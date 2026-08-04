const assert = require('assert/strict');
const fs = require('fs');
const vm = require('vm');

const players = require('../shared/services/players-service.js');
const teams = require('../shared/services/teams-service.js');
const permissions = require('../shared/services/permissions-service.js');
const modules = require('../shared/utils/module-registry.js');

function loadBrowserScript(filePath, windowOverrides={}){
  const window = {
    parent:{},
    addEventListener(){},
    document:{readyState:'complete', addEventListener(){}},
    localStorage:{getItem(){ return null; }, setItem(){}, removeItem(){}},
    ...windowOverrides
  };
  window.window = window;
  window.globalThis = window;
  const context = vm.createContext({window, globalThis:window, console, setTimeout, clearTimeout});
  vm.runInContext(fs.readFileSync(filePath, 'utf8'), context, {filename:filePath});
  return window;
}

function testPlayerIdsAndSeasons(){
  const raw = {
    nom:'Martin',
    prenom:'Lea',
    birth:'2016-09-04',
    team:'U11 A',
    season:'2025-2026'
  };
  const normalized = players.normalizePlayer(raw);
  assert.equal(normalized.playerId, 'player-lea-martin-2016-09-04');

  const season2526 = players.playerSeasonSnapshot(normalized, '2025-2026');
  assert.equal(season2526.subCategory, 'U10');
  assert.equal(season2526.categorie, 'U11');
  assert.equal(season2526.team, 'U11 A');
  assert.equal(season2526.teamId, teams.canonicalTeamId('U11 A'));

  const season2627 = players.playerSeasonSnapshot(normalized, '2026-2027');
  assert.equal(season2627.subCategory, 'U11');
  assert.equal(season2627.categorie, 'U11');
  assert.equal(season2627.team, 'U11 A');
}

function testPlayerIdStaysStableOnEdit(){
  const previous = players.normalizePlayer({
    nom:'Lopes',
    prenom:'Coelho Myriam',
    birth:'2005-06-24',
    team:'U19',
    season:'2025-2026'
  });
  const edited = players.normalizePlayer({
    documentId:previous.playerId,
    playerId:previous.playerId,
    nom:'Coelho',
    prenom:'Myriam Lopes',
    birth:'2005-06-24',
    team:'U19',
    season:'2025-2026'
  });

  assert.equal(edited.playerId, previous.playerId);
  assert.equal(edited.id, previous.playerId);
  assert.equal(edited.nom, 'COELHO');
  assert.equal(edited.prenom, 'MYRIAM LOPES');
}

function testTeamIdsStayShared(){
  assert.equal(players.canonicalTeamId('U13 A'), teams.canonicalTeamId('U13 A'));
  assert.equal(teams.defaultTeamForSubCategory('U15'), 'U16 A');
  assert.equal(teams.categoryForSubCategory('U15'), 'U16');
}

function testManualTeamEditOverridesDefaultCategoryTeam(){
  const edited = players.normalizePlayer({
    playerId:'player-u16-surclassement',
    nom:'Martin',
    prenom:'Ava',
    birth:'2010-03-01',
    team:'U19',
    teamId:teams.canonicalTeamId('U19'),
    teamIds:[teams.canonicalTeamId('U16 A'), teams.canonicalTeamId('U19')],
    currentSeason:'2026-2027',
    seasonHistory:{
      '2026-2027':{
        categorie:'U16',
        subCategory:'U16',
        team:'U19',
        teamId:teams.canonicalTeamId('U19'),
        teamIds:[teams.canonicalTeamId('U16 A'), teams.canonicalTeamId('U19')]
      }
    }
  });

  assert.equal(edited.team, 'U19');
  assert.equal(edited.teamId, teams.canonicalTeamId('U19'));
  assert(edited.teamIds.includes(teams.canonicalTeamId('U16 A')));
  assert(edited.teamIds.includes(teams.canonicalTeamId('U19')));
}

