// CoachPulse shared players service.
// Phase 1: standalone helper. Existing modules keep their current paths.

(function(global){
  const CACHE_KEY = 'coachpulse:centralPlayers';
  const CUSTOM_CACHE_KEY = 'coachpulse:customPlayers';

  function asText(value){ return String(value ?? '').trim(); }
  function normalizeUpper(value){ return asText(value).toUpperCase(); }

  function stableId(...parts){
    const raw = parts.map(part =>
      asText(part).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    ).join('-');
    return raw.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `id-${Date.now().toString(36)}`;
  }

  function displayName(player){
    const nom = player?.nom || player?.lastName || '';
    const prenom = player?.prenom || player?.firstName || '';
    return asText(player?.displayName || [nom, prenom].filter(Boolean).join(' '));
  }

  function normalizePlayer(raw={}){
    const full = asText(raw.displayName || raw.joueuse || raw.name || raw.playerName);
    let nom = asText(raw.nom || raw.lastName);
    let prenom = asText(raw.prenom || raw.firstName);

    if(!nom && full){
      const parts = full.split(/\s+/).filter(Boolean);
      nom = parts.shift() || '';
      prenom = parts.join(' ');
    }

    const categorie = asText(raw.categorie || raw.category);
    const subCategory = asText(raw.subCategory || raw.sousCategorie || raw.sous_category);
    const birth = asText(raw.birth || raw.dateNaissance || raw.birthDate);
    const playerId = asText(raw.playerId || raw.id) || stableId('player', nom, prenom, categorie, subCategory, birth);
    const team = asText(raw.team || raw.equipe || categorie);

    return {
      ...raw,
      id: playerId,
      playerId,
      nom: normalizeUpper(nom),
      prenom,
      displayName: asText(raw.displayName || [normalizeUpper(nom), prenom].filter(Boolean).join(' ')),
      categorie,
      subCategory,
      team,
      teamId: asText(raw.teamId) || stableId('team', team || categorie || 'global'),
      poste: asText(raw.poste || raw.position),
      photo: asText(raw.photo || raw.avatar),
      birth,
      dateNaissance: asText(raw.dateNaissance || birth),
      status: asText(raw.status || 'active')
    };
  }

  function parseCache(key){
    try{
      const rows = JSON.parse(global.localStorage?.getItem(key) || '[]');
      return Array.isArray(rows) ? rows : [];
    }catch(_e){ return []; }
  }

  function dedupePlayers(players=[]){
    const byId = new Map();
    players.map(normalizePlayer).forEach(player => {
      if(player.playerId) byId.set(player.playerId, {...(byId.get(player.playerId)||{}), ...player});
    });
    return [...byId.values()].sort((a,b) => displayName(a).localeCompare(displayName(b), 'fr'));
  }

  function readCachedPlayers(){
    return dedupePlayers([...parseCache(CACHE_KEY), ...parseCache(CUSTOM_CACHE_KEY)]);
  }

  function writeCache(players){
    const normalized = dedupePlayers(players);
    try{ global.localStorage?.setItem(CACHE_KEY, JSON.stringify(normalized)); }catch(_e){}
    return normalized;
  }

  async function readFirestorePlayers({firebaseFns, db}={}){
    if(!firebaseFns || !db) return readCachedPlayers();
    const snap = await firebaseFns.getDocs(firebaseFns.collection(db, 'players'));
    const rows = [];
    snap.forEach(docSnap => rows.push(normalizePlayer({id:docSnap.id, playerId:docSnap.id, ...docSnap.data()})));
    return writeCache(rows);
  }

  function filterPlayers(players=[], filters={}){
    const q = asText(filters.q).toLowerCase();
    return dedupePlayers(players).filter(player =>
      (!q || displayName(player).toLowerCase().includes(q))
      && (!filters.categorie || player.categorie === filters.categorie)
      && (!filters.subCategory || player.subCategory === filters.subCategory)
      && (!filters.team || player.team === filters.team)
      && (!filters.status || player.status === filters.status)
    );
  }

  const service = {
    CACHE_KEY, CUSTOM_CACHE_KEY, stableId, displayName,
    normalizePlayer, dedupePlayers, readCachedPlayers,
    readFirestorePlayers, writeCache, filterPlayers
  };

  global.CoachPulsePlayersService = service;
  if(typeof module !== 'undefined' && module.exports) module.exports = service;
})(typeof window !== 'undefined' ? window : globalThis);
