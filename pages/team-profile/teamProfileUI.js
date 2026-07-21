(function(global){
  const Data = global.TeamProfileData;
  const Filters = global.TeamProfileFilters;
  const Charts = global.TeamProfileCharts;
  function esc(value){ return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function option(value, label, selected){ return `<option value="${esc(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${esc(label || value)}</option>`; }
  function renderControls(state){
    const competitions = [...new Set((state.collections?.matches || []).map(match => match.competition || match.championnat).filter(Boolean))].sort();
    const opponents = state.filters.opponent || '';
    return `<section class="team-controls">
      <div class="field"><label>Équipe</label><select id="teamSelect">${state.teams.map(team => option(Data.teamIdOf(team), Data.teamName(team), state.selectedTeamId)).join('')}</select></div>
      <div class="field"><label>Période</label><select id="periodMode">${option('season','Saison',state.filters.periodMode)}${option('all','Toutes saisons',state.filters.periodMode)}${option('custom','Période personnalisée',state.filters.periodMode)}</select></div>
      <div class="field"><label>Saison</label><select id="seasonSelect">${state.seasons.map(season => option(season, season, state.filters.season)).join('')}</select></div>
      <div class="field"><label>Début</label><input id="startDate" type="date" value="${esc(state.filters.startDate || '')}"></div>
      <div class="field"><label>Fin</label><input id="endDate" type="date" value="${esc(state.filters.endDate || '')}"></div>
      <div class="field"><label>Compétition</label><select id="competitionFilter">${option('','Toutes',state.filters.competition)}${competitions.map(c => option(c,c,state.filters.competition)).join('')}</select></div>
      <div class="field"><label>Lieu</label><select id="venueFilter">${option('','Tous',state.filters.venue)}${option('home','Domicile',state.filters.venue)}${option('away','Extérieur',state.filters.venue)}</select></div>
      <div class="field"><label>Résultat</label><select id="resultFilter">${option('','Tous',state.filters.result)}${option('win','Victoire',state.filters.result)}${option('draw','Nul',state.filters.result)}${option('loss','Défaite',state.filters.result)}</select></div>
      <div class="field"><label>Adversaire</label><input id="opponentFilter" value="${esc(opponents)}" placeholder="Filtrer..."></div>
    </section>`;
  }
  function renderTabs(state){
    const tabs = [['overview','Synthèse'],['results','Résultats'],['stats','Stats collectives'],['squad','Effectif'],['heatmaps','Heatmaps'],['analysis','Analyse']];
    return `<nav class="team-tabs">${tabs.map(([id,label]) => `<button class="tab ${state.view === id ? 'active' : ''}" data-view="${id}">${esc(label)}</button>`).join('')}</nav>`;
  }
  function renderHeader(summary){
    const team = summary.team || {};
    const staff = [team.coach, team.staff, team.responsable].flat().filter(Boolean).join(' · ') || 'Staff non renseigné';
    const lastMatch = summary.matches.slice().reverse()[0];
    const nextMatch = (summary.collections?.matches || []).find(match => Data.dateOf(match) > new Date().toISOString().slice(0,10));
    return `<section class="team-hero">
      <div class="team-badge">${team.logo ? `<img src="${esc(team.logo)}" alt="">` : '🛡️'}</div>
      <div>
        <p class="eyebrow">Fiche équipe par teamId</p>
        <h1>${esc(Data.teamName(team))}</h1>
        <div class="hero-pills">
          <span>teamId <b>${esc(team.teamId || team.id || '-')}</b></span>
          <span>Catégorie <b>${esc(team.category || team.categorie || '-')}</b></span>
          <span>Sous-cat. <b>${esc((team.subCategories || []).join(', ') || '-')}</b></span>
          <span>Saison <b>${esc(summary.period.label)}</b></span>
        </div>
        <p class="team-staff">${esc(staff)}</p>
      </div>
      <div class="hero-facts">
        <span><b>${summary.players.length}</b> joueuses</span>
        <span><b>${summary.kpis.played}</b> matchs joués</span>
        <span><b>${esc(lastMatch?.date || '-')}</b> dernier match</span>
        <span><b>${esc(nextMatch ? Data.dateOf(nextMatch) : '-')}</b> prochain match</span>
      </div>
    </section>`;
  }
  function renderKpis(kpis){
    const items = [
      ['Matchs', kpis.played], ['Victoires', kpis.wins], ['Nuls', kpis.draws], ['Défaites', kpis.losses],
      ['Taux victoire', `${kpis.winRate}%`], ['Sans défaite', `${kpis.unbeatenRate}%`], ['Pts / match', kpis.pointsPerMatch],
      ['Buts pour', kpis.goalsFor], ['Buts contre', kpis.goalsAgainst], ['Diff.', kpis.goalDiff],
      ['Clean sheets', kpis.cleanSheets], ['Série', kpis.currentSeries]
    ];
    return `<section class="team-kpis">${items.map(([label,value]) => `<article><span>${esc(label)}</span><b>${esc(value)}</b></article>`).join('')}</section>`;
  }
  function table(headers=[], rows=[], empty='Aucune donnée disponible.'){
    if(!rows.length) return `<div class="empty-state">${esc(empty)}</div>`;
    return `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  }
  function renderOverview(summary){
    const donut = Charts.donut([
      {label:'V', value:summary.kpis.wins, color:'#1d995b'},
      {label:'N', value:summary.kpis.draws, color:'#cdb789'},
      {label:'D', value:summary.kpis.losses, color:'#dc2626'}
    ], `${summary.kpis.played} matchs`);
    return `<section class="team-grid two">
      <article class="panel"><h2>Anneau des résultats</h2>${donut}<div class="legend"><span>Victoire</span><span>Nul</span><span>Défaite</span></div></article>
      <article class="panel"><h2>Évolution buts</h2>${Charts.sparkline(summary.matches.map(m => m.goalDiff), '#1d995b')}<p class="notice">Différence de buts match par match.</p></article>
      <article class="panel wide"><h2>Résumé automatique</h2>${renderAutoSummary(summary.autoSummary)}</article>
    </section>`;
  }
  function renderAutoSummary(auto){
    return `<div class="auto-summary">
      <div><h3>Points forts</h3>${list(auto.strengths, 'Aucun point fort statistique isolé.')}</div>
      <div><h3>Points faibles</h3>${list(auto.weaknesses, 'Aucun point faible statistique isolé.')}</div>
      <div><h3>Tendance</h3><p>${esc(auto.trend)}</p></div>
      <div><h3>Priorités</h3>${list(auto.priorities, 'Priorités à préciser avec plus de données.')}</div>
    </div>`;
  }
  function list(items=[], empty){ return items.length ? `<ul>${items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : `<p>${esc(empty)}</p>`; }
  function renderResults(summary){
    return `<section class="team-grid">
      <article class="panel wide"><h2>Historique des matchs</h2>${table(['Date','Adversaire','Lieu','Compétition','Score','Résultat','Système'], summary.matches.map(m => `<tr><td>${esc(m.date || '-')}</td><td>${esc(m.opponent)}</td><td>${m.venue === 'home' ? 'Domicile' : 'Extérieur'}</td><td>${esc(m.competition)}</td><td><b>${m.goalsFor}-${m.goalsAgainst}</b></td><td><span class="result ${m.resultCode}">${esc(m.resultLabel)}</span></td><td>${esc(m.system || '-')}</td></tr>`), 'Aucun match sur cette période.')}</article>
      <article class="panel"><h2>Séries</h2><div class="mini-kpis"><span><b>${esc(summary.kpis.biggestWin)}</b>Plus large victoire</span><span><b>${esc(summary.kpis.biggestLoss)}</b>Plus large défaite</span><span><b>${esc(summary.kpis.bestWinSeries)}</b>Meilleure série V</span><span><b>${esc(summary.kpis.bestUnbeatenSeries)}</b>Série sans défaite</span></div></article>
      <article class="panel"><h2>Domicile / extérieur</h2><div class="mini-kpis"><span><b>${esc(summary.kpis.home)}</b>Domicile</span><span><b>${esc(summary.kpis.away)}</b>Extérieur</span></div></article>
    </section>`;
  }
  function renderStats(summary){
    const a = summary.stats.attack, d = summary.stats.defense, dom = summary.stats.domination;
    return `<section class="team-grid three">
      ${statPanel('Attaque', [['Tirs',a.shots],['Cadrés',a.shotsOn],['Précision',a.shotAccuracy+'%'],['Conversion',a.conversion+'%'],['Buts',a.goals],['Entrées 20m',a.entries20],['Progressions',a.progressions],['Pertes',a.turnovers]])}
      ${statPanel('Défense', [['Tirs adv.',d.advShots],['Cadrés adv.',d.advShotsOn],['Buts encaissés',d.goalsAgainst],['Arrêts',d.saves],['Taux arrêts',d.saveRate+'%'],['Récupérations',d.recoveries],['Interceptions',d.interceptions],['Entrées adv.',d.advEntries20]])}
      ${statPanel('Maîtrise', [['Rapport tirs',dom.shotRatio],['Rapport entrées',dom.entriesRatio],['Indice offensif',dom.offensiveIndex+'%'],['Intensité',dom.intensity],['Indice global',dom.performanceIndex+'%']])}
      <article class="panel wide"><h2>Expected Goals</h2>${renderXg(summary.xg)}</article>
    </section>`;
  }
  function statPanel(title, rows){ return `<article class="panel"><h2>${esc(title)}</h2><div class="stat-list">${rows.map(([label,value]) => `<span><b>${esc(value)}</b>${esc(label)}</span>`).join('')}</div></article>`; }
  function renderXg(xg){
    if(!xg.available) return `<div class="empty-state">${esc(xg.message)}</div>`;
    return `<div class="stat-list xg-list"><span><b>${xg.xg.toFixed(2)}</b>xG équipe</span><span><b>${xg.xgAgainst.toFixed(2)}</b>xG adverse</span><span><b>${xg.diff.toFixed(2)}</b>Diff. xG</span><span><b>${xg.xgAvg.toFixed(2)}</b>xG / match</span><span><b>${xg.xgAgainstAvg.toFixed(2)}</b>xGA / match</span></div>`;
  }
  function renderSquad(summary){
    return `<section class="team-grid"><article class="panel wide"><h2>Effectif</h2>${table(['Joueuse','App.','Minutes','Buts','Passes','Tirs','Fiche'], summary.squad.map(row => `<tr><td>${esc(Data.displayPlayerName(row.player))}</td><td>${row.appearances}</td><td>${row.minutes}</td><td>${row.goals}</td><td>${row.assists}</td><td>${row.shots}</td><td><button class="mini-btn" data-player-id="${esc(row.playerId)}">Ouvrir</button></td></tr>`), 'Aucune joueuse liée à cette équipe sur la période.')}</article></section>`;
  }
  function renderHeatmaps(summary){
    return `<section class="team-grid three">
      ${heatPanel('Actions offensives', summary.heatmaps.offensive)}
      ${heatPanel('Tirs', summary.heatmaps.shots)}
      ${heatPanel('Buts', summary.heatmaps.goals)}
      ${heatPanel('Récupérations', summary.heatmaps.recoveries)}
      ${heatPanel('Pertes de balle', summary.heatmaps.turnovers)}
      ${heatPanel('Actions adverses', summary.heatmaps.opponent)}
    </section>`;
  }
  function heatPanel(title, zones){ return `<article class="panel"><h2>${esc(title)}</h2>${Charts.heatmap(zones)}<p class="notice">Terrain horizontal CoachPulse : 3-6-9 en haut, 1-4-7 en bas.</p></article>`; }
  function renderAnalysis(summary){
    return `<section class="team-grid two">
      <article class="panel">${renderAutoSummary(summary.autoSummary)}</article>
      <article class="panel"><h2>Qualité des données</h2><div class="mini-kpis"><span><b>${summary.dataQuality.orphanEvents}</b>Données orphelines</span><span><b>${summary.dataQuality.partialMatches}</b>Matchs partiels</span><span><b>${summary.technicalTests.length}</b>Tests techniques</span><span><b>${summary.physicalTests.length}</b>Tests athlétiques</span><span><b>${summary.injuries.length}</b>Blessures</span></div></article>
    </section>`;
  }
  function renderBody(summary, state){
    if(state.view === 'results') return renderResults(summary);
    if(state.view === 'stats') return renderStats(summary);
    if(state.view === 'squad') return renderSquad(summary);
    if(state.view === 'heatmaps') return renderHeatmaps(summary);
    if(state.view === 'analysis') return renderAnalysis(summary);
    return renderOverview(summary);
  }
  global.TeamProfileUI = {esc, renderControls, renderTabs, renderHeader, renderKpis, renderBody};
})(window);
