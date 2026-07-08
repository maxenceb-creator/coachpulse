(function(global){
  function api(){ return global.parent?.CoachPulseCentralData || {}; }
  function text(value){ return String(value ?? '').trim(); }
  function seasonFromDate(date){
    if(api().seasonFromDate) return api().seasonFromDate(date);
    const d = new Date(date || Date.now());
    if(Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    return d.getMonth() >= 6 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  }
  function currentSeason(){ return api().currentSeason?.() || seasonFromDate(new Date()); }
  function idOf(player){ return text(player?.playerId || player?.id); }
  function displayName(player={}){
    return text(player.displayName || player.name || player.playerName || [player.prenom || player.firstName, player.nom || player.lastName].filter(Boolean).join(' ')).toUpperCase();
  }
  async function listPlayers(){
    if(api().listPlayers){
      const rows = await api().listPlayers({season:currentSeason()});
      return rows.map(row => ({...row, playerId:idOf(row), displayName:displayName(row)})).filter(row => row.playerId);
    }
    try{
      const cached = JSON.parse(localStorage.getItem('coachpulse:centralPlayers') || '[]');
      return Array.isArray(cached) ? cached.map(row => ({...row, playerId:idOf(row), displayName:displayName(row)})).filter(row => row.playerId) : [];
    }catch(_e){ return []; }
  }
  async function loadProfileData(playerId=''){
    if(api().playerProfileLoadData) return api().playerProfileLoadData({playerId});
    const players = await listPlayers();
    return {
      app:'CoachPulse',
      module:'playerProfile',
      currentSeason:currentSeason(),
      loadedAt:new Date().toISOString(),
      collections:{
        players:playerId ? players.filter(player => idOf(player) === playerId) : players,
        sessions:[], attendance:[], matches:[], matchEvents:[], technicalTests:[], physicalTests:[],
        injuries:[], injuryUpdates:[], medicalAppointments:[], rehabRoutines:[], workloads:[], medicalFollowUps:[]
      }
    };
  }
  function normalizeCollections(payload={}){
    const c = payload.collections || {};
    return {
      players:c.players || [],
      sessions:c.sessions || [],
      attendance:c.attendance || [],
      matches:c.matches || [],
      matchEvents:c.matchEvents || [],
      technicalTests:c.technicalTests || [],
      physicalTests:c.physicalTests || [],
      injuries:c.injuries || [],
      injuryUpdates:c.injuryUpdates || [],
      medicalAppointments:c.medicalAppointments || [],
      rehabRoutines:c.rehabRoutines || [],
      workloads:c.workloads || [],
      medicalFollowUps:c.medicalFollowUps || []
    };
  }
  global.PlayerProfileData = {api, text, seasonFromDate, currentSeason, idOf, displayName, listPlayers, loadProfileData, normalizeCollections};
})(window);