function testEditedTeamIdsDoNotReAddRemovedEligibleTeam(){
  const u16Id = teams.canonicalTeamId('U16 A');
  const u19Id = teams.canonicalTeamId('U19');
  const edited = players.normalizePlayer({
    playerId:'player-u16-keeps-explicit-teamids',
    nom:'Dupont',
    prenom:'Lina',
    birth:'2011-02-01',
    team:'U16 A',
    teamId:u16Id,
    teamIds:[u16Id],
    currentSeason:'2026-2027',
    seasonHistory:{
      '2026-2027':{
        categorie:'U16',
        subCategory:'U16',
        team:'U16 A',
        teamId:u16Id,
        teamIds:[u16Id]
      }
    }
  });

  assert.equal(edited.teamId, u16Id);
  assert(edited.teamIds.includes(u16Id));
  assert(!edited.teamIds.includes(u19Id));
}

function testPlayerFilteringAndDedupe(){
  const active = players.normalizePlayer({nom:'Dupont', prenom:'Ava', birth:'2014-01-02', status:'active'});
  const duplicate = {...active, photo:'updated-photo'};
  const archived = players.normalizePlayer({nom:'Archive', prenom:'Zoé', birth:'2013-03-04', status:'archived'});
  const rows = players.filterPlayers([active, duplicate, archived], {season:'2025-2026'});
  assert.equal(rows.length, 1);
  assert.equal(rows[0].playerId, active.playerId);
}

function testPermissions(){
  const u13Id = teams.canonicalTeamId('U13 A');
  const u16Id = teams.canonicalTeamId('U16 A');
  const scopedCoach = permissions.defaultProfile({uid:'coach-u13', email:'coach@club.test'}, 'ENTRAINEUR', 'SAISIE');
  scopedCoach.authorizedTeamIds = [u13Id];

  assert.equal(permissions.canAccessTeam(scopedCoach, u13Id), true);
  assert.equal(permissions.canAccessTeam(scopedCoach, u16Id), false);
  assert.equal(permissions.canAccessPlayer(scopedCoach, {playerId:'p1', teamId:u13Id}), true);
  assert.equal(permissions.canAccessPlayer(scopedCoach, {playerId:'p2', teamId:u16Id}), false);
  assert.equal(permissions.canAccessRecord(scopedCoach, {playerId:'p1', playerSnapshot:{teamIds:[u13Id]}}), true);
  assert.equal(permissions.canAccessRecord(scopedCoach, {playerId:'p2', playerSnapshot:{teamIds:[u16Id]}}), false);

  const admin = permissions.defaultProfile({uid:'admin', email:'admin@club.test'}, 'DIRIGEANT', 'ADMIN');
  assert.equal(permissions.canAccessTeam(admin, u16Id), true);
  assert.equal(permissions.canAccessPlayer(admin, {playerId:'p2', teamId:u16Id}), true);
  assert.equal(permissions.canPerformAction(admin, {id:'database'}, 'delete'), true);
}

function testPermissionsRespectTeamHistoryAndModuleScope(){
  const u13Id = teams.canonicalTeamId('U13 A');
  const u16Id = teams.canonicalTeamId('U16 A');
  const scopedCoach = permissions.defaultProfile({uid:'coach-u13', email:'coach@club.test'}, 'ENTRAINEUR', 'SAISIE');
  scopedCoach.authorizedTeamIds = [u13Id];
  scopedCoach.allowedModules = ['playerProfile'];
  scopedCoach.modulePermissions = {
    playerProfile:{read:true, write:false},
    database:{read:false, write:false}
  };

  assert.equal(permissions.canAccessPlayer(scopedCoach, {
    playerId:'player-history',
    teamId:u16Id,
    seasonHistory:{'2025-2026':{teamId:u13Id}}
  }), true);
  assert.equal(permissions.canViewModule(scopedCoach, {id:'playerProfile', active:true}), true);
  assert.equal(permissions.canEditModule(scopedCoach, {id:'playerProfile', active:true}), false);
  assert.equal(permissions.canViewModule(scopedCoach, {id:'database', active:true}), false);
}

