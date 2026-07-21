(function(global){
  const Data = global.PlayerProfileData;
  const Filters = global.PlayerProfileFilters;
  const Stats = global.PlayerProfileStats;
  const Compare = global.PlayerProfileCompare;
  const Render = global.PlayerProfileRender;
  const root = document.getElementById('profileShell');
  const state = {
    players:[],
    selectedPlayerId:'',
    payload:null,
    collections:null,
    collectionCache:{},
    seasons:[Data.currentSeason()],
    view:'overview',
    filters:{team:'', periodMode:'season', season:Data.currentSeason(), startDate:'', endDate:'', compareSeasonA:'', compareSeasonB:Data.currentSeason(), comparePlayerIds:[]}
  };
  function displaySeason(){
    return state.filters.periodMode === 'season' ? state.filters.season : Data.currentSeason();
  }
  function player(){
    const selected = state.players.find(p => p.playerId === state.selectedPlayerId) || state.players[0] || {};
    return Data.playerForSeason(selected, displaySeason());
  }
  function playersForTeam(){
    return state.players.filter(p => !state.filters.team || Data.teamLabel(Data.playerForSeason(p, displaySeason())) === state.filters.team);
  }
  async function ensureSelectedPlayer(){
    const visible = playersForTeam();
    if(!visible.length) return;
    if(!visible.some(p => p.playerId === state.selectedPlayerId)){
      state.selectedPlayerId = visible[0].playerId;
      await loadSelected();
    }
  }
  async function loadPlayerData(playerId){
    const selected = state.players.find(p => p.playerId === playerId) || {playerId};
    if(state.collectionCache[playerId]) return state.collectionCache[playerId];
    const payload = await Data.loadProfileData(selected);
    const collections = Data.normalizeCollections(payload);
    state.collectionCache[playerId] = {payload, collections};
    return state.collectionCache[playerId];
  }
  async function loadSelected(){
    const loaded = await loadPlayerData(state.selectedPlayerId);
    const payload = loaded.payload;
    state.payload = payload;
    state.collections = loaded.collections;
    state.seasons = Filters.seasonsFromCollections(state.collections);
    if(!state.filters.compareSeasonA) state.filters.compareSeasonA = state.seasons[0] || Data.currentSeason();
    if(!state.filters.compareSeasonB) state.filters.compareSeasonB = Data.currentSeason();
  }
  async function init(){
    try{
      state.players = await Data.listPlayers();
      const requestedPlayerId = localStorage.getItem('coachpulse:playerProfile:selectedPlayerId') || '';
      state.selectedPlayerId = state.players.some(player => player.playerId === requestedPlayerId) ? requestedPlayerId : (state.players[0]?.playerId || '');
      await loadSelected();
      await render();
    }catch(error){
      root.innerHTML = `<div class="empty-state">Chargement impossible : ${Render.esc(error.message || error)}</div>`;
    }
  }
  function bind(){
    document.getElementById('teamFilter')?.addEventListener('change', async event => {
      state.filters.team = event.target.value;
      state.filters.comparePlayerIds = state.filters.comparePlayerIds.filter(id => playersForTeam().some(p => p.playerId === id));
      await ensureSelectedPlayer();
      await render();
    });
    document.getElementById('playerSelect')?.addEventListener('change', async event => { state.selectedPlayerId = event.target.value; await loadSelected(); await render(); });
    document.getElementById('periodMode')?.addEventListener('change', async event => { state.filters.periodMode = event.target.value; await render(); });
    document.getElementById('seasonSelect')?.addEventListener('change', async event => { state.filters.season = event.target.value; await render(); });
    document.getElementById('startDate')?.addEventListener('change', async event => { state.filters.startDate = event.target.value; await render(); });
    document.getElementById('endDate')?.addEventListener('change', async event => { state.filters.endDate = event.target.value; await render(); });
    document.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', async () => { state.view = btn.dataset.view; await render(); }));
    document.getElementById('compareSeasonA')?.addEventListener('change', async event => { state.filters.compareSeasonA = event.target.value; await render(); });
    document.getElementById('compareSeasonB')?.addEventListener('change', async event => { state.filters.compareSeasonB = event.target.value; await render(); });
    document.querySelectorAll('[data-compare-player]').forEach(input => input.addEventListener('change', async () => {
      state.filters.comparePlayerIds = [...document.querySelectorAll('[data-compare-player]:checked')].map(option => option.value);
      await render();
    }));
  }
  function collectionsForPlayer(playerId){
    const base = state.collectionCache[playerId]?.collections || state.collections || {};
    const selected = state.players.find(p => p.playerId === playerId) || {};
    const aliases = Data.playerAliases(selected);
    const out = {
      players:(base.players || []).filter(row => Data.rowMatchesPlayer(row, aliases) || aliases.includes(row.playerId || row.id)),
      attendance:(base.attendance || []).filter(row => Data.rowMatchesPlayer(row, aliases)),
      matchEvents:(base.matchEvents || []).filter(row => Data.rowMatchesPlayer(row, aliases)),
      technicalTests:(base.technicalTests || []).filter(row => Data.rowMatchesPlayer(row, aliases)),
      physicalTests:(base.physicalTests || []).filter(row => Data.rowMatchesPlayer(row, aliases)),
      injuries:(base.injuries || []).filter(row => Data.rowMatchesPlayer(row, aliases)),
      injuryUpdates:(base.injuryUpdates || []).filter(row => Data.rowMatchesPlayer(row, aliases)),
      medicalAppointments:(base.medicalAppointments || []).filter(row => Data.rowMatchesPlayer(row, aliases)),
      rehabRoutines:(base.rehabRoutines || []).filter(row => Data.rowMatchesPlayer(row, aliases)),
      workloads:(base.workloads || []).filter(row => Data.rowMatchesPlayer(row, aliases)),
      medicalFollowUps:(base.medicalFollowUps || []).filter(row => Data.rowMatchesPlayer(row, aliases)),
      convocations:(base.convocations || []).filter(row => Data.rowMatchesPlayer(row, aliases)),
      individualReports:(base.individualReports || []).filter(row => Data.rowMatchesPlayer(row, aliases))
    };
    const sessionIds = new Set(out.attendance.map(row => row.sessionId).filter(Boolean));
    out.sessions = (base.sessions || []).filter(row => sessionIds.has(row.sessionId || row.id));
    const matchIds = new Set(out.matchEvents.map(row => row.matchId).filter(Boolean));
    out.matches = (base.matches || []).filter(row => matchIds.has(row.matchId || row.id));
    return out;
  }
  async function render(){
    if(!state.players.length){ root.innerHTML = '<div class="empty-state">Aucune joueuse disponible dans la base commune.</div>'; return; }
    await ensureSelectedPlayer();
    const selectedPlayer = player();
    const period = Filters.periodFromState(state);
    const selectedCollections = collectionsForPlayer(state.selectedPlayerId);
    const summary = Stats.summarize(selectedPlayer, selectedCollections, state);
    let body = Render.renderOverview(summary);
    if(state.view === 'timeline') body = `<section class="grid"><article class="panel"><h2>Présences et charge</h2>${summary.attendance.length ? Render.renderEvents(summary.attendance,'status','minutes') : '<div class="empty-state">Aucune présence sur cette période.</div>'}</article><article class="panel"><h2>Evolution saison</h2>${Render.renderEvents([...summary.physicalTests,...summary.technicalTests,...summary.matchEvents,...summary.injuries],'source','value')}</article></section>`;
    if(state.view === 'seasonCompare') body = Render.renderSeasonCompare(Compare.compareSeasons(selectedPlayer, selectedCollections, state), state);
    if(state.view === 'playerCompare'){
      if(!state.filters.comparePlayerIds.length) state.filters.comparePlayerIds = [state.selectedPlayerId];
      const teamIds = new Set(playersForTeam().map(p => p.playerId));
      const selectedIds = state.filters.comparePlayerIds.filter(id => teamIds.has(id) || id === state.selectedPlayerId);
      const comparePlayers = state.players.filter(p => selectedIds.includes(p.playerId));
      await Promise.all(comparePlayers.map(p => loadPlayerData(p.playerId)));
      const collectionMap = Object.fromEntries(comparePlayers.map(p => [p.playerId, collectionsForPlayer(p.playerId)]));
      body = Render.renderPlayerCompare(Compare.comparePlayers(comparePlayers, collectionMap, state), state);
    }
    root.innerHTML = Render.renderControls(state) + Render.renderKpis(summary) + body;
    document.getElementById('identityCard').innerHTML = Render.renderIdentity(selectedPlayer, period);
    document.querySelectorAll('[data-view]').forEach(btn => btn.classList.toggle('active', btn.dataset.view === state.view));
    bind();
  }
  init();
})(window);
