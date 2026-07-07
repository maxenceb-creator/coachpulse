const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBySsATDTx_wQ2zzMMOBhlmr2tY1SvKZ6U",
  authDomain: "coach-pulse-ee6b0.firebaseapp.com",
  projectId: "coach-pulse-ee6b0",
  storageBucket: "coach-pulse-ee6b0.firebasestorage.app",
  messagingSenderId: "147021875262",
  appId: "1:147021875262:web:dd0a52857a7b252295e96f"
};

const ROLES = {
  core:['ADMIN','RESPONSABLE_CATEGORIE'],
  sportRead:['ADMIN','RESPONSABLE_CATEGORIE','COACH','PREPARATEUR_ATHLETIQUE','OBSERVATEUR_STAFF','LECTURE'],
  sportWrite:['ADMIN','RESPONSABLE_CATEGORIE','COACH'],
  physicalWrite:['ADMIN','RESPONSABLE_CATEGORIE','PREPARATEUR_ATHLETIQUE'],
  medicalRead:['ADMIN','RESPONSABLE_CATEGORIE','MEDICAL'],
  medicalWrite:['ADMIN','MEDICAL']
};

const DEFAULT_MODULE_REGISTRY = [
  {id:'home', name:'Accueil', icon:'🏠', section:'staff', active:true, collection:'settings', screen:{type:'internal'}, permissions:{read:['ADMIN','RESPONSABLE_CATEGORIE','COACH','PREPARATEUR_ATHLETIQUE','MEDICAL','OBSERVATEUR_STAFF','LECTURE']}, settings:{showInNav:true, showOnDashboard:false}},
  {id:'stats', name:'Matchs', icon:'📊', section:'staff', active:true, collection:'matches', relatedCollections:['matchEvents','players','teams','settings'], screen:{type:'iframe', src:'pages/coach-stats.html'}, permissions:{read:ROLES.sportRead, write:ROLES.sportWrite, importExport:ROLES.core}, settings:{showInNav:true, showOnDashboard:true, description:'Prise de statistiques et bilan match.'}},
  {id:'presences', name:'Présences', icon:'✅', section:'staff', active:true, collection:'attendance', relatedCollections:['sessions','players','teams','settings'], screen:{type:'iframe', src:'pages/presences.html'}, permissions:{read:ROLES.sportRead, write:['ADMIN','RESPONSABLE_CATEGORIE','COACH','PREPARATEUR_ATHLETIQUE'], importExport:ROLES.core}, settings:{showInNav:true, showOnDashboard:true, description:'Suivi séances, statuts et charge.'}},
  {id:'tests', name:'Tests', icon:'⚡', section:'staff', active:true, collection:'technicalTests', relatedCollections:['physicalTests','players','teams','settings'], screen:{type:'iframe', src:'pages/tests-techniques.html'}, permissions:{read:ROLES.sportRead, write:['ADMIN','RESPONSABLE_CATEGORIE','COACH','PREPARATEUR_ATHLETIQUE'], importExport:['ADMIN','RESPONSABLE_CATEGORIE','PREPARATEUR_ATHLETIQUE']}, settings:{showInNav:true, showOnDashboard:true, description:'Technique, progression et évaluations.'}},
  {id:'methodologie', name:'Bilans & planning', icon:'🧭', section:'staff', active:true, collection:'sessions', relatedCollections:['settings','teams'], screen:{type:'iframe', src:'pages/methodologie.html'}, permissions:{read:ROLES.sportRead, write:ROLES.sportWrite, importExport:ROLES.core}, settings:{showInNav:true, showOnDashboard:true, description:'Méthodologie, calendrier et attendus.'}},
  {id:'database', name:'Joueuses & base', icon:'🧩', section:'admin', active:true, collection:'players', relatedCollections:['teams','settings','changeLogs'], screen:{type:'iframe', src:'pages/admin-database.html'}, permissions:{read:ROLES.core, write:ROLES.core, importExport:ROLES.core}, settings:{showInNav:true, showOnDashboard:true, description:'Corriger la base Firestore commune.'}},
  {id:'dataHub', name:'Data Hub', icon:'🗄️', section:'admin', active:true, collection:'syncLogs', relatedCollections:['players','teams','matches','sessions','attendance','technicalTests','physicalTests'], screen:{type:'iframe', src:'pages/data-hub.html'}, permissions:{read:ROLES.core, write:ROLES.core, importExport:ROLES.core}, settings:{showInNav:true, showOnDashboard:true, description:'Importer, simuler et synchroniser.'}},
  {id:'admin', name:'Gestion utilisateurs', icon:'👥', section:'admin', active:true, collection:'staff_members', relatedCollections:['settings','changeLogs'], screen:{type:'internal'}, permissions:{read:['ADMIN'], write:['ADMIN'], importExport:['ADMIN']}, settings:{showInNav:true, showOnDashboard:true, description:'Rôles, équipes et comptes.'}},
  {id:'injuries', name:'Blessures', icon:'🩹', section:'future', active:false, collection:'injuries', relatedCollections:['players','teams','settings'], screen:{type:'iframe', src:'pages/blessures.html'}, permissions:{read:ROLES.medicalRead, write:ROLES.medicalWrite, importExport:ROLES.medicalWrite}, settings:{showInNav:false, showOnDashboard:false, description:'Suivi blessures et indisponibilités.'}},
  {id:'workload', name:'Charge de travail', icon:'📈', section:'future', active:false, collection:'workloads', relatedCollections:['players','teams','sessions'], screen:{type:'iframe', src:'pages/charge-travail.html'}, permissions:{read:ROLES.sportRead, write:ROLES.physicalWrite, importExport:ROLES.core}, settings:{showInNav:false, showOnDashboard:false, description:'Charge, volumes et ressentis.'}},
  {id:'convocations', name:'Convocations', icon:'📣', section:'future', active:false, collection:'convocations', relatedCollections:['players','teams','matches'], screen:{type:'iframe', src:'pages/convocations.html'}, permissions:{read:ROLES.sportRead, write:ROLES.sportWrite, importExport:ROLES.core}, settings:{showInNav:false, showOnDashboard:false, description:'Groupes, convocations et disponibilités.'}},
  {id:'medical', name:'Suivi médical', icon:'🩺', section:'staff', active:true, collection:'injuries', relatedCollections:['players','teams','injuryUpdates','medicalAppointments','rehabRoutines','settings'], screen:{type:'iframe', src:'pages/suivi-medical.html'}, permissions:{read:ROLES.medicalRead, write:ROLES.medicalWrite, importExport:ROLES.medicalWrite}, settings:{showInNav:true, showOnDashboard:true, description:'Blessures, douleurs, rendez-vous et reprise.'}},
  {id:'individualReports', name:'Bilans individuels', icon:'📝', section:'future', active:false, collection:'individualReports', relatedCollections:['players','teams','matches','attendance','technicalTests','physicalTests'], screen:{type:'iframe', src:'pages/bilans-individuels.html'}, permissions:{read:['ADMIN','RESPONSABLE_CATEGORIE','COACH','OBSERVATEUR_STAFF','LECTURE'], write:ROLES.sportWrite, importExport:ROLES.core}, settings:{showInNav:false, showOnDashboard:false, description:'Bilans individuels staff.'}}
];

function parseModuleOverrides(){
  try{ return JSON.parse(localStorage.getItem('coachpulse:moduleSettings') || '{}') || {}; }catch(_e){ return {}; }
}
function moduleWithOverrides(module){
  const overrides = parseModuleOverrides()[module.id] || {};
  return {...module, ...overrides, screen:{...(module.screen||{}), ...(overrides.screen||{})}, permissions:{...(module.permissions||{}), ...(overrides.permissions||{})}, settings:{...(module.settings||{}), ...(overrides.settings||{})}};
}
function moduleRegistry(){ return DEFAULT_MODULE_REGISTRY.map(moduleWithOverrides); }
function getModule(id){ return moduleRegistry().find(module => module.id === id); }
function moduleToTool(module){ return {title:module.name, emoji:module.icon, src:module.screen?.src || '', internal:module.screen?.type === 'internal', admin:module.section === 'admin' || module.permissions?.read?.every(role => ['ADMIN','RESPONSABLE','RESPONSABLE_CATEGORIE'].includes(role)), module}; }
function buildTools(){ return Object.fromEntries(moduleRegistry().filter(module => module.active !== false).map(module => [module.id, moduleToTool(module)])); }
let tools = buildTools();