function testModuleAllPlayersScopeStaysModuleSpecific(){
  const u13Id = teams.canonicalTeamId('U13 A');
  const u16Id = teams.canonicalTeamId('U16 A');
  const scopedCoach = permissions.defaultProfile({uid:'prep-u13', email:'prep@club.test'}, 'PREPARATEUR_PHYSIQUE', 'SAISIE');
  scopedCoach.authorizedTeamIds = [u13Id];
  scopedCoach.allowedModules = ['tests-athletiques', 'presences'];
  scopedCoach.modulePermissions = {
    'tests-athletiques':{read:true, write:true},
    presences:{read:true, write:true}
  };
  scopedCoach.moduleScopes = {
    'tests-athletiques':{allPlayers:true}
  };
  const u16Player = {playerId:'player-u16', teamId:u16Id, teamIds:[u16Id]};
  const u16Record = {playerId:'player-u16', teamId:u16Id, playerSnapshot:u16Player};

  assert.equal(permissions.canAccessPlayer(scopedCoach, u16Player), false);
  assert.equal(permissions.canAccessAllPlayersForModule(scopedCoach, 'tests-athletiques'), true);
  assert.equal(permissions.canAccessPlayerForModule(scopedCoach, u16Player, 'tests-athletiques'), true);
  assert.equal(permissions.canAccessRecordForModule(scopedCoach, u16Record, 'tests-athletiques'), true);
  assert.equal(permissions.filterAuthorizedPlayersForModule(scopedCoach, [u16Player], 'tests-athletiques').length, 1);
  assert.equal(permissions.canAccessAllPlayersForModule(scopedCoach, 'presences'), false);
  assert.equal(permissions.canAccessPlayerForModule(scopedCoach, u16Player, 'presences'), false);
  assert.equal(permissions.filterAuthorizedPlayersForModule(scopedCoach, [u16Player], 'presences').length, 0);
}

function testModuleRegistry(){
  const catalog = modules.moduleRegistry();
  const ids = catalog.map(module => module.id);
  assert(ids.includes('database'));
  assert(ids.includes('playerProfile'));
  assert(ids.includes('teamProfile'));
  assert(ids.includes('tests-athletiques'));

  const databaseTool = modules.moduleToTool(modules.getModule('database'));
  assert.equal(databaseTool.admin, true);
  assert.equal(databaseTool.src, 'pages/admin-database.html');
}

function testAthleticTestsStayLinkedToPlayerAndTeamIds(){
  const appSource = fs.readFileSync('app.js', 'utf8');
  const athleticSource = fs.readFileSync('pages/tests-athletiques.html', 'utf8');
  const playerProfileRenderSource = fs.readFileSync('pages/player-profile/playerProfileRender.js', 'utf8');

  assert(appSource.includes("vma:{type:'vma'"), 'La VMA doit rester normalisée dans les métriques athlétiques.');
  assert(playerProfileRenderSource.includes("vma:{label:'VMA'"), 'La fiche individuelle doit afficher la VMA athlétique.');
  assert(appSource.includes('const readScopedPhysicalTests = async () =>'), 'Les tests athlétiques Firestore doivent être lus via une requête limitée au périmètre autorisé.');
  assert(appSource.includes("readWhere('teamIds', 'array-contains-any', chunk)"), 'Les tests athlétiques doivent pouvoir être récupérés par teamIds.');
  assert(appSource.includes("readWhere('playerId', 'in', chunk)"), 'Les tests athlétiques doivent pouvoir être récupérés par playerId.');
  assert(appSource.includes("scopedRecordsForModuleAccess(normalizeAthleticRows(rawRows, players), 'tests-athletiques')"), 'Les tests athlétiques chargés doivent être filtrés par autorisations et scopes module.');
  assert(appSource.includes('function firestoreSafeData'), 'Les écritures Firestore doivent nettoyer les objets non sérialisables.');
  assert(appSource.includes('const tests = athleticTestsFromRow(test);'), 'La sauvegarde athlétique doit reconstruire des tests plats avant Firestore.');
  assert(appSource.includes('...firestoreSafeData(clean)'), 'La sauvegarde athlétique doit envoyer un payload compatible Firestore.');
  assert(appSource.includes("readWhere(name, 'teamIds', 'array-contains', teamId)"), 'La fiche équipe doit lire les tests via teamIds.');
  assert(athleticSource.includes('playerSnapshotForAthletic'), 'La page Tests athlétiques doit envoyer une snapshot joueuse.');
  assert(athleticSource.includes('teamIds:snapshot.teamIds'), 'La page Tests athlétiques doit envoyer les teamIds dans le payload.');
}

