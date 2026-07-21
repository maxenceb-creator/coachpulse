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
    seasons:[Data.currentSeason()],
    view:'overview',
    filters:{periodMode:'season', season:Data.currentSeason(), startDate:'', endDate:'', competition:'', venue:'', result:'', opponent:''}
  };
  function selectedTeam(){ return state.teams.find(team => Data.teamIdOf(team) === state.selectedTeamId) || state.teams[0] || null; }
  async function loadSelected(){
    if(!state.selectedTeamId) return;
    root.innerHTML = '<div class="empty-state">Chargement des données équipe...</div>';
    state.payload = await Data.loadTeamData(state.selectedTeamId);
    state.collections = Data.normalizeCollections(state.payload);
    if(state.collections.teams?.length){
      const merged = new Map(state.teams.map(team => [Data.teamIdOf(team), team]));
      state.collections.teams.forEach(team => merged.set(Data.teamIdOf(team), {...(merged.get(Data.teamIdOf(team)) || {}), ...team}));
      state.teams = [...merged.values()];
    }
    state.seasons = Filters.seasonsFromCollections(state.collections);
    if(!state.seasons.includes(state.filters.season)) state.filters.season = state.seasons.includes(Data.currentSeason()) ? Data.currentSeason() : state.seasons[0];
  }
  async function init(){
    try{
      state.teams = await Data.listTeams();
      if(!state.teams.length){ root.innerHTML = '<div class="empty-state">Aucune équipe accessible pour ce profil.</div>'; return; }
      state.selectedTeamId = state.teams[0].teamId || state.teams[0].id;
      await loadSelected();
      render();
    }catch(error){
      root.innerHTML = `<div class="empty-state">Chargement impossible : ${UI.esc(error.message || error)}</div>`;
    }
  }
  function bind(){
    document.getElementById('teamSelect')?.addEventListener('change', async e => { state.selectedTeamId = e.target.value; await loadSelected(); render(); });
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
    const team = selectedTeam();
    if(!team){ root.innerHTML = '<div class="empty-state">Équipe introuvable.</div>'; return; }
    const summary = Metrics.summarize(team, state.collections || {}, state);
    summary.collections = state.collections || {};
    root.innerHTML = UI.renderControls(state) + UI.renderHeader(summary) + UI.renderTabs(state) + UI.renderKpis(summary.kpis) + UI.renderBody(summary, state);
    bind();
  }
  window.addEventListener('message', e => {
    if(e.data?.type === 'coachpulse-cloud-updated') init();
  });
  init();
})(window);
