// CoachPulse shared teams service.
// Phase 1: canonical team model + database option helpers.

(function(global){
  const COLLECTION = 'teams';
  const SETTINGS_COLLECTION = 'settings';
  const OPTIONS_ID = 'database-options';
  const DEFAULT_DB_OPTIONS = {
    categories:['U7','U8-U9','U10-U11','U12-U13','U12-U13-U14','U14-U15-U16','U19','R1'],
    subCategories:['U7','U8','U9','U10','U11','U12','U13','U14','U15','U16','U19','R1']
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

  function normalizeTeam(raw={}){
    const name = asText(raw.name || raw.team || raw.equipe);
    const teamId = asText(raw.teamId || raw.id) || stableId('team', name || raw.category || 'global');
    return {
      ...raw,
      id:teamId,
      teamId,
      name,
      category:asText(raw.category || raw.categorie),
      subCategories:Array.isArray(raw.subCategories) ? cleanOptionList(raw.subCategories) : [],
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

  async function listTeams(ctx={}){
    const {firebaseFns, db} = firestoreContext(ctx);
    const snap = await firebaseFns.getDocs(firebaseFns.collection(db, COLLECTION));
    const teams = [];
    snap.forEach(docSnap => teams.push(normalizeTeam({id:docSnap.id, teamId:docSnap.id, ...docSnap.data()})));
    return teams.sort((a,b) => String(a.name || '').localeCompare(String(b.name || ''), 'fr'));
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

  async function readDatabaseOptions(ctx={}){
    if(!ctx.firebaseFns || !ctx.db) return {...DEFAULT_DB_OPTIONS};
    const {firebaseFns, db} = firestoreContext(ctx);
    const snap = await firebaseFns.getDoc(firebaseFns.doc(db, SETTINGS_COLLECTION, OPTIONS_ID));
    const data = snap.exists() ? snap.data() : {};
    return {
      categories:Array.isArray(data.categories) && data.categories.length ? data.categories : DEFAULT_DB_OPTIONS.categories,
      subCategories:Array.isArray(data.subCategories) && data.subCategories.length ? data.subCategories : DEFAULT_DB_OPTIONS.subCategories
    };
  }

  async function saveDatabaseOptions(options={}, ctx={}){
    const {firebaseFns, db} = firestoreContext(ctx);
    const clean = {
      settingsId:OPTIONS_ID,
      categories:cleanOptionList(options.categories),
      subCategories:cleanOptionList(options.subCategories),
      updatedAt:firebaseFns.serverTimestamp ? firebaseFns.serverTimestamp() : undefined,
      updatedAtIso:nowIso(),
      updatedBy:ctx.user?.uid || '',
      updatedByEmail:ctx.user?.email || ''
    };
    await firebaseFns.setDoc(firebaseFns.doc(db, SETTINGS_COLLECTION, OPTIONS_ID), clean, {merge:true});
    return clean;
  }

  const service = {
    COLLECTION, SETTINGS_COLLECTION, OPTIONS_ID, DEFAULT_DB_OPTIONS,
    stableId, cleanOptionList, normalizeTeam, normalizeTeamForWrite,
    listTeams, getTeam, saveTeam, readDatabaseOptions, saveDatabaseOptions
  };

  global.CoachPulseTeamsService = service;
  if(typeof module !== 'undefined' && module.exports) module.exports = service;
})(typeof window !== 'undefined' ? window : globalThis);