function testMedicalDataStayLinkedToPlayerAndTeamIds(){
  const appSource = fs.readFileSync('app.js', 'utf8');
  const medicalSource = fs.readFileSync('pages/suivi-medical.html', 'utf8');

  assert(appSource.includes('function medicalTeamIdsFromSources'), 'Le médical doit centraliser les teamIds.');
  assert(appSource.includes('const enrichAndFilter = source =>'), 'Les lectures médicales doivent hériter du périmètre des blessures parentes.');
  assert(appSource.includes("scopedRecordsForModuleAccess(scopedInjuries, 'medical')"), 'Les lectures médicales doivent être filtrées par autorisations et scopes module.');
  assert(appSource.includes("['medicalFollowUps','medicalFollowUps']"), 'Les suivis médicaux doivent être lus dans le périmètre playerId/teamId.');
  assert(appSource.includes("medicalFollowUps:scopedRecordsForModuleAccess"), 'Les suivis médicaux doivent être filtrés par autorisations et scopes module.');
  assert(appSource.includes("readWhere(collectionName, 'teamIds', 'array-contains-any', chunk)"), 'Les lectures médicales doivent interroger les teamIds.');
  assert(appSource.includes("readWhere(collectionName, 'playerId', 'in', chunk)"), 'Les lectures médicales doivent interroger les playerId autorisés.');
  assert(appSource.includes("throw new Error('Accès non autorisé à cette joueuse.')"), 'Les écritures médicales doivent vérifier la joueuse.');
  assert(appSource.includes("throw new Error('Accès non autorisé à cette équipe.')"), 'Les écritures médicales doivent vérifier le teamId.');
  assert(medicalSource.includes('teamIds=[...new Set'), 'Le formulaire médical doit transmettre les teamIds.');
  assert(medicalSource.includes('teamId:injury.teamId||injury.playerSnapshot?.teamId'), 'Les évolutions médicales doivent reprendre le teamId de la blessure.');
}

function testGlobalExportsStayScoped(){
  const appSource = fs.readFileSync('app.js', 'utf8');

  assert(appSource.includes('function hasGlobalDataAccess'), 'Les exports globaux doivent distinguer les admins complets des éditeurs limités.');
  assert(appSource.includes('function scopedCentralExportPayload'), 'Les exports Firebase doivent avoir un filtrage centralisé.');
  assert(appSource.includes('return scopedCentralExportPayload(payload);'), 'Le payload Firebase exporté doit passer par le filtre global.');
  assert(appSource.includes("if(!guardGlobalDataExportAction()) return;"), 'L’export central doit être réservé aux admins complets.');
  assert(appSource.includes('return scopedPlayersForAccess(enrichPlayersWithTechnicalFootHints'), 'L’export joueurs doit respecter le périmètre teamId.');
  assert(appSource.includes("$('#exportBackup').addEventListener('click', () => { if(guardGlobalDataExportAction())"), 'Les backups localStorage doivent être réservés aux admins complets.');
}

function testDataHubImportsStayScoped(){
  const appSource = fs.readFileSync('app.js', 'utf8');

  assert(appSource.includes('function validateImportDocsAccess'), 'Les imports doivent valider les documents préparés avant écriture.');
  assert(appSource.includes('validateImportDocsAccess(docs);'), 'Les flux d’import doivent appeler le verrou teamId/playerId.');
  assert(appSource.includes("if(hasGlobalDataAccess()) await exportCentralFirestore('json');"), 'Les imports ne doivent lancer un backup global que pour un admin complet.');
  assert(appSource.includes("teamIds:[...new Set([p.teamId"), 'Les joueuses Data Hub doivent conserver leurs teamIds.');
  assert(appSource.includes('teamIds:teamId ? [teamId] : []'), 'Les séances Data Hub doivent conserver leurs teamIds.');
  assert(appSource.includes('teamIds:Array.isArray(linkedPlayer.teamIds)'), 'Les tests Data Hub doivent transmettre les teamIds dans la snapshot joueuse.');
}

