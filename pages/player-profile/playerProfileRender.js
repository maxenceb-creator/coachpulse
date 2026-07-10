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
      <article class="panel"><h2>Tests athlétiques</h2>${summary.physicalTests.length ? renderPhysicalTests(summary.physicalTests) : '<div class="empty-state">Aucun test athlétique sur cette période.</div>'}</article>
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
  const physicalLabels = {
    vmi:{label:'VMI', unit:'km/h', direction:'high'},
    illinois:{label:'Illinois', unit:'s', direction:'low'},
    v10s:{label:'10m', unit:'s', direction:'low'},
    v10kmh:{label:'10m', unit:'km/h', direction:'high'},
    v40s:{label:'40m', unit:'s', direction:'low'},
    v40kmh:{label:'40m', unit:'km/h', direction:'high'},
    cmj:{label:'CMJ', unit:'cm', direction:'high'}
  };
  function physicalValue(row={}, key){
    if(row.tests && row.tests[key] != null && row.tests[key] !== '') return Number(row.tests[key]);
    const metric = Array.isArray(row.metrics) ? row.metrics.find(item => item.type === key) : null;
    const value = metric ? Number(metric.result ?? metric.value) : NaN;
    return Number.isFinite(value) ? value : null;
  }
  function metricSummary(rows=[], key){
    const meta = physicalLabels[key];
    const values = rows
      .map(row => ({row, value:physicalValue(row, key), date:Filters.dateOf(row)}))
      .filter(item => Number.isFinite(item.value))
      .sort((a,b) => a.date.localeCompare(b.date));
    if(!values.length) return null;
    const latest = values[values.length - 1];
    const previous = values[values.length - 2] || null;
    const best = values.reduce((out, item) => {
      if(!out) return item;
      return meta.direction === 'low' ? (item.value < out.value ? item : out) : (item.value > out.value ? item : out);
    }, null);
    const average = values.reduce((sum, item) => sum + item.value, 0) / values.length;
    const diff = previous ? latest.value - previous.value : 0;
    const good = previous ? (meta.direction === 'low' ? diff < 0 : diff > 0) : false;
    return {meta, count:values.length, latest, previous, best, average, diff, trend:previous ? (diff === 0 ? 'stable' : (good ? 'progression' : 'régression')) : 'premier test'};
  }
  function formatMetric(value, unit){
    return `${Number(value).toLocaleString('fr-FR', {maximumFractionDigits:2})}${unit ? ' '+unit : ''}`;
  }
  function renderPhysicalTests(rows=[]){
    const summaries = Object.keys(physicalLabels).map(key => metricSummary(rows, key)).filter(Boolean);
    const history = rows.slice().sort((a,b) => Filters.dateOf(b).localeCompare(Filters.dateOf(a))).slice(0,8);
    return `<div class="physical-tests">
      <div class="metric-grid">${summaries.map(item => `<div class="metric-card">
        <h3>${esc(item.meta.label)}</h3>
        <div class="metric-main">${esc(formatMetric(item.latest.value, item.meta.unit))}</div>
        <div class="metric-row"><span>Meilleur</span><b>${esc(formatMetric(item.best.value, item.meta.unit))}</b></div>
        <div class="metric-row"><span>Moyenne</span><b>${esc(formatMetric(item.average, item.meta.unit))}</b></div>
        <div class="metric-row"><span>Progression</span><b>${esc(item.trend)}${item.previous ? ` (${esc(formatMetric(item.diff, item.meta.unit))})` : ''}</b></div>
      </div>`).join('')}</div>
      <div class="timeline">${history.map(row => {
        const entries = Object.entries(physicalLabels)
          .map(([key, meta]) => [meta, physicalValue(row, key)])
          .filter(([,value]) => Number.isFinite(value));
        const note = row.comment || row.commentaire || row.note || '';
        return `<div class="event technical-event"><div class="event-head"><b>${esc(Filters.dateOf(row) || 'Sans date')}</b><span class="mini-source">${esc(row.season || row.saison || row.source || 'Tests athlétiques')}</span></div><div class="chips">${entries.map(([meta,value]) => `<span class="chip">${esc(meta.label)} <strong>${esc(formatMetric(value, meta.unit))}</strong></span>`).join('')}${note ? `<span class="chip">${esc(note)}</span>` : ''}</div></div>`;
      }).join('')}</div>
    </div>`;
  }
  function renderSeasonCompare(rows, state){
    return `<section class="panel"><h2>Comparaison entre saisons</h2><div class="filter-grid"><div class="field"><label>Saison A</label><select id="compareSeasonA">${state.seasons.map(s => option(s,s,state.filters.compareSeasonA)).join('')}</select></div><div class="field"><label>Saison B</label><select id="compareSeasonB">${state.seasons.map(s => option(s,s,state.filters.compareSeasonB)).join('')}</select></div></div><table class="compare-table"><thead><tr><th>Indicateur</th><th>Saison A</th><th>Saison B</th><th>Tendance</th></tr></thead><tbody>${rows.map(row => `<tr><td>${esc(row.label)}</td><td>${esc(row.a)} ${esc(row.unit)}</td><td>${esc(row.b)} ${esc(row.unit)}</td><td class="${row.trend.className}">${esc(row.trend.label)} (${esc(row.trend.diff)})</td></tr>`).join('')}</tbody></table></section>`;
  }
  function renderPlayerCompare(rows, state){
    const selected = new Set(state.filters.comparePlayerIds || []);
    const candidates = filteredPlayers(state);
    return `<section class="panel"><h2>Comparaison entre joueuses</h2><div class="notice">Période utilisée : ${esc(Filters.periodFromState(state).label)}</div><div class="compare-picker">${candidates.map(p => `<label class="compare-choice"><input type="checkbox" data-compare-player value="${esc(p.playerId)}" ${selected.has(p.playerId) ? 'checked' : ''}> <span>${esc(Data.displayName(p))}</span></label>`).join('')}</div><table class="compare-table"><thead><tr><th>Joueuse</th><th>Présence</th><th>Charge</th><th>Matchs</th><th>Tests athlétiques</th><th>Blessures</th></tr></thead><tbody>${rows.length ? rows.map(row => `<tr><td>${esc(Data.displayName(row.player))}</td><td>${row.summary.kpis.presenceRate}%</td><td>${row.summary.kpis.minutes} min</td><td>${row.summary.kpis.matches}</td><td>${row.summary.physicalTests.length}</td><td>${row.summary.kpis.injuries}</td></tr>`).join('') : '<tr><td colspan="6">Sélectionne une ou plusieurs joueuses.</td></tr>'}</tbody></table></section>`;
  }
  global.PlayerProfileRender = {esc, renderControls, renderIdentity, renderKpis, renderOverview, renderEvents, renderTechnicalTests, renderPhysicalTests, renderSeasonCompare, renderPlayerCompare};
})(window);
