// CoachPulse shared teams service.
// Phase 1: canonical team model + database option helpers.

(function(global){
  const COLLECTION = 'teams';
  const SETTINGS_COLLECTION = 'settings';
  const OPTIONS_ID = 'database-options';
  const OFFICIAL_TEAMS = [
    {name:'U7 A', category:'U6-U7', subCategories:['U6','U7']},
    {name:'U9 A', category:'U8-U9', subCategories:['U8','U9']},
    {name:'U11 A', category:'U10-U11', subCategories:['U10','U11']},
    {name:'U13 A', category:'U12-U13', subCategories:['U12','U13']},
    {name:'U13 B', category:'U12-U13', subCategories:['U12','U13']},
    {name:'U16 A', category:'U14-U15-U16', subCategories:['U14','U15','U16']},
    {name:'U19', category:'U19', subCategories:['U17','U18','U19']},
    {name:'R1', category:'R1', subCategories:['R1']}
  ];
  const DEFAULT_DB_OPTIONS = {
    categories:['U6-U7','U8-U9','U10-U11','U12-U13','U12-U13-U14','U14-U15-U16','U19','R1'],
    subCategories:['U6','U7','U8','U9','U10','U11','U12','U13','U14','U15','U16','U17','U18','U19','R1'],
    teams:OFFICIAL_TEAMS.map(team => team.name)
  };

  function asText(value){ return String(value ?? '').trim(); }
  function nowIso(){ return new Date().toISOString(); }

  function stableId(){
    const raw = Array.from(arguments).map(part =>
      asText(part).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    ).join('-');
    return raw.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || `id-${Date.now().toString(36)}`;
  }

  function cleanOptionList(values){
    return [...new Set((values || []).map(v => asText(v)).filter(Boolean))];
  }

  function normalizeTeamName(value){
    return asText(value).toUpperCase().replace(/\s+/g, ' ');
  }

  function compactTeamKey(value){
    return normalizeTeamName(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/g, '');
  }

  function officialTeamByName(name){
    const key = compactTeamKey(name);
    return OFFICIAL_TEAMS.find(team => compactTeamKey(team.name) === key) || null;
  }

  function resolveOfficialTeam(value, fallback=''){
    const direct = officialTeamByName(value);
    if(direct) return direct;
    const fromSub = defaultTeamForSubCategory(value || fallback);
    return officialTeamByName(fromSub) || null;
  }

  function canonicalTeamId(name){
    const official = resolveOfficialTeam(name);
    return stableId('team', official?.name || normalizeTeamName(name));
  }

  function defaultTeamForSubCategory(value){
    const raw = normalizeTeamName(value);
    if(raw === 'R1' || raw.includes('SENIOR') || raw.includes('SÉNIOR')) return 'R1';
    const n = Number((raw.match(/\d+/) || [])[0] || 0);
    if(!n) return '';
    if(n <= 7) return 'U7 A';
    if(n <= 9) return 'U9 A';
    if(n <= 11) return 'U11 A';
    if(n <= 13) return 'U13 A';
    if(n <= 16) return 'U16 A';
    return 'U19';
  }

  function officialTeamRows(){
    return OFFICIAL_TEAMS.map(team => normalizeTeam({
      ...team,
      teamId:canonicalTeamId(team.name),
      source:'CoachPulse officiel',
      status:'active'
    }));
  }

  function mergeWithOfficialTeams(teams=[]){
    const byId = new Map(officialTeamRows().map(team => [team.teamId, team]));
    teams.map(normalizeTeam).filter(team => byId.has(team.teamId)).forEach(team => byId.set(team.teamId, {...(byId.get(team.teamId) || {}), ...team, name:byId.get(team.teamId)?.name || team.name}));
    return [...byId.values()].sort((a,b) => String(a.name || '').localeCompare(String(b.name || ''), 'fr', {numeric:true}));
  }

  function normalizeTeam(raw={}){
    const sourceName = raw.name || raw.team || raw.equipe || raw.category || raw.categorie;
    const official = resolveOfficialTeam(sourceName, raw.category || raw.categorie);
    const name = official ? official.name : normalizeTeamName(sourceName);
    const teamId = official ? canonicalTeamId(official.name) : (asText(raw.teamId || raw.id) || canonicalTeamId(name || raw.category || 'global'));
    return {
      ...raw,
      id:teamId,
      teamId,
      name,
      category:official?.category || asText(raw.category || raw.categorie),
      subCategories:official?.subCategories || (Array.isArray(raw.subCategories) ? cleanOptionList(raw.subCategories) : []),
      status:asText(raw.status || 'active').toLowerCase(),
      source:asText(raw.source || 'CoachPulse')
    };
  }

  function normalizeTeamForWrite(raw={}, context={}){
    const team = normalizeTeam(raw);
    const iso = context.nowIso || nowIso();
    const clean = {
      ...team,
      updatedAtIso:iso,
      updatedBy:context.user?.uid || raw.updatedBy || '',
      updatedByEmail:context.user?.email || raw.updatedByEmail || ''
    };
    if(context.firebaseFns?.serverTimestamp) clean.updatedAt = context.firebaseFns.serverTimestamp();
    if(!raw.createdAtIso) clean.createdAtIso = iso;
    return clean;
  }

  function firestoreContext({firebaseFns, db}={}){
    if(!firebaseFns || !db) throw new Error('Connexion Firebase requise.');
    return {firebaseFns, db};
  }

  async function listTeams(ctx={}, options={}){
    const {firebaseFns, db} = firestoreContext(ctx);
    const snap = await firebaseFns.getDocs(firebaseFns.collection(db, COLLECTION));
    const teams = [];
    snap.forEach(docSnap => teams.push(normalizeTeam({id:docSnap.id, teamId:docSnap.id, ...docSnap.data()})));
    const merged = mergeWithOfficialTeams(teams);
    return options.includeArchived ? merged : merged.filter(team => team.status !== 'archived');
  }

  async function ensureOfficialTeams(ctx={}){
    const {firebaseFns, db} = firestoreContext(ctx);
    const existingSnap = await firebaseFns.getDocs(firebaseFns.collection(db, COLLECTION));
    const existing = [];
    existingSnap.forEach(docSnap => existing.push({id:docSnap.id, teamId:docSnap.id, ...docSnap.data()}));
    const officialIds = new Set(officialTeamRows().map(team => team.teamId));
    const writes = [];
    officialTeamRows().forEach(team => {
      const clean = normalizeTeamForWrite({...team, source:'CoachPulse officiel', status:'active'}, {firebaseFns, user:ctx.user});
      if(firebaseFns.serverTimestamp) clean.createdAt = clean.createdAt || firebaseFns.serverTimestamp();
      writes.push(firebaseFns.setDoc(firebaseFns.doc(db, COLLECTION, team.teamId), clean, {merge:true}));
    });
    existing.forEach(raw => {
      const normalized = normalizeTeam(raw);
      const originalId = raw.teamId || raw.id;
      if(!originalId || officialIds.has(originalId)) return;
      const replacementId = officialIds.has(normalized.teamId) ? normalized.teamId : '';
      writes.push(firebaseFns.setDoc(firebaseFns.doc(db, COLLECTION, originalId), {
        ...raw,
        status:'archived',
        replacedByTeamId:replacementId,
        updatedAt:firebaseFns.serverTimestamp ? firebaseFns.serverTimestamp() : undefined,
        updatedAtIso:nowIso(),
        updatedBy:ctx.user?.uid || '',
        updatedByEmail:ctx.user?.email || ''
      }, {merge:true}));
    });
    await Promise.all(writes);
    return officialTeamRows();
  }

  async function getTeam(teamId, ctx={}){
    if(!teamId) return null;
    const {firebaseFns, db} = firestoreContext(ctx);
    const snap = await firebaseFns.getDoc(firebaseFns.doc(db, COLLECTION, teamId));
    return snap.exists() ? normalizeTeam({id:snap.id, teamId:snap.id, ...snap.data()}) : null;
  }

  async function saveTeam(team={}, ctx={}){
    const {firebaseFns, db} = firestoreContext(ctx);
    const clean = normalizeTeamForWrite(team, {firebaseFns, user:ctx.user});
    if(!clean.name) throw new Error('Nom d’équipe obligatoire.');
    const ref = firebaseFns.doc(db, COLLECTION, clean.teamId);
    const beforeSnap = await firebaseFns.getDoc(ref);
    const before = beforeSnap.exists() ? normalizeTeam({id:beforeSnap.id, teamId:beforeSnap.id, ...beforeSnap.data()}) : null;
    const payload = {...clean};
    if(before && before.createdAtIso) delete payload.createdAtIso;
    if(!before && firebaseFns.serverTimestamp) payload.createdAt = firebaseFns.serverTimestamp();
    await firebaseFns.setDoc(ref, payload, {merge:true});
    return {team:clean, before, created:!before};
  }

  async function archiveTeam(teamId, archived=true, ctx={}){
    const {firebaseFns, db} = firestoreContext(ctx);
    const ref = firebaseFns.doc(db, COLLECTION, teamId);
    const beforeSnap = await firebaseFns.getDoc(ref);
    const before = beforeSnap.exists() ? normalizeTeam({id:beforeSnap.id, teamId:beforeSnap.id, ...beforeSnap.data()}) : officialTeamRows().find(team => team.teamId === teamId) || null;
    if(!before) throw new Error('Équipe introuvable.');
    const clean = normalizeTeamForWrite({...before, status:archived ? 'archived' : 'active'}, {firebaseFns, user:ctx.user});
    await firebaseFns.setDoc(ref, clean, {merge:true});
    return {team:clean, before};
  }

  async function readDatabaseOptions(ctx={}){
    if(!ctx.firebaseFns || !ctx.db) return {...DEFAULT_DB_OPTIONS};
    const {firebaseFns, db} = firestoreContext(ctx);
    const snap = await firebaseFns.getDoc(firebaseFns.doc(db, SETTINGS_COLLECTION, OPTIONS_ID));
    const data = snap.exists() ? snap.data() : {};
    return {
      categories:Array.isArray(data.categories) && data.categories.length ? data.categories : DEFAULT_DB_OPTIONS.categories,
      subCategories:Array.isArray(data.subCategories) && data.subCategories.length ? data.subCategories : DEFAULT_DB_OPTIONS.subCategories,
      teams:DEFAULT_DB_OPTIONS.teams
    };
  }

  async function saveDatabaseOptions(options={}, ctx={}){
    const {firebaseFns, db} = firestoreContext(ctx);
    const officialNames = DEFAULT_DB_OPTIONS.teams;
    const clean = {
      settingsId:OPTIONS_ID,
      categories:cleanOptionList(options.categories),
      subCategories:cleanOptionList(options.subCategories),
      teams:officialNames,
      updatedAt:firebaseFns.serverTimestamp ? firebaseFns.serverTimestamp() : undefined,
      updatedAtIso:nowIso(),
      updatedBy:ctx.user?.uid || '',
      updatedByEmail:ctx.user?.email || ''
    };
    await firebaseFns.setDoc(firebaseFns.doc(db, SETTINGS_COLLECTION, OPTIONS_ID), clean, {merge:true});
    return clean;
  }

  const service = {
    COLLECTION, SETTINGS_COLLECTION, OPTIONS_ID, OFFICIAL_TEAMS, DEFAULT_DB_OPTIONS,
    stableId, canonicalTeamId, defaultTeamForSubCategory, resolveOfficialTeam, cleanOptionList,
    officialTeamRows, mergeWithOfficialTeams, normalizeTeam, normalizeTeamForWrite,
    listTeams, ensureOfficialTeams, getTeam, saveTeam, archiveTeam, readDatabaseOptions, saveDatabaseOptions
  };

  global.CoachPulseTeamsService = service;
  if(typeof module !== 'undefined' && module.exports) module.exports = service;
})(typeof window !== 'undefined' ? window : globalThis);