function testFirestoreRulesProtectExistingAndIncomingScope(){
  const rulesSource = fs.readFileSync('firestore.rules', 'utf8');
  const scopedCollections = ['players','matches','matchEvents','sessions','attendance','technicalTests','physicalTests','injuries','injuryUpdates','medicalAppointments','rehabRoutines','medicalFollowUps','workloads','convocations','individualReports'];

  assert(!rulesSource.includes('allow create, update: if canWriteSportData()'), 'Les règles sportives ne doivent pas grouper create/update sans vérifier resource.data.');
  assert(!rulesSource.includes('allow create, update: if canWriteMedicalData()'), 'Les règles médicales ne doivent pas grouper create/update sans vérifier resource.data.');
  assert(!rulesSource.includes('allow create, update: if canWritePhysicalData()'), 'Les règles physiques ne doivent pas grouper create/update sans vérifier resource.data.');
  scopedCollections.forEach(collection => {
    assert(rulesSource.includes(`match /${collection}/`), `La collection ${collection} doit être déclarée dans firestore.rules.`);
  });
  assert(rulesSource.includes('canAccessScopedData(resource.data) && canAccessScopedData(request.resource.data)'), 'Les updates doivent valider l’ancien et le nouveau périmètre teamId/playerId.');
  assert(rulesSource.includes('match /{document=**}'), 'Les règles doivent conserver le bloc catch-all.');
  assert(rulesSource.includes('allow read, write: if false;'), 'Le bloc catch-all doit refuser les accès non déclarés.');
}

