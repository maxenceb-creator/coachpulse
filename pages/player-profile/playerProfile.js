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
    filteredCollectionCache:{},
    seasons:[Data.currentSeason()],
    view:'overview',
    filters:{team:'', periodMode:'season', season:Data.currentSeason(), startDate:'', endDate:'', compareSeasonA:'', compareSeasonB:Data.currentSeason(), comparePlayerIds:[]},
    renderToken:0,
    loadingPlayerId:'',
    firstSelectedPlayerId:'',
    preloadedTeams:new Set()
  };
  function debugPerf(){ try{ return localStorage.getItem('coachpulse:debugPerf') === '1'; }catch(_e){ return false; } }
  function logPerf(label, start){ if(debugPerf()) console.info(`[CoachPulse perf] ${label}: ${Math.round(performance.now() - start)}ms`); }
  function displaySeason(){
    return state.filters.periodMode === 'season' ? state.filters.season : Data.currentSeason();
  }
  function player(){
    if(!state.selectedPlayerId) return {};
    const selected = state.players.find(p => p.playerId === state.selectedPlayerId) || {};
    return Data.playerForSeason(selected, displaySeason());
  }
  function firstText(){
    for(const value of arguments){
      const text = String(value ?? '').trim();
      if(text) return text;
    }
    return '';
  }
  function enrichPlayerFromCollections(player={}, collections={}){
    const aliases = Data.playerAliases(player);
    const candidates = [
      ...(collections.players || []),
      ...(collections.technicalTests || []),
      ...(collections.technicalTests || []).map(row => row.playerSnapshot || {}),
      ...(collections.technicalTests || []).map(row => row.player || {})
    ].filter(row => row && (!Data.rowMatchesPlayer || Data.rowMatchesPlayer(row, aliases) || aliases.includes(row.playerId || row.id)));
    const foot = firstText(
      player.foot, player.pied, player.meilleurPiedLabel, player.preferredFoot, player.strongFoot,
      ...candidates.flatMap(row => [row.foot, row.pied, row.meilleurPiedLabel, row.preferredFoot, row.strongFoot])
    );
    const nationalite = firstText(
      player.nationalite, player.nationalité, player.nationality, player.country, player.pays,
      ...candidates.flatMap(row => [row.nationalite, row.nationalité, row.nationality, row.country, row.pays])
    );
    return {
      ...player,
      foot:foot || player.foot || '',
      pied:firstText(player.pied, foot),
      meilleurPiedLabel:firstText(player.meilleurPiedLabel, foot),
      nationalite:nationalite || player.nationalite || '',
      nationality:firstText(player.nationality, nationalite)
    };
  }
  function playersForTeam(){
    return state.players.filter(p => !state.filters.team || Data.teamLabel(Data.playerForSeason(p, displaySeason())) === state.filters.team);
  }
  function emptyCollections(){
    return {
      players:[],
      sessions:[],
      attendance:[],
      matches:[],
      matchEvents:[],
      technicalTests:[],
      physicalTests:[],
      injuries:[],
      injuryUpdates:[],
      medicalAppointments:[],
      rehabRoutines:[],
      workloads:[],
      medicalFollowUps:[],
      convocations:[],
      individualReports:[]
    };
  }
  async function ensureSelectedPlayer(){
    const visible = playersForTeam();
    if(!visible.length || !state.selectedPlayerId) return;
    if(!visible.some(p => p.playerId === state.selectedPlayerId)) state.selectedPlayerId = '';
  }
  async function loadPlayerData(playerId){
    const selected = state.players.find(p => p.playerId === playerId) || {playerId};
    if(state.collectionCache[playerId]) return state.collectionCache[playerId];
    const payload = await Data.loadProfileData(selected);
    const collections = Data.normalizeCollections(payload);
    state.collectionCache[playerId] = {payload, collections};
    delete state.filteredCollectionCache[playerId];
    return state.collectionCache[playerId];
  }
  async function loadSelected(){
    const loaded = await loadPlayerData(state.selectedPlayerId);
    const payload = loaded.payload;
    state.payload = payload;
    state.collections = loaded.collections;
    const selected = state.players.find(p => p.playerId === state.selectedPlayerId);
    if(selected){
      const enriched = enrichPlayerFromCollections(selected, state.collections);
      state.players = state.players.map(player => player.playerId === state.selectedPlayerId ? enriched : player);
      state.collections.players = [
        enriched,
        ...(state.collections.players || []).filter(player => (player.playerId || player.id) !== state.selectedPlayerId)
      ];
      loaded.collections = state.collections;
    }
    delete state.filteredCollectionCache[state.selectedPlayerId];
    state.seasons = Filters.seasonsFromCollections(state.collections);
    if(!state.filters.compareSeasonA) state.filters.compareSeasonA = state.seasons[0] || Data.currentSeason();
    if(!state.filters.compareSeasonB) state.filters.compareSeasonB = Data.currentSeason();
  }
  function teamRank(team=''){
    const numbers = String(team || '').match(/\d+/g)?.map(Number).filter(Number.isFinite) || [];
    if(numbers.length) return Math.min(...numbers);
    return Number.POSITIVE_INFINITY;
  }
  function sortedTeamLabels(){
    const season = displaySeason();
    return [...new Set(state.players.map(p => Data.teamLabel(Data.playerForSeason(p, season))).filter(Boolean))]
      .sort((a,b) => {
        const rankDiff = teamRank(a) - teamRank(b);
        return rankDiff || a.localeCompare(b, 'fr');
      });
  }
  function teamsByDistanceFrom(team){
    const selectedRank = teamRank(team);
    return sortedTeamLabels()
      .filter(label => label !== team)
      .map(label => ({label, distance:Math.abs(teamRank(label) - selectedRank)}))
      .sort((a,b) => a.distance - b.distance || a.label.localeCompare(b.label, 'fr'))
      .map(item => item.label);
  }
  async function preloadTeam(team, excludedPlayerIds=new Set()){
    if(!team || state.preloadedTeams.has(team)) return;
    state.preloadedTeams.add(team);
    const season = displaySeason();
    const teamPlayers = state.players.filter(p => (
      !excludedPlayerIds.has(p.playerId) &&
      Data.teamLabel(Data.playerForSeason(p, season)) === team &&
      !state.collectionCache[p.playerId]
    ));
    const start = performance.now();
    for(const teammate of teamPlayers){
      try{
        await loadPlayerData(teammate.playerId);
      }catch(error){
        if(debugPerf()) console.warn('[CoachPulse perf] preload team player failed', teammate.playerId, error);
      }
    }
    logPerf(`playerProfile.preloadTeam.${team}.${teamPlayers.length}`, start);
  }
  function preloadProgressiveTeamsForFirstSelection(playerId){
    if(state.firstSelectedPlayerId || !playerId) return;
    state.firstSelectedPlayerId = playerId;
    const selected = state.players.find(p => p.playerId === playerId);
    const team = Data.teamLabel(Data.playerForSeason(selected, displaySeason()));
    if(!team) return;
    setTimeout(async () => {
      await preloadTeam(team, new Set([playerId]));
      for(const nextTeam of teamsByDistanceFrom(team)){
        await preloadTeam(nextTeam);
      }
    }, 0);
  }
  async function selectPlayer(playerId, options={}){
    if(!playerId){
      state.selectedPlayerId = '';
      state.payload = null;
      state.collections = null;
      state.loadingPlayerId = '';
      try{ localStorage.removeItem('coachpulse:playerProfile:selectedPlayerId'); }catch(_e){}
      await render();
      return;
    }
    state.selectedPlayerId = playerId;
    try{ localStorage.setItem('coachpulse:playerProfile:selectedPlayerId', playerId); }catch(_e){}
    const alreadyLoaded = !!state.collectionCache[playerId];
    state.loadingPlayerId = alreadyLoaded ? '' : playerId;
    await render();
    if(!alreadyLoaded){
      await loadSelected();
      state.loadingPlayerId = '';
      await render();
    }else{
      const loaded = state.collectionCache[playerId];
      state.payload = loaded.payload;
      state.collections = loaded.collections;
      state.seasons = Filters.seasonsFromCollections(state.collections);
      await render();
    }
    if(options.userSelected) preloadProgressiveTeamsForFirstSelection(playerId);
  }
  async function init(){
    try{
      state.players = await Data.listPlayers();
      state.selectedPlayerId = '';
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
    document.getElementById('playerSelect')?.addEventListener('change', async event => { await selectPlayer(event.target.value, {userSelected:true}); });
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
    if(state.filteredCollectionCache[playerId]) return state.filteredCollectionCache[playerId];
    const hasLoadedCollections = !!state.collectionCache[playerId];
    const base = hasLoadedCollections ? state.collectionCache[playerId].collections : emptyCollections();
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
    if(hasLoadedCollections) state.filteredCollectionCache[playerId] = out;
    return out;
  }
  async function render(){
    const renderToken = ++state.renderToken;
    const start = performance.now();
    if(!state.players.length){ root.innerHTML = '<div class="empty-state">Aucune joueuse disponible dans la base commune.</div>'; return; }
    await ensureSelectedPlayer();
    if(renderToken !== state.renderToken) return;
    const selectedPlayer = player();
    const period = Filters.periodFromState(state);
    const selectedCollections = collectionsForPlayer(state.selectedPlayerId);
    const summary = Stats.summarize(selectedPlayer, selectedCollections, state);
    const hasSelectedPlayer = !!state.selectedPlayerId;
    const hasSelectedData = hasSelectedPlayer && !!state.collectionCache[state.selectedPlayerId];
    const isLoadingSelected = state.loadingPlayerId === state.selectedPlayerId;
    let body = hasSelectedData
      ? Render.renderOverview(summary)
      : `<section class="panel"><div class="empty-state">${isLoadingSelected ? 'Chargement complet de la fiche joueuse...' : 'Sélectionne une joueuse pour charger sa fiche complète.'}</div></section>`;
    if(hasSelectedData && state.view === 'timeline') body = `<section class="grid"><article class="panel"><h2>Présences et charge</h2>${summary.attendance.length ? Render.renderEvents(summary.attendance,'status','minutes') : '<div class="empty-state">Aucune présence sur cette période.</div>'}</article><article class="panel"><h2>Evolution saison</h2>${Render.renderEvents([...summary.physicalTests,...summary.technicalTests,...summary.matchEvents,...summary.injuries],'source','value')}</article></section>`;
    if(hasSelectedData && state.view === 'seasonCompare') body = Render.renderSeasonCompare(Compare.compareSeasons(selectedPlayer, selectedCollections, state), state);
    if(hasSelectedData && state.view === 'playerCompare'){
      if(!state.filters.comparePlayerIds.length) state.filters.comparePlayerIds = [state.selectedPlayerId];
      const teamIds = new Set(playersForTeam().map(p => p.playerId));
      const selectedIds = state.filters.comparePlayerIds.filter(id => teamIds.has(id) || id === state.selectedPlayerId);
      const comparePlayers = state.players.filter(p => selectedIds.includes(p.playerId));
      await Promise.all(comparePlayers.map(p => loadPlayerData(p.playerId)));
      if(renderToken !== state.renderToken) return;
      const collectionMap = Object.fromEntries(comparePlayers.map(p => [p.playerId, collectionsForPlayer(p.playerId)]));
      body = Render.renderPlayerCompare(Compare.comparePlayers(comparePlayers, collectionMap, state), state);
    }
    if(renderToken !== state.renderToken) return;
    root.innerHTML = Render.renderControls(state) + Render.renderKpis(summary) + body;
    document.getElementById('identityCard').innerHTML = Render.renderIdentity(selectedPlayer, period);
    document.querySelectorAll('[data-view]').forEach(btn => btn.classList.toggle('active', btn.dataset.view === state.view));
    bind();
    logPerf('playerProfile.render', start);
  }
  init();
})(window);