let deferredPrompt = null;
let firebaseFns = null, fbApp = null, auth = null, db = null, currentUser = null, currentProfile = null, authReady = false, signingIn = false;
// Prévu pour évoluer avec Firebase Auth custom claims. Aujourd'hui, le rôle vient du document staff_members.
let currentUserRole = 'STAFF';
let syncTimer = null;
let realtimeUnsub = null;
let cloudWriteTimer = null;
let applyingCloud = false;
let lastCloudItemsHash = '';
let adminAccessChoiceCache = null;
const CLIENT_ID = (() => {
  let id = localStorage.getItem('coachpulse:clientId');
  if(!id){ id = 'cp-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36); localStorage.setItem('coachpulse:clientId', id); }
  return id;
})();

const frame = $('#toolFrame');
const shell = $('#shell');
const homeView = $('#homeView');
const adminView = $('#adminView');
const drawer = $('#drawer');
const overlay = $('#overlay');
const installBtn = $('#installBtn');
const cloudPanel = $('#cloudPanel');
const syncDot = $('#syncDot');
const syncText = $('#syncText');
const lastSave = $('#lastSave');
const authGate = $('#authGate');
const topUser = $('#topUser');

function closeDrawer(){ drawer.classList.remove('open'); overlay.classList.remove('show'); }
function openDrawer(){
  if(window.matchMedia('(max-width:1180px)').matches) shell.classList.remove('collapsed');
  drawer.classList.add('open');
  overlay.classList.add('show');
}
function requireAuth(){ return Boolean(authReady && currentUser); }
function getCurrentUserRole(){
  const service = permissionsService();
  if(service?.getRole) return service.getRole(currentProfile, currentUserRole);
  return (currentProfile?.role || currentUserRole || 'STAFF').toUpperCase();
}
function getCurrentPermissionLevel(){
  const service = permissionsService();
  if(service?.normalizePermission) return service.normalizePermission(null, currentProfile || {role:currentUserRole,status:'ACTIVE'});
  return currentProfile?.permissionLevel || 'LECTEUR';
}
function isAdmin(){
  const service = permissionsService();
  return service?.canManageCoreData ? service.canManageCoreData(currentProfile || {role:currentUserRole,status:'ACTIVE'}) : ['ADMIN','RESPONSABLE','RESPONSABLE_CATEGORIE'].includes(getCurrentUserRole());
}
function isSuperAdmin(){
  const service = permissionsService();
  return service?.canManageUsers ? service.canManageUsers(currentProfile || {role:currentUserRole,status:'ACTIVE'}) : getCurrentUserRole() === 'ADMIN';
}
function hasModulePermission(module, action='read'){
  const service = permissionsService();
  if(service?.canUseModule) return service.canUseModule(currentProfile || {role:currentUserRole,status:'ACTIVE'}, module, action);
  if(!module || module.active === false) return false;
  const roles = module.permissions?.[action] || module.permissions?.read || [];
  return roles.map(String).map(r => r.toUpperCase()).includes(getCurrentUserRole());
}
function canAccessTool(key){ return hasModulePermission(getModule(key), 'read'); }
function accessProfile(){
  return currentProfile || {uid:currentUser?.uid || '', email:currentUser?.email || '', role:currentUserRole, status:'ACTIVE'};
}
function canViewModule(moduleId){ return hasModulePermission(getModule(moduleId), 'read'); }
function canEditModule(moduleId){ return hasModulePermission(getModule(moduleId), 'write'); }
function canDeleteData(moduleId){
  const service = permissionsService();
  return service?.canDeleteData ? service.canDeleteData(accessProfile(), moduleId) : getCurrentUserRole() === 'ADMIN';
}
function canAccessTeamId(teamId){
  const service = permissionsService();
  return service?.canAccessTeam ? service.canAccessTeam(accessProfile(), teamId) : true;
}
function canAccessPlayerRecord(player){
  const service = permissionsService();
  return service?.canAccessPlayer ? service.canAccessPlayer(accessProfile(), player) : true;
}
function accessContext(){
  const profile = accessProfile();
  return {
    type:'coachpulse-access-context',
    user:{uid:currentUser?.uid || '', email:currentUser?.email || ''},
    profile:{
      uid:profile.uid || currentUser?.uid || '',
      email:profile.email || currentUser?.email || '',
      name:profile.name || currentUser?.displayName || currentUser?.email || '',
      role:getCurrentUserRole(),
      roleLabel:profile.roleLabel || permissionsService()?.roleLabel?.(getCurrentUserRole()) || getCurrentUserRole(),
      permissionLevel:getCurrentPermissionLevel(),
      permissionLabel:permissionsService()?.permissionLabel?.(getCurrentPermissionLevel()) || getCurrentPermissionLevel(),
      status:profile.status || 'ACTIVE',
      teamIds:profile.teamIds || [],
      allowedTeamIds:profile.allowedTeamIds || [],
      allowedModules:profile.allowedModules || [],
      modulePermissions:profile.modulePermissions || {}
    },
    modules:Object.fromEntries(moduleRegistry().map(module => [module.id, {read:hasModulePermission(module, 'read'), write:hasModulePermission(module, 'write'), delete:canDeleteData(module.id)}]))
  };
}
function notifyFramesAccessUpdated(){
  try{ frame?.contentWindow?.postMessage(accessContext(), '*'); }catch(_e){}
}
function guardAdminAction(label='Action réservée aux éditeurs autorisés'){
  if(isAdmin()) return true;
  alert(label);
  return false;
}
function escapeHtml(v){
  return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function playersService(){
  return window.CoachPulsePlayersService || null;
}
function teamsService(){
  return window.CoachPulseTeamsService || null;
}
function permissionsService(){
  return window.CoachPulsePermissionsService || null;
}
function firestoreServiceContext(){
  return {firebaseFns, db, user:currentUser};
}
function sortPlayersForApp(players){
  const service = playersService();
  if(service?.dedupePlayers) return service.dedupePlayers(players);
  return [...players].sort((a,b) => String(a.nom||a.displayName||'').localeCompare(String(b.nom||b.displayName||''), 'fr'));
}

function visibleModules(section){
  const service = permissionsService();
  const modules = moduleRegistry();
  if(service?.visibleModules) return service.visibleModules(modules, currentProfile || {role:currentUserRole,status:'ACTIVE'}, section);
  return modules.filter(module => module.active !== false && module.settings?.showInNav !== false && (!section || module.section === section) && hasModulePermission(module, 'read'));
}
function renderModuleShell(){
  tools = buildTools();
  const nav = document.querySelector('.nav');
  const moduleGrid = document.querySelector('.module-grid');
  if(nav){
    const staff = visibleModules('staff');
    const admin = visibleModules('admin');
    const navSection = (label, modules, adminClass='') => modules.length ? `<div class="nav-section ${adminClass}">${escapeHtml(label)}</div>${modules.map(module => `<button class="nav-link ${adminClass}" data-tool="${escapeHtml(module.id)}"><span>${escapeHtml(module.icon)}</span><span class="label">${escapeHtml(module.name)}</span></button>`).join('')}` : '';
    nav.innerHTML = navSection('Staff', staff) + navSection('Administration', admin, 'admin-only');
  }
  if(moduleGrid){
    const modules = moduleRegistry().filter(module => module.active !== false && module.settings?.showOnDashboard && hasModulePermission(module, 'read'));
    moduleGrid.innerHTML = modules.map(module => `<article class="quick-card ${module.section === 'admin' ? 'admin-only' : ''}" data-tool="${escapeHtml(module.id)}"><div><span class="emoji">${escapeHtml(module.icon)}</span><h2>${escapeHtml(module.name)}</h2><p>${escapeHtml(module.settings?.description || '')}</p></div><strong>${module.section === 'admin' ? 'Admin' : 'Ouvrir'}</strong></article>`).join('');
  }
  const alertList = document.querySelector('.alert-list');
  if(alertList){
    const previous = document.getElementById('moduleRoadmap');
    if(previous) previous.remove();
    const futureModules = moduleRegistry().filter(module => module.active === false).slice(0,6);
    if(futureModules.length){
      const box = document.createElement('div');
      box.id = 'moduleRoadmap';
      box.className = 'module-roadmap admin-only hidden';
      box.innerHTML = `<b>Modules prêts à connecter</b><div>${futureModules.map(module => `<span title="${escapeHtml(module.collection)}">${escapeHtml(module.icon)} ${escapeHtml(module.name)}</span>`).join('')}</div>`;
      alertList.appendChild(box);
    }
  }
  document.querySelectorAll('[data-tool]').forEach(el => {
    if(el.__coachpulseToolBound) return;
    el.__coachpulseToolBound = true;
    el.addEventListener('click', () => routeTo(el.dataset.tool));
  });
}
function updateRoleUi(){
  currentUserRole = getCurrentUserRole();
  renderModuleShell();
  shell.classList.toggle('role-admin', isAdmin());
  $$('.admin-only,.admin-action').forEach(el => el.classList.toggle('hidden', !isAdmin()));
  const service = permissionsService();
  const roleLabel = service?.roleLabel ? service.roleLabel(currentUserRole) : (isAdmin() ? 'Admin' : 'Staff');
  const permissionLabel = service?.permissionLabel ? service.permissionLabel(getCurrentPermissionLevel()) : getCurrentPermissionLevel();
  const dashRole = $('#dashboardRole');
  const dashAccess = $('#dashboardAccess');
  if(dashRole) dashRole.textContent = `${currentProfile?.name || currentUser?.email || 'Staff'} · ${roleLabel}`;
  if(dashAccess) dashAccess.textContent = permissionLabel;
}

function setLocked(locked){
  if(locked){
    shell.classList.add('locked');
    authGate.classList.remove('hidden');
    frame.removeAttribute('src');
    frame.classList.add('hidden');
    homeView.classList.remove('hidden');
    if(adminView) adminView.classList.add('hidden');
    cloudPanel.classList.remove('open');
    topUser.classList.add('hidden');
  } else {
    shell.classList.remove('locked');
    authGate.classList.add('hidden');
    topUser.classList.remove('hidden');
    topUser.textContent = `${currentProfile?.name || currentUser?.email || 'Staff'} · ${currentProfile?.roleLabel || currentProfile?.role || 'Staff'} · ${currentProfile?.permissionLabel || getCurrentPermissionLevel()}`;
    updateRoleUi();
    notifyFramesAccessUpdated();
    updateDashboard();
  }
}

function showHome(){
  frame.classList.add('hidden');
  frame.removeAttribute('src');
  homeView.classList.remove('hidden');
  if(adminView) adminView.classList.add('hidden');
}
function showAdmin(){
  if(!isSuperAdmin()) { alert('Accès non autorisé : gestion utilisateurs réservée aux éditeurs autorisés.'); return showHome(); }
  ensureUserAdminFields();
  refreshAdminAccessPickers();
  frame.classList.add('hidden');
  frame.removeAttribute('src');
  homeView.classList.add('hidden');
  adminView.classList.remove('hidden');
  loadMembers();
}

function routeTo(key){
  if(!requireAuth()) { setLocked(true); return; }
  if(!canAccessTool(key)){
    alert('Accès non autorisé.');
    key = 'home';
  }
  let item = tools[key];
  if(!item){ key = 'home'; item = tools.home; }
  localStorage.setItem('coachpulse:lastTool', key);
  $('#currentEmoji').textContent = item.emoji;
  $('#currentTitle').textContent = item.title;
  $$('.nav-link,.quick-card').forEach(el => el.classList.toggle('active', el.dataset.tool === key));
  if(key === 'home') showHome();
  else if(key === 'admin') showAdmin();
  else {
    homeView.classList.add('hidden');
    if(adminView) adminView.classList.add('hidden');
    frame.classList.remove('hidden');
    const target = new URL(item.src, location.href).href;
    if(frame.src !== target) frame.src = item.src;
    else notifyFramesAccessUpdated();
    if(!window.matchMedia('(max-width:1100px)').matches) shell.classList.add('collapsed');
  }
  closeDrawer();
  snapshotLocalData();
}

async function loadFirebaseFns(){
  if(firebaseFns) return firebaseFns;
  const app = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js');
  const authMod = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
  const fs = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js');
  firebaseFns = {...app, ...authMod, ...fs};
  return firebaseFns;
}

async function ensureUserProfile(user){
  const ref = firebaseFns.doc(db, 'staff_members', user.uid);
  const snap = await firebaseFns.getDoc(ref);
  const service = permissionsService();
  if(snap.exists()){
    currentProfile = {uid:user.uid, ...snap.data()};
    const legacyRole = currentProfile.legacyRole || currentProfile.role || currentUserRole;
    currentProfile.legacyRole = legacyRole;
    currentProfile.role = service?.normalizeRole ? service.normalizeRole(currentProfile.businessRole || currentProfile.role) : currentProfile.role;
    currentProfile.roleLabel = service?.roleLabel ? service.roleLabel(currentProfile.role) : currentProfile.role;
    currentProfile.permissionLevel = service?.normalizePermission ? service.normalizePermission(currentProfile.permissionLevel, {...currentProfile, legacyRole}) : (currentProfile.permissionLevel || 'LECTEUR');
    currentProfile.permissionLabel = service?.permissionLabel ? service.permissionLabel(currentProfile.permissionLevel) : currentProfile.permissionLevel;
    if(service?.normalizePermission && currentProfile.permissionLevel === 'ADMIN' && (!Array.isArray(currentProfile.allowedModules) || !currentProfile.allowedModules.length)){
      currentProfile.allowedModules = moduleRegistry().filter(module => module.id !== 'home').map(module => module.id);
    }
    if(['ARCHIVED','INACTIVE','DISABLED'].includes(String(currentProfile.status || '').toUpperCase())) throw new Error('Compte inactif. Contacte un administrateur.');
    await firebaseFns.setDoc(ref, {lastLoginAt:firebaseFns.serverTimestamp(), email:user.email, legacyRole, role:currentProfile.role, roleLabel:currentProfile.roleLabel, permissionLevel:currentProfile.permissionLevel, permissionLabel:currentProfile.permissionLabel, allowedModules:currentProfile.allowedModules || []}, {merge:true});
    return currentProfile;
  }
  const email = (user.email || '').toLowerCase();
  const isSeedAdmin = email.includes('maxence.boisdron') || email.endsWith('@asse.fr');
  const role = isSeedAdmin ? 'DIRIGEANT' : 'ENTRAINEUR';
  const permissionLevel = isSeedAdmin ? 'ADMIN' : 'LECTEUR';
  currentProfile = service?.defaultProfile ? service.defaultProfile(user, role, permissionLevel) : {uid:user.uid, email:user.email, name:user.displayName || user.email, role, permissionLevel, scope:'CoachPulse', status:'ACTIVE'};
  if(isSeedAdmin) currentProfile.allowedModules = moduleRegistry().filter(module => module.id !== 'home').map(module => module.id);
  await firebaseFns.setDoc(ref, {...currentProfile, createdAt:firebaseFns.serverTimestamp(), updatedAt:firebaseFns.serverTimestamp(), lastLoginAt:firebaseFns.serverTimestamp()}, {merge:true});
  return currentProfile;
}

async function initFirebase(){
  try{
    await loadFirebaseFns();
    fbApp = firebaseFns.getApps().length ? firebaseFns.getApps()[0] : firebaseFns.initializeApp(FIREBASE_CONFIG);
    auth = firebaseFns.getAuth(fbApp);
    db = firebaseFns.getFirestore(fbApp);
    try{ await firebaseFns.enableIndexedDbPersistence(db); }catch(_e){}
    firebaseFns.onAuthStateChanged(auth, async user => {
      authReady = true;
      currentUser = user;
      updateSyncState(user ? 'Cloud connecté' : 'Connexion staff requise');
      if(user){
        try{
          await ensureUserProfile(user);
          setLocked(false);
          startRealtimeSync();
          await syncCloud(false);
          await pullCentralPlayersToLocal(false).catch(()=>{});
          const last = localStorage.getItem('coachpulse:lastTool') || 'home';
          routeTo((last === 'admin' && !isSuperAdmin()) ? 'home' : last);
        }catch(e){
          $('#authError').textContent = cleanError(e);
          await firebaseFns.signOut(auth);
          setLocked(true);
        }
      } else {
        currentProfile = null;
        stopRealtimeSync();
        setLocked(true);
      }
    });
  }catch(e){
    authReady = true;
    updateSyncState('Firebase indisponible');
    setLocked(true);
    $('#authError').textContent = 'Firebase indisponible : vérifie Internet ou la configuration.';
    console.error(e);
  }
}

async function signInStaff(){
  $('#authError').textContent = '';
  if(signingIn) return;
  signingIn = true;
  const btn = $('#loginBtn');
  if(btn) btn.disabled = true;
  try{
    if(!auth) await initFirebase();
    await firebaseFns.signInWithEmailAndPassword(auth, $('#loginEmail').value.trim(), $('#loginPassword').value);
  }catch(e){
    $('#authError').textContent = 'Connexion impossible : ' + cleanError(e);
  }finally{
    signingIn = false;
    if(btn) btn.disabled = false;
  }
}

function cleanError(e){
  const raw = String(e?.code || e?.message || e || '');
  if(raw.includes('auth/quota-exceeded') || raw.includes('quota has been exceeded')){
    return 'Quota Firebase dépassé. Attends quelques minutes puis réessaie. Si le message reste présent, vérifie dans Firebase / Google Cloud que le quota Identity Toolkit ou Authentication n’est pas bloqué.';
  }
  if(raw.includes('auth/too-many-requests')){
    return 'Trop de tentatives de connexion. Attends quelques minutes avant de réessayer, puis vérifie le mot de passe.';
  }
  if(raw.includes('auth/invalid-credential') || raw.includes('auth/wrong-password') || raw.includes('auth/user-not-found')){
    return 'Email ou mot de passe incorrect.';
  }
  if(raw.includes('auth/network-request-failed')){
    return 'Connexion réseau impossible. Vérifie Internet puis réessaie.';
  }
  const msg = (e && e.message) ? e.message : String(e || 'Erreur inconnue');
  return msg.replace('Firebase: ', '').replace(/\s*\([^)]*\)\.?/g, '').trim();
}

function collectLocalStorage(){
  const data = {};
  for(let i=0;i<localStorage.length;i++){
    const key = localStorage.key(i);
    if(!key) continue;
    if(key.startsWith('coachpulse:autoBackup') || key === 'coachpulse:firebaseConfig') continue;
    data[key] = localStorage.getItem(key);
  }
  return data;
}
function buildPayload(){
  return {
    version:'CoachPulse PWA V6.4 Base Joueuses',
    savedAt:new Date().toISOString(),
    user:{uid:currentUser?.uid||null,email:currentUser?.email||null,name:currentProfile?.name||null,role:currentProfile?.role||null},
    bases:{joueuses:{source:'outils HTML intégrés'}, matchs:{source:'Coach Stats'}, presences:{source:'Présences'}, tests:{source:'Tests techniques'}},
    items:collectLocalStorage()
  };
}
function countLocalDataItems(){
  let count = 0;
  for(let i=0;i<localStorage.length;i++){
    const key = localStorage.key(i);
    if(key && key.startsWith('coachpulse:')) count++;
  }
  return count;
}
function updateDashboard(){
  const centralPlayers = parseStoredJson('coachpulse:centralPlayers', []);
  const customPlayers = parseStoredJson('coachpulse:customPlayers', []);
  const lastSync = localStorage.getItem('coachpulse:lastCloudSync');
  const pending = localStorage.getItem('coachpulse:pendingSync') === '1';
  const localCount = countLocalDataItems();
  const playerCount = [...centralPlayers, ...customPlayers].filter(Boolean).length;
  const setText = (id, value) => { const el = $('#'+id); if(el) el.textContent = value; };
  setText('dashboardPlayers', playerCount);
  setText('dashboardLocal', localCount);
  setText('dashboardSync', pending ? 'À faire' : (lastSync ? 'OK' : 'Local'));
  setText('dashboardLastSync', lastSync ? new Date(lastSync).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : 'Pas encore synchronisé');
  setText('dashboardSyncAlert', pending ? 'Des changements sont en attente de synchronisation.' : (lastSync ? 'Cloud synchronisé, sauvegarde locale active.' : 'Mode local actif avant première synchronisation.'));
  setText('dashboardDataAlert', playerCount ? `${playerCount} fiche(s) joueuse(s) disponibles dans la base commune locale.` : 'Aucune joueuse Firebase récupérée localement pour le moment.');
  updateRoleUi();
}
function snapshotLocalData(options={}){
  const payload = buildPayload();
  localStorage.setItem('coachpulse:autoBackup:v6', JSON.stringify(payload));
  localStorage.setItem('coachpulse:lastAutoSave', payload.savedAt);
  if(!options.fromCloud && currentUser){
    const lastCloud = localStorage.getItem('coachpulse:lastCloudSync');
    if(!lastCloud || new Date(payload.savedAt) > new Date(lastCloud)) localStorage.setItem('coachpulse:pendingSync','1');
    scheduleCloudSync();
  }
  updateCloudKpis();
  updateDashboard();
  if(lastSave) lastSave.textContent = new Date(payload.savedAt).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
}

function hashItems(items){
  try{ return JSON.stringify(items || {}).length + ':' + Object.keys(items || {}).sort().map(k => k+'='+String(items[k]).length).join('|'); }
  catch(_e){ return String(Date.now()); }
}
function scheduleCloudSync(delay=900){
  if(applyingCloud || !currentUser) return;
  localStorage.setItem('coachpulse:pendingSync','1');
  updateSyncState('🔄 Synchronisation en attente...');
  clearTimeout(cloudWriteTimer);
  cloudWriteTimer = setTimeout(() => syncCloud(false), delay);
}
function getCloudRef(){
  if(!db || !currentUser) return null;
  return firebaseFns.doc(db, 'coachpulse_common_base', currentUser.uid);
}
function stopRealtimeSync(){
  if(realtimeUnsub){ try{ realtimeUnsub(); }catch(_e){} }
  realtimeUnsub = null;
}
function startRealtimeSync(){
  if(!db || !currentUser) return;
  stopRealtimeSync();
  const ref = getCloudRef();
  if(!ref) return;
  realtimeUnsub = firebaseFns.onSnapshot(ref, snap => {
    if(!snap.exists()) { updateSyncState('Cloud prêt'); return; }
    const data = snap.data() || {};
    const items = data.items || {};
    const incomingHash = hashItems(items);
    const updatedByClient = data.updatedByClient || '';
    if(incomingHash === lastCloudItemsHash){ updateSyncState('Cloud synchronisé'); return; }
    if(updatedByClient === CLIENT_ID){
      lastCloudItemsHash = incomingHash;
      localStorage.setItem('coachpulse:lastCloudSync', new Date().toISOString());
      localStorage.removeItem('coachpulse:pendingSync');
      updateCloudKpis();
      updateSyncState('Cloud synchronisé');
      return;
    }
    applyingCloud = true;
    try{
      Object.entries(items).forEach(([k,v]) => {
        if(k !== 'coachpulse:clientId') localStorage.setItem(k,v);
      });
      lastCloudItemsHash = incomingHash;
      localStorage.setItem('coachpulse:lastCloudSync', new Date().toISOString());
      localStorage.removeItem('coachpulse:pendingSync');
      snapshotLocalData({fromCloud:true});
      updateSyncState('Données cloud récupérées');
      notifyFramesCloudUpdated();
    }finally{
      applyingCloud = false;
    }
  }, err => {
    console.error(err);
    updateSyncState('Erreur écoute cloud · local OK');
  });
}
function notifyFramesCloudUpdated(){
  try{ frame?.contentWindow?.postMessage({type:'coachpulse-cloud-updated'}, '*'); }catch(_e){}
  notifyFramesAccessUpdated();
}
function notifyFramesPlayersUpdated(){
  try{ frame?.contentWindow?.postMessage({type:'coachpulse-players-updated'}, '*'); }catch(_e){}
  try{ frame?.contentWindow?.postMessage({type:'coachpulse-cloud-updated'}, '*'); }catch(_e){}
  notifyFramesAccessUpdated();
}
function installFrameLocalStorageWatcher(){
  try{
    const win = frame.contentWindow;
    if(!win || win.__coachpulseStorageWatcher) return;
    win.__coachpulseStorageWatcher = true;
    const patch = () => {
      const proto = win.Storage && win.Storage.prototype;
      if(!proto || proto.__coachpulsePatched) return;
      proto.__coachpulsePatched = true;
      ['setItem','removeItem','clear'].forEach(method => {
        const original = proto[method];
        proto[method] = function(){
          const result = original.apply(this, arguments);
          try{ win.parent.postMessage({type:'coachpulse-local-change', method, key: arguments[0] || null}, '*'); }catch(_e){}
          return result;
        };
      });
    };
    patch();
    notifyFramesAccessUpdated();
  }catch(_e){ /* certains navigateurs bloquent l'injection : la synchro périodique prend le relais */ }
}

function exportJson(payload, filename){
  snapshotLocalData();
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function downloadText(content, filename, type='text/plain;charset=utf-8'){
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
const FIRESTORE_COLLECTIONS = ['players','teams','matches','matchEvents','sessions','attendance','technicalTests','physicalTests','staff','settings','syncLogs','changeLogs','injuries','injuryUpdates','medicalAppointments','rehabRoutines','workloads','convocations','medicalFollowUps','individualReports'];
function parseStoredJson(key, fallback){
  try{ return JSON.parse(localStorage.getItem(key) || ''); }catch(_e){ return fallback; }
}
function stableFirestoreId(){
  return slugify([].slice.call(arguments).filter(Boolean).join('-')).slice(0,120);
}
function normalizeTeamFromCategory(category){
  const c = String(category || '').toUpperCase();
  const n = Number((c.match(/\d+/)||[])[0] || 0);
  if(c.includes('R1') || c.includes('SENIOR') || c.includes('SÉNIOR')) return 'R1';
  if(!n) return c || 'Non renseignee';
  if(n <= 7) return 'U6-U7';
  if(n <= 9) return 'U8-U9';
  if(n <= 11) return 'U10-U11';
  if(n <= 14) return 'U12-U13-U14';
  if(n <= 16) return 'U14-U15-U16';
  return 'U19';
}
function normalizePlayer(raw={}){
  const service = playersService();
  if(service?.normalizePlayer) return service.normalizePlayer(raw);
  const full = String(raw.joueuse || raw.name || raw.fullName || '').trim();
  let prenom = String(raw.prenom || raw.firstName || '').trim();
  let nom = String(raw.nom || raw.lastName || '').trim();
  if(!prenom && !nom && full){
    const bits = full.split(/\s+/).filter(Boolean);
    const upperCount = bits.filter(b => b === b.toUpperCase()).length;
    if(upperCount >= Math.max(1, bits.length - 1)){
      nom = bits.slice(0, Math.max(1, bits.length - 1)).join(' ');
      prenom = bits.slice(Math.max(1, bits.length - 1)).join(' ');
    }else{
      prenom = bits.slice(0, 1).join(' ');
      nom = bits.slice(1).join(' ');
    }
  }
  const categorie = String(raw.categorie || raw.category || raw.sousCategorie || raw.subCategory || '').trim();
  const subCategory = String(raw.subCategory || raw.sousCategorie || categorie || '').trim();
  const team = String(raw.team || raw.equipe || normalizeTeamFromCategory(subCategory || categorie)).trim();
  const importedId = raw.id && !String(raw.id).startsWith('manual-') ? raw.id : '';
  const birth = raw.birth || raw.dateNaissance || raw.birthDate || raw.annee || raw.age || '';
  const playerId = raw.playerId || importedId || stableFirestoreId('player', nom, prenom, birth || 'no-birth');
  return {
    playerId, id:playerId, prenom:String(prenom || '').toUpperCase(), nom:String(nom || '').toUpperCase(), displayName:[prenom, String(nom || '').toUpperCase()].filter(Boolean).join(' ').trim().toUpperCase(),
    categorie, subCategory, team, teamId:stableFirestoreId('team', team || categorie || 'global'),
    foot:raw.foot || raw.pied || '', birth, dateNaissance:raw.dateNaissance || birth, photo:raw.photo || '',
    source:raw.source || 'Migration CoachPulse', status:raw.status || 'ACTIVE'
  };
}
function addDoc(map, collection, id, data){
  if(!id) return;
  if(!map[collection]) map[collection] = new Map();
  const previous = map[collection].get(id) || {};
  map[collection].set(id, {...previous, ...data, id});
}
function collectCentralFirestoreDocs(){
  const docs = Object.fromEntries(FIRESTORE_COLLECTIONS.map(name => [name, new Map()]));
  const players = [
    ...parseStoredJson('coachpulse:centralPlayers', []),
    ...parseStoredJson('coachpulse:customPlayers', [])
  ].filter(Boolean);
  const rows = parseStoredJson('coachStatsV13Rows', []);
  rows.forEach(row => {
    if(row && row.joueuse) players.push({joueuse:row.joueuse, categorie:row.categorie, subCategory:row.sousCategorie, source:'Tests techniques'});
  });
  players.map(normalizePlayer).forEach(p => {
    if(!p.displayName) return;
    addDoc(docs,'players',p.playerId,{...p, updatedAtIso:new Date().toISOString()});
    addDoc(docs,'teams',p.teamId,{teamId:p.teamId,name:p.team || p.categorie || 'Non renseignée',category:p.categorie || '',source:'players'});
  });
  const playerIndex = new Map([...docs.players.values()].map(p => [p.playerId, p]));
  const playerByName = new Map([...docs.players.values()].map(p => [stableFirestoreId(p.displayName, p.categorie, p.subCategory), p]));
  const presence = parseStoredJson('presenceSeanceV3_6_Excel', null);
  const presenceSessions = Array.isArray(presence?.sessions) ? presence.sessions : [];
  presenceSessions.forEach(s => {
    const sessionId = s.sessionId || s.id || stableFirestoreId('session', s.date, s.type, s.theme);
    addDoc(docs,'sessions',sessionId,{sessionId,date:s.date || '',start:s.start || '',end:s.end || '',duration:Number(s.duration||0),type:s.type || 'Séance',theme:s.theme || '',categories:s.categories || [],source:s.source || 'Présences'});
    Object.entries(s.entries || {}).forEach(([pid, entry]) => {
      const playerId = pid;
      addDoc(docs,'attendance',stableFirestoreId('attendance',sessionId,playerId),{
        attendanceId:stableFirestoreId('attendance',sessionId,playerId), sessionId, playerId,
        status:entry?.code || '', minutes:Number(entry?.minutes || 0), note:entry?.note || '', date:s.date || '', source:'Présences'
      });
    });
  });
  const methodoEvents = parseStoredJson('methodo_events_v24', []);
  methodoEvents.filter(e => String(e?.type || e?.title || e?.theme || '').toLowerCase().includes('séance') || String(e?.type || '').toLowerCase().includes('seance')).forEach(e => {
    const sessionId = e.sessionId || stableFirestoreId('methodologie', e.date || e.start || '', e.team || e.category || '', e.title || e.theme || 'seance');
    addDoc(docs,'sessions',sessionId,{sessionId,date:e.date || e.start || '',type:'Séance',theme:e.title || e.theme || e.text || 'Séance',categories:e.categories || e.category || [],team:e.team || '',source:'Méthodologie'});
  });
  rows.forEach((row, idx) => {
    const player = playerByName.get(stableFirestoreId(row.joueuse, row.categorie, row.sousCategorie)) || normalizePlayer({joueuse:row.joueuse,categorie:row.categorie,subCategory:row.sousCategorie,source:'Tests techniques'});
    addDoc(docs,'players',player.playerId,{...player, updatedAtIso:new Date().toISOString()});
    addDoc(docs,'technicalTests',row.testId || stableFirestoreId('technical', player.playerId, row.date, row.saison, idx), {
      testId:row.testId || stableFirestoreId('technical', player.playerId, row.date, row.saison, idx),
      playerId:player.playerId, playerName:row.joueuse || player.displayName, date:row.date || '', season:row.saison || '',
      categorie:row.categorie || player.categorie || '', subCategory:row.sousCategorie || player.subCategory || '',
      tests:row.tests || {}, objectifs:row.objectifs || {}, source:row.source || 'Tests techniques'
    });
  });
  const stats = parseStoredJson('coachStatsV170', null);
  const matches = Array.isArray(stats?.matches) ? stats.matches : (Array.isArray(stats) ? stats.filter(x => x?.score || x?.events || x?.actions) : []);
  matches.forEach((m, idx) => {
    const matchId = m.matchId || m.id || stableFirestoreId('match', m.date, m.team || m.equipe, m.opponent || m.adversaire, idx);
    addDoc(docs,'matches',matchId,{matchId,date:m.date || '',team:m.team || m.equipe || '',opponent:m.opponent || m.adversaire || '',score:m.score || '',competition:m.competition || '',source:'Coach Stats'});
    const actions = Array.isArray(m.events) ? m.events : (Array.isArray(m.actions) ? m.actions : []);
    actions.forEach((ev, evIdx) => {
      const player = ev.playerId ? playerIndex.get(ev.playerId) : normalizePlayer({joueuse:ev.player || ev.joueuse || '', categorie:ev.categorie || '', source:'Coach Stats'});
      addDoc(docs,'matchEvents',ev.eventId || stableFirestoreId('event', matchId, ev.minute, ev.action || ev.type, evIdx), {
        eventId:ev.eventId || stableFirestoreId('event', matchId, ev.minute, ev.action || ev.type, evIdx),
        matchId, playerId:ev.playerId || player.playerId || '', team:ev.team || m.team || '', minute:ev.minute || '', action:ev.action || ev.type || '', zone:ev.zone || '', source:'Coach Stats'
      });
    });
  });
  if(currentProfile){
    addDoc(docs,'staff',currentUser.uid,{staffId:currentUser.uid, uid:currentUser.uid, email:currentUser.email || currentProfile.email || '', name:currentProfile.name || '', role:currentProfile.role || '', roleLabel:currentProfile.roleLabel || '', permissionLevel:currentProfile.permissionLevel || '', permissionLabel:currentProfile.permissionLabel || '', scope:currentProfile.scope || '', status:currentProfile.status || 'ACTIVE'});
  }
  addDoc(docs,'settings','coachpulse-schema',{settingsId:'coachpulse-schema',version:'firestore-v1',legacyCloudCollection:'coachpulse_common_base',migratedAtIso:new Date().toISOString(),collections:FIRESTORE_COLLECTIONS,modules:moduleRegistry().map(module => ({id:module.id,name:module.name,active:module.active,section:module.section,collection:module.collection,relatedCollections:module.relatedCollections||[],permissions:module.permissions,screen:module.screen,settings:module.settings}))});
  return docs;
}
async function pushCentralDocsToFirestore(docs){
  if(!db || !currentUser) throw new Error('Connexion Firebase requise.');
  const writes = [];
  FIRESTORE_COLLECTIONS.forEach(collection => {
    (docs[collection] || new Map()).forEach((data, id) => {
      writes.push(firebaseFns.setDoc(firebaseFns.doc(db, collection, id), {
        ...data,
        updatedAt:firebaseFns.serverTimestamp(),
        updatedBy:currentUser.uid,
        updatedByEmail:currentUser.email || ''
      }, {merge:true}));
    });
  });
  await Promise.all(writes);
  return writes.length;
}
async function migrateLocalDataToCentralFirestore(manual=true){
  if(manual && !guardAdminAction()) return;
  try{
    const docs = collectCentralFirestoreDocs();
    const count = await pushCentralDocsToFirestore(docs);
    await pullCentralPlayersToLocal(false);
    localStorage.setItem('coachpulse:lastCentralMigration', new Date().toISOString());
    updateSyncState('Base centrale Firestore à jour');
    if(manual) alert(`Migration Firestore terminée : ${count} documents préparés/actualisés.`);
  }catch(e){
    updateSyncState('Migration Firestore impossible · local OK');
    if(manual) alert('Migration impossible : '+cleanError(e));
  }
}
async function pullCentralPlayersToLocal(manual=true){
  if(manual && !guardAdminAction()) return [];
  if(!db || !currentUser) throw new Error('Connexion Firebase requise.');
  const service = playersService();
  let players = [];
  if(service?.readFirestorePlayers){
    players = await service.readFirestorePlayers(firestoreServiceContext());
  }else{
    const snap = await firebaseFns.getDocs(firebaseFns.collection(db, 'players'));
    snap.forEach(docSnap => players.push({id:docSnap.id, playerId:docSnap.id, ...docSnap.data()}));
    localStorage.setItem('coachpulse:centralPlayers', JSON.stringify(players));
  }
  notifyFramesPlayersUpdated();
  updateCloudKpis();
  if(manual) alert(`${players.length} joueuses récupérées depuis Firebase.`);
  return players;
}
async function readCentralFirestoreExport(){
  if(!db || !currentUser) throw new Error('Connexion Firebase requise.');
  const payload = {app:'CoachPulse', schema:'firestore-v1', exportedAt:new Date().toISOString(), collections:{}};
  for(const name of FIRESTORE_COLLECTIONS){
    const snap = await firebaseFns.getDocs(firebaseFns.collection(db, name));
    payload.collections[name] = [];
    snap.forEach(docSnap => payload.collections[name].push({id:docSnap.id, ...docSnap.data()}));
  }
  return payload;
}
function csvEscape(v){
  const s = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
}
function centralPayloadToCsv(payload){
  const rows = [['collection','id','playerId','teamId','matchId','sessionId','date','name','category','type','value']];
  Object.entries(payload.collections || {}).forEach(([collection, docs]) => {
    docs.forEach(doc => rows.push([
      collection, doc.id || '', doc.playerId || '', doc.teamId || '', doc.matchId || '', doc.sessionId || '',
      doc.date || doc.createdAtIso || doc.updatedAtIso || '', doc.displayName || doc.name || doc.theme || doc.action || '',
      doc.categorie || doc.category || doc.subCategory || '', doc.type || doc.status || '', JSON.stringify(doc)
    ]));
  });
  return rows.map(row => row.map(csvEscape).join(';')).join('\n');
}
async function exportCentralFirestore(format){
  if(!guardAdminAction()) return;
  try{
    const payload = await readCentralFirestoreExport();
    if(format === 'csv') downloadText(centralPayloadToCsv(payload), 'coachpulse_firebase_centralise.csv', 'text/csv;charset=utf-8');
    else exportJson(payload, 'coachpulse_firebase_centralise.json');
  }catch(e){ alert('Export Firebase impossible : '+cleanError(e)); }
}
const IMPORT_STATUS_CODES = new Set(['P','R','ANJ','AJ','M','B','PO','D']);
const IMPORT_FIELD_ALIASES = {
  fullName:['joueuse','joueur','nom complet','nom prenom','nom prénom','athlete','athlète','player','player name','licencie','licencié'],
  nom:['nom','last name','surname','name'],
  prenom:['prenom','prénom','first name','firstname'],
  categorie:['categorie','catégorie','category','cat','groupe age','groupe âge'],
  subCategory:['sous categorie','sous catégorie','sub category','subcategory','age','u'],
  team:['equipe','équipe','team','groupe','collectif'],
  poste:['poste','position','role terrain','rôle terrain'],
  birth:['date naissance','date de naissance','naissance','birth','birthday','dob'],
  photo:['photo','image','avatar'],
  date:['date','jour','day','session date','date seance','date séance','date test'],
  status:['statut','presence','présence','etat','état','code','absence'],
  minutes:['minutes','temps','duree','durée','charge','volume'],
  sessionType:['type seance','type séance','type','nature'],
  theme:['theme','thème','contenu','objectif','seance','séance'],
  testType:['test','type test','test type','atelier','exercice'],
  value:['valeur','resultat','résultat','score','performance','mesure'],
  season:['saison','season']
};
function normalizeImportText(v){
  return String(v ?? '').replace(/\u00a0/g,' ').trim().replace(/\s+/g,' ');
}
function normalizeImportKey(v){
  return normalizeImportText(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[_/.-]+/g,' ').replace(/\s+/g,' ').trim();
}
function detectImportField(header){
  const key = normalizeImportKey(header);
  for(const [field, aliases] of Object.entries(IMPORT_FIELD_ALIASES)){
    if(aliases.some(a => key === normalizeImportKey(a))) return field;
  }
  for(const [field, aliases] of Object.entries(IMPORT_FIELD_ALIASES)){
    if(aliases.some(a => {
      const aliasKey = normalizeImportKey(a);
      return aliasKey.length > 3 && key.includes(aliasKey);
    })) return field;
  }
  if(parseImportDate(header)) return 'dateColumn';
  return '';
}
function normalizeSubCategory(value){
  const txt = normalizeImportText(value).toUpperCase().replace('SENIORS','R1').replace('SÉNIORS','R1');
  if(txt.includes('R1')) return 'R1';
  const n = Number((txt.match(/\d+/)||[])[0] || 0);
  return n ? `U${n}` : txt;
}
function normalizeImportCategory(value){
  const sub = normalizeSubCategory(value);
  if(sub === 'R1') return 'R1';
  const n = Number((sub.match(/\d+/)||[])[0] || 0);
  if(!n) return normalizeImportText(value);
  if(n <= 7) return 'U7';
  if(n <= 9) return 'U8-U9';
  if(n <= 11) return 'U10-U11';
  if(n <= 13) return 'U12-U13';
  if(n <= 14) return 'U12-U13-U14';
  if(n <= 16) return 'U14-U15-U16';
  return 'U19';
}
function splitImportName(row){
  const full = normalizeImportText(row.fullName || row.joueuse || row.player || '');
  let nom = normalizeImportText(row.nom || '');
  let prenom = normalizeImportText(row.prenom || '');
  if((!nom || !prenom) && full){
    const bits = full.split(/\s+/).filter(Boolean);
    const upperPrefix = [];
    while(bits.length && bits[0] === bits[0].toUpperCase() && !/-/.test(bits[0])) upperPrefix.push(bits.shift());
    if(upperPrefix.length && bits.length){ nom = nom || upperPrefix.join(' '); prenom = prenom || bits.join(' '); }
    else { nom = nom || bits.slice(0,-1).join(' '); prenom = prenom || bits.slice(-1).join(' '); }
  }
  return {nom:nom.toUpperCase(), prenom};
}
function parseImportDate(value){
  const raw = normalizeImportText(value);
  if(!raw) return '';
  if(typeof value === 'number'){
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0,10);
  }
  const iso = raw.match(/\b(20\d{2}|19\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if(iso) return `${iso[1]}-${String(iso[2]).padStart(2,'0')}-${String(iso[3]).padStart(2,'0')}`;
  const fr = raw.match(/\b(\d{1,2})[/-](\d{1,2})[/-]((?:20|19)?\d{2})\b/);
  if(fr){
    const year = fr[3].length === 2 ? `20${fr[3]}` : fr[3];
    return `${year}-${String(fr[2]).padStart(2,'0')}-${String(fr[1]).padStart(2,'0')}`;
  }
  return '';
}
function parseImportNumber(value){
  const txt = normalizeImportText(value).replace(',','.');
  if(!txt || /[a-zA-Z]/.test(txt.replace(/[eE]/g,''))) return null;
  const n = Number(txt);
  return Number.isFinite(n) ? n : null;
}
function parseCsvRows(text){
  const sample = text.slice(0,2000);
  const delimiter = (sample.match(/;/g)||[]).length >= (sample.match(/,/g)||[]).length ? ';' : ',';
  const rows = [];
  let row = [], cell = '', quoted = false;
  for(let i=0;i<text.length;i++){
    const c = text[i], next = text[i+1];
    if(c === '"' && quoted && next === '"'){ cell += '"'; i++; continue; }
    if(c === '"'){ quoted = !quoted; continue; }
    if(c === delimiter && !quoted){ row.push(cell); cell=''; continue; }
    if((c === '\n' || c === '\r') && !quoted){
      if(c === '\r' && next === '\n') i++;
      row.push(cell); rows.push(row); row=[]; cell=''; continue;
    }
    cell += c;
  }
  if(cell || row.length){ row.push(cell); rows.push(row); }
  return tableRowsToObjects(rows);
}
function tableRowsToObjects(rows){
  const clean = rows.filter(r => (r || []).some(c => normalizeImportText(c)));
  if(!clean.length) return [];
  const headers = clean[0].map((h,i) => normalizeImportText(h) || `colonne_${i+1}`);
  return clean.slice(1).map((r,idx) => {
    const obj = {__rowNumber:idx+2};
    headers.forEach((h,i) => obj[h] = normalizeImportText(r[i]));
    return obj;
  });
}
function xmlText(node){ return node ? node.textContent || '' : ''; }
function columnIndex(ref){
  const letters = String(ref||'').replace(/[^A-Z]/gi,'').toUpperCase();
  let n = 0; for(const ch of letters) n = n * 26 + ch.charCodeAt(0) - 64;
  return Math.max(0,n-1);
}
async function inflateZipBytes(bytes, method){
  if(method === 0) return bytes;
  if(method !== 8 || !('DecompressionStream' in window)) throw new Error('Lecture XLSX non disponible sur ce navigateur. Utilise CSV si besoin.');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function unzipEntries(buffer){
  const data = new Uint8Array(buffer), view = new DataView(buffer);
  let eocd = -1;
  for(let i=data.length-22;i>=0 && i>data.length-66000;i--){ if(view.getUint32(i,true) === 0x06054b50){ eocd=i; break; } }
  if(eocd < 0) throw new Error('Fichier XLSX illisible.');
  const total = view.getUint16(eocd+10,true), cdOffset = view.getUint32(eocd+16,true);
  const entries = {};
  let ptr = cdOffset;
  for(let i=0;i<total;i++){
    if(view.getUint32(ptr,true) !== 0x02014b50) break;
    const method = view.getUint16(ptr+10,true), compSize = view.getUint32(ptr+20,true);
    const nameLen = view.getUint16(ptr+28,true), extraLen = view.getUint16(ptr+30,true), commentLen = view.getUint16(ptr+32,true);
    const localOffset = view.getUint32(ptr+42,true);
    const name = new TextDecoder().decode(data.slice(ptr+46, ptr+46+nameLen));
    const localNameLen = view.getUint16(localOffset+26,true), localExtraLen = view.getUint16(localOffset+28,true);
    const start = localOffset + 30 + localNameLen + localExtraLen;
    entries[name] = {method, bytes:data.slice(start,start+compSize)};
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  const output = {};
  for(const [name, entry] of Object.entries(entries)) output[name] = new TextDecoder().decode(await inflateZipBytes(entry.bytes, entry.method));
  return output;
}
async function parseXlsxRows(file){
  const entries = await unzipEntries(await file.arrayBuffer());
  const parser = new DOMParser();
  const shared = [];
  if(entries['xl/sharedStrings.xml']){
    parser.parseFromString(entries['xl/sharedStrings.xml'],'application/xml').querySelectorAll('si').forEach(si => shared.push([...si.querySelectorAll('t')].map(xmlText).join('')));
  }
  const sheetName = Object.keys(entries).find(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k));
  if(!sheetName) throw new Error('Aucune feuille Excel détectée.');
  const doc = parser.parseFromString(entries[sheetName],'application/xml');
  const rows = [];
  doc.querySelectorAll('sheetData row').forEach(rowNode => {
    const row = [];
    rowNode.querySelectorAll('c').forEach(c => {
      const idx = columnIndex(c.getAttribute('r'));
      let value = '';
      if(c.getAttribute('t') === 's') value = shared[Number(xmlText(c.querySelector('v')))] || '';
      else if(c.getAttribute('t') === 'inlineStr') value = xmlText(c.querySelector('is t'));
      else value = xmlText(c.querySelector('v'));
      row[idx] = value;
    });
    rows.push(row);
  });
  return tableRowsToObjects(rows);
}
async function parseImportFile(file){
  const name = file.name.toLowerCase();
  if(name.endsWith('.csv')) return parseCsvRows(await file.text());
  if(name.endsWith('.json')){
    const data = JSON.parse(await file.text());
    if(Array.isArray(data)) return data;
    if(Array.isArray(data.players)) return data.players;
    if(data.collections) return Object.entries(data.collections).flatMap(([collection, docs]) => (docs || []).map(d => ({...d, __collection:collection})));
    return Object.values(data).flat().filter(v => v && typeof v === 'object');
  }
  if(name.endsWith('.xlsx')) return parseXlsxRows(file);
  throw new Error('Format non supporté. Utilise .xlsx, .csv ou .json.');
}
function mappedImportRow(row){
  const out = {raw:row, fields:{}, extras:{}};
  Object.entries(row || {}).forEach(([header,value]) => {
    if(header.startsWith('__')) return;
    const field = detectImportField(header);
    if(field) out.fields[field] = out.fields[field] || value;
    else out.extras[header] = value;
  });
  return out;
}
function buildImportPlan(rows, options={}){
  const plan = {source:options.source || 'Import fichier', columns:[], recognized:[], ignored:[], players:new Map(), teams:new Map(), sessions:new Map(), attendance:new Map(), technicalTests:new Map(), physicalTests:new Map(), potentialDuplicates:[]};
  const columns = new Set();
  rows.forEach(row => Object.keys(row || {}).filter(k => !k.startsWith('__')).forEach(k => columns.add(k)));
  plan.columns = [...columns].map(header => ({header, field:detectImportField(header) || 'non reconnu'}));
  plan.recognized = plan.columns.filter(c => c.field !== 'non reconnu');
  rows.forEach((row, idx) => {
    const mapped = mappedImportRow(row);
    const f = mapped.fields;
    const names = splitImportName({...f, fullName:f.fullName});
    const subCategory = normalizeSubCategory(f.subCategory || f.categorie || f.team || '');
    const categorie = normalizeImportCategory(f.categorie || subCategory || f.team || '');
    const date = parseImportDate(f.date);
    if(!names.nom && !names.prenom){ plan.ignored.push({row:row.__rowNumber || idx+1, reason:'joueuse non détectée'}); return; }
    const player = normalizePlayer({nom:names.nom, prenom:names.prenom, categorie, subCategory, team:f.team || normalizeTeamFromCategory(categorie), birth:parseImportDate(f.birth) || f.birth || '', photo:f.photo || '', poste:f.poste || '', source:plan.source});
    addDoc(plan,'players',player.playerId,{...player, poste:f.poste || '', importSource:plan.source});
    addDoc(plan,'teams',player.teamId,{teamId:player.teamId,name:player.team,category:player.categorie,source:'Import'});
    const status = normalizeImportText(f.status).toUpperCase();
    if(IMPORT_STATUS_CODES.has(status) || f.minutes || f.theme || f.sessionType){
      const sessionId = stableFirestoreId('session', date || 'date-inconnue', f.theme || f.sessionType || 'seance', player.teamId);
      addDoc(plan,'sessions',sessionId,{sessionId,date,type:f.sessionType || 'Séance',theme:f.theme || 'Import présence',team:player.team,categories:[player.categorie].filter(Boolean),source:plan.source});
      addDoc(plan,'attendance',stableFirestoreId('attendance',sessionId,player.playerId),{attendanceId:stableFirestoreId('attendance',sessionId,player.playerId),sessionId,playerId:player.playerId,date,status:status || 'P',minutes:Number(f.minutes || 0),note:'',source:plan.source});
    }
    Object.entries(mapped.extras).forEach(([header,value]) => {
      const val = normalizeImportText(value);
      if(!val) return;
      const headerDate = parseImportDate(header);
      const upper = val.toUpperCase();
      if(headerDate && IMPORT_STATUS_CODES.has(upper)){
        const sessionId = stableFirestoreId('session', headerDate, 'presence', player.teamId);
        addDoc(plan,'sessions',sessionId,{sessionId,date:headerDate,type:'Séance',theme:'Import présence',team:player.team,categories:[player.categorie].filter(Boolean),source:plan.source});
        addDoc(plan,'attendance',stableFirestoreId('attendance',sessionId,player.playerId),{attendanceId:stableFirestoreId('attendance',sessionId,player.playerId),sessionId,playerId:player.playerId,date:headerDate,status:upper,minutes:0,note:'',source:plan.source});
      }
      const num = parseImportNumber(val);
      const h = normalizeImportKey(header);
      const looksTechnical = /(jongle|pied|tete|tête|conduite|passe|technique|max_|reg_|mouv_)/.test(h);
      const looksPhysical = /(vitesse|sprint|endurance|vma|force|detente|détente|agilite|agilité|physique)/.test(h);
      if(num !== null && (looksTechnical || looksPhysical)){
        const collection = looksPhysical ? 'physicalTests' : 'technicalTests';
        const testId = stableFirestoreId(collection, player.playerId, date || 'date-inconnue', header);
        addDoc(plan,collection,testId,{testId,playerId:player.playerId,playerName:player.displayName,date,season:f.season || '',categorie:player.categorie,subCategory:player.subCategory,testType:header,value:num,source:plan.source});
      }
    });
    if(f.testType && f.value){
      const num = parseImportNumber(f.value);
      if(num !== null){
        const testId = stableFirestoreId('technicalTests', player.playerId, date || 'date-inconnue', f.testType);
        addDoc(plan,'technicalTests',testId,{testId,playerId:player.playerId,playerName:player.displayName,date,season:f.season || '',categorie:player.categorie,subCategory:player.subCategory,testType:f.testType,value:num,source:plan.source});
      }
    }
  });
  return plan;
}
async function existingPlayersIndex(){
  const byId = new Map(), byKey = new Map(), byPerson = new Map();
  const indexPlayer = player => {
    const id = player.playerId || player.id;
    if(!id) return;
    const p = {...player, playerId:id};
    byId.set(id, p);
    byKey.set(stableFirestoreId(p.nom, p.prenom, p.categorie, p.subCategory, p.birth || p.dateNaissance || ''), p);
    byKey.set(stableFirestoreId(p.nom, p.prenom, p.categorie, p.subCategory), p);
    byPerson.set(stableFirestoreId('person', p.nom, p.prenom, p.birth || p.dateNaissance || ''), p);
    byPerson.set(stableFirestoreId('person', p.nom, p.prenom), p);
  };
  if(db && currentUser){
    const snap = await firebaseFns.getDocs(firebaseFns.collection(db, 'players'));
    snap.forEach(docSnap => {
      indexPlayer({id:docSnap.id, playerId:docSnap.id, ...docSnap.data()});
    });
  }
  parseStoredJson('coachpulse:centralPlayers', []).forEach(p => {
    indexPlayer(p);
  });
  return {byId, byKey, byPerson};
}
function findExistingPlayerForImport(existing, player){
  const keyBirth = stableFirestoreId(player.nom, player.prenom, player.categorie, player.subCategory, player.birth || player.dateNaissance || '');
  const key = stableFirestoreId(player.nom, player.prenom, player.categorie, player.subCategory);
  const personBirth = stableFirestoreId('person', player.nom, player.prenom, player.birth || player.dateNaissance || '');
  const person = stableFirestoreId('person', player.nom, player.prenom);
  return existing.byId.get(player.playerId) || existing.byKey.get(keyBirth) || existing.byKey.get(key) || existing.byPerson.get(personBirth) || existing.byPerson.get(person);
}
const PLAYER_IMPORT_AUTHORITATIVE_FIELDS = new Set(['categorie','subCategory','team','teamId','birth','dateNaissance','photo','foot','poste']);
function mergePlayerForImport(existing, incoming){
  const out = {}, changes = {};
  Object.entries(incoming).forEach(([k,v]) => {
    if(v === '' || v == null || ['id','playerId','updatedAt','updatedBy','updatedByEmail'].includes(k)) return;
    const current = existing[k];
    const isEmpty = current == null || current === '' || (Array.isArray(current) && !current.length);
    const isAuthoritative = PLAYER_IMPORT_AUTHORITATIVE_FIELDS.has(k);
    if((isAuthoritative || isEmpty) && String(current ?? '') !== String(v ?? '')){
      out[k] = v; changes[k] = v;
    }
  });
  return {out, changes};
}
async function analyzeImportAgainstFirestore(plan){
  const existing = await existingPlayersIndex();
  const report = {created:0, updated:0, unchanged:0, potentialDuplicates:0, ignored:plan.ignored.length, details:[]};
  plan.players.forEach(player => {
    const found = findExistingPlayerForImport(existing, player);
    if(found){
      const merged = mergePlayerForImport(found, player);
      if(Object.keys(merged.changes).length){ report.updated++; report.details.push({type:'mise à jour', player:player.displayName, fields:Object.keys(merged.changes)}); }
      else { report.unchanged++; report.details.push({type:'inchangé', player:player.displayName}); }
      if((found.playerId || found.id) !== player.playerId) report.potentialDuplicates++;
    }else{
      report.created++; report.details.push({type:'création', player:player.displayName});
    }
  });
  return report;
}
async function commitImportPlan(plan){
  if(!db || !currentUser) throw new Error('Connexion Firebase requise.');
  const existing = await existingPlayersIndex();
  const docs = Object.fromEntries(FIRESTORE_COLLECTIONS.map(c => [c,new Map()]));
  plan.players.forEach(player => {
    const found = findExistingPlayerForImport(existing, player);
    if(found){
      const foundId = found.playerId || found.id;
      const merged = mergePlayerForImport(found, player);
      if(Object.keys(merged.out).length) addDoc(docs,'players',foundId,{...merged.out, playerId:foundId, lastImportSource:plan.source});
    }else addDoc(docs,'players',player.playerId,{...player, createdFromImport:true});
  });
  ['teams','sessions','attendance','technicalTests','physicalTests'].forEach(collection => {
    plan[collection].forEach((doc,id) => addDoc(docs,collection,id,doc));
  });
  const count = await pushCentralDocsToFirestore(docs);
  await pullCentralPlayersToLocal(false).catch(()=>{});
  return count;
}
async function importPlayerRowsToFirestore(rows, options={}){
  const plan = buildImportPlan(rows, {source:options.source || 'Import Excel/CSV/JSON'});
  if(options.dryRun) return analyzeImportAgainstFirestore(plan);
  await exportCentralFirestore('json');
  return commitImportPlan(plan);
}
let importUiState = {file:null, rows:[], plan:null, report:null};
function openImportModal(){
  if(!requireAuth()) return setLocked(true);
  if(!guardAdminAction('Import / Base est réservé aux administrateurs.')) return;
  $('#importModal')?.classList.add('open');
  renderImportSummary();
}
function closeImportModal(){ $('#importModal')?.classList.remove('open'); }
const IMPORT_COLLECTION_LABELS = {
  players:'Joueuses',
  sessions:'Séances',
  attendance:'Présences',
  technicalTests:'Tests techniques',
  physicalTests:'Tests physiques',
  ignored:'Lignes ignorées'
};
const IMPORT_FIELD_LABELS = {
  fullName:'Nom complet',
  nom:'Nom',
  prenom:'Prénom',
  categorie:'Catégorie',
  subCategory:'Sous-catégorie',
  team:'Équipe',
  poste:'Poste',
  birth:'Date de naissance',
  photo:'Photo',
  date:'Date',
  status:'Statut',
  minutes:'Minutes',
  sessionType:'Type de séance',
  theme:'Thème',
  testType:'Type de test',
  value:'Valeur',
  season:'Saison',
  dateColumn:'Date de présence',
  'non reconnu':'Non reconnu'
};
const IMPORT_HEADER_LABELS = {
  nom:'Nom',
  prenom:'Prénom',
  categorie:'Catégorie',
  subCategory:'Sous-catégorie',
  team:'Équipe',
  birth:'Date de naissance',
  photo:'Photo',
  poste:'Poste',
  season:'Saison'
};
function importLabel(map, key){ return map[key] || key; }
function importPreviewValue(header, value){
  if(header === 'photo') return value ? 'Photo intégrée' : 'Aucune photo';
  return value ?? '';
}
function renderImportSummary(){
  const box = $('#importSummary'), preview = $('#importPreview'), report = $('#importReport');
  if(!box || !preview || !report) return;
  const plan = importUiState.plan;
  if(!plan){
    box.innerHTML = '<div class="import-empty">Aucun fichier analysé.</div>';
    preview.innerHTML = '';
    report.innerHTML = '';
    return;
  }
  const counts = {players:plan.players.size,sessions:plan.sessions.size,attendance:plan.attendance.size,technicalTests:plan.technicalTests.size,physicalTests:plan.physicalTests.size,ignored:plan.ignored.length};
  box.innerHTML = Object.entries(counts).map(([k,v]) => `<div><b>${v}</b><span>${escapeHtml(importLabel(IMPORT_COLLECTION_LABELS,k))}</span></div>`).join('');
  const cols = plan.columns.map(c => `<span class="${c.field==='non reconnu'?'bad':''}">${escapeHtml(importLabel(IMPORT_HEADER_LABELS,c.header))} → ${escapeHtml(importLabel(IMPORT_FIELD_LABELS,c.field))}</span>`).join('');
  const sample = importUiState.rows.slice(0,8);
  const headers = Object.keys(sample[0] || {}).filter(k => !k.startsWith('__')).slice(0,8);
  preview.innerHTML = `<h3>Colonnes détectées</h3><div class="import-columns">${cols || 'Aucune colonne'}</div><h3>Aperçu</h3><div class="table-wrap"><table class="staff-table"><thead><tr>${headers.map(h=>`<th>${escapeHtml(importLabel(IMPORT_HEADER_LABELS,h))}</th>`).join('')}</tr></thead><tbody>${sample.map(r=>`<tr>${headers.map(h=>`<td>${escapeHtml(importPreviewValue(h,r[h]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const r = importUiState.report;
  report.innerHTML = r ? `<h3>Simulation</h3><p><b>${r.created}</b> créations · <b>${r.updated}</b> mises à jour · <b>${r.unchanged}</b> inchangées · <b>${r.potentialDuplicates}</b> doublons potentiels · <b>${r.ignored}</b> lignes ignorées</p>` : '<p class="admin-note">Lance une simulation avant import réel.</p>';
}
async function handleImportFileSelected(e){
  const file = e.target.files?.[0]; if(!file) return;
  try{
    importUiState = {file, rows:await parseImportFile(file), plan:null, report:null};
    importUiState.plan = buildImportPlan(importUiState.rows, {source:file.name});
    $('#importSourceName').textContent = `${file.name} · ${importUiState.rows.length} lignes détectées`;
    renderImportSummary();
  }catch(err){ alert('Lecture impossible : '+cleanError(err)); }
}
async function simulateImport(){
  if(!importUiState.plan) return alert('Choisis d’abord un fichier.');
  try{ importUiState.report = await analyzeImportAgainstFirestore(importUiState.plan); renderImportSummary(); }
  catch(e){ alert('Simulation impossible : '+cleanError(e)); }
}
async function commitImport(){
  if(!importUiState.plan) return alert('Choisis d’abord un fichier.');
  if(!importUiState.report) return alert('Lance d’abord la simulation.');
  if(!confirm(`Importer dans Firebase ?\nCréations prévues : ${importUiState.report.created}\nMises à jour prévues : ${importUiState.report.updated}\nLignes ignorées : ${importUiState.report.ignored}\n\nAucune suppression automatique ne sera faite.`)) return;
  try{
    await exportCentralFirestore('json');
    const count = await commitImportPlan(importUiState.plan);
    alert(`Import terminé : ${count} documents préparés/actualisés dans Firebase.`);
    await simulateImport();
  }catch(e){ alert('Import impossible : '+cleanError(e)); }
}
function normalizeDataHubPlayer(item, meta={}){
  const p = normalizePlayer({
    nom:item.nom, prenom:item.prenom, fullName:item.fullName || item.joueuse,
    categorie:item.categorie, subCategory:item.sousCategorie || item.subCategory,
    team:item.equipe || item.team, birth:item.dateNaissance || item.birth,
    photo:item.photo, poste:item.poste, source:meta.fileName || item.source || 'Data Hub'
  });
  return {...p, poste:item.poste || '', dateNaissance:item.dateNaissance || p.birth || '', connector:item.connector || 'fichesJoueuses'};
}
function hubPlayerDiff(existing={}, incoming={}){
  const changes = {};
  ['nom','prenom','displayName','categorie','subCategory','team','teamId','poste','birth','dateNaissance','photo','status'].forEach(key => {
    const value = incoming[key];
    if(value === '' || value == null) return;
    if(existing[key] == null || existing[key] === '' || String(existing[key]) !== String(value)) changes[key] = value;
  });
  return changes;
}
function normalizeDataHubSession(item, meta={}){
  const date = item.date || '';
  const categorie = item.categorie || '';
  const subCategory = item.sousCategorie || item.subCategory || '';
  const theme = item.theme || 'Import présence';
  const sessionId = item.sessionId || stableFirestoreId('session', date || 'date-inconnue', theme, categorie, subCategory);
  return {
    sessionId, id:sessionId, date, categorie, subCategory, categories:[categorie].filter(Boolean),
    theme, type:item.sessionType || item.typeSeance || 'Séance', duration:Number(item.duration || 0),
    source:meta.fileName || item.source || 'Data Hub'
  };
}
function normalizeDataHubAttendance(item, meta={}){
  const attendanceId = item.attendanceId || stableFirestoreId('attendance', item.sessionId, item.playerId);
  return {
    attendanceId, id:attendanceId, sessionId:item.sessionId || '', playerId:item.playerId || '',
    date:item.date || '', status:item.status || '', duration:Number(item.duration || 0),
    minutes:Number(item.duration || item.minutes || 0), charge:Number(item.charge || item.duration || 0),
    source:meta.fileName || item.source || 'Data Hub'
  };
}
function normalizeDataHubTest(item, meta={}){
  const collection = item.type === 'physicalTest' ? 'physicalTests' : 'technicalTests';
  const testId = item.testId || stableFirestoreId(item.type || 'test', item.playerId, item.date || 'date-inconnue', item.testName || 'test');
  return {
    collection,
    testId, id:testId, playerId:item.playerId || '', playerName:item.playerName || '',
    date:item.date || '', season:item.season || '', categorie:item.categorie || '',
    subCategory:item.sousCategorie || item.subCategory || '', testName:item.testName || item.testType || '',
    testType:item.testName || item.testType || '', value:item.value ?? '', unit:item.unit || '',
    source:meta.fileName || item.source || 'Data Hub'
  };
}
function objectDiff(existing={}, incoming={}, keys=[]){
  const changes = {};
  keys.forEach(key => {
    const value = incoming[key];
    if(value === '' || value == null || (Array.isArray(value) && !value.length)) return;
    const a = Array.isArray(value) ? JSON.stringify(value) : String(value);
    const b = Array.isArray(existing[key]) ? JSON.stringify(existing[key]) : String(existing[key] ?? '');
    if(existing[key] == null || existing[key] === '' || a !== b) changes[key] = value;
  });
  return changes;
}
async function existingCollectionIndex(collection){
  const byId = new Map();
  if(db && currentUser){
    const snap = await firebaseFns.getDocs(firebaseFns.collection(db, collection));
    snap.forEach(docSnap => byId.set(docSnap.id, {id:docSnap.id, ...docSnap.data()}));
  }
  return byId;
}
async function simulateDataHubSync(items=[], meta={}){
  if(!guardAdminAction()) return {mode:'simulation', fileName:meta.fileName || '', fileType:meta.fileType || '', rowsRead:0, valid:0, created:0, updated:0, unchanged:0, potentialDuplicates:0, errors:1, anomalies:[{level:'error', message:'Accès réservé aux administrateurs'}], details:[]};
  const existing = await existingPlayersIndex();
  const existingSessions = await existingCollectionIndex('sessions');
  const existingAttendance = await existingCollectionIndex('attendance');
  const existingTechnicalTests = await existingCollectionIndex('technicalTests');
  const existingPhysicalTests = await existingCollectionIndex('physicalTests');
  const report = {mode:'simulation', fileName:meta.fileName || '', fileType:meta.fileType || 'fichesJoueuses', rowsRead:Number(meta.rowsRead || items.length), valid:0, created:0, updated:0, unchanged:0, potentialDuplicates:0, errors:0, anomalies:[...(meta.anomalies || [])], details:[]};
  const seen = new Set();
  items.forEach((item, idx) => {
    if(item.type === 'player'){
      const player = normalizeDataHubPlayer(item, meta);
      if(!player.nom || !player.prenom){ report.errors++; report.anomalies.push({row:item.rowNumber || idx+1, level:'error', message:'Nom ou prénom manquant'}); return; }
      report.valid++;
      const dedupeKey = stableFirestoreId(player.nom, player.prenom, player.categorie, player.subCategory, player.birth || player.dateNaissance || '');
      if(seen.has('player:'+dedupeKey)){ report.potentialDuplicates++; report.anomalies.push({row:item.rowNumber || idx+1, level:'warn', message:`Doublon dans le fichier : ${player.displayName}`}); }
      seen.add('player:'+dedupeKey);
      const found = existing.byId.get(player.playerId) || existing.byKey.get(dedupeKey) || existing.byKey.get(stableFirestoreId(player.nom, player.prenom, player.categorie, player.subCategory));
      if(found){
        const changes = hubPlayerDiff(found, player);
        if(Object.keys(changes).length){ report.updated++; report.details.push({type:'update', collection:'players', id:found.playerId || found.id, label:player.displayName, fields:Object.keys(changes)}); }
        else { report.unchanged++; report.details.push({type:'ignore', collection:'players', id:found.playerId || found.id, label:player.displayName}); }
        if((found.playerId || found.id) !== player.playerId) report.potentialDuplicates++;
      }else{
        report.created++; report.details.push({type:'create', collection:'players', id:player.playerId, label:player.displayName});
      }
      return;
    }
    if(item.type === 'session'){
      const session = normalizeDataHubSession(item, meta);
      report.valid++;
      if(seen.has('session:'+session.sessionId)) return;
      seen.add('session:'+session.sessionId);
      const found = existingSessions.get(session.sessionId);
      if(found){
        const changes = objectDiff(found, session, ['date','categorie','subCategory','categories','theme','type','duration']);
        if(Object.keys(changes).length){ report.updated++; report.details.push({type:'update', collection:'sessions', id:session.sessionId, fields:Object.keys(changes)}); }
        else { report.unchanged++; report.details.push({type:'ignore', collection:'sessions', id:session.sessionId}); }
      }else{ report.created++; report.details.push({type:'create', collection:'sessions', id:session.sessionId}); }
      return;
    }
    if(item.type === 'attendance'){
      const attendance = normalizeDataHubAttendance(item, meta);
      if(!attendance.playerId || !attendance.sessionId){ report.errors++; report.anomalies.push({row:item.rowNumber || idx+1, level:'error', message:'Présence sans playerId ou sessionId'}); return; }
      report.valid++;
      if(seen.has('attendance:'+attendance.attendanceId)){ report.potentialDuplicates++; return; }
      seen.add('attendance:'+attendance.attendanceId);
      const found = existingAttendance.get(attendance.attendanceId);
      if(found){
        const changes = objectDiff(found, attendance, ['sessionId','playerId','date','status','duration','minutes','charge']);
        if(Object.keys(changes).length){ report.updated++; report.details.push({type:'update', collection:'attendance', id:attendance.attendanceId, fields:Object.keys(changes)}); }
        else { report.unchanged++; report.details.push({type:'ignore', collection:'attendance', id:attendance.attendanceId}); }
      }else{ report.created++; report.details.push({type:'create', collection:'attendance', id:attendance.attendanceId}); }
      return;
    }
    if(item.type === 'technicalTest' || item.type === 'physicalTest'){
      const test = normalizeDataHubTest(item, meta);
      if(!test.playerId || !test.testName){ report.errors++; report.anomalies.push({row:item.rowNumber || idx+1, level:'error', message:'Test sans playerId ou nom de test'}); return; }
      report.valid++;
      if(seen.has(test.collection+':'+test.testId)){ report.potentialDuplicates++; return; }
      seen.add(test.collection+':'+test.testId);
      const found = (test.collection === 'physicalTests' ? existingPhysicalTests : existingTechnicalTests).get(test.testId);
      if(found){
        const changes = objectDiff(found, test, ['playerId','playerName','date','season','categorie','subCategory','testName','testType','value','unit']);
        if(Object.keys(changes).length){ report.updated++; report.details.push({type:'update', collection:test.collection, id:test.testId, fields:Object.keys(changes)}); }
        else { report.unchanged++; report.details.push({type:'ignore', collection:test.collection, id:test.testId}); }
      }else{ report.created++; report.details.push({type:'create', collection:test.collection, id:test.testId}); }
      return;
    }
    report.errors++; report.anomalies.push({row:item.rowNumber || idx+1, level:'error', message:`Type non géré : ${item.type || 'inconnu'}`});
  });
  return report;
}
async function syncDataHubItems(items=[], meta={}){
  if(!guardAdminAction()) return;
  if(!db || !currentUser) throw new Error('Connexion Firebase requise.');
  const report = await simulateDataHubSync(items, meta);
  const existing = await existingPlayersIndex();
  const docs = Object.fromEntries(FIRESTORE_COLLECTIONS.map(c => [c,new Map()]));
  items.forEach(item => {
    if(item.type === 'player'){
      const player = normalizeDataHubPlayer(item, meta);
      if(!player.nom || !player.prenom) return;
      const found = existing.byId.get(player.playerId) || existing.byKey.get(stableFirestoreId(player.nom, player.prenom, player.categorie, player.subCategory, player.birth || player.dateNaissance || '')) || existing.byKey.get(stableFirestoreId(player.nom, player.prenom, player.categorie, player.subCategory));
      if(found){
        const id = found.playerId || found.id;
        const changes = hubPlayerDiff(found, player);
        if(Object.keys(changes).length) addDoc(docs,'players',id,{...changes, playerId:id, lastDataHubSyncAt:new Date().toISOString(), lastDataHubSource:meta.fileName || ''});
      }else{
        addDoc(docs,'players',player.playerId,{...player, createdFromDataHub:true, createdAtIso:new Date().toISOString()});
      }
      addDoc(docs,'teams',player.teamId,{teamId:player.teamId,name:player.team || player.categorie || 'Non renseignée',category:player.categorie || '',source:'Data Hub'});
    }
    if(item.type === 'session'){
      const session = normalizeDataHubSession(item, meta);
      addDoc(docs,'sessions',session.sessionId,{...session, lastDataHubSyncAt:new Date().toISOString()});
    }
    if(item.type === 'attendance'){
      const attendance = normalizeDataHubAttendance(item, meta);
      if(attendance.playerId && attendance.sessionId) addDoc(docs,'attendance',attendance.attendanceId,{...attendance, lastDataHubSyncAt:new Date().toISOString()});
    }
    if(item.type === 'technicalTest' || item.type === 'physicalTest'){
      const test = normalizeDataHubTest(item, meta);
      if(test.playerId && test.testName) addDoc(docs,test.collection,test.testId,{...test, lastDataHubSyncAt:new Date().toISOString()});
    }
  });
  const logId = stableFirestoreId('syncLog', Date.now(), meta.fileName || 'import');
  addDoc(docs,'syncLogs',logId,{
    syncLogId:logId, date:new Date().toISOString(), userId:currentUser.uid, userEmail:currentUser.email || '',
    fileName:meta.fileName || '', fileType:meta.fileType || 'fichesJoueuses', connector:meta.connector || 'fichesJoueuses',
    rowsRead:report.rowsRead, created:report.created, updated:report.updated, ignored:report.unchanged, errors:report.errors,
    potentialDuplicates:report.potentialDuplicates, anomalies:report.anomalies.slice(0,80)
  });
  await exportCentralFirestore('json');
  const written = await pushCentralDocsToFirestore(docs);
  await pullCentralPlayersToLocal(false).catch(()=>{});
  return {...report, mode:'sync', written, syncLogId:logId};
}
async function readSyncLogs(limit=20){
  if(!guardAdminAction()) return [];
  if(!db || !currentUser) throw new Error('Connexion Firebase requise.');
  const snap = await firebaseFns.getDocs(firebaseFns.query(firebaseFns.collection(db,'syncLogs'), firebaseFns.orderBy('date','desc')));
  const logs = [];
  snap.forEach(docSnap => { if(logs.length < limit) logs.push({id:docSnap.id, ...docSnap.data()}); });
  return logs;
}
async function adminListPlayers(filters={}){
  if(!guardAdminAction()) return [];
  if(!db || !currentUser) throw new Error('Connexion Firebase requise.');
  const service = playersService();
  if(service?.listPlayers) return service.listPlayers(firestoreServiceContext(), filters);
  if(service?.readFirestorePlayers) return service.readFirestorePlayers(firestoreServiceContext(), filters);
  const snap = await firebaseFns.getDocs(firebaseFns.collection(db, 'players'));
  const players = [];
  snap.forEach(docSnap => players.push({id:docSnap.id, playerId:docSnap.id, ...docSnap.data()}));
  return sortPlayersForApp(players).filter(p => filters.includeArchived || filters.status || String(p.status || 'active').toLowerCase() !== 'archived');
}
async function adminListRawPlayers(){
  if(!guardAdminAction()) return [];
  if(!db || !currentUser) throw new Error('Connexion Firebase requise.');
  const snap = await firebaseFns.getDocs(firebaseFns.collection(db, 'players'));
  const players = [];
  snap.forEach(docSnap => players.push({id:docSnap.id, playerId:docSnap.id, ...docSnap.data()}));
  return players.sort((a,b) => String(a.nom||a.displayName||'').localeCompare(String(b.nom||b.displayName||''), 'fr'));
}
function playerAdminDiff(before={}, after={}){
  const editable = ['nom','prenom','birth','dateNaissance','categorie','subCategory','team','teamId','poste','numero','photo','status','commentaireInterne'];
  const changes = {};
  editable.forEach(key => {
    const next = after[key];
    const prev = before[key];
    if(next === undefined) return;
    if(String(prev ?? '') !== String(next ?? '')) changes[key] = {before:prev ?? '', after:next ?? ''};
  });
  return changes;
}
async function writeChangeLog({collectionName, documentId, action, before, after, changes, summary}){
  const logId = stableFirestoreId('changeLog', Date.now(), collectionName, documentId);
  await firebaseFns.setDoc(firebaseFns.doc(db, 'changeLogs', logId), {
    changeLogId:logId,
    type:action,
    collection:collectionName,
    documentId,
    changes,
    before,
    after,
    summary,
    updatedAt:firebaseFns.serverTimestamp(),
    updatedAtIso:new Date().toISOString(),
    updatedBy:currentUser?.uid || '',
    updatedByEmail:currentUser?.email || ''
  }, {merge:true});
  return logId;
}
async function adminCreatePlayer(data={}){
  if(!guardAdminAction()) return {created:false};
  if(!db || !currentUser) throw new Error('Connexion Firebase requise.');
  const service = playersService();
  const clean = service?.normalizePlayer ? service.normalizePlayer(data) : {...data};
  clean.nom = String(clean.nom || '').trim().toUpperCase();
  clean.prenom = String(clean.prenom || '').trim().toUpperCase();
  if(!clean.nom || !clean.prenom) throw new Error('Nom et prénom obligatoires.');
  clean.categorie = String(clean.categorie || '').trim();
  clean.subCategory = String(clean.subCategory || clean.categorie || '').trim();
  clean.team = String(clean.team || normalizeTeamFromCategory(clean.categorie || clean.subCategory) || '').trim();
  clean.teamId = clean.team ? stableFirestoreId('team', clean.team) : '';
  clean.birth = String(clean.birth || clean.dateNaissance || '').trim();
  clean.dateNaissance = clean.birth;
  clean.poste = String(clean.poste || '').trim();
  clean.numero = String(clean.numero || '').trim();
  clean.photo = String(clean.photo || '').trim();
  clean.status = String(clean.status || 'active').trim() || 'active';
  clean.commentaireInterne = String(clean.commentaireInterne || '').trim();
  clean.currentSeason = clean.currentSeason || service?.seasonFromDate?.() || '2026-2027';
  clean.seasonStart = clean.seasonStart || `${clean.currentSeason.slice(0,4)}-07-01`;
  clean.seasonEnd = clean.seasonEnd || `${clean.currentSeason.slice(5)}-06-30`;
  clean.playerId = clean.playerId || stableFirestoreId('player', clean.nom, clean.prenom, clean.birth || 'no-birth');
  clean.id = clean.playerId;
  clean.displayName = [clean.prenom, clean.nom].filter(Boolean).join(' ').trim().toUpperCase();
  clean.createdAt = firebaseFns.serverTimestamp();
  clean.createdAtIso = new Date().toISOString();
  clean.updatedAt = firebaseFns.serverTimestamp();
  clean.updatedAtIso = new Date().toISOString();
  clean.createdBy = currentUser.uid;
  clean.createdByEmail = currentUser.email || '';
  clean.updatedBy = currentUser.uid;
  clean.updatedByEmail = currentUser.email || '';
  const existing = await adminListPlayers();
  const duplicate = existing.find(p => {
    const sameId = (p.playerId || p.id) === clean.playerId;
    const sameIdentity = String(p.nom || '').toUpperCase() === clean.nom
      && String(p.prenom || '').trim().toLowerCase() === clean.prenom.toLowerCase()
      && String(p.birth || p.dateNaissance || '') === String(clean.birth || clean.dateNaissance || '');
    return sameId || sameIdentity;
  });
  if(duplicate) throw new Error(`Joueuse déjà présente : ${duplicate.displayName || `${duplicate.nom || ''} ${duplicate.prenom || ''}`.trim()}`);
  await firebaseFns.setDoc(firebaseFns.doc(db, 'players', clean.playerId), clean, {merge:true});
  if(clean.teamId && clean.team) await firebaseFns.setDoc(firebaseFns.doc(db, 'teams', clean.teamId), {teamId:clean.teamId, name:clean.team, category:clean.categorie || '', source:'Administration', updatedAt:firebaseFns.serverTimestamp(), updatedAtIso:new Date().toISOString()}, {merge:true});
  await writeChangeLog({
    collectionName:'players',
    documentId:clean.playerId,
    action:'create',
    before:{},
    after:clean,
    changes:playerAdminDiff({}, clean),
    summary:`Joueuse créée : ${clean.displayName}`
  });
  await pullCentralPlayersToLocal(false).catch(()=>{});
  notifyFramesPlayersUpdated();
  return {created:true, playerId:clean.playerId, player:clean};
}
async function adminUpdatePlayer(playerId, updates={}, action='update'){
  if(!guardAdminAction()) return {changed:false, changes:{}};
  if(!db || !currentUser) throw new Error('Connexion Firebase requise.');
  if(!playerId) throw new Error('playerId manquant.');
  const service = playersService();
  const ref = firebaseFns.doc(db, 'players', playerId);
  const snap = service?.getPlayer ? null : await firebaseFns.getDoc(ref);
  const before = service?.getPlayer ? (await service.getPlayer(playerId, firestoreServiceContext()) || {}) : (snap.exists() ? {id:snap.id, playerId:snap.id, ...snap.data()} : {});
  const clean = {...updates};
  if(clean.nom) clean.nom = String(clean.nom).trim().toUpperCase();
  if(clean.prenom) clean.prenom = String(clean.prenom).trim();
  if(clean.categorie && !clean.team) clean.team = normalizeTeamFromCategory(clean.categorie);
  if(clean.team) clean.teamId = stableFirestoreId('team', clean.team);
  clean.displayName = [String(clean.nom ?? before.nom ?? '').toUpperCase(), String(clean.prenom ?? before.prenom ?? '')].filter(Boolean).join(' ').trim();
  clean.updatedAt = firebaseFns.serverTimestamp();
  clean.updatedAtIso = new Date().toISOString();
  clean.updatedBy = currentUser.uid;
  clean.updatedByEmail = currentUser.email || '';
  const after = {...before, ...clean};
  const changes = playerAdminDiff(before, after);
  if(!Object.keys(changes).length) return {changed:false, changes:{}};
  if(service?.savePlayer) await service.savePlayer(after, firestoreServiceContext());
  else await firebaseFns.setDoc(ref, clean, {merge:true});
  const summary = Object.entries(changes).map(([field,v]) => `${field}: ${v.before || '-'} → ${v.after || '-'}`).join(' · ');
  await writeChangeLog({collectionName:'players', documentId:playerId, action, before, after, changes, summary});
  if(clean.teamId && clean.team) await firebaseFns.setDoc(firebaseFns.doc(db, 'teams', clean.teamId), {teamId:clean.teamId, name:clean.team, source:'Administration', updatedAt:firebaseFns.serverTimestamp()}, {merge:true});
  await pullCentralPlayersToLocal(false).catch(()=>{});
  notifyFramesPlayersUpdated();
  return {changed:true, changes};
}
async function adminArchivePlayer(playerId, archived=true){
  if(!guardAdminAction()) return;
  return adminUpdatePlayer(playerId, {status:archived ? 'archived' : 'active'}, archived ? 'archive' : 'update');
}
async function adminReadChangeLogs(limit=50){
  if(!guardAdminAction()) return [];
  if(!db || !currentUser) throw new Error('Connexion Firebase requise.');
  const snap = await firebaseFns.getDocs(firebaseFns.query(firebaseFns.collection(db,'changeLogs'), firebaseFns.orderBy('updatedAtIso','desc')));
  const logs = [];
  snap.forEach(docSnap => { if(logs.length < limit) logs.push({id:docSnap.id, ...docSnap.data()}); });
  return logs;
}
async function adminExportPlayers(format='json'){
  if(!guardAdminAction()) return;
  const players = await adminListPlayers();
  if(format === 'csv'){
    const rows = [['playerId','nom','prenom','categorie','subCategory','team','poste','birth','dateNaissance','status','updatedAtIso']];
    players.forEach(p => rows.push([p.playerId||p.id||'',p.nom||'',p.prenom||'',p.categorie||'',p.subCategory||'',p.team||'',p.poste||'',p.birth||'',p.dateNaissance||'',p.status||'',p.updatedAtIso||'']));
    downloadText(rows.map(row => row.map(csvEscape).join(';')).join('\n'), 'coachpulse_players.csv', 'text/csv;charset=utf-8');
  }else{
    exportJson({app:'CoachPulse', collection:'players', exportedAt:new Date().toISOString(), players}, 'coachpulse_players.json');
  }
  return players.length;
}
const DEFAULT_DB_OPTIONS = {
  categories:['U6-U7','U8-U9','U10-U11','U12-U13','U12-U13-U14','U14-U15-U16','U19','R1'],
  subCategories:['U6','U7','U8','U9','U10','U11','U12','U13','U14','U15','U16','U17','U18','U19','R1']
};
async function adminListTeamsAndSettings(){
  if(!guardAdminAction()) return {teams:[], settings:DEFAULT_DB_OPTIONS};
  if(!db || !currentUser) throw new Error('Connexion Firebase requise.');
  const service = teamsService();
  if(service?.listTeams && service?.readDatabaseOptions){
    return {
      teams:await service.listTeams(firestoreServiceContext()),
      settings:await service.readDatabaseOptions(firestoreServiceContext())
    };
  }
  const teamsSnap = await firebaseFns.getDocs(firebaseFns.collection(db, 'teams'));
  const teams = [];
  teamsSnap.forEach(docSnap => teams.push({id:docSnap.id, teamId:docSnap.id, ...docSnap.data()}));
  teams.sort((a,b) => String(a.name||'').localeCompare(String(b.name||''), 'fr'));
  const settingsRef = firebaseFns.doc(db, 'settings', 'database-options');
  const settingsSnap = await firebaseFns.getDoc(settingsRef);
  const settings = settingsSnap.exists() ? settingsSnap.data() : {};
  return {
    teams,
    settings:{
      categories:Array.isArray(settings.categories) && settings.categories.length ? settings.categories : DEFAULT_DB_OPTIONS.categories,
      subCategories:Array.isArray(settings.subCategories) && settings.subCategories.length ? settings.subCategories : DEFAULT_DB_OPTIONS.subCategories
    }
  };
}
async function adminSaveTeam(team={}){
  if(!guardAdminAction()) return;
  if(!db || !currentUser) throw new Error('Connexion Firebase requise.');
  const name = String(team.name || '').trim();
  if(!name) throw new Error('Nom d’équipe obligatoire.');
  const teamId = team.teamId || team.id || stableFirestoreId('team', name);
  const ref = firebaseFns.doc(db, 'teams', teamId);
  const service = teamsService();
  let before = {};
  let created = false;
  let after = {teamId, name, category:team.category || '', updatedAt:firebaseFns.serverTimestamp(), updatedAtIso:new Date().toISOString(), updatedBy:currentUser.uid, updatedByEmail:currentUser.email || ''};
  if(service?.saveTeam){
    const result = await service.saveTeam(after, firestoreServiceContext());
    before = result.before || {};
    created = result.created;
    after = result.team;
  }else{
    const snap = await firebaseFns.getDoc(ref);
    before = snap.exists() ? {id:snap.id, ...snap.data()} : {};
    created = !snap.exists();
    await firebaseFns.setDoc(ref, after, {merge:true});
  }
  await writeChangeLog({collectionName:'teams', documentId:teamId, action:created?'create':'update', before, after:{...before,...after}, changes:objectDiff(before, after, ['name','category']), summary:`Équipe ${created?'créée':'modifiée'} : ${name}`});
  return {teamId, name};
}
function cleanOptionList(values){
  return [...new Set((values || []).map(v => String(v || '').trim()).filter(Boolean))];
}
async function adminSaveDatabaseOptions(options={}){
  if(!guardAdminAction()) return DEFAULT_DB_OPTIONS;
  if(!db || !currentUser) throw new Error('Connexion Firebase requise.');
  const ref = firebaseFns.doc(db, 'settings', 'database-options');
  const snap = await firebaseFns.getDoc(ref);
  const before = snap.exists() ? snap.data() : {};
  const service = teamsService();
  const after = service?.saveDatabaseOptions ? await service.saveDatabaseOptions(options, firestoreServiceContext()) : {
    settingsId:'database-options',
    categories:cleanOptionList(options.categories),
    subCategories:cleanOptionList(options.subCategories),
    updatedAt:firebaseFns.serverTimestamp(),
    updatedAtIso:new Date().toISOString(),
    updatedBy:currentUser.uid,
    updatedByEmail:currentUser.email || ''
  };
  if(!service?.saveDatabaseOptions) await firebaseFns.setDoc(ref, after, {merge:true});
  await writeChangeLog({collectionName:'settings', documentId:'database-options', action:'update', before, after:{...before,...after}, changes:objectDiff(before, after, ['categories','subCategories']), summary:'Options catégories mises à jour'});
  return after;
}
async function updatePlayerRefsInCollection(collectionName, fromPlayerId, toPlayerId){
  const service = playersService();
  if(service?.updatePlayerRefs){
    const counts = await service.updatePlayerRefs({fromPlayerId, toPlayerId, collections:[collectionName]}, firestoreServiceContext());
    return counts[collectionName] || 0;
  }
  const snap = await firebaseFns.getDocs(firebaseFns.collection(db, collectionName));
  const writes = [];
  let count = 0;
  snap.forEach(docSnap => {
    const data = docSnap.data() || {};
    if(data.playerId === fromPlayerId){
      count++;
      writes.push(firebaseFns.setDoc(firebaseFns.doc(db, collectionName, docSnap.id), {
        playerId:toPlayerId,
        mergedFromPlayerId:fromPlayerId,
        updatedAt:firebaseFns.serverTimestamp(),
        updatedAtIso:new Date().toISOString(),
        updatedBy:currentUser.uid,
        updatedByEmail:currentUser.email || ''
      }, {merge:true}));
    }
  });
  await Promise.all(writes);
  return count;
}
function adminPlayerRefCollections(){
  const service = playersService();
  return service?.PLAYER_REF_COLLECTIONS || ['matchEvents', 'attendance', 'technicalTests', 'physicalTests', 'injuries', 'injuryUpdates', 'medicalAppointments', 'rehabRoutines'];
}
function adminIdentityText(value){
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}
function adminIdentityDate(value){
  const parsed = parseImportDate(value);
  return parsed || String(value || '').trim();
}
function adminPlayerIdentity(player={}){
  const nom = adminIdentityText(player.nom || player.lastName);
  const prenom = adminIdentityText(player.prenom || player.firstName);
  const birth = adminIdentityDate(player.birth || player.dateNaissance || player.birthDate);
  return {nom, prenom, birth};
}
function adminPlayerNameLabel(player={}){
  const identity = adminPlayerIdentity(player);
  return [identity.prenom, identity.nom].filter(Boolean).join(' ');
}
function adminPlayerMergeScore(player={}){
  const source = String(player.source || player.importSource || '').toLowerCase();
  let score = 0;
  if(source.includes('coachpulse-joueuses-import') || source.includes('reference')) score += 80;
  if(player.photo) score += 20;
  if(player.birth || player.dateNaissance) score += 12;
  if(player.categorie) score += 6;
  if(player.subCategory) score += 6;
  if(player.team) score += 4;
  if(source.includes('test') || /^U20\d{2}$/i.test(String(player.subCategory || ''))) score -= 30;
  return score;
}
function chooseAdminMergePrimary(group=[]){
  return [...group].sort((a,b) => {
    const score = adminPlayerMergeScore(b) - adminPlayerMergeScore(a);
    if(score) return score;
    return String(b.updatedAtIso || '').localeCompare(String(a.updatedAtIso || ''));
  })[0];
}
function compactAdminMergePlayer(player={}){
  return {
    playerId:player.playerId || player.id || '',
    label:adminPlayerNameLabel(player),
    nom:player.nom || '',
    prenom:player.prenom || '',
    birth:player.birth || player.dateNaissance || '',
    categorie:player.categorie || '',
    subCategory:player.subCategory || '',
    team:player.team || '',
    source:player.source || player.importSource || '',
    status:player.status || 'active'
  };
}
function buildAdminDuplicateMergePlan(players=[]){
  const active = players.filter(p => String(p.status || 'active').toLowerCase() !== 'archived');
  const strictMap = new Map();
  const nameMap = new Map();
  active.forEach(player => {
    const id = player.playerId || player.id;
    if(!id) return;
    const identity = adminPlayerIdentity(player);
    const nameKey = [identity.nom, identity.prenom].join('|');
    if(identity.nom && identity.prenom) nameMap.set(nameKey, [...(nameMap.get(nameKey) || []), player]);
    if(identity.nom && identity.prenom && identity.birth){
      const strictKey = [identity.nom, identity.prenom, identity.birth].join('|');
      strictMap.set(strictKey, [...(strictMap.get(strictKey) || []), player]);
    }
  });
  const strictGroups = [];
  const strictPlayerIds = new Set();
  strictMap.forEach(group => {
    const unique = [...new Map(group.map(player => [player.playerId || player.id, player])).values()];
    if(unique.length < 2) return;
    const primary = chooseAdminMergePrimary(unique);
    const keepId = primary.playerId || primary.id;
    const duplicates = unique.filter(player => (player.playerId || player.id) !== keepId);
    unique.forEach(player => strictPlayerIds.add(player.playerId || player.id));
    strictGroups.push({
      key:[adminPlayerIdentity(primary).nom, adminPlayerIdentity(primary).prenom, adminPlayerIdentity(primary).birth].join('|'),
      keepId,
      keep:compactAdminMergePlayer(primary),
      duplicates:duplicates.map(compactAdminMergePlayer),
      duplicateIds:duplicates.map(player => player.playerId || player.id),
      count:unique.length
    });
  });
  const manualCandidates = [];
  nameMap.forEach(group => {
    const unique = [...new Map(group.map(player => [player.playerId || player.id, player])).values()].filter(player => !strictPlayerIds.has(player.playerId || player.id));
    if(unique.length < 2) return;
    manualCandidates.push({
      name:adminPlayerNameLabel(unique[0]),
      reason:'Même nom/prénom, date de naissance absente ou différente',
      players:unique.map(compactAdminMergePlayer)
    });
  });
  strictGroups.sort((a,b) => a.keep.label.localeCompare(b.keep.label, 'fr'));
  manualCandidates.sort((a,b) => a.name.localeCompare(b.name, 'fr'));
  return {
    generatedAtIso:new Date().toISOString(),
    rule:'Fusion automatique seulement si nom + prénom + date de naissance identiques.',
    refCollections:adminPlayerRefCollections(),
    strictGroups,
    manualCandidates,
    groupsToMerge:strictGroups.length,
    duplicatePlayersToArchive:strictGroups.reduce((sum, group) => sum + group.duplicateIds.length, 0)
  };
}
async function adminBuildDuplicateMergePlan(){
  if(!guardAdminAction()) return buildAdminDuplicateMergePlan([]);
  const players = await adminListRawPlayers();
  return buildAdminDuplicateMergePlan(players);
}
async function adminMergePlayers({primaryPlayerId, duplicatePlayerId}={}){
  if(!guardAdminAction()) return;
  if(!db || !currentUser) throw new Error('Connexion Firebase requise.');
  if(!primaryPlayerId || !duplicatePlayerId || primaryPlayerId === duplicatePlayerId) throw new Error('Choisis deux fiches différentes.');
  const primaryRef = firebaseFns.doc(db,'players',primaryPlayerId);
  const duplicateRef = firebaseFns.doc(db,'players',duplicatePlayerId);
  const [primarySnap, duplicateSnap] = await Promise.all([firebaseFns.getDoc(primaryRef), firebaseFns.getDoc(duplicateRef)]);
  if(!primarySnap.exists() || !duplicateSnap.exists()) throw new Error('Une des deux fiches est introuvable.');
  const primary = {playerId:primaryPlayerId, ...primarySnap.data()};
  const duplicate = {playerId:duplicatePlayerId, ...duplicateSnap.data()};
  const refCounts = {};
  for(const collectionName of adminPlayerRefCollections()){
    refCounts[collectionName] = await updatePlayerRefsInCollection(collectionName, duplicatePlayerId, primaryPlayerId);
  }
  const fill = {};
  ['photo','birth','dateNaissance','poste','numero','commentaireInterne','team','teamId','categorie','subCategory'].forEach(key => {
    if((primary[key] == null || primary[key] === '') && duplicate[key]) fill[key] = duplicate[key];
  });
  if(Object.keys(fill).length) await firebaseFns.setDoc(primaryRef, {...fill, updatedAt:firebaseFns.serverTimestamp(), updatedAtIso:new Date().toISOString(), updatedBy:currentUser.uid, updatedByEmail:currentUser.email || ''}, {merge:true});
  await firebaseFns.setDoc(duplicateRef, {
    status:'archived',
    archivedReason:'Fusion doublon',
    mergedIntoPlayerId:primaryPlayerId,
    updatedAt:firebaseFns.serverTimestamp(),
    updatedAtIso:new Date().toISOString(),
    updatedBy:currentUser.uid,
    updatedByEmail:currentUser.email || ''
  }, {merge:true});
  await writeChangeLog({
    collectionName:'players',
    documentId:duplicatePlayerId,
    action:'merge',
    before:duplicate,
    after:{...duplicate,status:'archived',mergedIntoPlayerId:primaryPlayerId},
    changes:{mergedIntoPlayerId:{before:'',after:primaryPlayerId},status:{before:duplicate.status||'',after:'archived'},references:{before:duplicatePlayerId,after:primaryPlayerId}},
    summary:`Fusion doublon : ${duplicate.displayName || duplicate.nom || duplicatePlayerId} → ${primary.displayName || primary.nom || primaryPlayerId}. Références transférées : ${Object.entries(refCounts).map(([k,v])=>`${k} ${v}`).join(', ')}`
  });
  await pullCentralPlayersToLocal(false).catch(()=>{});
  notifyFramesPlayersUpdated();
  return {primaryPlayerId, duplicatePlayerId, refCounts, filledFields:Object.keys(fill)};
}
async function adminMergeDuplicatePlan(){
  if(!guardAdminAction()) return {mergedPlayers:0, groupsMerged:0, results:[]};
  if(!db || !currentUser) throw new Error('Connexion Firebase requise.');
  const plan = await adminBuildDuplicateMergePlan();
  const results = [];
  for(const group of plan.strictGroups){
    for(const duplicatePlayerId of group.duplicateIds){
      results.push(await adminMergePlayers({primaryPlayerId:group.keepId, duplicatePlayerId}));
    }
  }
  await writeChangeLog({
    collectionName:'players',
    documentId:'duplicate-merge-plan',
    action:'merge-plan',
    before:{},
    after:{groupsMerged:plan.strictGroups.length, mergedPlayers:results.length, rule:plan.rule},
    changes:{mergedPlayers:{before:0, after:results.length}},
    summary:`Fusion stricte doublons : ${results.length} fiches archivées sur ${plan.strictGroups.length} groupes.`
  });
  return {groupsMerged:plan.strictGroups.length, mergedPlayers:results.length, results};
}
function buildCleanPlayersReference(rows=[], options={}){
  const service = playersService();
  const sourceSeason = options.sourceSeason || '2025-2026';
  const source = options.source || 'Migration propre CoachPulse';
  const normalized = rows.map(row => service?.normalizePlayer ? service.normalizePlayer({...row, season:row.season || row.saison || sourceSeason, source, status:'active'}) : normalizePlayer({...row, season:row.season || row.saison || sourceSeason, source, status:'active'}));
  const players = service?.dedupePlayers ? service.dedupePlayers(normalized) : sortPlayersForApp(normalized);
  const ids = new Set();
  const duplicates = [];
  players.forEach(player => {
    const id = player.playerId || player.id;
    if(ids.has(id)) duplicates.push(id);
    ids.add(id);
  });
  const categories = {};
  players.forEach(player => {
    const key = `${player.categorie || '-'} / ${player.subCategory || '-'}`;
    categories[key] = (categories[key] || 0) + 1;
  });
  return {
    players,
    report:{
      sourceRows:rows.length,
      cleanPlayers:players.length,
      duplicates,
      withPhoto:players.filter(player => player.photo).length,
      categories
    }
  };
}
async function adminAnalyzeCleanPlayersReference(rows=[], options={}){
  if(!guardAdminAction()) return {players:[], report:{}};
  return buildCleanPlayersReference(rows, options);
}
async function adminApplyCleanPlayersReference(rows=[], options={}){
  if(!guardAdminAction()) return {written:0, archived:0};
  if(!db || !currentUser) throw new Error('Connexion Firebase requise.');
  const {players, report} = buildCleanPlayersReference(rows, options);
  if(players.length !== 127) throw new Error(`Migration bloquée : ${players.length} joueuses détectées au lieu de 127.`);
  if(report.duplicates.length) throw new Error(`Migration bloquée : ${report.duplicates.length} doublons playerId dans la source.`);
  await exportCentralFirestore('json');
  const existing = await adminListRawPlayers();
  const cleanIds = new Set(players.map(player => player.playerId || player.id));
  const writes = [];
  const now = new Date().toISOString();
  players.forEach(player => {
    writes.push(firebaseFns.setDoc(firebaseFns.doc(db, 'players', player.playerId), {
      ...player,
      status:'active',
      migrationBatch:'clean-reference-2026-2027',
      updatedAt:firebaseFns.serverTimestamp(),
      updatedAtIso:now,
      updatedBy:currentUser.uid,
      updatedByEmail:currentUser.email || ''
    }, {merge:true}));
    if(player.teamId && player.team){
      writes.push(firebaseFns.setDoc(firebaseFns.doc(db, 'teams', player.teamId), {
        teamId:player.teamId,
        name:player.team,
        category:player.categorie || '',
        source:'Migration propre CoachPulse',
        updatedAt:firebaseFns.serverTimestamp(),
        updatedAtIso:now
      }, {merge:true}));
    }
  });
  let archived = 0;
  existing.forEach(player => {
    const id = player.playerId || player.id;
    if(!id || cleanIds.has(id) || String(player.status || '').toLowerCase() === 'archived') return;
    archived++;
    writes.push(firebaseFns.setDoc(firebaseFns.doc(db, 'players', id), {
      status:'archived',
      archivedReason:'Migration propre vers référentiel 127 joueuses',
      migrationBatch:'clean-reference-2026-2027',
      updatedAt:firebaseFns.serverTimestamp(),
      updatedAtIso:now,
      updatedBy:currentUser.uid,
      updatedByEmail:currentUser.email || ''
    }, {merge:true}));
  });
  await Promise.all(writes);
  await writeChangeLog({
    collectionName:'players',
    documentId:'clean-reference-2026-2027',
    action:'clean-migration',
    before:{existingPlayers:existing.length},
    after:{cleanPlayers:players.length, archivedPlayers:archived, categories:report.categories},
    changes:{players:{before:existing.length, after:players.length}, archived:{before:0, after:archived}},
    summary:`Migration base joueuses propre : ${players.length} fiches actives, ${archived} anciennes fiches archivées.`
  });
  await pullCentralPlayersToLocal(false).catch(()=>{});
  notifyFramesPlayersUpdated();
  return {written:players.length, archived, report};
}
function canUseMedical(action='read'){
  return hasModulePermission(getModule('medical'), action);
}
function guardMedical(action='read'){
  if(canUseMedical(action)) return true;
  alert(action === 'importExport' ? 'Export médical réservé aux éditeurs autorisés.' : 'Accès médical non autorisé.');
  return false;
}
function medicalCapabilities(){
  return {role:getCurrentUserRole(), canRead:canUseMedical('read'), canWrite:canUseMedical('write'), canExport:canUseMedical('importExport')};
}
function localMedicalPayload(){
  return parseStoredJson('coachpulse:medicalData', {injuries:[], injuryUpdates:[], medicalAppointments:[], rehabRoutines:[]});
}
function saveLocalMedicalPayload(payload){
  localStorage.setItem('coachpulse:medicalData', JSON.stringify(payload || {injuries:[], injuryUpdates:[], medicalAppointments:[], rehabRoutines:[]}));
}
async function moduleListPlayers(){
  if(!requireAuth()) throw new Error('Connexion Firebase requise.');
  const service = playersService();
  if(service?.readFirestorePlayers && db && currentUser) return service.readFirestorePlayers({firebaseFns, db});
  if(service?.readCachedPlayers) return service.readCachedPlayers();
  const byId = new Map();
  parseStoredJson('coachpulse:centralPlayers', []).forEach(p => { const id=p.playerId||p.id; if(id) byId.set(id,{...p,playerId:id,id}); });
  parseStoredJson('coachpulse:customPlayers', []).forEach(p => { const id=p.playerId||p.id; if(id) byId.set(id,{...p,playerId:id,id}); });
  if(db && currentUser){
    const snap = await firebaseFns.getDocs(firebaseFns.collection(db, 'players'));
    snap.forEach(docSnap => byId.set(docSnap.id, {id:docSnap.id, playerId:docSnap.id, ...docSnap.data()}));
  }
  return sortPlayersForApp([...byId.values()]);
}
async function listPlayers(filters={}){
  const players = await moduleListPlayers();
  const service = playersService();
  return service?.filterPlayers ? service.filterPlayers(players, filters) : sortPlayersForApp(players);
}
function seasonFromDate(date=new Date()){
  const service = playersService();
  if(service?.seasonFromDate) return service.seasonFromDate(date);
  const d = date instanceof Date ? date : new Date(date);
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  const year = safe.getFullYear();
  return safe.getMonth() >= 6 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}
function currentSeason(){ return seasonFromDate(new Date()); }
async function getPlayer(playerId){
  if(!playerId) return null;
  const players = await listPlayers();
  return players.find(player => (player.playerId || player.id) === playerId) || null;
}
async function medicalListPlayers(){
  if(!guardMedical('read')) return [];
  return listPlayers();
}
async function medicalListData(){
  if(!guardMedical('read')) return localMedicalPayload();
  const payload = {injuries:[], injuryUpdates:[], medicalAppointments:[], rehabRoutines:[]};
  if(db && currentUser){
    for(const [collection, key] of [['injuries','injuries'], ['injuryUpdates','injuryUpdates'], ['medicalAppointments','medicalAppointments'], ['rehabRoutines','rehabRoutines']]){
      const snap = await firebaseFns.getDocs(firebaseFns.collection(db, collection));
      snap.forEach(docSnap => payload[key].push({id:docSnap.id, ...docSnap.data()}));
    }
    saveLocalMedicalPayload(payload);
    return payload;
  }
  return localMedicalPayload();
}
async function medicalSaveInjury(injury={}){
  if(!guardMedical('write')) return null;
  if(!injury.playerId) throw new Error('playerId obligatoire.');
  const now = new Date().toISOString();
  const injuryId = injury.injuryId || injury.id || stableFirestoreId('injury', injury.playerId, injury.declaredAt || now, injury.bodyZone || 'zone');
  const clean = {
    ...injury,
    id:injuryId,
    injuryId,
    playerId:injury.playerId,
    season:injury.season || seasonFromDate(injury.declaredAt || now),
    status:injury.status || injury.availability || 'active',
    bodyZone:injury.bodyZone || '',
    painLevel:Number(injury.painLevel || 0),
    createdAt:injury.createdAt || now,
    updatedAt:now,
    createdBy:injury.createdBy || currentUser?.uid || '',
    createdByEmail:injury.createdByEmail || currentUser?.email || '',
    updatedBy:currentUser?.uid || '',
    updatedByEmail:currentUser?.email || ''
  };
  if(db && currentUser){
    await firebaseFns.setDoc(firebaseFns.doc(db, 'injuries', injuryId), {...clean, updatedAtServer:firebaseFns.serverTimestamp()}, {merge:true});
  }
  const local = localMedicalPayload();
  const idx = local.injuries.findIndex(x => (x.injuryId||x.id) === injuryId);
  if(idx >= 0) local.injuries[idx] = {...local.injuries[idx], ...clean};
  else local.injuries.push(clean);
  saveLocalMedicalPayload(local);
  snapshotLocalData();
  return clean;
}
async function medicalAddUpdate(injuryId, update={}){
  if(!guardMedical('write')) return null;
  if(!injuryId) throw new Error('injuryId obligatoire.');
  const now = new Date().toISOString();
  const updateId = update.updateId || stableFirestoreId('injuryUpdate', injuryId, now);
  const clean = {
    ...update,
    id:updateId,
    updateId,
    injuryId,
    playerId:update.playerId || '',
    date:update.date || now.slice(0,10),
    painLevel:Number(update.painLevel || 0),
    createdAt:now,
    updatedAt:now,
    createdBy:currentUser?.uid || '',
    createdByEmail:currentUser?.email || ''
  };
  if(db && currentUser){
    await firebaseFns.setDoc(firebaseFns.doc(db, 'injuryUpdates', updateId), {...clean, updatedAtServer:firebaseFns.serverTimestamp()}, {merge:true});
    const injuryPatch = {updatedAt:now, updatedBy:currentUser.uid, updatedByEmail:currentUser.email || ''};
    if(clean.status) injuryPatch.status = clean.status;
    if(clean.painLevel) injuryPatch.painLevel = clean.painLevel;
    if(clean.nextStep) injuryPatch.nextStep = clean.nextStep;
    if(clean.nextControlDate) injuryPatch.nextControlDate = clean.nextControlDate;
    await firebaseFns.setDoc(firebaseFns.doc(db, 'injuries', injuryId), injuryPatch, {merge:true});
  }
  const local = localMedicalPayload();
  local.injuryUpdates.push(clean);
  const idx = local.injuries.findIndex(x => (x.injuryId||x.id) === injuryId);
  if(idx >= 0){
    local.injuries[idx] = {...local.injuries[idx], updatedAt:now};
    if(clean.status) local.injuries[idx].status = clean.status;
    if(clean.painLevel) local.injuries[idx].painLevel = clean.painLevel;
    if(clean.nextStep) local.injuries[idx].nextStep = clean.nextStep;
    if(clean.nextControlDate) local.injuries[idx].nextControlDate = clean.nextControlDate;
  }
  saveLocalMedicalPayload(local);
  snapshotLocalData();
  return clean;
}
async function medicalExport(format='json'){
  if(!guardMedical('importExport')) return;
  const data = await medicalListData();
  const players = await moduleListPlayers();
  const playerById = new Map(players.map(p => [p.playerId||p.id, p]));
  const payload = {app:'CoachPulse', module:'medical', exportedAt:new Date().toISOString(), data};
  if(format === 'csv'){
    const rows = [['injuryId','playerId','joueuse','categorie','team','declaredAt','bodyZone','side','injuryType','painLevel','availability','estimatedReturnDate','status','nextStep']];
    data.injuries.forEach(i => {
      const p = playerById.get(i.playerId) || {};
      rows.push([i.injuryId||i.id||'', i.playerId||'', p.displayName || `${p.nom||''} ${p.prenom||''}`.trim(), p.categorie||'', p.team||'', i.declaredAt||'', i.bodyZone||'', i.side||'', i.injuryType||'', i.painLevel||'', i.availability||'', i.estimatedReturnDate||'', i.status||'', i.nextStep||'']);
    });
    downloadText(rows.map(row => row.map(csvEscape).join(';')).join('\n'), 'coachpulse_suivi_medical.csv', 'text/csv;charset=utf-8');
  }else exportJson(payload, 'coachpulse_suivi_medical.json');
}
function getModuleCatalog(){
  return moduleRegistry().map(module => ({id:module.id,name:module.name,icon:module.icon,section:module.section,active:module.active !== false,collection:module.collection,relatedCollections:module.relatedCollections || [],screen:module.screen,permissions:module.permissions,settings:module.settings,visible:hasModulePermission(module,'read') && module.active !== false}));
}
async function adminSaveModuleSettings(moduleId, updates={}){
  if(!guardAdminAction()) return getModuleCatalog();
  const module = getModule(moduleId);
  if(!module) throw new Error('Module introuvable.');
  const overrides = parseModuleOverrides();
  overrides[moduleId] = {...(overrides[moduleId] || {}), ...updates, settings:{...((overrides[moduleId] || {}).settings || {}), ...(updates.settings || {})}};
  localStorage.setItem('coachpulse:moduleSettings', JSON.stringify(overrides));
  if(db && currentUser){
    await firebaseFns.setDoc(firebaseFns.doc(db, 'settings', `module-${moduleId}`), {
      settingsId:`module-${moduleId}`,
      moduleId,
      ...overrides[moduleId],
      updatedAt:firebaseFns.serverTimestamp(),
      updatedAtIso:new Date().toISOString(),
      updatedBy:currentUser.uid,
      updatedByEmail:currentUser.email || ''
    }, {merge:true});
  }
  renderModuleShell();
  updateRoleUi();
  return getModuleCatalog();
}
var seasonFromDate = typeof seasonFromDate === 'function' ? seasonFromDate : (() => '');
var currentSeason = typeof currentSeason === 'function' ? currentSeason : (() => '');
var listPlayers = typeof listPlayers === 'function' ? listPlayers : adminListPlayers;
var getPlayer = typeof getPlayer === 'function' ? getPlayer : (async playerId => (await adminListPlayers()).find(p => (p.playerId || p.id) === playerId) || null);
var adminBuildDuplicateMergePlan = typeof adminBuildDuplicateMergePlan === 'function' ? adminBuildDuplicateMergePlan : (async () => []);
var adminMergeDuplicatePlan = typeof adminMergeDuplicatePlan === 'function' ? adminMergeDuplicatePlan : (async () => ({merged:0, skipped:0}));
var adminAnalyzeCleanPlayersReference = typeof adminAnalyzeCleanPlayersReference === 'function' ? adminAnalyzeCleanPlayersReference : (async () => ({items:[], count:0}));
var adminApplyCleanPlayersReference = typeof adminApplyCleanPlayersReference === 'function' ? adminApplyCleanPlayersReference : (async () => ({updated:0}));
window.CoachPulseCentralData = {collections:FIRESTORE_COLLECTIONS, modules:getModuleCatalog, moduleRegistry:getModuleCatalog, seasonFromDate, currentSeason, listPlayers, getPlayer, adminSaveModuleSettings, medicalCapabilities, medicalListPlayers, medicalListData, medicalSaveInjury, medicalAddUpdate, medicalExport, collectCentralFirestoreDocs, migrateLocalDataToCentralFirestore, pullCentralPlayersToLocal, exportCentralFirestore, importPlayerRowsToFirestore, parseImportFile, buildImportPlan, analyzeImportAgainstFirestore, simulateDataHubSync, syncDataHubItems, readSyncLogs, adminListPlayers, adminBuildDuplicateMergePlan, adminMergeDuplicatePlan, adminAnalyzeCleanPlayersReference, adminApplyCleanPlayersReference, adminCreatePlayer, adminUpdatePlayer, adminArchivePlayer, adminReadChangeLogs, adminExportPlayers, adminListTeamsAndSettings, adminSaveTeam, adminSaveDatabaseOptions, adminMergePlayers};
Object.assign(window.CoachPulseCentralData, {accessContext, canViewModule, canEditModule, canDeleteData, canAccessTeam:canAccessTeamId, canAccessPlayer:canAccessPlayerRecord});
async function syncCloud(manual=false){
  if(applyingCloud) return;
  snapshotLocalData({fromCloud:true});
  if(!navigator.onLine){ localStorage.setItem('coachpulse:pendingSync','1'); return updateSyncState('Hors ligne · local OK'); }
  if(!db || !currentUser) return updateSyncState('Connexion staff requise');
  try{
    updateSyncState('🔄 Synchronisation...');
    const ref = getCloudRef();
    const payload = buildPayload();
    const itemsHash = hashItems(payload.items);
    await firebaseFns.setDoc(ref, {
      ...payload,
      updatedAt:firebaseFns.serverTimestamp(),
      updatedAtIso:new Date().toISOString(),
      updatedBy:currentUser.uid,
      updatedByEmail:currentUser.email,
      updatedByClient:CLIENT_ID,
      itemsHash
    }, {merge:true});
    lastCloudItemsHash = itemsHash;
    localStorage.setItem('coachpulse:lastCloudSync', new Date().toISOString());
    localStorage.removeItem('coachpulse:pendingSync');
    updateCloudKpis();
    updateSyncState('Cloud synchronisé');
    if(manual) alert('Synchronisation cloud OK.');
  }catch(e){
    localStorage.setItem('coachpulse:pendingSync','1');
    updateSyncState('Erreur cloud · local OK');
    if(manual) alert('Sync cloud impossible : '+cleanError(e));
  }
}
async function pullCloud(){
  if(!db || !currentUser) return;
  const snap = await firebaseFns.getDoc(getCloudRef());
  if(snap.exists()){
    applyingCloud = true;
    try{
      Object.entries(snap.data().items||{}).forEach(([k,v]) => { if(k !== 'coachpulse:clientId') localStorage.setItem(k,v); });
      lastCloudItemsHash = hashItems(snap.data().items || {});
      localStorage.removeItem('coachpulse:pendingSync');
      localStorage.setItem('coachpulse:lastCloudSync', new Date().toISOString());
      snapshotLocalData({fromCloud:true}); updateCloudKpis(); updateSyncState('Cloud récupéré'); notifyFramesCloudUpdated();
    }finally{ applyingCloud = false; }
  }
}
function updateSyncState(forced){
  updateCloudKpis();
  let txt = forced || 'Connexion staff requise'; let state='warn';
  const pending = localStorage.getItem('coachpulse:pendingSync') === '1';
  if(db && currentUser && navigator.onLine){
    const last = localStorage.getItem('coachpulse:lastCloudSync');
    if(pending){ txt = 'Sync en attente · local OK'; state='pending'; }
    else { txt = last ? 'Cloud OK '+new Date(last).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : 'Cloud prêt'; state='ok'; }
  } else if(!navigator.onLine) txt='Hors ligne · local actif';
  if(syncText) syncText.textContent = txt;
  if(syncDot) syncDot.className = 'sync-dot '+state;
}
function updateCloudKpis(){
  const localEl = $('#localCount'), pendingEl=$('#pendingCount'), lastEl=$('#lastCloudSyncLabel');
  if(!localEl) return;
  localEl.textContent = Object.keys(collectLocalStorage()).length;
  pendingEl.textContent = localStorage.getItem('coachpulse:pendingSync') === '1' ? '1' : '0';
  const last = localStorage.getItem('coachpulse:lastCloudSync');
  lastEl.textContent = last ? new Date(last).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : 'Jamais';
}
async function logout(){
  try{ if(auth) await firebaseFns.signOut(auth); }catch(e){ alert('Déconnexion impossible : '+cleanError(e)); }
  stopRealtimeSync();
  currentUser = null; currentProfile = null;
  localStorage.removeItem('coachpulse:pendingSync');
  setLocked(true);
  updateSyncState('Compte déconnecté');
}

async function createMember(){
  const msg = $('#adminMsg'); msg.textContent=''; msg.classList.remove('bad');
  if(!isSuperAdmin()){ msg.textContent='Accès non autorisé : gestion utilisateurs réservée aux éditeurs autorisés.'; msg.classList.add('bad'); return; }
  const name = $('#newStaffName').value.trim();
  const email = $('#newStaffEmail').value.trim().toLowerCase();
  const password = $('#newStaffPassword').value;
  const service = permissionsService();
  const role = service?.normalizeRole ? service.normalizeRole($('#newStaffRole').value) : $('#newStaffRole').value;
  const roleLabel = service?.roleLabel ? service.roleLabel(role) : role;
  const permissionLevel = service?.normalizePermission ? service.normalizePermission($('#newStaffPermission')?.value || 'LECTEUR') : ($('#newStaffPermission')?.value || 'LECTEUR');
  const permissionLabel = service?.permissionLabel ? service.permissionLabel(permissionLevel) : permissionLevel;
  const scope = $('#newStaffScope').value.trim();
  const teamIds = readCsvField('newStaffTeams');
  const allowedModules = readCsvField('newStaffModules');
  const status = $('#newStaffStatus')?.value || 'ACTIVE';
  if(!email || !password || password.length < 6){ msg.textContent='Email et mot de passe de 6 caractères minimum obligatoires.'; msg.classList.add('bad'); return; }

  let secondary = null;
  try{
    await loadFirebaseFns();
    const secondaryName = 'coachpulse-secondary-' + Date.now();
    secondary = firebaseFns.initializeApp(FIREBASE_CONFIG, secondaryName);
    const secondaryAuth = firebaseFns.getAuth(secondary);

    const cred = await firebaseFns.createUserWithEmailAndPassword(secondaryAuth, email, password);
    await firebaseFns.updateProfile(cred.user, {displayName:name || email});

    await firebaseFns.setDoc(firebaseFns.doc(db, 'staff_members', cred.user.uid), {
      uid:cred.user.uid, name:name || email, email, role, roleLabel, permissionLevel, permissionLabel, scope:scope || teamIds.join(', ') || 'CoachPulse', teamIds, allowedTeamIds:teamIds, allowedModules, modulePermissions:{}, status,
      userType:'staff',
      createdBy:currentUser.uid, createdByEmail:currentUser.email, createdAt:firebaseFns.serverTimestamp(), updatedAt:firebaseFns.serverTimestamp()
    }, {merge:true});

    await firebaseFns.signOut(secondaryAuth).catch(()=>{});
    msg.textContent = 'Compte créé : '+email;
    resetMemberForm(false);
    await loadMembers();
  }catch(e){
    const raw = String(e?.code || e?.message || e || '');
    let friendly = cleanError(e);
    if(raw.includes('auth/email-already-in-use')) friendly = 'Cet email existe déjà dans Firebase Authentication. Va dans Console Firebase > Authentication pour vérifier le compte, puis crée/actualise le profil staff si besoin.';
    if(raw.includes('auth/operation-not-allowed')) friendly = 'La connexion Email/Mot de passe n’est pas activée dans Firebase Authentication.';
    if(raw.includes('permission-denied') || raw.includes('Missing or insufficient permissions')) friendly = 'Compte Auth créé, mais Firestore refuse le profil staff. Vérifie les règles Firestore staff_members.';
    msg.textContent = 'Création impossible : '+friendly;
    msg.classList.add('bad');
  }finally{
    if(secondary){
      try{ await firebaseFns.deleteApp(secondary); }catch(_e){}
    }
  }
}
function resetMemberForm(clearMsg=true){
  ['newStaffName','newStaffEmail','newStaffPassword','newStaffScope','newStaffTeams','newStaffModules'].forEach(id => { const el=$('#'+id); if(el) el.value=''; });
  $('#newStaffRole').value='ENTRAINEUR';
  if($('#newStaffPermission')) $('#newStaffPermission').value='LECTEUR';
  if($('#newStaffStatus')) $('#newStaffStatus').value='ACTIVE';
  refreshAdminAccessPickers();
  if(clearMsg){ $('#adminMsg').textContent=''; $('#adminMsg').classList.remove('bad'); }
}
function roleOptions(selected='ENTRAINEUR'){
  const service = permissionsService();
  const labels = service?.ROLE_LABELS || {RESPONSABLE_POLE:'Responsable de pôle',ENTRAINEUR:'Entraîneur',ENTRAINEUR_ADJOINT:'Entraîneur adjoint',PREPARATEUR_PHYSIQUE:'Préparateur physique',KINE:'Kiné',MEDECIN:'Médecin',DIRIGEANT:'Dirigeant'};
  const current = service?.normalizeRole ? service.normalizeRole(selected) : selected;
  return Object.entries(labels).map(([role,label]) => `<option value="${role}" ${role===current?'selected':''}>${escapeHtml(label)}</option>`).join('');
}
function permissionOptions(selected='LECTEUR'){
  const service = permissionsService();
  const labels = service?.PERMISSION_LABELS || {LECTEUR:'Lecteur',SAISIE:'Saisie',EDITEUR:'Éditeur',ADMIN:'Admin'};
  const current = service?.normalizePermission ? service.normalizePermission(selected) : selected;
  return Object.entries(labels).map(([permission,label]) => `<option value="${permission}" ${permission===current?'selected':''}>${escapeHtml(label)}</option>`).join('');
}
function readCsvField(id){
  return parseAccessList($('#'+id)?.value || '');
}
function parseAccessList(value){
  return [...new Set(String(value || '').split(/[,;\n]+/).map(v => v.trim()).filter(Boolean))];
}
function accessChoiceKey(value){
  return String(value || '').trim().toLowerCase();
}
function uniqueAccessChoices(items=[]){
  const seen = new Set();
  return items.map(item => {
    const value = String(item?.value || '').trim();
    const label = String(item?.label || value).trim();
    const hint = String(item?.hint || '').trim();
    return value ? {value, label, hint} : null;
  }).filter(Boolean).filter(item => {
    const key = accessChoiceKey(item.value);
    if(seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function moduleAccessChoices(){
  return uniqueAccessChoices(moduleRegistry()
    .filter(module => module.id !== 'home')
    .map(module => ({
      value:module.id,
      label:module.name,
      hint:module.section === 'admin' ? 'Admin' : (module.section === 'future' ? 'À venir' : 'Staff')
    })));
}
async function loadAdminAccessChoices(force=false){
  if(adminAccessChoiceCache && !force) return adminAccessChoiceCache;
  const moduleChoices = moduleAccessChoices();
  const baseTeamChoices = DEFAULT_DB_OPTIONS.categories.map(value => ({value, label:value, hint:'Catégorie'}));
  let teamChoices = [...baseTeamChoices];
  try{
    const data = await adminListTeamsAndSettings();
    const settings = data?.settings || {};
    teamChoices = [
      ...(Array.isArray(settings.categories) ? settings.categories : []).map(value => ({value, label:value, hint:'Catégorie'})),
      ...(Array.isArray(settings.subCategories) ? settings.subCategories : []).map(value => ({value, label:value, hint:'Sous-catégorie'})),
      ...(data?.teams || []).map(team => {
        const value = team.teamId || team.id || team.name || team.category || '';
        const label = team.name || team.teamName || value;
        const hint = team.category || team.level || 'Équipe';
        return {value, label, hint};
      }),
      ...baseTeamChoices
    ];
  }catch(_e){}
  adminAccessChoiceCache = {
    teams:uniqueAccessChoices(teamChoices).sort((a,b) => a.label.localeCompare(b.label, 'fr', {numeric:true})),
    modules:moduleChoices
  };
  return adminAccessChoiceCache;
}
function renderAccessPicker(kind, selected=[], choices=[], inputAttrs=''){
  const selectedKeys = new Set(parseAccessList(selected).map(accessChoiceKey));
  const knownKeys = new Set(choices.map(choice => accessChoiceKey(choice.value)));
  const extraChoices = parseAccessList(selected)
    .filter(value => value && !knownKeys.has(accessChoiceKey(value)))
    .map(value => ({value, label:value, hint:'Personnalisé'}));
  const allChoices = uniqueAccessChoices([...choices, ...extraChoices]);
  const selectedValues = allChoices.filter(choice => selectedKeys.has(accessChoiceKey(choice.value))).map(choice => choice.value);
  const list = allChoices.length ? allChoices.map(choice => {
    const checked = selectedKeys.has(accessChoiceKey(choice.value)) ? 'checked' : '';
    const title = choice.hint ? `${choice.label} · ${choice.hint}` : choice.label;
    return `<label class="access-choice" title="${escapeHtml(title)}"><input type="checkbox" data-access-choice="${escapeHtml(kind)}" value="${escapeHtml(choice.value)}" ${checked}><span>${escapeHtml(choice.label)}</span>${choice.hint ? `<small>${escapeHtml(choice.hint)}</small>` : ''}</label>`;
  }).join('') : '<div class="admin-note">Aucun choix disponible.</div>';
  const summary = selectedValues.length ? `${selectedValues.length} sélectionné(s)` : 'Aucun accès spécifique';
  const selectedLabel = selectedValues.length ? selectedValues.slice(0, 2).join(', ') + (selectedValues.length > 2 ? ` +${selectedValues.length - 2}` : '') : 'Choisir';
  return `<details class="access-picker" data-access-kind="${escapeHtml(kind)}"><summary><span class="access-summary">${escapeHtml(summary)}</span><b>${escapeHtml(selectedLabel)}</b></summary><input type="hidden" ${inputAttrs} value="${escapeHtml(selectedValues.join(', '))}"><div class="access-choice-list">${list}</div></details>`;
}
function syncAccessPicker(picker){
  if(!picker) return;
  const selected = [...picker.querySelectorAll('[data-access-choice]:checked')].map(input => input.value);
  const hidden = picker.querySelector('input[type="hidden"]');
  if(hidden) hidden.value = selected.join(', ');
  const summary = picker.querySelector('.access-summary');
  if(summary) summary.textContent = selected.length ? `${selected.length} sélectionné(s)` : 'Aucun accès spécifique';
  const label = picker.querySelector('summary b');
  if(label) label.textContent = selected.length ? selected.slice(0, 2).join(', ') + (selected.length > 2 ? ` +${selected.length - 2}` : '') : 'Choisir';
}
function ensureAccessPickerStyles(){
  if(document.getElementById('accessPickerStyles')) return;
  const style = document.createElement('style');
  style.id = 'accessPickerStyles';
  style.textContent = `.access-picker{position:relative;border:1px solid var(--line);border-radius:12px;background:#fff}.access-picker summary{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:42px;padding:8px 10px;cursor:pointer;list-style:none}.access-picker summary::-webkit-details-marker{display:none}.access-picker summary:after{content:'⌄';color:var(--muted);font-weight:1000}.access-picker[open] summary:after{content:'⌃'}.access-picker summary b{font-size:12px;color:#06351f;max-width:52%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.access-choice-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:6px;max-height:210px;overflow:auto;padding:8px;border-top:1px solid var(--line);background:#fff;box-shadow:0 14px 30px rgba(6,23,13,.10);border-radius:0 0 12px 12px}.access-choice{display:flex;align-items:center;gap:7px;border:1px solid var(--line);border-radius:10px;background:#f8fafc;padding:8px;cursor:pointer;min-width:0}.access-choice input{width:auto!important;margin:0}.access-choice span{font-weight:900;color:#06351f;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.access-choice small{margin-left:auto;color:var(--muted);font-size:10px;font-weight:900;text-transform:uppercase}.access-choice:has(input:checked){border-color:rgba(29,153,91,.55);background:#eef8f2}.access-summary{color:var(--muted);font-size:12px;font-weight:900;white-space:nowrap}.staff-table .access-picker{min-width:190px}.staff-table .access-choice-list{grid-template-columns:minmax(130px,1fr);max-height:170px}.staff-table .access-choice small{display:none}`;
  document.head.appendChild(style);
}
async function refreshAdminAccessPickers(){
  if(!isSuperAdmin()) return;
  const choices = await loadAdminAccessChoices();
  const teamsBox = $('#newStaffTeamsPicker');
  const modulesBox = $('#newStaffModulesPicker');
  if(teamsBox) teamsBox.innerHTML = renderAccessPicker('teams', readCsvField('newStaffTeams'), choices.teams, 'id="newStaffTeams"');
  if(modulesBox) modulesBox.innerHTML = renderAccessPicker('modules', readCsvField('newStaffModules'), choices.modules, 'id="newStaffModules"');
}
function ensureUserAdminFields(){
  ensureAccessPickerStyles();
  const roleSelect = $('#newStaffRole');
  if(roleSelect && !roleSelect.dataset.extendedRoles){
    const roleLabel = roleSelect.closest('.field')?.querySelector('label');
    if(roleLabel) roleLabel.textContent = 'Rôle métier';
    roleSelect.innerHTML = roleOptions('ENTRAINEUR');
    roleSelect.dataset.extendedRoles = '1';
    roleSelect.closest('.field')?.insertAdjacentHTML('afterend', `<div class="field"><label>Permission</label><select id="newStaffPermission">${permissionOptions('LECTEUR')}</select></div>`);
  }
  const scope = $('#newStaffScope');
  if(scope && !$('#newStaffTeams')){
    scope.closest('.field')?.insertAdjacentHTML('afterend', `<div class="form-grid"><div class="field"><label>Équipes autorisées</label><div id="newStaffTeamsPicker" class="admin-note">Chargement des équipes...</div></div><div class="field"><label>Modules autorisés</label><div id="newStaffModulesPicker" class="admin-note">Chargement des modules...</div></div></div><div class="field"><label>Statut</label><select id="newStaffStatus"><option value="ACTIVE">Actif</option><option value="INACTIVE">Inactif</option><option value="ARCHIVED">Archivé</option></select></div>`);
  }
  const roleList = document.querySelector('.role-list');
  if(roleList && !roleList.dataset.extendedRoles){
    roleList.innerHTML = `<div><b>Rôle métier</b><span>Fonction dans le club : responsable de pôle, entraîneur, adjoint, préparateur, kiné, médecin ou dirigeant.</span></div><div><b>Équipes</b><span>Périmètre sportif accessible. Plusieurs équipes peuvent être sélectionnées.</span></div><div><b>Modules</b><span>Périmètre fonctionnel visible dans CoachPulse.</span></div><div><b>Lecteur</b><span>Consultation uniquement sur les modules autorisés.</span></div><div><b>Saisie</b><span>Consultation et ajout/modification courante sur les modules autorisés.</span></div><div><b>Éditeur</b><span>Droits avancés sur les modules autorisés, avec accès aux actions d’administration si le module est autorisé.</span></div><div><b>Admin</b><span>Tous les droits, toutes les équipes et tous les modules.</span></div>`;
    roleList.dataset.extendedRoles = '1';
  }
}
async function loadMembers(){
  if(!db || !isSuperAdmin()) return;
  ensureUserAdminFields();
  const choices = await loadAdminAccessChoices();
  const tbody = $('#membersTbody'); if(!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6">Chargement...</td></tr>';
  try{
    const q = firebaseFns.query(firebaseFns.collection(db, 'staff_members'), firebaseFns.orderBy('createdAt','desc'));
    const snap = await firebaseFns.getDocs(q);
    if(snap.empty){ tbody.innerHTML = '<tr><td colspan="6">Aucun compte staff enregistré.</td></tr>'; return; }
    tbody.innerHTML = '';
    snap.forEach(docSnap => {
      const m = {uid:docSnap.id, ...docSnap.data()};
      const tr = document.createElement('tr');
      const teams = [...new Set([...(m.teamIds || []), ...(m.allowedTeamIds || [])])].filter(Boolean);
      const modules = m.allowedModules || [];
      const teamPicker = renderAccessPicker('teams', teams, choices.teams, `data-teams="${escapeHtml(m.uid)}"`);
      const modulePicker = renderAccessPicker('modules', modules, choices.modules, `data-modules="${escapeHtml(m.uid)}"`);
      tr.innerHTML = `<td><b>${escapeHtml(m.name||'-')}</b></td><td>${escapeHtml(m.email||'-')}</td><td><label class="admin-note">Rôle métier</label><select data-role="${m.uid}">${roleOptions(m.role)}</select><label class="admin-note" style="display:block;margin-top:8px">Permission</label><select data-permission="${m.uid}">${permissionOptions(m.permissionLevel || m.permission || m.role)}</select></td><td><label class="admin-note">Équipes</label>${teamPicker}<label class="admin-note" style="display:block;margin-top:8px">Modules</label>${modulePicker}</td><td><select data-status="${m.uid}"><option value="ACTIVE" ${String(m.status||'ACTIVE').toUpperCase()==='ACTIVE'?'selected':''}>Actif</option><option value="INACTIVE" ${String(m.status||'').toUpperCase()==='INACTIVE'?'selected':''}>Inactif</option><option value="ARCHIVED" ${String(m.status||'').toUpperCase()==='ARCHIVED'?'selected':''}>Archivé</option></select></td><td><div class="staff-actions"><button data-reset="${m.email||''}">Reset MDP</button><button data-save="${m.uid}">Sauver accès</button><button class="danger" data-archive="${m.uid}">${String(m.status||'ACTIVE').toUpperCase()==='ARCHIVED'?'Réactiver':'Archiver'}</button></div></td>`;
      tbody.appendChild(tr);
    });
  }catch(e){ tbody.innerHTML = `<tr><td colspan="6">Erreur : ${escapeHtml(cleanError(e))}</td></tr>`; }
}
function customPlayers(){
  try{ return JSON.parse(localStorage.getItem('coachpulse:customPlayers') || '[]').filter(Boolean); }
  catch(_e){ return []; }
}
function setCustomPlayers(players){
  localStorage.setItem('coachpulse:customPlayers', JSON.stringify(players || []));
  localStorage.setItem('coachpulse:pendingSync','1');
  renderCustomPlayers();
  snapshotLocalData();
  notifyFramesPlayersUpdated();
  if(db && currentUser) migrateLocalDataToCentralFirestore(false);
}
function slugify(v){
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'joueuse';
}
function readPlayerPhoto(){
  const file = $('#playerPhoto')?.files?.[0];
  if(!file) return Promise.resolve('');
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}
function openPlayerModal(){
  if(!requireAuth()) return setLocked(true);
  if(!guardAdminAction('La gestion manuelle des joueuses est réservée aux administrateurs.')) return;
  $('#playerModal')?.classList.add('open');
  renderCustomPlayers();
  updatePlayerPreview();
}
function closePlayerModal(){ $('#playerModal')?.classList.remove('open'); }
function resetPlayerForm(){
  ['playerFirstName','playerLastName','playerBirth'].forEach(id => { const el=$('#'+id); if(el) el.value=''; });
  if($('#playerCategory')) $('#playerCategory').value='U12';
  if($('#playerTeam')) $('#playerTeam').value='U12-U13';
  if($('#playerFoot')) $('#playerFoot').value='';
  if($('#playerPhoto')) $('#playerPhoto').value='';
  if($('#playerMsg')) $('#playerMsg').textContent='';
  updatePlayerPreview();
}
function playerDisplayName(p){
  return `${String(p.prenom||'').trim()} ${String(p.nom||'').toUpperCase()}`.trim().toUpperCase();
}
function updatePlayerPreview(){
  const first=$('#playerFirstName')?.value.trim() || '';
  const last=$('#playerLastName')?.value.trim() || '';
  const cat=$('#playerCategory')?.value || '';
  const team=$('#playerTeam')?.value || '';
  const name=`${first} ${last.toUpperCase()}`.trim().toUpperCase() || 'Nouvelle joueuse';
  const initials=(first||last||'?').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase() || '?';
  const box=$('#playerPreview'); if(!box) return;
  box.innerHTML=`<div class="player-avatar-preview">${escapeHtml(initials)}</div><div><b>${escapeHtml(name)}</b><br><span>${escapeHtml([team,cat].filter(Boolean).join(' · ') || 'Complète le formulaire.')}</span></div>`;
}
async function saveManualPlayer(){
  if(!guardAdminAction('La gestion manuelle des joueuses est réservée aux administrateurs.')) return;
  const msg=$('#playerMsg'); if(msg){ msg.textContent=''; msg.classList.remove('bad'); }
  const prenom=$('#playerFirstName')?.value.trim() || '';
  const nom=$('#playerLastName')?.value.trim() || '';
  if(!prenom || !nom){
    if(msg){ msg.textContent='Prénom et nom obligatoires.'; msg.classList.add('bad'); }
    return;
  }
  const photo = await readPlayerPhoto();
  const categorie=$('#playerCategory')?.value || '';
  const team=$('#playerTeam')?.value || '';
  const birth=$('#playerBirth')?.value.trim() || '';
  const service=playersService();
  const baseId=stableFirestoreId('player', nom, prenom, birth || 'no-birth');
  const players=customPlayers();
  const duplicate=players.find(p => slugify(playerDisplayName(p)) === slugify(`${prenom} ${nom}`) && String(p.birth || p.dateNaissance || '') === birth);
  if(duplicate){
    if(msg){ msg.textContent='Cette joueuse existe déjà dans la base manuelle.'; msg.classList.add('bad'); }
    return;
  }
  const rawPlayer={
    id:baseId, playerId:baseId,
    prenom:prenom.toUpperCase(), nom:nom.toUpperCase(), categorie, subCategory:categorie, team,
    foot:$('#playerFoot')?.value || '', birth, age:/^\d{1,2}$/.test(birth)?birth:'',
    photo, source:'Saisie manuelle CoachPulse', createdAt:new Date().toISOString()
  };
  const player=service?.normalizePlayer ? service.normalizePlayer(rawPlayer) : rawPlayer;
  players.push(player);
  setCustomPlayers(players);
  resetPlayerForm();
  if(msg) msg.textContent='Joueuse ajoutée à la base commune.';
}
function deleteManualPlayer(id){
  if(!id) return;
  if(!confirm('Retirer cette joueuse de la base manuelle ?')) return;
  setCustomPlayers(customPlayers().filter(p => p.id !== id));
}
function renderCustomPlayers(){
  const box=$('#customPlayerList'); if(!box) return;
  const players=customPlayers();
  box.innerHTML = players.length ? players.slice().reverse().map(p => `<div class="player-list-row"><div><b>${escapeHtml(playerDisplayName(p))}</b><br><span>${escapeHtml([p.team,p.categorie,p.foot].filter(Boolean).join(' · ') || 'Infos non renseignées')}</span></div><button data-delete-player="${escapeHtml(p.id)}">Retirer</button></div>`).join('') : '<div class="player-list-row"><span>Aucune joueuse ajoutée manuellement.</span></div>';
}
async function adminTableClick(e){
  const resetEmail = e.target?.dataset?.reset;
  const saveUid = e.target?.dataset?.save;
  const archiveUid = e.target?.dataset?.archive;
  if((resetEmail || saveUid || archiveUid) && !isSuperAdmin()){
    alert('Accès non autorisé : gestion utilisateurs réservée aux éditeurs autorisés.');
    return;
  }
  try{
    if(resetEmail){ await firebaseFns.sendPasswordResetEmail(auth, resetEmail); alert('Email de réinitialisation envoyé à '+resetEmail); }
    if(saveUid){
      const service = permissionsService();
      const role = service?.normalizeRole ? service.normalizeRole(document.querySelector(`[data-role="${saveUid}"]`)?.value || 'ENTRAINEUR') : (document.querySelector(`[data-role="${saveUid}"]`)?.value || 'ENTRAINEUR');
      const permissionLevel = service?.normalizePermission ? service.normalizePermission(document.querySelector(`[data-permission="${saveUid}"]`)?.value || 'LECTEUR') : (document.querySelector(`[data-permission="${saveUid}"]`)?.value || 'LECTEUR');
      const teamIds = parseAccessList(document.querySelector(`[data-teams="${saveUid}"]`)?.value || '');
      const allowedModules = parseAccessList(document.querySelector(`[data-modules="${saveUid}"]`)?.value || '');
      const status = String(document.querySelector(`[data-status="${saveUid}"]`)?.value || 'ACTIVE').toUpperCase();
      await firebaseFns.setDoc(firebaseFns.doc(db,'staff_members',saveUid), {
        role,
        roleLabel:service?.roleLabel ? service.roleLabel(role) : role,
        permissionLevel,
        permissionLabel:service?.permissionLabel ? service.permissionLabel(permissionLevel) : permissionLevel,
        teamIds,
        allowedTeamIds:teamIds,
        allowedModules,
        status,
        userType:'staff',
        updatedAt:firebaseFns.serverTimestamp(),
        updatedAtIso:new Date().toISOString(),
        updatedBy:currentUser.uid,
        updatedByEmail:currentUser.email || ''
      }, {merge:true});
      alert('Accès utilisateur mis à jour.');
      await loadMembers();
    }
    if(archiveUid){
      const ref=firebaseFns.doc(db,'staff_members',archiveUid);
      const snap=await firebaseFns.getDoc(ref);
      const current=String(snap.data()?.status || 'ACTIVE').toUpperCase();
      await firebaseFns.setDoc(ref,{status:current==='ARCHIVED'?'ACTIVE':'ARCHIVED', updatedAt:firebaseFns.serverTimestamp(), updatedAtIso:new Date().toISOString(), updatedBy:currentUser.uid, updatedByEmail:currentUser.email || ''},{merge:true});
      await loadMembers();
    }
  }catch(err){ alert('Action impossible : '+cleanError(err)); }
}
function adminAccessPickerChange(e){
  if(e.target?.matches?.('[data-access-choice]')) syncAccessPicker(e.target.closest('.access-picker'));
}

$('#menuBtn').addEventListener('click', () => { if(window.matchMedia('(max-width:1180px)').matches) openDrawer(); else shell.classList.toggle('collapsed'); });
overlay.addEventListener('click', closeDrawer);
$$('[data-tool]').forEach(el => el.addEventListener('click', () => routeTo(el.dataset.tool)));
$('#homeBtn').addEventListener('click', () => routeTo('home'));
$('#addPlayerBtn').addEventListener('click', openPlayerModal);
$('#importDbBtn')?.addEventListener('click', openImportModal);
$('#openImportFromCloud')?.addEventListener('click', () => { cloudPanel.classList.remove('open'); openImportModal(); });
$('#closeImportBtn')?.addEventListener('click', closeImportModal);
$('#importModal')?.addEventListener('click', e => { if(e.target?.id === 'importModal') closeImportModal(); });
$('#dbImportInput')?.addEventListener('change', handleImportFileSelected);
$('#simulateImportBtn')?.addEventListener('click', simulateImport);
$('#commitImportBtn')?.addEventListener('click', commitImport);
$('#importExportJsonBtn')?.addEventListener('click', () => exportCentralFirestore('json'));
$('#importExportCsvBtn')?.addEventListener('click', () => exportCentralFirestore('csv'));
$('#closePlayerBtn').addEventListener('click', closePlayerModal);
$('#resetPlayerBtn').addEventListener('click', resetPlayerForm);
$('#savePlayerBtn').addEventListener('click', saveManualPlayer);
$('#playerModal').addEventListener('click', e => { if(e.target?.id === 'playerModal') closePlayerModal(); if(e.target?.dataset?.deletePlayer) deleteManualPlayer(e.target.dataset.deletePlayer); });
['playerFirstName','playerLastName','playerCategory','playerTeam','playerFoot','playerBirth'].forEach(id => $('#'+id)?.addEventListener('input', updatePlayerPreview));
$('#loginBtn').addEventListener('click', signInStaff);
$('#loginPassword').addEventListener('keydown', e => { if(e.key === 'Enter') signInStaff(); });
$('#logoutBtn').addEventListener('click', logout);
$('#staffLogout').addEventListener('click', logout);

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; installBtn.hidden = false; });
installBtn.addEventListener('click', async () => { if(!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; installBtn.hidden = true; });

$('#saveNow').addEventListener('click', snapshotLocalData);
$('#exportBackup').addEventListener('click', () => { if(guardAdminAction()) exportJson(buildPayload(), 'coachpulse_sauvegarde_locale_v6.json'); });
$('#exportGlobal').addEventListener('click', () => { if(guardAdminAction()) exportJson(buildPayload(), 'coachpulse_export_global_v6.json'); });
$('#importBackupInput').addEventListener('change', async e => {
  if(!guardAdminAction()) { e.target.value=''; return; }
  const file = e.target.files?.[0]; if(!file) return;
  try{ const payload=JSON.parse(await file.text()); Object.entries(payload.items||{}).forEach(([k,v])=>localStorage.setItem(k,v)); snapshotLocalData(); alert('Sauvegarde restaurée. Recharge la page si besoin.'); }
  catch(err){ alert('Fichier de sauvegarde invalide.'); }
  e.target.value='';
});
$('#cloudBtn').addEventListener('click', () => { if(!requireAuth()) return setLocked(true); if(!guardAdminAction('Le panneau Cloud est réservé aux administrateurs.')) return; cloudPanel.classList.add('open'); $('#staffEmail').value = currentUser?.email || ''; $('#staffName').value = currentProfile?.name || ''; $('#staffRole').value = currentProfile?.role || ''; });
$('#cloudClose').addEventListener('click', () => cloudPanel.classList.remove('open'));
$('#saveFirebaseConfig').addEventListener('click', () => alert('Firebase est déjà intégré dans CoachPulse V6.'));
$('#staffLogin').addEventListener('click', async () => { $('#loginEmail').value=$('#staffEmail').value.trim(); $('#loginPassword').value=$('#staffPassword').value; await signInStaff(); });
$('#openAdminFromCloud').addEventListener('click', () => { cloudPanel.classList.remove('open'); routeTo('admin'); });
$('#syncNow').addEventListener('click', () => { if(guardAdminAction()) syncCloud(true); });
$('#pullCloud').addEventListener('click', async () => { if(!guardAdminAction()) return; try{ await pullCloud(); alert('Données cloud récupérées.'); }catch(e){ alert('Récupération impossible : '+cleanError(e)); } });
$('#migrateCentral')?.addEventListener('click', () => migrateLocalDataToCentralFirestore(true));
$('#pullCentralPlayers')?.addEventListener('click', async () => { try{ await pullCentralPlayersToLocal(true); }catch(e){ alert('Récupération impossible : '+cleanError(e)); } });
$('#exportCentralJson')?.addEventListener('click', () => exportCentralFirestore('json'));
$('#exportCentralCsv')?.addEventListener('click', () => exportCentralFirestore('csv'));
$('#createMemberBtn').addEventListener('click', createMember);
$('#resetMemberFormBtn').addEventListener('click', () => resetMemberForm(true));
$('#refreshMembersBtn').addEventListener('click', async () => { adminAccessChoiceCache = null; await refreshAdminAccessPickers(); await loadMembers(); });
$('#membersTbody').addEventListener('click', adminTableClick);
adminView?.addEventListener('change', adminAccessPickerChange);

window.addEventListener('online', () => { updateSyncState('Retour Internet · sync...'); syncCloud(false); });
window.addEventListener('offline', () => updateSyncState('Hors ligne · local actif'));
window.addEventListener('resize', () => { if(window.matchMedia('(max-width:1180px)').matches) shell.classList.remove('collapsed'); });
window.addEventListener('message', e => { if(e.data?.type === 'coachpulse-local-change') snapshotLocalData(); });
frame.addEventListener('load', installFrameLocalStorageWatcher);
setInterval(() => { snapshotLocalData(); if(currentUser && localStorage.getItem('coachpulse:pendingSync') === '1') scheduleCloudSync(500); }, 5000);
setInterval(snapshotLocalData, 15000);
window.addEventListener('pagehide', snapshotLocalData);
window.addEventListener('storage', snapshotLocalData);

if('serviceWorker' in navigator){ window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.error)); }
window.addEventListener('load', () => {
  localStorage.setItem('coachpulse:firebaseConfig', JSON.stringify(FIREBASE_CONFIG));
  setLocked(true);
  setTimeout(() => $('#splash').classList.add('hide'), 950);
  initFirebase();
  snapshotLocalData();
  renderCustomPlayers();
  syncTimer = setInterval(() => { if(localStorage.getItem('coachpulse:pendingSync') === '1') syncCloud(false); }, 15000);
});