function testAccessRegressionSurfaceStaysComplete(){
  const appSource = fs.readFileSync('app.js', 'utf8');
  const rulesSource = fs.readFileSync('firestore.rules', 'utf8');
  const permissionsSource = fs.readFileSync('shared/services/permissions-service.js', 'utf8');
  const playersSource = fs.readFileSync('shared/services/players-service.js', 'utf8');
  const teamsSource = fs.readFileSync('shared/services/teams-service.js', 'utf8');

  [
    'getAuthorizedTeamIds',
    'canAccessTeam:canAccessTeamId',
    'canAccessPlayer:canAccessPlayerRecord',
    'canAccessRecord',
    'filterAuthorizedTeams',
    'filterAuthorizedPlayers',
    'filterAuthorizedPlayersForModule',
    'filterAuthorizedRecords'
  ].forEach(exportName => {
    assert(appSource.includes(exportName), `Le moteur d'autorisation global doit exposer ${exportName}.`);
  });

  [
    'function purgeUnauthorizedLocalData',
    'function clearSensitiveLocalData',
    'async function playerProfileLoadData',
    'async function teamProfileLoadData',
    'async function medicalListData',
    'async function athleticListData',
    'async function presenceListEvents',
    'function validateImportDocsAccess',
    'function scopedCentralExportPayload',
    'function scopedPlayersForModuleAccess',
    'function scopedRecordsForModuleAccess'
  ].forEach(functionName => {
    assert(appSource.includes(functionName), `${functionName} doit rester présent pour sécuriser lectures, caches, imports et exports.`);
  });

  [
    'function teamIds',
    'function canAccessTeam',
    'function canAccessPlayer',
    'function canAccessRecord',
    'function filterAuthorizedTeams',
    'function filterAuthorizedPlayers',
    'function filterAuthorizedPlayersForModule',
    'function filterAuthorizedRecords'
  ].forEach(functionName => {
    assert(permissionsSource.includes(functionName), `${functionName} doit rester centralisé dans permissions-service.`);
  });
  assert(permissionsSource.includes('getAuthorizedTeamIds:teamIds'), 'permissions-service doit exposer getAuthorizedTeamIds via son service public.');
  assert(rulesSource.includes('function moduleScopeAllowsAllPlayers'), 'Les règles Firestore doivent reconnaître les scopes toutes joueuses par module.');
  assert(rulesSource.includes('function canAccessScopedDataForModule'), 'Les règles Firestore doivent appliquer les scopes complets au niveau module.');
  assert(rulesSource.includes("canAccessModule('presences') && isPresenceSession"), 'Les sessions créées par Présences doivent être lisibles via le module Présences.');
  assert(appSource.includes("canAccessAllPlayersForModule('presences')"), 'La lecture cloud Présences doit gérer le scope complet du module.');
  assert(appSource.includes('readPresenceSessionsForTeams'), 'Le module Présences doit lire les sessions cloud via les teamIds autorisés.');
  assert(appSource.includes("field:'createdFromPresenceModule'"), 'Le module Présences doit cibler les sessions créées depuis Présences.');
  assert(appSource.includes("moduleId:'tests-athletiques'"), 'Les Tests athlétiques doivent demander les joueuses dans leur scope module.');
  assert(fs.readFileSync('pages/tests-techniques.html', 'utf8').includes('moduleId:"tests"'), 'Les Tests techniques doivent demander les joueuses dans leur scope module.');
  assert(appSource.includes('async function athleticDeleteTest'), 'Les Tests athlétiques doivent exposer une suppression centralisée.');
  assert(appSource.includes('athleticSaveTest, athleticDeleteTest, athleticExport'), 'Le service central doit publier athleticDeleteTest au module.');
  assert(fs.readFileSync('pages/tests-athletiques.html', 'utf8').includes('data-edit-athletic-test'), 'L’historique des Tests athlétiques doit permettre la modification.');
  assert(fs.readFileSync('pages/tests-athletiques.html', 'utf8').includes('data-delete-athletic-test'), 'L’historique des Tests athlétiques doit permettre la suppression.');
  assert(fs.readFileSync('pages/tests-athletiques.html', 'utf8').includes('data-finalize-athletic-test'), 'Les Tests athlétiques doivent garder une action d’enregistrement définitif par ligne.');
  assert(rulesSource.includes("allow delete: if canWritePhysicalData() && (canAccessModule('tests-athletiques') || canAccessModule('tests'))"), 'Les suppressions physicalTests doivent rester contrôlées par droits module et teamId/playerId.');

  [
    'matchEvents',
    'attendance',
    'technicalTests',
    'physicalTests',
    'injuries',
    'medicalFollowUps',
    'convocations',
    'individualReports'
  ].forEach(collectionName => {
    assert(playersSource.includes(`'${collectionName}'`), `${collectionName} doit rester dans les collections liées au playerId.`);
  });

  assert(teamsSource.includes("name:'U19', category:'U19', subCategories:['U16','U17','U18','U19']"), 'U16 doit rester rattachable à U19 pour les surclassements.');
  assert(rulesSource.includes('function canAccessScopedData(data)'), 'Les règles Firestore doivent conserver le verrou teamId/playerId central.');
  assert((rulesSource.match(/canAccessScopedData\(resource\.data\) && canAccessScopedData\(request\.resource\.data\)/g) || []).length >= 10, 'Les updates Firestore doivent contrôler ancien et nouveau périmètre sur les collections sensibles.');
}

function testMatchDataStayLinkedToPlayerAndTeamIds(){
  const appSource = fs.readFileSync('app.js', 'utf8');

  assert(appSource.includes('const matchTeamIds = [...new Set'), 'Les matchs doivent conserver une liste teamIds stable.');
  assert(appSource.includes('teamSnapshot:{team:matchTeam'), 'Les matchs doivent exposer une snapshot équipe.');
  assert(appSource.includes('const eventTeamIds = [...new Set'), 'Les événements de match doivent conserver leurs teamIds.');
  assert(appSource.includes('const playerSnapshot = eventPlayerId ?'), 'Les événements de match liés à une joueuse doivent exposer une playerSnapshot.');
  assert(appSource.includes('matchSnapshot:{...matchSnapshot'), 'Les événements de match doivent exposer une matchSnapshot.');

  const u13Id = teams.canonicalTeamId('U13 A');
  const u16Id = teams.canonicalTeamId('U16 A');
  const scopedCoach = permissions.defaultProfile({uid:'coach-u13', email:'coach@club.test'}, 'ENTRAINEUR', 'SAISIE');
  scopedCoach.authorizedTeamIds = [u13Id];

  assert.equal(permissions.canAccessRecord(scopedCoach, {matchSnapshot:{teamIds:[u13Id]}}), true);
  assert.equal(Boolean(permissions.canAccessRecord(scopedCoach, {matchSnapshot:{teamIds:[u16Id]}})), false);
}

