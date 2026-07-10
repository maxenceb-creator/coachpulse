(function(global){
  const Data = global.PlayerProfileData;
  const Filters = global.PlayerProfileFilters;
  function esc(value){ return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function option(value, label, selected){ return `<option value="${esc(value)}" ${String(value) === String(selected) ? 'selected' : ''}>${esc(label || value)}</option>`; }
  function filteredPlayers(state){
    const team = state.filters.team || '';
    const displaySeason = state.filters.periodMode === 'season' ? state.filters.season : Data.currentSeason();
    return state.players
      .map(player => Data.playerForSeason(player, displaySeason))
      .filter(player => !team || Data.teamLabel(player) === team)
      .slice()
      .sort((a,b) => Data.displayName(a).localeCompare(Data.displayName(b), 'fr'));
  }
  function renderControls(state){
    const displaySeason = state.filters.periodMode === 'season' ? state.filters.season : Data.currentSeason();
    const teams = [...new Set(state.players.map(player => Data.teamLabel(Data.playerForSeason(player, displaySeason))).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'fr'));
    const players = filteredPlayers(state);
    const seasons = state.seasons;
    const selected = state.selectedPlayerId || players[0]?.playerId || '';
    return `<section class="hero">
      <div class="identity" id="identityCard"></div>
      <div class="filters">
        <h2>Filtres de fiche</h2>
        <div class="filter-grid">
          <div class="field"><label>Équipe</label><select id="teamFilter">${option('','Toutes',state.filters.team || '')}${teams.map(team => option(team, team, state.filters.team || '')).join('')}</select></div>
          <div class="field"><label>Joueuse</label><select id="playerSelect">${players.map(p => option(p.playerId, Data.displayName(p), selected)).join('')}</select></div>
          <div class="field"><label>Période</label><select id="periodMode">${option('season','Saison',state.filters.periodMode)}${option('all','Toutes saisons',state.filters.periodMode)}${option('custom','Période personnalisée',state.filters.periodMode)}</select></div>
          <div class="field"><label>Saison</label><select id="seasonSelect">${seasons.map(s => option(s,s,state.filters.season)).join('')}</select></div>
          <div class="field"><label>Début</label><input id="startDate" type="date" value="${esc(state.filters.startDate || '')}"></div>
          <div class="field"><label>Fin</label><input id="endDate" type="date" value="${esc(state.filters.endDate || '')}"></div>
        </div>
        <div class="tabs">
          <button class="tab active" data-view="overview">Synthèse</button>
          <button class="tab" data-view="timeline">Historique</button>
          <button class="tab" data-view="seasonCompare">Comparer saisons</button>
          <button class="tab" data-view="playerCompare">Comparer joueuses</button>
        </div>
      </div>
    </section>`;
  }
  function renderIdentity(player={}, period){
    const photo = player.photo || player.avatar || player.photoUrl || '';
    const initials = Data.displayName(player).split(/\s+/).map(x => x[0]).join('').slice(0,2) || '?';
    return `<div class="avatar">${photo ? `<img src="${esc(photo)}" alt="">` : esc(initials)}</div><div><h1>${esc(Data.displayName(player) || 'Joueuse')}</h1><div class="chips">
      <span class="chip">${esc(player.categorie || player.category || 'Catégorie non renseignée')}</span>
      <span class="chip">${esc(player.subCategory || player.sousCategorie || 'Sous-catégorie non renseignée')}</span>
      <span class="chip">${esc(player.poste || player.position || 'Poste non renseigné')}</span>
      <span class="chip">playerId ${esc(player.playerId || player.id || '-')}</span>
      <span class="chip">${esc(period.label)}</span>
    </div><p class="notice">Les données affichées sont lues depuis la base commune et reliées par playerId.</p></div>`;
  }
  function renderKpis(summary){
    const items = [
      ['Présence', `${summary.kpis.presenceRate}%`],
      ['Séances', summary.kpis.sessions],
      ['Charge', `${summary.kpis.minutes} min`],
      ['Matchs', summary.kpis.matches],
      ['Blessures', summary.kpis.injuries],
      ['Suivi médical', summary.kpis.medical]
    ];
    return `<section class="kpis">${items.map(([label,value]) => `<article class="kpi"><span>${esc(label)}</span><b>${esc(value)}</b></article>`).join('')}</section>`;
  }
  function bar(label, value, max, suffix=''){
    const pct = max ? Math.min(100, Math.round(value / max * 100)) : 0;
    return `<div class="bar-row"><b>${esc(label)}</b><div class="bar-bg"><div class="bar-fill" style="width:${pct}%"></div></div><span>${esc(value)}${esc(suffix)}</span></div>`;
  }
  function renderOverview(summary){
    const actionMax = Math.max(1, ...Object.values(summary.actions));
    const linkedLabels = {
      presences:'Présences',
      seances:'Séances',
      matchs:'Actions match',
      testsTechniques:'Tests techniques',
      testsAthletiques:'Tests athlétiques',
      blessures:'Blessures',
      suiviMedical:'Suivi médical',
      convocations:'Convocations',
      bilansIndividuels:'Bilans'
    };
    return `<section class="grid">
      <article class="panel"><h2>Informations générales</h2><div class="chips"><span class="chip">Dernière VMI ${esc(summary.latest.vmi || '-')}</span><span class="chip">Dernier CMJ ${esc(summary.latest.cmj || '-')}</span><span class="chip">Tests techniques ${esc(summary.technicalTests.length)}</span><span class="chip">Tests athlétiques ${esc(summary.physicalTests.length)}</span></div></article>
      <article class="panel"><h2>Données reliées au playerId</h2><div class="chips">${Object.entries(summary.linkedCounts || {}).map(([key,value]) => `<span class="chip">${esc(linkedLabels[key] || key)} ${esc(value)}</span>`).join('')}</div></article>
      <article class="panel"><h2>Statistiques de match</h2><div class="bar-list">${Object.keys(summary.actions).length ? Object.entries(summary.actions).map(([k,v]) => bar(k,v,actionMax)).join('') : '<div class="empty-state">Aucune statistique match sur cette période.</div>'}</div></article>
      <article class="panel"><h2>Tests techniques</h2>${summary.technicalTests.length ? renderTechnicalTests(summary.technicalTests) : '<div class="empty-state">Aucun test technique sur cette période.</div>'}</article>
      <article class="panel"><h2>Tests athlétiques</h2>${summary.physicalTests.length ? renderEvents(summary.physicalTests,'source','tests') : '<div class="empty-state">Aucun test athlétique sur cette période.</div>'}</article>
      <article class="panel"><h2>Blessures</h2>${summary.injuries.length ? renderEvents(summary.injuries,'injuryType','status') : '<div class="empty-state">Aucune blessure sur cette période.</div>'}</article>
      <article class="panel"><h2>Suivi médical</h2>${summary.medical.length ? renderEvents(summary.medical,'type','status') : '<div class="empty-state">Aucun suivi médical sur cette période.</div>'}</article>
      <article class="panel"><h2>Convocations</h2>${summary.convocations.length ? renderEvents(summary.convocations,'type','status') : '<div class="empty-state">Aucune convocation sur cette période.</div>'}</article>
      <article class="panel"><h2>Bilans individuels</h2>${summary.individualReports.length ? renderEvents(summary.individualReports,'title','summary') : '<div class="empty-state">Aucun bilan individuel sur cette période.</div>'}</article>
    </section>`;
  }
  function renderEvents(rows=[], titleKey='type', valueKey='status'){
    function valueText(row){
      const value = row[valueKey] ?? row.note ?? row.tests ?? row.objectifs ?? '';
      return typeof value === 'object' && value !== null ? JSON.stringify(value) : value;
    }
    return `<div class="timeline">${rows.slice().sort((a,b) => Filters.dateOf(b).localeCompare(Filters.dateOf(a))).slice(0,12).map(row => `<div class="event"><b>${esc(row[titleKey] || row.theme || row.testName || row.action || row.source || 'Donnée')}</b><small>${esc(Filters.dateOf(row) || 'Sans date')} · ${esc(valueText(row))}</small></div>`).join('')}</div>`;
  }
  function renderTechnicalTests(rows=[]){
    const labels = {
      max_pfp:'Max pied fort',
      max_pfm:'Max pied faible',
      max_alt:'Max alterné',
      max_tete:'Max tête',
      reg_pfp:'Régularité pied fort',
      reg_pfm:'Régularité pied faible',
      reg_alt:'Régularité alterné',
      reg_tete:'Régularité tête',
      mouv_pfp:'Libre pied fort',
      mouv_pfm:'Libre pied faible',
      mouv_alt:'Libre alterné'
    };
    function testEntries(row){
      if(row.tests && typeof row.tests === 'object'){
        return Object.entries(labels)
          .map(([key,label]) => [label, row.tests[key]])
          .filter(([,value]) => value !== '' && value != null && !Number.isNaN(Number(value)));
      }
      const label = row.testName || row.testType || 'Test';
      const value = row.value ?? row.score ?? row.note;
      return value !== '' && value != null ? [[label, value]] : [];
    }
    const sorted = rows.slice().sort((a,b) => Filters.dateOf(b).localeCompare(Filters.dateOf(a))).slice(0,12);
    return `<div class="timeline technical-list">${sorted.map(row => {
      const entries = testEntries(row);
      const source = row.source ? `<span class="mini-source">${esc(row.source)}</span>` : '';
      return `<div class="event technical-event"><div class="event-head"><b>${esc(Filters.dateOf(row) || 'Sans date')}</b>${source}</div><div class="chips">${entries.length ? entries.map(([label,value]) => `<span class="chip">${esc(label)} <strong>${esc(value)}</strong></span>`).join('') : '<span class="chip">Aucune valeur renseignée</span>'}</div></div>`;
    }).join('')}</div>`;
  }
  function renderSeasonCompare(rows, state){
    return `<section class="panel"><h2>Comparaison entre saisons</h2><div class="filter-grid"><div class="field"><label>Saison A</label><select id="compareSeasonA">${state.seasons.map(s => option(s,s,state.filters.compareSeasonA)).join('')}</select></div><div class="field"><label>Saison B</label><select id="compareSeasonB">${state.seasons.map(s => option(s,s,state.filters.compareSeasonB)).join('')}</select></div></div><table class="compare-table"><thead><tr><th>Indicateur</th><th>Saison A</th><th>Saison B</th><th>Tendance</th></tr></thead><tbody>${rows.map(row => `<tr><td>${esc(row.label)}</td><td>${esc(row.a)} ${esc(row.unit)}</td><td>${esc(row.b)} ${esc(row.unit)}</td><td class="${row.trend.className}">${esc(row.trend.label)} (${esc(row.trend.diff)})</td></tr>`).join('')}</tbody></table></section>`;
  }
  function renderPlayerCompare(rows, state){
    const selected = new Set(state.filters.comparePlayerIds || []);
    const candidates = filteredPlayers(state);
    return `<section class="panel"><h2>Comparaison entre joueuses</h2><div class="notice">Période utilisée : ${esc(Filters.periodFromState(state).label)}</div><div class="compare-picker">${candidates.map(p => `<label class="compare-choice"><input type="checkbox" data-compare-player value="${esc(p.playerId)}" ${selected.has(p.playerId) ? 'checked' : ''}> <span>${esc(Data.displayName(p))}</span></label>`).join('')}</div><table class="compare-table"><thead><tr><th>Joueuse</th><th>Présence</th><th>Charge</th><th>Matchs</th><th>Tests athlétiques</th><th>Blessures</th></tr></thead><tbody>${rows.length ? rows.map(row => `<tr><td>${esc(Data.displayName(row.player))}</td><td>${row.summary.kpis.presenceRate}%</td><td>${row.summary.kpis.minutes} min</td><td>${row.summary.kpis.matches}</td><td>${row.summary.physicalTests.length}</td><td>${row.summary.kpis.injuries}</td></tr>`).join('') : '<tr><td colspan="6">Sélectionne une ou plusieurs joueuses.</td></tr>'}</tbody></table></section>`;
  }
  global.PlayerProfileRender = {esc, renderControls, renderIdentity, renderKpis, renderOverview, renderEvents, renderTechnicalTests, renderSeasonCompare, renderPlayerCompare};
})(window);
