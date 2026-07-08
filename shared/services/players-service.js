// CoachPulse shared players service.
// Phase 1: canonical player model + CRUD helpers, while keeping legacy local cache compatibility.

(function(global){
  const CACHE_KEY = 'coachpulse:centralPlayers';
  const CUSTOM_CACHE_KEY = 'coachpulse:customPlayers';
  const COLLECTION = 'players';
  const ACTIVE_STATUSES = ['active', 'injured', 'left', 'archived'];
  const PLAYER_REF_COLLECTIONS = ['matchEvents', 'attendance', 'technicalTests', 'physicalTests', 'injuries', 'injuryUpdates', 'medicalAppointments', 'rehabRoutines', 'workloads', 'medicalFollowUps', 'convocations', 'individualReports'];
  const OFFICIAL_TEAMS = ['U7 A','U9 A','U11 A','U13 A','U13 B','U16 A','U19','R1'];

  function asText(value){ return String(value ?? '').trim(); }
  function normalizeUpper(value){ return asText(value).toUpperCase(); }
  function nowIso(){ return new Date().toISOString(); }

  function stableId(){
    const raw = Array.from(arguments).map(part =>
      asText(part).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    ).join('-');
    return raw.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || `id-${Date.now().toString(36)}`;
  }

  function seasonFromDate(date=new Date()){
    const d = date instanceof Date ? date : new Date(date);
    const safe = Number.isNaN(d.getTime()) ? new Date() : d;
    const year = safe.getFullYear();
    return safe.getMonth() >= 6 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  }

  function seasonEndYear(season=seasonFromDate()){
    const match = asText(season).match(/(\d{4})\s*-\s*(\d{4})/);
    return match ? Number(match[2]) : Number(seasonFromDate().slice(5));
  }

  function birthYear(playerOrDate){
    const value = typeof playerOrDate === 'object' && playerOrDate
      ? asText(playerOrDate.birth || playerOrDate.dateNaissance || playerOrDate.birthDate)
      : asText(playerOrDate);
    if(!value) return 0;
    const iso = value.match(/^(\d{4})[-/]/);
    if(iso) return Number(iso[1]);
    const fr = value.match(/(?:^|\/)(\d{4})$/);
    if(fr) return Number(fr[1]);
    const any = value.match(/\b(19|20)\d{2}\b/);
    return any ? Number(any[0]) : 0;
  }

  function subCategoryForSeason(player={}, season=seasonFromDate()){
    const year = birthYear(player);
    if(!year) return '';
    const ageCategory = seasonEndYear(season) - year;
    if(ageCategory >= 6 && ageCategory <= 19) return `U${ageCategory}`;
    if(ageCategory > 19) return 'R1';
    return '';
  }

  function categorySnapshotForSeason(player={}, season=seasonFromDate()){
    const selectedSeason = asText(season) || seasonFromDate();
    const history = player?.seasonHistory && typeof player.seasonHistory === 'object' ? player.seasonHistory : {};
    const fromHistory = history[selectedSeason] || {};
    const computedSub = subCategoryForSeason(player, selectedSeason);
    const subCategory = computedSub || asText(fromHistory.subCategory || player.subCategory || player.sousCategorie);
    const categorie = normalizeTeamFromCategory(subCategory || fromHistory.categorie || player.categorie || player.category);
    const seasonTeam = computedSub ? defaultClubTeamFromSubCategory(subCategory) : '';
    const team = resolveClubTeam(fromHistory.team || seasonTeam || player.team || player.equipe, subCategory || categorie) || asText(fromHistory.team || seasonTeam || player.team || player.equipe || categorie);
    const teamId = canonicalTeamId(team || categorie);
    return {season:selectedSeason, categorie, subCategory, team, teamId};
  }

  function normalizeTeamFromCategory(category){
    const c = normalizeUpper(category);
    const n = Number((c.match(/\d+/) || [])[0] || 0);
    if(c.includes('R1') || c.includes('SENIOR') || c.includes('SÉNIOR')) return 'R1';
    if(!n) return c || 'Non renseignee';
    if(n <= 7) return 'U6-U7';
    if(n <= 9) return 'U8-U9';
    if(n <= 11) return 'U10-U11';
    if(n <= 13) return 'U12-U13';
    if(n <= 14) return 'U12-U13-U14';
    if(n <= 16) return 'U14-U15-U16';
    return 'U19';
  }

  function defaultClubTeamFromSubCategory(value){
    const c = normalizeUpper(value);
    if(c.includes('R1') || c.includes('SENIOR') || c.includes('SÉNIOR')) return 'R1';
    const n = Number((c.match(/\d+/) || [])[0] || 0);
    if(!n) return '';
    if(n <= 7) return 'U7 A';
    if(n <= 9) return 'U9 A';
    if(n <= 11) return 'U11 A';
    if(n <= 13) return 'U13 A';
    if(n <= 16) return 'U16 A';
    return 'U19';
  }

  function compactTeamKey(value){
    return normalizeUpper(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/g, '');
  }

  function officialClubTeam(value){
    const key = compactTeamKey(value);
    return OFFICIAL_TEAMS.find(team => compactTeamKey(team) === key) || '';
  }

  function resolveClubTeam(value, fallback=''){
    return officialClubTeam(value) || defaultClubTeamFromSubCategory(value || fallback) || officialClubTeam(fallback) || '';
  }

  function isOfficialTeamId(value){
    const ids = OFFICIAL_TEAMS.map(team => stableId('team', team));
    return ids.includes(asText(value));
  }

  function canonicalTeamId(value){
    const team = resolveClubTeam(value) || asText(value).toUpperCase().replace(/\s+/g, ' ');
    return stableId('team', team || 'global');
  }

  function displayName(player){
    const nom = player?.nom || player?.lastName || '';
    const prenom = player?.prenom || player?.firstName || '';
    return normalizeUpper(player?.displayName || [prenom, normalizeUpper(nom)].filter(Boolean).join(' '));
  }

  function keyPart(value){
    return asText(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
  }

  function identityKey(player, withBirth=false){
    const names = splitName(player || {});
    const birth = asText(player?.birth || player?.dateNaissance || player?.birthDate);
    const parts = [names.nom, names.prenom];
    if(withBirth) parts.push(birth);
    const key = parts.map(keyPart).join('|');
    return key.replace(/\|/g, '') ? key : '';
  }

  function personKey(player){
    const names = splitName(player || {});
    const key = [names.nom, names.prenom].map(keyPart).join('|');
    return key.replace(/\|/g, '') ? key : '';
  }
  function canonicalPlayerId(raw={}){
    const names = splitName(raw);
    const birth = asText(raw.birth || raw.dateNaissance || raw.birthDate);
    if(!names.nom || !names.prenom || !birth) return '';
    return stableId('player', names.prenom, names.nom, birth);
  }

  function isOfficialCategory(value){
    const key = normalizeUpper(value).replace(/\s+/g, '');
    return ['U6-U7','U7','U8-U9','U10-U11','U12-U13','U12-U13-U14','U14-U15-U16','U19','R1'].includes(key);
  }

  function isOfficialSubCategory(value){
    const key = normalizeUpper(value).replace(/\s+/g, '');
    return ['U6','U7','U8','U9','U10','U11','U12','U13','U14','U15','U16','U17','U18','U19','R1'].includes(key);
  }

  function looksLikeImportSeason(value){
    return /^U20\d{2}$/i.test(asText(value));
  }

  function splitName(raw={}){
    const full = asText(raw.displayName || raw.joueuse || raw.name || raw.fullName || raw.playerName);
    let nom = asText(raw.nom || raw.lastName);
    let prenom = asText(raw.prenom || raw.firstName);

    if((!nom || !prenom) && full){
      const parts = full.split(/\s+/).filter(Boolean);
      const upper = [];
      while(parts.length && parts[0] === parts[0].toUpperCase()) upper.push(parts.shift());
      if(upper.length && parts.length){
        nom = nom || upper.join(' ');
        prenom = prenom || parts.join(' ');
      }else{
        nom = nom || parts.slice(0, -1).join(' ');
        prenom = prenom || parts.slice(-1).join(' ');
      }
    }

    return {nom:normalizeUpper(nom), prenom:normalizeUpper(prenom)};
  }

  function normalizePlayer(raw={}){
    const names = splitName(raw);
    const birth = asText(raw.birth || raw.dateNaissance || raw.birthDate);
    const sourceSeason = asText(raw.season || raw.saison || raw.currentSeason) || seasonFromDate();
    const currentSeason = seasonFromDate();
    const storedCategorie = asText(raw.categorie || raw.category);
    const storedSubCategory = asText(raw.subCategory || raw.sousCategorie || raw.sous_category || storedCategorie);
    const sourceSubCategory = subCategoryForSeason({...raw, birth}, sourceSeason) || storedSubCategory;
    const sourceCategory = normalizeTeamFromCategory(sourceSubCategory || storedCategorie);
    const categorie = isOfficialCategory(storedCategorie) ? storedCategorie : sourceCategory;
    const subCategory = isOfficialSubCategory(sourceSubCategory) ? sourceSubCategory : storedSubCategory;
    const team = resolveClubTeam(raw.team || raw.equipe, subCategory || categorie) || asText(sourceCategory || normalizeTeamFromCategory(subCategory || categorie));
    const importedId = raw.id && !String(raw.id).startsWith('manual-') ? asText(raw.id) : '';
    const previousId = asText(raw.playerId || importedId);
    const generatedId = canonicalPlayerId({...raw, ...names, birth}) || stableId('player', names.prenom, names.nom, birth || 'no-birth');
    const playerId = generatedId || previousId;
    const legacyPlayerIds = [...new Set([
      ...(Array.isArray(raw.legacyPlayerIds) ? raw.legacyPlayerIds : []),
      raw.legacyPlayerId,
      raw.oldPlayerId,
      previousId && previousId !== playerId ? previousId : ''
    ].map(asText).filter(Boolean))];
    const status = asText(raw.status || 'active').toLowerCase();
    const seasonHistory = raw.seasonHistory && typeof raw.seasonHistory === 'object' ? {...raw.seasonHistory} : {};
    if(sourceSeason) seasonHistory[sourceSeason] = {
      categorie,
      subCategory,
      team,
      updatedAtIso: asText(raw.updatedAtIso || raw.createdAtIso || '')
    };
    const currentSnapshot = categorySnapshotForSeason({...raw, birth, categorie, subCategory, team, seasonHistory}, currentSeason);

    return {
      ...raw,
      id: playerId,
      playerId,
      legacyPlayerId: legacyPlayerIds[0] || raw.legacyPlayerId || '',
      legacyPlayerIds,
      nom: names.nom,
      prenom: names.prenom,
      displayName: displayName({...raw, nom:names.nom, prenom:names.prenom}),
      categorie: currentSnapshot.categorie || categorie,
      subCategory: currentSnapshot.subCategory || subCategory,
      team: currentSnapshot.team || team,
      teamId: isOfficialTeamId(raw.teamId) ? asText(raw.teamId) : (currentSnapshot.teamId || canonicalTeamId(currentSnapshot.team || team || categorie || 'global')),
      poste: asText(raw.poste || raw.position),
      numero: asText(raw.numero || raw.number),
      photo: asText(raw.photo || raw.avatar),
      foot: asText(raw.foot || raw.pied),
      birth,
      dateNaissance: asText(raw.dateNaissance || birth),
      currentSeason,
      seasonStart: currentSeason ? `${currentSeason.slice(0,4)}-07-01` : '',
      seasonEnd: currentSeason ? `${currentSeason.slice(5)}-06-30` : '',
      seasonHistory,
      status: ACTIVE_STATUSES.includes(status) ? status : status || 'active',
      source: asText(raw.source || 'CoachPulse')
    };
  }

  function normalizePlayerForWrite(raw={}, context={}){
    const player = normalizePlayer(raw);
    const iso = context.nowIso || nowIso();
    const clean = {
      ...player,
      updatedAtIso: iso,
      updatedBy: context.user?.uid || raw.updatedBy || '',
      updatedByEmail: context.user?.email || raw.updatedByEmail || ''
    };
    if(context.firebaseFns?.serverTimestamp) clean.updatedAt = context.firebaseFns.serverTimestamp();
    if(!raw.createdAtIso) clean.createdAtIso = iso;
    return clean;
  }

  function parseCache(key){
    try{
      const rows = JSON.parse(global.localStorage?.getItem(key) || '[]');
      return Array.isArray(rows) ? rows : [];
    }catch(_e){ return []; }
  }

  function mergePlayerRecords(previous={}, incoming={}){
    const preferredId = previous.playerId || previous.id || incoming.playerId || incoming.id;
    const merged = {...previous};
    Object.keys(incoming).forEach(key => {
      if((merged[key] == null || merged[key] === '') && incoming[key] != null && incoming[key] !== '') merged[key] = incoming[key];
    });
    if(incoming.photo && !previous.photo) merged.photo = incoming.photo;
    if(incoming.avatar && !previous.avatar) merged.avatar = incoming.avatar;
    if(incoming.subCategory && (!isOfficialSubCategory(merged.subCategory) || looksLikeImportSeason(merged.subCategory)) && isOfficialSubCategory(incoming.subCategory)){
      merged.subCategory = incoming.subCategory;
    }
    if(incoming.categorie && !isOfficialCategory(merged.categorie) && isOfficialCategory(incoming.categorie)){
      merged.categorie = incoming.categorie;
    }
    if(incoming.team && (!merged.team || looksLikeImportSeason(merged.team)) && !looksLikeImportSeason(incoming.team)){
      merged.team = incoming.team;
    }
    if(preferredId){
      merged.playerId = preferredId;
      merged.id = preferredId;
    }
    return normalizePlayer(merged);
  }

  function playerForSeason(player={}, season=seasonFromDate()){
    const normalized = normalizePlayer(player);
    const snapshot = categorySnapshotForSeason(normalized, season);
    return {
      ...normalized,
      categorie:snapshot.categorie || normalized.categorie,
      subCategory:snapshot.subCategory || normalized.subCategory,
      team:snapshot.team || normalized.team,
      teamId:snapshot.teamId || canonicalTeamId(snapshot.team || normalized.team || snapshot.categorie || normalized.categorie || 'global'),
      currentSeason:snapshot.season || normalized.currentSeason,
      seasonStart:snapshot.season ? `${snapshot.season.slice(0,4)}-07-01` : normalized.seasonStart,
      seasonEnd:snapshot.season ? `${snapshot.season.slice(5)}-06-30` : normalized.seasonEnd
    };
  }

  function dedupePlayers(players=[]){
    const byCanonicalKey = new Map();
    const aliases = new Map();
    players.map(normalizePlayer).forEach(player => {
      const aliasCandidates = [
        player.playerId,
        player.id,
        identityKey(player, true),
        identityKey(player, false),
        personKey(player)
      ].filter(Boolean);
      const canonicalKey = aliasCandidates.map(key => aliases.get(key)).find(Boolean) || aliasCandidates[0];
      if(!canonicalKey) return;
      const merged = byCanonicalKey.has(canonicalKey)
        ? mergePlayerRecords(byCanonicalKey.get(canonicalKey), player)
        : player;
      byCanonicalKey.set(canonicalKey, merged);
      aliasCandidates.forEach(key => aliases.set(key, canonicalKey));
    });
    return [...byCanonicalKey.values()].sort((a,b) => displayName(a).localeCompare(displayName(b), 'fr'));
  }

  function readCachedPlayers(){
    return dedupePlayers([...parseCache(CACHE_KEY), ...parseCache(CUSTOM_CACHE_KEY)]);
  }

  function writeCache(players){
    const normalized = dedupePlayers(players);
    try{ global.localStorage?.setItem(CACHE_KEY, JSON.stringify(normalized)); }catch(_e){}
    return normalized;
  }

  function firestoreContext({firebaseFns, db}={}){
    if(!firebaseFns || !db) throw new Error('Connexion Firebase requise.');
    return {firebaseFns, db};
  }

  async function listPlayers(ctx={}, filters={}){
    if(!ctx.firebaseFns || !ctx.db) return filterPlayers(readCachedPlayers(), filters);
    const {firebaseFns, db} = firestoreContext(ctx);
    const snap = await firebaseFns.getDocs(firebaseFns.collection(db, COLLECTION));
    const rows = [];
    snap.forEach(docSnap => rows.push(normalizePlayer({id:docSnap.id, playerId:docSnap.id, ...docSnap.data()})));
    const normalized = writeCache([...rows, ...parseCache(CUSTOM_CACHE_KEY)]);
    return filterPlayers(normalized, filters);
  }

  async function readFirestorePlayers(ctx){ return listPlayers(ctx); }

  async function getPlayer(playerId, ctx={}){
    if(!playerId) return null;
    if(!ctx.firebaseFns || !ctx.db) return readCachedPlayers().find(p => p.playerId === playerId || p.id === playerId) || null;
    const {firebaseFns, db} = firestoreContext(ctx);
    const snap = await firebaseFns.getDoc(firebaseFns.doc(db, COLLECTION, playerId));
    return snap.exists() ? normalizePlayer({id:snap.id, playerId:snap.id, ...snap.data()}) : null;
  }

  async function savePlayer(player={}, ctx={}, options={}){
    const {firebaseFns, db} = firestoreContext(ctx);
    const clean = normalizePlayerForWrite(player, {firebaseFns, user:ctx.user});
    const ref = firebaseFns.doc(db, COLLECTION, clean.playerId);
    const beforeSnap = await firebaseFns.getDoc(ref);
    const before = beforeSnap.exists() ? normalizePlayer({id:beforeSnap.id, playerId:beforeSnap.id, ...beforeSnap.data()}) : null;
    const payload = {...clean};
    if(before && before.createdAtIso) delete payload.createdAtIso;
    if(!before && firebaseFns.serverTimestamp) payload.createdAt = firebaseFns.serverTimestamp();
    await firebaseFns.setDoc(ref, payload, {merge:true});
    if(options.writeTeam !== false && clean.teamId && clean.team){
      await firebaseFns.setDoc(firebaseFns.doc(db, 'teams', clean.teamId), {
        teamId:clean.teamId,
        name:clean.team,
        category:clean.categorie || '',
        source:'players',
        updatedAt:firebaseFns.serverTimestamp ? firebaseFns.serverTimestamp() : undefined,
        updatedAtIso:payload.updatedAtIso
      }, {merge:true});
    }
    await listPlayers(ctx).catch(()=>{});
    return {player:clean, before, created:!before};
  }

  async function archivePlayer(playerId, archived=true, ctx={}){
    const existing = await getPlayer(playerId, ctx);
    if(!existing) throw new Error('Joueuse introuvable.');
    return savePlayer({...existing, status:archived ? 'archived' : 'active'}, ctx, {writeTeam:false});
  }

  async function updatePlayerRefs({fromPlayerId, toPlayerId, collections=PLAYER_REF_COLLECTIONS}={}, ctx={}){
    if(!fromPlayerId || !toPlayerId) throw new Error('playerId manquant.');
    const {firebaseFns, db} = firestoreContext(ctx);
    const refCounts = {};
    for(const collectionName of collections){
      const snap = await firebaseFns.getDocs(firebaseFns.collection(db, collectionName));
      const writes = [];
      let count = 0;
      snap.forEach(docSnap => {
        const data = docSnap.data() || {};
        const directMatch = data.playerId === fromPlayerId;
        const arrayMatch = Array.isArray(data.playerIds) && data.playerIds.includes(fromPlayerId);
        const snapshotMatch = data.playerSnapshot && typeof data.playerSnapshot === 'object' && data.playerSnapshot.playerId === fromPlayerId;
        if(directMatch || arrayMatch || snapshotMatch){
          count++;
          const patch = {
            mergedFromPlayerId:fromPlayerId,
            updatedAt:firebaseFns.serverTimestamp ? firebaseFns.serverTimestamp() : undefined,
            updatedAtIso:nowIso(),
            updatedBy:ctx.user?.uid || '',
            updatedByEmail:ctx.user?.email || ''
          };
          if(directMatch) patch.playerId = toPlayerId;
          if(snapshotMatch) patch.playerSnapshot = {...data.playerSnapshot, playerId:toPlayerId};
          if(Array.isArray(data.playerIds)) patch.playerIds = data.playerIds.map(id => id === fromPlayerId ? toPlayerId : id);
          writes.push(firebaseFns.setDoc(firebaseFns.doc(db, collectionName, docSnap.id), {
            ...patch
          }, {merge:true}));
        }
      });
      await Promise.all(writes);
      refCounts[collectionName] = count;
    }
    return refCounts;
  }

  async function mergePlayers({primaryPlayerId, duplicatePlayerId, collections}={}, ctx={}){
    if(!primaryPlayerId || !duplicatePlayerId || primaryPlayerId === duplicatePlayerId) throw new Error('Choisis deux fiches différentes.');
    const primary = await getPlayer(primaryPlayerId, ctx);
    const duplicate = await getPlayer(duplicatePlayerId, ctx);
    if(!primary || !duplicate) throw new Error('Une des deux fiches est introuvable.');

    const refCounts = await updatePlayerRefs({fromPlayerId:duplicatePlayerId, toPlayerId:primaryPlayerId, collections}, ctx);
    const fill = {};
    ['photo','birth','dateNaissance','poste','numero','commentaireInterne','team','teamId','categorie','subCategory','foot'].forEach(key => {
      if((primary[key] == null || primary[key] === '') && duplicate[key]) fill[key] = duplicate[key];
    });
    if(Object.keys(fill).length) await savePlayer({...primary, ...fill}, ctx, {writeTeam:false});
    await savePlayer({
      ...duplicate,
      status:'archived',
      archivedReason:'Fusion doublon',
      mergedIntoPlayerId:primaryPlayerId
    }, ctx, {writeTeam:false});
    return {primary, duplicate, refCounts, filledFields:Object.keys(fill)};
  }

  function filterPlayers(players=[], filters={}){
    const q = asText(filters.q).toLowerCase();
    const displaySeason = filters.season && filters.season !== 'all' ? filters.season : seasonFromDate();
    return dedupePlayers(players).map(player => playerForSeason(player, displaySeason)).filter(player =>
      (!q || displayName(player).toLowerCase().includes(q))
      && (!filters.season || filters.season === 'all' || player.currentSeason === filters.season || player.seasonHistory?.[filters.season])
      && (filters.includeArchived || filters.status || String(player.status || 'active').toLowerCase() !== 'archived')
      && (!filters.categorie || player.categorie === filters.categorie)
      && (!filters.subCategory || player.subCategory === filters.subCategory)
      && (!filters.team || player.team === filters.team)
      && (!filters.status || String(player.status || '').toLowerCase() === String(filters.status).toLowerCase())
    );
  }

  const service = {
    CACHE_KEY, CUSTOM_CACHE_KEY, COLLECTION, PLAYER_REF_COLLECTIONS,
    stableId, canonicalPlayerId, canonicalTeamId, seasonFromDate, seasonEndYear, birthYear, subCategoryForSeason,
    categorySnapshotForSeason, playerForSeason, normalizeTeamFromCategory, defaultClubTeamFromSubCategory, resolveClubTeam, displayName, splitName,
    normalizePlayer, normalizePlayerForWrite, identityKey, personKey, dedupePlayers,
    readCachedPlayers, writeCache, filterPlayers,
    listPlayers, readFirestorePlayers, getPlayer, savePlayer, archivePlayer,
    updatePlayerRefs, mergePlayers
  };

  global.CoachPulsePlayersService = service;
  if(typeof module !== 'undefined' && module.exports) module.exports = service;
})(typeof window !== 'undefined' ? window : globalThis);