function testPresenceEventsStayLinkedToPlayerAndTeamIds(){
  const events = [{
    id:'presence-event-test',
    date:'2026-08-03',
    startTime:'18:00',
    endTime:'19:30',
    duration:90,
    type:'entrainement',
    teamId:'team-u13-a',
    teamIds:['team-u13-a'],
    team:'U13 A',
    attendance:{
      'player-a':{
        status:'present',
        minutes:90,
        comment:'OK',
        playerSnapshot:{
          playerId:'player-a',
          prenom:'Ava',
          nom:'Dupont',
          teamId:'team-u13-a',
          teamIds:['team-u13-a']
        }
      },
      'player-b':{
        status:'excused',
        minutes:0,
        comment:'Sélection',
        playerSnapshot:{
          playerId:'player-b',
          prenom:'Lina',
          nom:'Martin',
          teamId:'team-u13-a',
          teamIds:['team-u13-a']
        }
      }
    }
  }];
  const presencePageSource = fs.readFileSync('pages/presences.html', 'utf8');
  const window = loadBrowserScript('shared/services/presence-events-service.js', {
    localStorage:{
      getItem(key){ return key === 'coachpulse:presenceEvents:v1' ? JSON.stringify(events) : null; },
      setItem(){},
      removeItem(){}
    }
  });

  const byTeam = window.CoachPulsePresenceEventsService.collectionsForTeam('team-u13-a');
  const byPlayer = window.CoachPulsePresenceEventsService.collectionsForPlayer('player-a');

  assert.equal(byTeam.sessions.length, 1);
  assert.equal(byTeam.attendance.length, 2);
  assert.equal(byTeam.attendance[0].playerId, 'player-a');
  assert.equal(byTeam.attendance[0].teamId, 'team-u13-a');
  assert.equal(byTeam.attendance[0].teamIds.join(','), 'team-u13-a');
  assert.equal(byTeam.attendance[1].status, 'AJ');
  assert.equal(byPlayer.sessions[0].teamId, 'team-u13-a');
  assert.equal(byPlayer.attendance[0].playerSnapshot.playerId, 'player-a');
  assert(presencePageSource.includes('function normalizePresenceEventForStorage'), 'La page Présences doit normaliser les événements avant stockage.');
  assert(presencePageSource.includes('return api.presenceSaveEvent(normalized);'), 'La synchronisation cloud doit envoyer un événement normalisé.');
}

function testPresenceD2CodeStaysScopedToU19(){
  const presencePageSource = fs.readFileSync('pages/presences.html', 'utf8');
  const presenceServiceSource = fs.readFileSync('shared/services/presence-events-service.js', 'utf8');
  const appSource = fs.readFileSync('app.js', 'utf8');

  assert(presencePageSource.includes('short:"D2"'), 'Le code D2 doit être disponible dans les paramètres Présences.');
  assert(presencePageSource.includes('teamIds:["team-u19"]'), 'Le code D2 doit rester limité au teamId U19.');
  assert(presencePageSource.includes('function attendanceStatusesForTeam'), 'La feuille de présence doit filtrer les codes selon le teamId.');
  assert(presencePageSource.includes('allowedStatusIds.has(patch.status)'), 'La sauvegarde doit refuser un code non autorisé pour l’équipe.');
  assert(presenceServiceSource.includes("D2:{code:'D2'"), 'Le service partagé doit normaliser le code D2.');
  assert(appSource.includes("'D2'"), 'Les imports Présences doivent reconnaître le code D2.');
}

