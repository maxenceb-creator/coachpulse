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
  function playerForSeason(player={}, season=currentSeason()){
    return api().playerForSeason ? api().playerForSeason(player, season) : player;
  }
  function idOf(player){ return text(player?.playerId || player?.id); }
  function slug(value){
    return text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function stableId(){
    return Array.from(arguments).map(slug).filter(Boolean).join('-') || '';
  }
  function displayName(player={}){
    return text(player.displayName || player.name || player.playerName || [player.prenom || player.firstName, player.nom || player.lastName].filter(Boolean).join(' ')).toUpperCase();
  }
  function teamLabel(player={}){
    return text(player.team || player.equipe || player.teamName || player.categorie || player.category || player.subCategory || player.sousCategorie || 'Sans équipe');
  }
  function list(value){
    if(Array.isArray(value)) return value;
    if(value == null || value === '') return [];
    return String(value).split(/[,;\n]+/).map(text).filter(Boolean);
  }
  function playerAliases(player={}){
    const aliases = new Set();
    [
      player.playerId,
      player.id,
      player.legacyPlayerId,
      player.oldPlayerId,
      player.previousPlayerId,
      player.playerKey,
      player.externalId
    ].forEach(value => { if(text(value)) aliases.add(text(value)); });
    ['playerIds','legacyPlayerIds','previousPlayerIds','aliases','aliasIds'].forEach(key => {
      list(player[key]).forEach(value => aliases.add(text(value)));
    });
    const nom = text(player.nom || player.lastName);
    const prenom = text(player.prenom || player.firstName);
    const birth = text(player.birth || player.dateNaissance || player.birthDate);
    [
      nom,
      prenom,
      player.displayName,
      player.name,
      player.playerName,
      [prenom, nom].filter(Boolean).join(' '),
      [nom, prenom].filter(Boolean).join(' ')
    ].forEach(value => {
      const raw = text(value);
      if(raw){
        aliases.add(raw);
        aliases.add(raw.toUpperCase());
        raw.split(/\s+/).map(text).filter(Boolean).forEach(part => {
          aliases.add(part);
          aliases.add(part.toUpperCase());
        });
      }
    });
    if(nom || prenom){
      [birth, 'no-birth'].filter(Boolean).forEach(date => {
        aliases.add(stableId('player', nom, prenom, date));
        aliases.add(stableId('player', prenom, nom, date));
      });
      aliases.add(stableId(nom, prenom));
      aliases.add(stableId(prenom, nom));
    }
    return [...aliases].filter(Boolean);
  }
  function normName(value){
    return text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  }
  function rowPlayerNames(row={}){
    return [
      row.playerName,
      row.joueuse,
      row.name,
      row.nom,
      row.prenom,
      row.fullName,
      row.displayName,
      [row.prenom, row.nom].filter(Boolean).join(' '),
      [row.nom, row.prenom].filter(Boolean).join(' '),
      row.playerSnapshot?.displayName,
      row.player?.displayName,
      [row.playerSnapshot?.prenom, row.playerSnapshot?.nom].filter(Boolean).join(' '),
      [row.player?.prenom, row.player?.nom].filter(Boolean).join(' ')
    ].map(text).filter(Boolean);
  }
  function rowPlayerIds(row={}){
    const out = [];
    [
      row.playerId,
      row.playerID,
      row.player_id,
      row.legacyPlayerId,
      row.oldPlayerId,
      row.playerKey,
      row.playerRef,
      row.playerSnapshot?.playerId,
      row.playerSnapshot?.id,
      row.player?.playerId,
      row.player?.id
    ].forEach(value => { if(text(value)) out.push(text(value)); });
    ['playerIds','playersIds','players','selectedPlayers','calledPlayers','absentPlayers','presentPlayers'].forEach(key => {
      list(row[key]).forEach(value => {
        if(typeof value === 'object' && value){
          [value.playerId, value.id, value.playerID, value.player_id].forEach(inner => { if(text(inner)) out.push(text(inner)); });
        }else if(text(value)) out.push(text(value));
      });
    });
    return out;
  }
  function rowMatchesPlayer(row={}, aliases=[]){
    const ids = rowPlayerIds(row);
    const set = new Set(aliases);
    if(ids.some(id => set.has(id))) return true;
    const normalizedAliases = new Set(aliases.map(normName).filter(Boolean));
    return rowPlayerNames(row).some(name => normalizedAliases.has(normName(name)));
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
  async function loadProfileData(playerOrId=''){
    const player = typeof playerOrId === 'object' && playerOrId ? playerOrId : {playerId:playerOrId};
    const playerId = idOf(player);
    const aliases = playerAliases(player);
    if(api().playerProfileLoadData) return api().playerProfileLoadData({playerId, aliases});
    const players = await listPlayers();
    return {
      app:'CoachPulse',
      module:'playerProfile',
      currentSeason:currentSeason(),
      loadedAt:new Date().toISOString(),
      collections:{
        players:playerId ? players.filter(player => idOf(player) === playerId) : players,
        sessions:[], attendance:[], matches:[], matchEvents:[], technicalTests:[], physicalTests:[],
        injuries:[], injuryUpdates:[], medicalAppointments:[], rehabRoutines:[], workloads:[], medicalFollowUps:[], convocations:[], individualReports:[]
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
      medicalFollowUps:c.medicalFollowUps || [],
      convocations:c.convocations || [],
      individualReports:c.individualReports || []
    };
  }
  global.PlayerProfileData = {api, text, seasonFromDate, currentSeason, playerForSeason, idOf, slug, stableId, displayName, teamLabel, listPlayers, loadProfileData, normalizeCollections, playerAliases, rowPlayerIds, rowMatchesPlayer};
})(window);
