(function(global){
  const Data = global.TeamProfileData;
  const Filters = global.TeamProfileFilters;
  function n(value){ const out = Number(value); return Number.isFinite(out) ? out : 0; }
  function pct(value, total){ return total ? Math.round((value / total) * 100) : 0; }
  function sum(rows, getter){ return rows.reduce((total, row) => total + n(getter(row)), 0); }
  function matchDate(match){ return Data.dateOf(match); }
  function eventAction(row){ return String(row.action || row.type || row.eventType || row.name || '').toLowerCase(); }
  function isOpponent(row){ return /adv|adverse|opponent|contre/.test(String(row.side || row.teamSide || row.owner || row.sourceSide || '').toLowerCase()) || row.isOpponent === true; }
  function actionMatches(row, keys=[]){ const action = eventAction(row); return keys.some(key => action.includes(key)); }
  function xgValue(row={}, keys=[]){
    for(const key of keys){
      const value = row[key] ?? row.stats?.[key] ?? row.metrics?.[key];
      if(value !== '' && value != null && Number.isFinite(Number(value))) return Number(value);
    }
    return null;
  }
  function normalizeMatch(match={}){
    const score = Filters.scoreOf(match);
    const result = Filters.resultOf(match);
    return {
      ...match,
      date:matchDate(match),
      opponent:match.opponent || match.adversaire || 'Adversaire non renseigné',
      competition:match.competition || match.championnat || 'Non renseignée',
      venue:Filters.venueOf(match),
      resultCode:result.code,
      resultLabel:result.label,
      goalsFor:score.forGoals,
      goalsAgainst:score.againstGoals,
      goalDiff:score.forGoals - score.againstGoals,
      duration:n(match.duration || match.duree || match.minutes || 0),
      system:match.system || match.dispositif || match.formation || ''
    };
  }
  function finishedMatches(matches=[]){ return matches.filter(match => ['win','draw','loss'].includes(match.resultCode)); }
  function series(matches=[]){
    const ordered = finishedMatches(matches).slice().sort((a,b) => a.date.localeCompare(b.date));
    let current = [], bestWins = 0, bestUnbeaten = 0, winRun = 0, unbeatenRun = 0;
    ordered.forEach(match => {
      if(match.resultCode === 'win') winRun += 1; else winRun = 0;
      if(match.resultCode !== 'loss') unbeatenRun += 1; else unbeatenRun = 0;
      bestWins = Math.max(bestWins, winRun);
      bestUnbeaten = Math.max(bestUnbeaten, unbeatenRun);
    });
    for(let i = ordered.length - 1; i >= 0; i -= 1){
      if(!current.length || ordered[i].resultCode === current[0].resultCode) current.unshift(ordered[i]);
      else break;
    }
    return {
      current:current.length ? `${current.length} ${current[0].resultLabel.toLowerCase()}${current.length > 1 ? 's' : ''}` : '-',
      bestWins,
      bestUnbeaten
    };
  }
  function scoreExtreme(matches=[], direction='win'){
    const candidates = finishedMatches(matches).filter(match => direction === 'win' ? match.goalDiff > 0 : match.goalDiff < 0);
    if(!candidates.length) return '-';
    const sorted = candidates.sort((a,b) => direction === 'win' ? b.goalDiff - a.goalDiff : a.goalDiff - b.goalDiff);
    const m = sorted[0];
    return `${m.goalsFor}-${m.goalsAgainst} vs ${m.opponent}`;
  }
  function computeKpis(matches=[]){
    const played = finishedMatches(matches);
    const wins = played.filter(m => m.resultCode === 'win').length;
    const draws = played.filter(m => m.resultCode === 'draw').length;
    const losses = played.filter(m => m.resultCode === 'loss').length;
    const gf = sum(played, m => m.goalsFor);
    const ga = sum(played, m => m.goalsAgainst);
    const home = played.filter(m => m.venue === 'home');
    const away = played.filter(m => m.venue === 'away');
    const streak = series(played);
    return {
      played:played.length,
      wins, draws, losses,
      winRate:pct(wins, played.length),
      unbeatenRate:pct(wins + draws, played.length),
      pointsPerMatch:played.length ? ((wins * 3 + draws) / played.length).toFixed(2) : '0.00',
      goalsFor:gf,
      goalsAgainst:ga,
      goalDiff:gf - ga,
      goalsForAvg:played.length ? (gf / played.length).toFixed(2) : '0.00',
      goalsAgainstAvg:played.length ? (ga / played.length).toFixed(2) : '0.00',
      cleanSheets:played.filter(m => m.goalsAgainst === 0).length,
      biggestWin:scoreExtreme(played, 'win'),
      biggestLoss:scoreExtreme(played, 'loss'),
      currentSeries:streak.current,
      bestWinSeries:streak.bestWins,
      bestUnbeatenSeries:streak.bestUnbeaten,
      home:`${home.filter(m => m.resultCode === 'win').length}V ${home.filter(m => m.resultCode === 'draw').length}N ${home.filter(m => m.resultCode === 'loss').length}D`,
      away:`${away.filter(m => m.resultCode === 'win').length}V ${away.filter(m => m.resultCode === 'draw').length}N ${away.filter(m => m.resultCode === 'loss').length}D`
    };
  }
  function collectiveStats(events=[]){
    const teamEvents = events.filter(row => !isOpponent(row));
    const advEvents = events.filter(isOpponent);
    const count = (rows, keys) => rows.filter(row => actionMatches(row, keys)).length;
    const shots = count(teamEvents, ['tir']);
    const shotsOn = count(teamEvents, ['cadr']);
    const advShots = count(advEvents, ['tir']);
    const advShotsOn = count(advEvents, ['cadr']);
    const goals = count(teamEvents, ['but']);
    return {
      attack:{
        shots, shotsOn, shotsOff:Math.max(0, shots - shotsOn), shotAccuracy:pct(shotsOn, shots), conversion:pct(goals, shots),
        chances:count(teamEvents, ['occasion']), goals, assists:count(teamEvents, ['passe decisive', 'assist']),
        crosses:count(teamEvents, ['centre']), successfulCrosses:count(teamEvents, ['centre reussi']),
        entries20:count(teamEvents, ['entree20', '20m']), dribblesWon:count(teamEvents, ['1v1', 'duel gagne']),
        progressions:count(teamEvents, ['progression']), turnovers:count(teamEvents, ['perte'])
      },
      defense:{
        advShots, advShotsOn, goalsAgainst:count(advEvents, ['but']), saves:count(teamEvents, ['arret']),
        saveRate:pct(count(teamEvents, ['arret']), advShotsOn), recoveries:count(teamEvents, ['recup']),
        defensiveDuelsWon:count(teamEvents, ['duel defensif gagne']), defensiveDuelsLost:count(teamEvents, ['duel defensif perdu']),
        interceptions:count(teamEvents, ['interception']), advEntries20:count(advEvents, ['entree20', '20m'])
      },
      domination:{
        shotRatio:advShots ? (shots / advShots).toFixed(2) : String(shots),
        entriesRatio:count(advEvents, ['entree20', '20m']) ? (count(teamEvents, ['entree20', '20m']) / count(advEvents, ['entree20', '20m'])).toFixed(2) : String(count(teamEvents, ['entree20', '20m'])),
        offensiveIndex:pct(shotsOn + count(teamEvents, ['entree20', '20m']) + goals, Math.max(1, shots + count(teamEvents, ['entree20', '20m']) + goals)),
        intensity:teamEvents.length,
        performanceIndex:pct(goals + shotsOn + count(teamEvents, ['recup']), Math.max(1, teamEvents.length))
      }
    };
  }
  function xgStats(matches=[], events=[]){
    const rows = [...matches, ...events];
    const team = rows.map(row => xgValue(row, ['xg','xG','expectedGoals','xgFor'])).filter(value => value != null);
    const against = rows.map(row => xgValue(row, ['xgAgainst','xGA','xgAdv','opponentXg'])).filter(value => value != null);
    if(!team.length && !against.length) return {available:false, message:'Données xG insuffisantes'};
    const teamTotal = team.reduce((a,b) => a + b, 0);
    const againstTotal = against.reduce((a,b) => a + b, 0);
    const played = Math.max(1, finishedMatches(matches).length);
    const goalsFor = sum(finishedMatches(matches), m => m.goalsFor);
    const goalsAgainst = sum(finishedMatches(matches), m => m.goalsAgainst);
    return {
      available:true,
      xg:teamTotal,
      xgAgainst:againstTotal,
      diff:teamTotal - againstTotal,
      xgAvg:teamTotal / played,
      xgAgainstAvg:againstTotal / played,
      offensiveEfficiency:teamTotal ? goalsFor / teamTotal : null,
      defensiveEfficiency:againstTotal ? goalsAgainst / againstTotal : null
    };
  }
  function heatmap(events=[], predicate=()=>true){
    const zones = {1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0};
    events.filter(predicate).forEach(row => {
      const zone = Number(String(row.zone || row.zoneId || row.pitchZone || '').match(/[1-9]/)?.[0] || 0);
      if(zones[zone] != null) zones[zone] += 1;
    });
    return zones;
  }
  function squad(players=[], attendance=[], events=[]){
    return players.map(player => {
      const playerId = player.playerId || player.id;
      const rows = attendance.filter(row => row.playerId === playerId);
      const ev = events.filter(row => row.playerId === playerId);
      const minutes = sum(rows, row => row.minutes || row.duration);
      const goals = ev.filter(row => actionMatches(row, ['but'])).length;
      const assists = ev.filter(row => actionMatches(row, ['passe decisive', 'assist'])).length;
      return {player, playerId, minutes, appearances:rows.length, goals, assists, shots:ev.filter(row => actionMatches(row, ['tir'])).length};
    }).sort((a,b) => b.minutes - a.minutes || b.goals - a.goals);
  }
  function autoSummary(kpis, stats, xg){
    const notes = [];
    if(kpis.played === 0) return {strengths:[], weaknesses:['Aucun match terminé sur la période'], trend:'Données résultats insuffisantes', priorities:['Renseigner ou importer les matchs de la saison']};
    if(kpis.winRate >= 60) notes.push({type:'strengths', text:`Taux de victoire élevé (${kpis.winRate}%).`});
    if(kpis.goalsAgainstAvg <= 1) notes.push({type:'strengths', text:`Solidité défensive forte (${kpis.goalsAgainstAvg} but encaissé/match).`});
    if(kpis.goalsForAvg >= 2) notes.push({type:'strengths', text:`Production offensive intéressante (${kpis.goalsForAvg} buts/match).`});
    if(kpis.winRate < 35) notes.push({type:'weaknesses', text:`Taux de victoire bas (${kpis.winRate}%).`});
    if(kpis.goalsAgainstAvg > 2) notes.push({type:'weaknesses', text:`Trop de buts encaissés (${kpis.goalsAgainstAvg}/match).`});
    if(stats.attack.shotAccuracy && stats.attack.shotAccuracy < 35) notes.push({type:'weaknesses', text:`Précision des tirs à améliorer (${stats.attack.shotAccuracy}% cadrés).`});
    if(xg.available && xg.offensiveEfficiency != null && xg.offensiveEfficiency < .8) notes.push({type:'weaknesses', text:'Efficacité offensive inférieure aux xG disponibles.'});
    return {
      strengths:notes.filter(n => n.type === 'strengths').map(n => n.text).slice(0,3),
      weaknesses:notes.filter(n => n.type === 'weaknesses').map(n => n.text).slice(0,3),
      trend:`Série actuelle : ${kpis.currentSeries}`,
      priorities:notes.filter(n => n.type === 'weaknesses').map(n => n.text.replace(/\.$/, '')).slice(0,3)
    };
  }
  function summarize(team, collections, state){
    const periodMatches = Filters.filterMatches((collections.matches || []).map(normalizeMatch), state).sort((a,b) => a.date.localeCompare(b.date));
    const period = Filters.periodFromState(state);
    const matchIds = new Set(periodMatches.map(match => match.matchId || match.id).filter(Boolean));
    const players = (collections.players || []).map(player => Data.playerForSeason(player, period.season || Data.currentSeason())).filter(player => !team?.teamId || Data.rowMatchesTeam(player, team.teamId));
    const events = Filters.filterRows(collections.matchEvents || [], state).filter(row => !matchIds.size || matchIds.has(row.matchId) || Data.rowMatchesTeam(row, team?.teamId));
    const attendance = Filters.filterRows(collections.attendance || [], state);
    const technicalTests = Filters.filterRows(collections.technicalTests || [], state);
    const physicalTests = Filters.filterRows(collections.physicalTests || [], state);
    const injuries = Filters.filterRows(collections.injuries || [], state);
    const stats = collectiveStats(events);
    const kpis = computeKpis(periodMatches);
    const xg = xgStats(periodMatches, events);
    return {
      team, period, matches:periodMatches, events, players, attendance, technicalTests, physicalTests, injuries,
      kpis, stats, xg,
      squad:squad(players, attendance, events),
      heatmaps:{
        offensive:heatmap(events, row => !isOpponent(row)),
        shots:heatmap(events, row => !isOpponent(row) && actionMatches(row, ['tir'])),
        goals:heatmap(events, row => !isOpponent(row) && actionMatches(row, ['but'])),
        recoveries:heatmap(events, row => !isOpponent(row) && actionMatches(row, ['recup'])),
        turnovers:heatmap(events, row => !isOpponent(row) && actionMatches(row, ['perte'])),
        entries20:heatmap(events, row => !isOpponent(row) && actionMatches(row, ['entree20','20m'])),
        opponent:heatmap(events, isOpponent)
      },
      autoSummary:autoSummary(kpis, stats, xg),
      dataQuality:{
        orphanEvents:(collections.matchEvents || []).filter(row => !row.teamId && !row.matchId).length,
        partialMatches:periodMatches.filter(match => !match.score && match.goalsFor === 0 && match.goalsAgainst === 0).length
      }
    };
  }
  global.TeamProfileMetrics = {n, pct, normalizeMatch, computeKpis, collectiveStats, xgStats, heatmap, summarize};
})(window);