function testPlayerProfileDataFallsBackToSelectedPlayerOnly(){
  const window = loadBrowserScript('pages/player-profile/playerProfileData.js', {
    parent:{
      CoachPulseCentralData:{
        currentSeason(){ return '2026-2027'; },
        async listPlayers(){
          return [
            {playerId:'player-a', prenom:'Ava', nom:'Dupont', team:'U13 A'},
            {playerId:'player-b', prenom:'Lina', nom:'Martin', team:'U16 A'}
          ];
        }
      }
    },
    CoachPulsePresenceEventsService:{
      collectionsForPlayer(playerIds){
        return {sessions:[{sessionId:'s1'}], attendance:[{attendanceId:'a1', playerId:playerIds[0], sessionId:'s1'}]};
      }
    }
  });

  return window.PlayerProfileData.loadProfileData({playerId:'player-a', prenom:'Ava', nom:'Dupont'}).then(payload => {
    assert.equal(payload.module, 'playerProfile');
    assert.deepEqual(payload.collections.players.map(player => player.playerId), ['player-a']);
    assert.equal(payload.collections.attendance.length, 1);
  });
}

function testPlayerProfileRenderStartsEmptyAndUsesPlayerIds(){
  const window = loadBrowserScript('pages/player-profile/playerProfileRender.js', {
    PlayerProfileData:{
      currentSeason(){ return '2026-2027'; },
      playerForSeason(player){ return player; },
      teamLabel(player){ return player.team || ''; },
      displayName(player){ return `${player.prenom || ''} ${player.nom || ''}`.trim().toUpperCase(); }
    },
    PlayerProfileFilters:{
      periodFromState(){ return {label:'Saison 2026-2027'}; },
      dateOf(row){ return row.date || ''; }
    }
  });
  const controls = window.PlayerProfileRender.renderControls({
    players:[
      {playerId:'player-a', prenom:'Ava', nom:'Dupont', team:'U13 A'},
      {playerId:'player-b', prenom:'Lina', nom:'Martin', team:'U16 A'}
    ],
    selectedPlayerId:'',
    seasons:['2026-2027'],
    filters:{team:'', periodMode:'season', season:'2026-2027', startDate:'', endDate:''}
  });
  const emptyIdentity = window.PlayerProfileRender.renderIdentity({}, {label:'Saison 2026-2027'}, {medicalProfile:{}, kpis:{}});

  assert(controls.includes('value="player-a"'));
  assert(controls.includes('value="player-b"'));
  assert(controls.includes('Sélectionner une joueuse'));
  assert(emptyIdentity.includes('Aucune joueuse sélectionnée'));
  assert(emptyIdentity.includes('Sélectionne une joueuse pour charger sa fiche complète.'));
}

testPlayerIdsAndSeasons();
testPlayerIdStaysStableOnEdit();
testTeamIdsStayShared();
testManualTeamEditOverridesDefaultCategoryTeam();
testEditedTeamIdsDoNotReAddRemovedEligibleTeam();
testPlayerFilteringAndDedupe();
testPermissions();
testPermissionsRespectTeamHistoryAndModuleScope();
testModuleAllPlayersScopeStaysModuleSpecific();
testModuleRegistry();
testAthleticTestsStayLinkedToPlayerAndTeamIds();
testMedicalDataStayLinkedToPlayerAndTeamIds();
testGlobalExportsStayScoped();
testDataHubImportsStayScoped();
testFirestoreRulesProtectExistingAndIncomingScope();
testAccessRegressionSurfaceStaysComplete();
testMatchDataStayLinkedToPlayerAndTeamIds();
testPresenceEventsStayLinkedToPlayerAndTeamIds();
testPresenceD2CodeStaysScopedToU19();
testPlayerProfileRenderStartsEmptyAndUsesPlayerIds();

Promise.resolve()
  .then(testPlayerProfileDataFallsBackToSelectedPlayerOnly)
  .then(() => {
    console.log('Core regression guards OK');
  });
