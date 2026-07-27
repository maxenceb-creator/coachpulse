(function(global){
  const Data = global.TeamProfileData;
  const Filters = global.TeamProfileFilters;
  const Metrics = global.TeamProfileMetrics;
  const UI = global.TeamProfileUI;
  const root = document.getElementById('teamProfileShell');
  const state = {
    teams:[],
    selectedTeamId:'',
    payload:null,
    collections:null,
    teamCache:{},
    seasons:[Data.currentSeason()],
    view:'overview',
    filters:{periodMode:'season', season:Data.currentSeason(), startDate:'', endDate:'', competition:'', venue:'', result:'', opponent:''},
    renderToken:0,
    loadingTeamId:'',
    detailLoadingTeamId:'',
    firstSelectedTeamId:'',
    preloadedTeams:new Set()
  };
  function debugPerf(){ try{ return localStorage.getItem('coachpulse:debugPerf') === '1'; }catch(_e){ return false; } }
  function logPerf(label, start){ if(debugPerf()) console.info(`[CoachPulse perf] ${label}: ${Math.round(performance.now() - start)}ms`); }
  function selectedTeam(){ return state.teams.find(team => Data.teamIdOf(team) === state.selectedTeamId) || null; }
  async function loadTeamData(teamId, options={}){
    const cached = state.teamCache[teamId];
    const summaryOnly = options.summaryOnly === true;
    if(cached && (cached.complete || summaryOnly)) return cached;
    const payload = await Data.loadTeamData(teamId, {summaryOnly});
    const collections = Data.normalizeCollections(payload);
    state.teamCache[teamId] = {payload, collections, complete:!summaryOnly};
    return state.teamCache[teamId];
  }
  async function loadSelected(options={}){
    if(!state.selectedTeamId) return null;
    const loaded = await loadTeamData(state.selectedTeamId, options);
    state.payload = loaded.payload;
    state.collections = loaded.collections;
    if(state.collections.teams?.length){
      const merged = new Map(state.teams.map(team => [Data.teamIdOf(team), team]));
      state.collections.teams.forEach(team => merged.set(Data.teamIdOf(team), {...(merged.get(Data.teamIdOf(team)) || {}), ...team}));
      state.teams = [...merged.values()];
    }
    state.seasons = Filters.seasonsFromCollections(state.collections);
    if(!state.seasons.includes(state.filters.season)) state.filters.season = state.seasons.includes(Data.currentSeason()) ? Data.currentSeason() : state.seasons[0];
    return loaded;
  }
  function teamRank(team=''){
    const label = String(team || '').toUpperCase();
    if(label.includes('R1') || label.includes('SENIOR')) return 999;
    const numbers = label.match(/\d+/g)?.map(Number).filter(Number.isFinite) || [];
    return numbers.length ? Math.min(...numbers) : Number.POSITIVE_INFINITY;
  }
  function sortedTeams(){
    return state.teams.slice().sort((a,b) => {
      const nameA = Data.teamName(a);
      const nameB = Data.teamName(b);
      const rankA = teamRank(nameA);
      const rankB = teamRank(nameB);
      const distance = Number.isFinite(rankA) && Number.isFinite(rankB) ? rankA - rankB : 0;
      return distance || nameA.localeCompare(nameB, 'fr', {numeric:true});
    });
  }
  function teamsByDistanceFrom(teamId){
    const selected = state.teams.find(team => Data.teamIdOf(team) === teamId);
    const selectedRank = teamRank(Data.teamName(selected));
    return sortedTeams()
      .filter(team => Data.teamIdOf(team) !== teamId)
      .map(team => ({team, distance:Math.abs(teamRank(Data.teamName(team)) - selectedRank)}))
      .sort((a,b) => a.distance - b.distance || Data.teamName(a.team).localeCompare(Data.teamName(b.team), 'fr', {numeric:true}))
      .map(item => Data.teamIdOf(item.team))
      .filter(Boolean);
  }
  async function preloadTeam(teamId){
    if(!teamId || state.preloadedTeams.has(teamId) || state.teamCache[teamId]) return;
    state.preloadedTeams.add(teamId);
    try{ await loadTeamData(teamId, {summaryOnly:true}); }
    catch(error){ if(debugPerf()) console.warn('[CoachPulse perf] preload team failed', teamId, error); }
  }
  function preloadProgressiveTeamsForFirstSelection(teamId){
    if(state.firstSelectedTeamId || !teamId) return;
    state.firstSelectedTeamId = teamId;
    const schedule = global.requestIdleCallback || (callback => setTimeout(callback, 3000));
    schedule(async () => {
      for(const nextTeamId of teamsByDistanceFrom(teamId).slice(0, 2)){
        await preloadTeam(nextTeamId);
      }
    });
  }
  async function selectTeam(teamId, options={}){
    if(!teamId){
      state.selectedTeamId = '';
      state.payload = null;
      state.collections = null;
      state.loadingTeamId = '';
      state.detailLoadingTeamId = '';
      await render();
      return;
    }
    state.selectedTeamId = teamId;
    const alreadyLoaded = !!state.teamCache[teamId];
    const hasCompleteData = !!state.teamCache[teamId]?.complete;
    state.loadingTeamId = alreadyLoaded ? '' : teamId;
    await render();
    if(!alreadyLoaded){
      try{
        await loadSelected({summaryOnly:true});
      }catch(error){
        state.loadingTeamId = '';
        root.innerHTML = UI.renderControls(state) + `<section class="panel"><div class="empty-state">Chargement impossible : ${UI.esc(error.message || error)}</div></section>`;
        bind();
        return;
      }
      state.loadingTeamId = '';
      await render();
    }else{
      const loaded = state.teamCache[teamId];
      state.payload = loaded.payload;
      state.collections = loaded.collections;
      state.seasons = Filters.seasonsFromCollections(state.collections);
      await render();
    }
    if(!hasCompleteData) loadFullTeamInBackground(teamId);
    if(options.userSelected) preloadProgressiveTeamsForFirstSelection(teamId);
  }
  async function loadFullTeamInBackground(teamId){
    if(!teamId || state.teamCache[teamId]?.complete || state.detailLoadingTeamId === teamId) return;
    state.detailLoadingTeamId = teamId;
    render();
    await new Promise(resolve => setTimeout(resolve, 600));
    if(state.selectedTeamId !== teamId) {
      if(state.detailLoadingTeamId === teamId) state.detailLoadingTeamId = '';
      return;
    }
    try{
      const loaded = await loadTeamData(teamId, {summaryOnly:false});
      if(state.selectedTeamId === teamId){
        state.payload = loaded.payload;
        state.collections = loaded.collections;
        state.seasons = Filters.seasonsFromCollections(state.collections);
      }
    }catch(error){
      if(debugPerf()) console.warn('[CoachPulse perf] full team load failed', teamId, error);
    }finally{
      if(state.detailLoadingTeamId === teamId) state.detailLoadingTeamId = '';
      if(state.selectedTeamId === teamId) render();
    }
  }
  async function init(){
    try{
      state.teams = await Data.listTeams();
      if(!state.teams.length){ root.innerHTML = '<div class="empty-state">Aucune équipe accessible pour ce profil.</div>'; return; }
      state.selectedTeamId = '';
      state.payload = null;
      state.collections = null;
      render();
    }catch(error){
      root.innerHTML = `<div class="empty-state">Chargement impossible : ${UI.esc(error.message || error)}</div>`;
    }
  }
  function bind(){
    document.getElementById('teamSelect')?.addEventListener('change', async e => { await selectTeam(e.target.value, {userSelected:true}); });
    document.getElementById('periodMode')?.addEventListener('change', e => { state.filters.periodMode = e.target.value; render(); });
    document.getElementById('seasonSelect')?.addEventListener('change', e => { state.filters.season = e.target.value; render(); });
    document.getElementById('startDate')?.addEventListener('change', e => { state.filters.startDate = e.target.value; render(); });
    document.getElementById('endDate')?.addEventListener('change', e => { state.filters.endDate = e.target.value; render(); });
    document.getElementById('competitionFilter')?.addEventListener('change', e => { state.filters.competition = e.target.value; render(); });
    document.getElementById('venueFilter')?.addEventListener('change', e => { state.filters.venue = e.target.value; render(); });
    document.getElementById('resultFilter')?.addEventListener('change', e => { state.filters.result = e.target.value; render(); });
    document.getElementById('opponentFilter')?.addEventListener('input', e => { state.filters.opponent = e.target.value; render(); });
    document.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => { state.view = btn.dataset.view; render(); }));
    document.querySelectorAll('[data-player-id]').forEach(btn => btn.addEventListener('click', () => Data.openPlayerProfile(btn.dataset.playerId)));
  }
  function render(){
    const renderToken = ++state.renderToken;
    const start = performance.now();
    const team = selectedTeam();
    if(!state.selectedTeamId){
      root.innerHTML = UI.renderControls(state) + '<section class="panel"><div class="empty-state">Sélectionne une équipe pour charger sa fiche complète.</div></section>';
      bind();
      logPerf('teamProfile.render.empty', start);
      return;
    }
    if(!team){ root.innerHTML = UI.renderControls(state) + '<section class="panel"><div class="empty-state">Équipe introuvable.</div></section>'; bind(); return; }
    if(state.loadingTeamId === state.selectedTeamId && !state.teamCache[state.selectedTeamId]){
      root.innerHTML = UI.renderControls(state) + '<section class="panel"><div class="empty-state">Chargement complet de la fiche équipe...</div></section>';
      bind();
      logPerf('teamProfile.render.loading', start);
      return;
    }
    const summary = Metrics.summarize(team, state.collections || {}, state);
    if(renderToken !== state.renderToken) return;
    summary.collections = state.collections || {};
    root.innerHTML = UI.renderControls(state) + UI.renderHeader(summary) + UI.renderTabs(state) + UI.renderKpis(summary.kpis) + UI.renderBody(summary, state);
    bind();
    logPerf('teamProfile.render', start);
  }
  window.addEventListener('message', e => {
    if(e.data?.type === 'coachpulse-cloud-updated') init();
  });
  init();
})(window);
