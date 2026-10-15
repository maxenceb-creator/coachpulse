(function(global){
  const Data = global.TeamProfileData;
  const Filters = global.TeamProfileFilters;
  function n(value){ const out = Number(value); return Number.isFinite(out) ? out : 0; }
  function pct(value, total){ return total ? Math.round((value / total) * 100) : 0; }
  function sum(rows, getter){ return rows.reduce((total, row) => total + n(getter(row)), 0); }
  function matchDate(match){ return Data.dateOf(match); }
  function eventAction(row){ return String(row.action || row.type || row.eventType || row.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
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
      matchType:Filters.matchTypeOf(match),
      matchTypeLabel:Filters.matchTypeLabel(match),
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
  const EVENT_KEYS = Object.freeze({
    but:['but'],passe:['passe decisive','assist'],tirCadre:['tir cadre'],tirNonCadre:['tir non cadre'],centre:['centre'],
    progression:['progression'],entree20:['entree20','20m'],recup:['recup'],duelWon:['duel gagne'],duelLost:['duel perdu'],
    butAdv:['but'],tirCadreAdv:['tir cadre'],tirNonCadreAdv:['tir non cadre'],centreAdv:['centre'],progressionAdv:['progression'],
    entree20Adv:['entree20','20m'],recupAdv:['recup'],duelWonAdv:['duel gagne'],duelLostAdv:['duel perdu']
  });
  function nullableSum(rows, key){
    const values=rows.map(row=>row?.[key]).filter(value=>value!==''&&value!=null&&Number.isFinite(Number(value)));
    return values.length?values.reduce((total,value)=>total+Number(value),0):null;
  }
  function matchEvents(match, events){const id=match.matchId||match.id;return events.filter(row=>String(row.matchId||'')===String(id||''));}
  function provenanceUsesSnapshot(match,key,playerName=''){
    const rows=match.statsProvenance?.players||{};
    if(playerName)return ['MANUAL','CORRECTED'].includes(rows[playerName]?.[key]);
    return Object.values(rows).some(row=>['MANUAL','CORRECTED'].includes(row?.[key]));
  }
  function canonicalMetric(match, events, key, {opponent=false,playerName=''}={}){
    const scoped=matchEvents(match,events).filter(row=>isOpponent(row)===opponent).filter(row=>!playerName||row.player===playerName||row.playerName===playerName||row.playerId===match.players?.[playerName]?.playerId);
    const eventValue=scoped.filter(row=>actionMatches(row,EVENT_KEYS[key]||[key])).length;
    const manual=opponent?nullableSum([match.opp||match.opponent||{}],key):nullableSum(playerName?[match.players?.[playerName]||{}]:Object.values(match.players||{}),key);
    const source=match.statsSource||(match.entryMode==='LIVE'?'EVENTS':(match.entryMode?'MANUAL':''));
    if(source==='MANUAL')return manual;
    if(source==='EVENTS')return eventValue;
    if(provenanceUsesSnapshot(match,key,playerName))return manual;
    return eventValue>0?eventValue:manual;
  }
  function totalMetric(matches,events,key,options){
    const values=matches.map(match=>canonicalMetric(match,events,key,options)).filter(value=>value!=null);
    return values.length?values.reduce((total,value)=>total+value,0):null;
  }
  function collectiveStats(events=[],matches=[]){
    if(!matches.length){
      const synthetic={matchId:'__all__',entryMode:'LIVE',statsSource:'EVENTS'};
      events=events.map(row=>({...row,matchId:'__all__'}));matches=[synthetic];
    }
    const count=(key,options)=>totalMetric(matches,events,key,options);
    const teamEvents=events.filter(row=>!isOpponent(row)),advEvents=events.filter(isOpponent);
    const rawCount=(rows,keys)=>rows.filter(row=>actionMatches(row,keys)).length;
    const shotsOn=count('tirCadre');
    const shotsOff=count('tirNonCadre');
    const shots=shotsOn==null&&shotsOff==null?null:n(shotsOn)+n(shotsOff);
    const advShotsOn=count('tirCadreAdv',{opponent:true});
    const advShotsOff=count('tirNonCadreAdv',{opponent:true});
    const advShots=advShotsOn==null&&advShotsOff==null?null:n(advShotsOn)+n(advShotsOff);
    const goals=count('but');
    return {
      attack:{
        shots, shotsOn, shotsOff, shotAccuracy:shots==null?null:pct(shotsOn, shots), conversion:shots==null?null:pct(goals, shots),
        chances:rawCount(teamEvents,['occasion']), goals, assists:count('passe'), crosses:count('centre'), successfulCrosses:rawCount(teamEvents,['centre reussi']),
        entries20:count('entree20'), dribblesWon:count('duelWon'), progressions:count('progression'), turnovers:rawCount(teamEvents,['perte'])
      },
      defense:{
        advShots, advShotsOn, goalsAgainst:count('butAdv',{opponent:true}), saves:rawCount(teamEvents,['arret']), saveRate:advShotsOn==null?null:pct(rawCount(teamEvents,['arret']),advShotsOn), recoveries:count('recup'),
        defensiveDuelsWon:count('duelWon'), defensiveDuelsLost:count('duelLost'), interceptions:rawCount(teamEvents,['interception']), advEntries20:count('entree20Adv',{opponent:true})
      },
      domination:{
        shotRatio:advShots ? (n(shots) / advShots).toFixed(2) : (shots==null?null:String(shots)),
        entriesRatio:count('entree20Adv',{opponent:true})?(n(count('entree20'))/count('entree20Adv',{opponent:true})).toFixed(2):(count('entree20')==null?null:String(count('entree20'))),
        offensiveIndex:shots==null?null:pct(n(shotsOn)+n(count('entree20'))+n(goals),Math.max(1,n(shots)+n(count('entree20'))+n(goals))),
        intensity:teamEvents.length,
        performanceIndex:pct(n(goals)+n(shotsOn)+n(count('recup')),Math.max(1,teamEvents.length))
      }
    };
  }
  function xgStats(matches=[], events=[]){
    const usedEventIds=new Set();
    const canonical=(match,keys)=>{const aggregate=xgValue(match,keys);if(aggregate!=null)return aggregate;const rows=matchEvents(match,events);rows.forEach(row=>usedEventIds.add(row.eventId||row.id));const values=rows.map(row=>xgValue(row,keys)).filter(value=>value!=null);return values.length?values.reduce((a,b)=>a+b,0):null;};
    const team = matches.map(match=>canonical(match,['xg','xG','expectedGoals','xgFor'])).filter(value=>value!=null);
    const against = matches.map(match=>canonical(match,['xgAgainst','xGA','xgAdv','opponentXg'])).filter(value=>value!=null);
    events.filter(row=>!usedEventIds.has(row.eventId||row.id)&&!matches.some(match=>String(match.matchId||match.id)===String(row.matchId))).forEach(row=>{const value=xgValue(row,['xg','xG','expectedGoals','xgFor']);if(value!=null)team.push(value);const againstValue=xgValue(row,['xgAgainst','xGA','xgAdv','opponentXg']);if(againstValue!=null)against.push(againstValue);});
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
  function avg(values=[]){
    const numbers = values.map(value => Number(value || 0)).filter(Number.isFinite);
    return numbers.length ? numbers.reduce((total, value) => total + value, 0) / numbers.length : 0;
  }
  function attendanceStatus(row={}){
    const code = String(row.status || row.statut || row.presence || row.etat || '').trim().toLowerCase();
    if(['p','present','présent','presente','présente'].includes(code)) return 'present';
    if(['r','late','retard','en retard'].includes(code)) return 'late';
    if(['a','absent','absence'].includes(code)) return 'absent';
    if(['m','sick','malade'].includes(code)) return 'sick';
    if(['b','injured','blessé','blesse','blessée','blessee'].includes(code)) return 'injured';
    return code || 'absent';
  }
  function attendanceEventKey(row={}){
    return row.sessionId || row.eventId || row.id || `${row.date || ''}:${row.teamId || ''}`;
  }
  function attendanceAverages(attendance=[]){
    const rows = Array.isArray(attendance) ? attendance : [];
    const playerIds = new Set(rows.map(row => row.playerId).filter(Boolean));
    const eventMap = new Map();
    rows.forEach(row => {
      const key = attendanceEventKey(row);
      if(!key) return;
      const eventRows = eventMap.get(key) || [];
      eventRows.push(row);
      eventMap.set(key, eventRows);
    });
    const eventStats = [...eventMap.values()].map(eventRows => {
      const present = eventRows.filter(row => ['present','late'].includes(attendanceStatus(row))).length;
      const absent = eventRows.filter(row => attendanceStatus(row) === 'absent').length;
      const late = eventRows.filter(row => attendanceStatus(row) === 'late').length;
      const injured = eventRows.filter(row => attendanceStatus(row) === 'injured').length;
      const unavailable = eventRows.filter(row => ['sick','injured'].includes(attendanceStatus(row))).length;
      return {
        present,
        absent,
        late,
        injured,
        unavailable,
        total:eventRows.length,
        rate:eventRows.length ? present / eventRows.length : 0
      };
    });
    const totalMinutes = sum(rows, row => row.minutes || row.duration);
    return {
      events:eventMap.size,
      playerCount:playerIds.size,
      presenceAvgRate:Math.round(avg(eventStats.map(stat => stat.rate)) * 100),
      minutesAvgPerPlayer:playerIds.size ? Math.round(totalMinutes / playerIds.size) : 0,
      presentAvgPerEvent:Math.round(avg(eventStats.map(stat => stat.present))),
      absentAvgPerEvent:Math.round(avg(eventStats.map(stat => stat.absent))),
      lateAvgPerEvent:Math.round(avg(eventStats.map(stat => stat.late))),
      unavailableAvgPerEvent:Math.round(avg(eventStats.map(stat => stat.unavailable))),
      injuredAvgPerEvent:Math.round(avg(eventStats.map(stat => stat.injured)))
    };
  }
  function squad(players=[], attendance=[], events=[], matches=[]){
    return players.map(player => {
      const playerId = player.playerId || player.id;
      const rows = attendance.filter(row => row.playerId === playerId);
      const ev = events.filter(row => row.playerId === playerId);
      const minutes = sum(rows, row => row.minutes || row.duration);
      const names=[player.name,player.displayName,player.playerName].filter(Boolean);
      const relevant=matches.filter(match=>names.some(name=>match.players?.[name])||Object.values(match.players||{}).some(row=>row?.playerId===playerId));
      const playerNameFor=match=>names.find(name=>match.players?.[name])||Object.keys(match.players||{}).find(name=>match.players[name]?.playerId===playerId)||'';
      const metric=key=>{const values=relevant.map(match=>canonicalMetric(match,events,key,{playerName:playerNameFor(match)})).filter(value=>value!=null);return values.length?values.reduce((a,b)=>a+b,0):null;};
      const goals = relevant.length?metric('but'):ev.filter(row => actionMatches(row, ['but'])).length;
      const assists = relevant.length?metric('passe'):ev.filter(row => actionMatches(row, ['passe decisive', 'assist'])).length;
      const shotsOn=relevant.length?metric('tirCadre'):ev.filter(row => actionMatches(row, ['tir cadre'])).length;
      const shotsOff=relevant.length?metric('tirNonCadre'):ev.filter(row => actionMatches(row, ['tir non cadre'])).length;
      return {player, playerId, minutes, appearances:rows.length, goals, assists, shots:shotsOn==null&&shotsOff==null?null:n(shotsOn)+n(shotsOff)};
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
    const matchFilterActive = !!(state.filters.matchType || state.filters.competition || state.filters.venue || state.filters.result || state.filters.opponent);
    const players = (collections.players || []).map(player => Data.playerForSeason(player, period.season || Data.currentSeason())).filter(player => !team?.teamId || Data.rowMatchesTeam(player, team.teamId));
    const events = Filters.filterRows(collections.matchEvents || [], state).filter(row => {
      if(matchFilterActive) return matchIds.has(row.matchId);
      return !matchIds.size || matchIds.has(row.matchId) || Data.rowMatchesTeam(row, team?.teamId);
    });
    const sessions = Filters.filterRows(collections.sessions || [], state);
    const attendance = Filters.filterRows(collections.attendance || [], state);
    const technicalTests = Filters.filterRows(collections.technicalTests || [], state);
    const physicalTests = Filters.filterRows(collections.physicalTests || [], state);
    const injuries = Filters.filterRows(collections.injuries || [], state);
    const stats = collectiveStats(events, periodMatches);
    const attendanceStats = attendanceAverages(attendance);
    const kpis = {
      ...computeKpis(periodMatches),
      sessions:sessions.length,
      attendance:attendance.length,
      attendanceEvents:attendanceStats.events,
      presenceAvgRate:attendanceStats.presenceAvgRate,
      attendanceAvgMinutesPerPlayer:attendanceStats.minutesAvgPerPlayer,
      presentAvgPerEvent:attendanceStats.presentAvgPerEvent,
      absentAvgPerEvent:attendanceStats.absentAvgPerEvent,
      lateAvgPerEvent:attendanceStats.lateAvgPerEvent,
      unavailableAvgPerEvent:attendanceStats.unavailableAvgPerEvent,
      injuredAvgPerEvent:attendanceStats.injuredAvgPerEvent
    };
    const xg = xgStats(periodMatches, events);
    return {
      team, period, matches:periodMatches, events, players, sessions, attendance, technicalTests, physicalTests, injuries,
      kpis, stats, xg,
      squad:squad(players, attendance, events, periodMatches),
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
  global.TeamProfileMetrics = {n, pct, normalizeMatch, computeKpis, collectiveStats, xgStats, heatmap, attendanceAverages, summarize};
})(window);
