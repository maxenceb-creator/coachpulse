const assert = require('assert/strict');
const fs = require('fs');
const vm = require('vm');

const players = require('../shared/services/players-service.js');
const teams = require('../shared/services/teams-service.js');
const permissions = require('../shared/services/permissions-service.js');
const modules = require('../shared/utils/module-registry.js');
const playerDataAudit = require('./audit-player-data.js');
const measurements = require('../shared/services/player-measurements-service.js');

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

function testTeamIdNormalizationIsIdempotent(){
  const officialNames = ['U7 A','U9 A','U11 A','U13 A','U13 B','U16 A','U19','R1'];
  officialNames.forEach(name => {
    const expected = `team-${name.toLowerCase().replace(/\s+/g, '-')}`;
    assert.equal(teams.canonicalTeamId(name), expected);
    assert.equal(teams.canonicalTeamId(expected), expected);
    assert.equal(teams.canonicalTeamId(expected.toUpperCase()), expected);
    let repeated = name;
    for(let index=0;index<20;index++) repeated = teams.canonicalTeamId(repeated);
    assert.equal(repeated, expected, `${name} doit rester stable après 20 normalisations.`);
  });
  assert.equal(teams.canonicalTeamId('team-team-team-u13-a'), 'team-u13-a');
  ['global','team-global','team-team-global','team-team-team-global'].forEach(value => {
    assert.equal(teams.canonicalTeamId(value), '', `${value} ne doit jamais être une équipe valide.`);
    assert.equal(players.canonicalTeamId(value), '', `${value} doit être supprimé des affectations joueuses.`);
  });

  const seed = {
    documentId:'stable-team-player', playerId:'stable-team-player', nom:'DUPONT', prenom:'AVA', birth:'2013-02-01',
    categorie:'U13', subCategory:'U13', team:'U13 A', teamId:'team-team-u13-a',
    teamIds:['team-u13-a','team-team-u13-a','team-global','team-team-global'],
    teamAssignments:[
      {teamId:'team-team-u13-a', teamIds:['team-u13-a','team-team-u13-a','team-global'], startDate:'2026-07-01'},
      {teamId:'team-u11-a', teamIds:['TEAM-U11-A'], endDate:'2026-08-31'}
    ],
    seasonHistory:{'2026-2027':{categorie:'U13',subCategory:'U13',team:'U13 A',teamId:'team-team-team-u13-a',teamIds:['team-u13-a','team-global']}}
  };
  let normalized = players.normalizePlayerForWrite(seed, {nowIso:'2026-09-02T00:00:00.000Z'});
  const teamState = value => ({teamId:value.teamId, teamIds:value.teamIds, teamAssignments:value.teamAssignments, seasonHistory:value.seasonHistory});
  const expectedState = structuredClone(teamState(normalized));
  for(let index=0;index<20;index++){
    normalized = players.normalizePlayerForWrite(normalized, {nowIso:'2026-09-02T00:00:00.000Z'});
    assert.deepEqual(teamState(normalized), expectedState, `Les références Team ont changé à la normalisation ${index + 2}.`);
  }
  assert.deepEqual(normalized.teamIds, ['team-u13-a']);
  assert(!JSON.stringify(teamState(normalized)).includes('global'));

  const playersSource = fs.readFileSync('shared/services/players-service.js', 'utf8');
  const readPath = playersSource.match(/async function listPlayers[\s\S]*?\n  }\n\n  async function readFirestorePlayers/)?.[0] || '';
  assert(readPath && !readPath.includes('setDoc('), 'Une lecture de players ne doit jamais réécrire Firestore.');
  const appSource = fs.readFileSync('app.js', 'utf8');
  const migration = appSource.match(/async function adminRepairTeamIds[\s\S]*?\n}\nasync function adminListTeamsAndSettings/)?.[0] || '';
  assert(migration.includes('normalizePlayerTeamReferences'), 'La migration doit utiliser le normaliseur canonique partagé.');
  assert(migration.includes('teamAssignments') && migration.includes('seasonHistory'), 'La migration doit réparer les affectations et historiques sans les supprimer.');
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

function testPermissionUpdateDoesNotPromoteRole(){
  const u13Id = teams.canonicalTeamId('U13 A');
  const firestore = new Map();
  const initial = permissions.defaultProfile({uid:'coach-permissions'}, 'ENTRAINEUR', 'SAISIE');
  initial.allowedModules = ['presences'];
  initial.modulePermissions = {presences:{read:true, write:false}};
  firestore.set(initial.uid, structuredClone(initial));

  const before = structuredClone(firestore.get(initial.uid));
  firestore.set(initial.uid, {
    ...before,
    modulePermissions:{presences:{read:true, write:true}}
  });
  const reloaded = structuredClone(firestore.get(initial.uid));

  assert.equal(reloaded.role, 'ENTRAINEUR');
  assert.equal(permissions.isAdminRole(reloaded), false);
  assert.equal(permissions.canManageCoreData(reloaded), false);
  assert.equal(reloaded.permissionLevel, 'SAISIE');
  assert.deepEqual(reloaded.modulePermissions, {presences:{read:true, write:true}});
  assert.deepEqual(
    Object.keys(reloaded).filter(key => JSON.stringify(reloaded[key]) !== JSON.stringify(before[key])),
    ['modulePermissions']
  );

  const appSource = fs.readFileSync('app.js', 'utf8');
  const adminDetection = appSource.match(/function isAdminLikeProfile[\s\S]*?\n}/)?.[0] || '';
  assert(adminDetection && !adminDetection.includes('permissionLevel') && !adminDetection.includes('permissionLabel'), 'Une permission ne doit jamais être interprétée comme un rôle Admin.');
  const accessSave = appSource.match(/if\(saveUid\)[\s\S]*?notifySuccess\('Accès utilisateur mis à jour\.'\);/)?.[0] || '';
  assert(accessSave.includes('firebaseFns.updateDoc('), 'La carte modulePermissions doit remplacer l’ancienne valeur Firestore sans conserver des droits retirés.');

  const demoted = {
    ...permissions.defaultProfile({uid:'former-admin'}, 'ENTRAINEUR', 'LECTEUR'),
    legacyRole:'ADMIN', businessRole:'ADMIN', userRole:'ADMIN', isAdmin:true, admin:true,
    allowedModules:['presences'], modulePermissions:{presences:'read'}
  };
  assert.equal(permissions.isAdminRole(demoted), false, 'Une permissionLevel explicite non-admin doit primer sur tous les marqueurs admin historiques.');
  assert.equal(permissions.canPerformAction(demoted, {id:'presences'}, 'read'), true);
  assert.equal(permissions.canPerformAction(demoted, {id:'presences'}, 'write'), false);
  demoted.permissionLevel = 'EDITEUR';
  demoted.modulePermissions.presences = 'edit';
  assert.equal(permissions.canPerformAction(demoted, {id:'presences'}, 'write'), true, 'Lecteur vers éditeur doit être effectif sans refresh complet.');
  demoted.allowedModules = [];
  demoted.modulePermissions = {};
  assert.equal(permissions.canPerformAction(demoted, {id:'presences'}, 'read'), false, 'La suppression du dernier accès module doit survivre aux anciens rôles.');
  demoted.permissionLevel = 'ADMIN';
  assert.equal(permissions.canPerformAction(demoted, {id:'presences'}, 'write'), true, 'Non-admin vers admin doit ouvrir les droits.');
  demoted.permissionLevel = 'LECTEUR';
  assert.equal(permissions.canPerformAction(demoted, {id:'presences'}, 'write'), false, 'Admin vers non-admin doit retirer immédiatement les droits élevés.');

  const staleTeams = {authorizedTeamIds:[], teamIds:[], allowedTeamIds:[], authorizedTeams:['team-old'], equipesAutorisees:['team-old']};
  assert.deepEqual(permissions.getAuthorizedTeamIds(staleTeams), [], 'Les champs équipe historiques ne doivent pas réinjecter un accès supprimé du modèle canonique.');
  assert(accessSave.includes('legacyRole:role') && accessSave.includes('isAdmin:permissionLevel === \'ADMIN\''), 'La sauvegarde doit neutraliser les marqueurs admin historiques.');
  assert(appSource.includes('startStaffProfileSubscription();'), 'Le contexte utilisateur doit écouter les modifications Firestore en temps réel.');
  assert(!appSource.includes('isSeedAdminEmail'), 'Aucun email, même historique, ne doit déclencher une promotion Admin.');
  assert(!appSource.includes('applyAdminProfileRepair'), 'Le login ne doit jamais réparer un profil existant en augmentant ses droits.');
  const profileLoad = appSource.match(/async function ensureUserProfile[\s\S]*?\n}\n/)?.[0] || '';
  assert(profileLoad.includes("const loginPatch = {lastLoginAt:firebaseFns.serverTimestamp(), email:user.email}"));
  assert(!profileLoad.includes("permissionLevel = 'ADMIN'") && !profileLoad.includes('allowedModules = modules'));

  for(const level of ['LECTEUR','EDITEUR']){
    const stored = {
      uid:`maxence-coach-${level.toLowerCase()}`,
      email:'maxence.boisdron+coach@club.test',
      role:'ENTRAINEUR', businessRole:'ENTRAINEUR', legacyRole:'ADMIN', userRole:'ADMIN',
      permissionLevel:level, permission:'ADMIN', accessLevel:'ADMIN', isAdmin:true, admin:true,
      authorizedTeamIds:[u13Id], teamIds:[u13Id], allowedTeamIds:[u13Id],
      allowedModules:['presences'], modulePermissions:{presences:level === 'EDITEUR' ? 'edit' : 'read'}, status:'ACTIVE'
    };
    const afterLoad = structuredClone(stored);
    const afterRefresh = structuredClone(afterLoad);
    const afterReconnect = structuredClone(afterRefresh);
    [afterLoad, afterRefresh, afterReconnect].forEach(profile => {
      assert.equal(permissions.getRole(profile), 'ENTRAINEUR');
      assert.equal(permissions.normalizePermission(null, profile), level);
      assert.equal(permissions.isAdminRole(profile), false);
      assert.deepEqual(permissions.getAuthorizedTeamIds(profile), [u13Id]);
      assert.deepEqual(profile.allowedModules, ['presences']);
    });
  }
}

function testAttendanceRosterUsesActiveTeamAssignmentAtSessionDate(){
  const u13Id = teams.canonicalTeamId('U13 A');
  const u16Id = teams.canonicalTeamId('U16 A');
  const u11Id = teams.canonicalTeamId('U11 A');
  const sessionDate = '2026-09-15';
  const roster = players.playersForTeamAtDate([
    {documentId:'u13-valid', playerId:'u13-valid', nom:'Valid', prenom:'U13', status:'active', teamAssignments:[{teamId:u13Id, startDate:'2026-07-01', endDate:'2027-06-30'}]},
    {documentId:'other-team', playerId:'other-team', nom:'Other', prenom:'Team', status:'active', teamAssignments:[{teamId:u16Id, startDate:'2026-07-01', endDate:'2027-06-30'}]},
    {documentId:'no-active-team', playerId:'no-active-team', nom:'No', prenom:'Team', status:'active', teamAssignments:[{teamId:u13Id, startDate:'2026-10-01'}]},
    {documentId:'ended-assignment', playerId:'ended-assignment', nom:'Ended', prenom:'U13', status:'active', teamAssignments:[{teamId:u13Id, startDate:'2025-07-01', endDate:'2026-06-30'}]},
    {documentId:'valid-open-ended', playerId:'valid-open-ended', nom:'Open', prenom:'U13', status:'active', teamAssignments:[{teamId:u13Id, effectiveFrom:'2026-08-20'}]}
  ], u13Id, sessionDate);
  assert.deepEqual(roster.map(player => player.playerId).sort(), ['u13-valid','valid-open-ended']);

  const secondaryRoster = players.playersForTeamAtDate([
    {documentId:'secondary-u11', playerId:'secondary-u11', nom:'Bompard', prenom:'Lisa', status:'active', teamId:u13Id, teamIds:[u13Id, u11Id]}
  ], u11Id, sessionDate);
  assert.deepEqual(secondaryRoster.map(player => player.playerId), ['secondary-u11'], 'Une joueuse avec un second teamId doit apparaître dans la feuille de présence de cette équipe.');

  const u13bId = teams.canonicalTeamId('U13 B');
  const multiTeamRows = [
    {documentId:'multi-valid', playerId:'multi-valid', nom:'Multi', prenom:'Team', status:'active', teamId:u13Id, teamIds:[u11Id,u13Id,u16Id]},
    {documentId:'u13b-only', playerId:'u13b-only', nom:'Only', prenom:'U13B', status:'active', teamId:u13bId, teamIds:[u13bId]},
    {documentId:'fake-global', playerId:'fake-global', nom:'Fake', prenom:'Global', status:'active', teamId:'team-team-global', teamIds:['team-global']}
  ];
  assert.deepEqual(players.playersForTeamAtDate(multiTeamRows, u11Id, sessionDate).map(p => p.playerId), ['multi-valid']);
  assert.deepEqual(players.playersForTeamAtDate(multiTeamRows, u13Id, sessionDate).map(p => p.playerId), ['multi-valid']);
  assert.deepEqual(players.playersForTeamAtDate(multiTeamRows, u13bId, sessionDate).map(p => p.playerId), ['u13b-only']);
  assert.deepEqual(players.playersForTeamAtDate(multiTeamRows, u16Id, sessionDate).map(p => p.playerId), ['multi-valid']);
}
function testPlayerMeasurementsAreIndependentAndHistorical(){
  const first=measurements.parse({playerId:'player-a',teamId:'team-u13',heightCm:'154',weightKg:'45,2',measuredAt:'2026-09-02'});
  const second=measurements.parse({playerId:'player-a',teamId:'team-u13',heightCm:156,weightKg:46.1,measuredAt:'2026-11-10'});
  const third=measurements.parse({playerId:'player-a',teamId:'team-u13',heightCm:157,weightKg:47,measuredAt:'2027-01-15'});
  assert.equal(first.season,'2026-2027');
  assert.equal(first.weightKg,45.2);
  assert.equal(measurements.latest([first,third,second]),third);
  assert.equal(measurements.sortLatest([first,third,second]).length,3);
  assert(!Object.prototype.hasOwnProperty.call(first,'injuryId'),'Une mesure ne doit jamais dépendre d’une blessure.');
  assert.equal(measurements.validate({...first,heightCm:20}).success,false);
  assert.equal(measurements.validate({...first,weightKg:500}).success,false);
  assert.equal(measurements.validate({...first,measuredAt:''}).success,false);
  const appSource=fs.readFileSync('app.js','utf8'),medicalSource=fs.readFileSync('pages/suivi-medical.html','utf8'),rules=fs.readFileSync('firestore.rules','utf8');
  assert(appSource.includes("firebaseFns.collection(db,'playerMeasurements')"));
  assert(medicalSource.includes('CoachPulsePlayerMeasurementsService.getLatest'),'Le médical doit consulter la source de vérité des mesures.');
  assert(medicalSource.includes('id="addMeasurementBtn"')&&medicalSource.includes('Ajouter une mesure'),'Le médical doit proposer une action visible pour une première mesure.');
  assert(medicalSource.includes('id="measurementEditor"')&&medicalSource.includes('hidden'),'Le formulaire de mesure doit rester masqué hors saisie.');
  assert(medicalSource.includes('id="saveMeasurementBtn"')&&medicalSource.includes('Enregistrer la mesure'),'La saisie doit avoir son propre bouton de sauvegarde.');
  assert(medicalSource.includes('id="cancelMeasurementBtn"')&&medicalSource.includes('Annuler'),'La saisie doit pouvoir être annulée.');
  const measurementSave=medicalSource.match(/async function saveMedicalMeasurement[\s\S]*?\n}\nfunction bindMeasurementInputs/);
  assert(measurementSave,'La sauvegarde dédiée des mesures doit rester disponible.');
  assert(!measurementSave[0].includes('injuryId')&&!measurementSave[0].includes('saveUpdate'),'La sauvegarde des mesures ne doit dépendre d’aucune blessure.');
  assert(rules.includes('match /playerMeasurements/{measurementId}'),'Les mesures doivent être protégées par les règles Firestore.');
}
async function testMeasurementSaveWithoutSelectedInjuryPersistsAfterReload(){
  const stored=[];let injuryWrites=0;
  global.CoachPulseCentralData={
    playerMeasurementsAdd:async row=>{stored.push({...row,measurementId:measurements.measurementId(row.playerId,row.measuredAt)});return stored.at(-1)},
    playerMeasurementsList:async playerId=>stored.filter(row=>row.playerId===playerId),
    medicalSaveInjury:async()=>{injuryWrites+=1}
  };
  await measurements.add({playerId:'player-no-injury',teamId:'team-u13',heightCm:160,weightKg:'51,2',measuredAt:'2026-08-24'});
  const afterReload=await measurements.getLatest('player-no-injury');
  assert.equal(afterReload.playerId,'player-no-injury');
  assert.equal(afterReload.heightCm,160);assert.equal(afterReload.weightKg,51.2);
  assert.equal(stored.length,1,'La mesure doit être persistée sans écraser un historique inexistant.');
  assert.equal(injuryWrites,0,'Aucune fausse blessure ne doit être créée.');
  await measurements.add({playerId:'player-no-injury',teamId:'team-u13',heightCm:161,weightKg:51.7,measuredAt:'2026-10-15'});
  const latestAfterSecondReload=await measurements.getLatest('player-no-injury');
  assert.equal(stored.length,2,'Une nouvelle date doit conserver la première mesure.');
  assert.equal(latestAfterSecondReload.heightCm,161);assert.equal(latestAfterSecondReload.measuredAt,'2026-10-15');
  delete global.CoachPulseCentralData;
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
  assert(appSource.includes('normalizeAthleticRows(rawRows, players)'), 'Les tests athlétiques chargés doivent être normalisés avant affichage.');
  assert(appSource.includes("scopedRecordsForModuleAccess(") && appSource.includes("'tests-athletiques'"), 'Les tests athlétiques chargés doivent être filtrés par autorisations et scopes module.');
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
  const scopedCollections = ['players','matches','matchEvents','sessions','attendance','technicalTests','physicalTests','physicalTestDeletions','injuries','injuryUpdates','medicalAppointments','rehabRoutines','medicalFollowUps','workloads','convocations','individualReports'];

  assert(!rulesSource.includes('allow create, update: if canWriteSportData()'), 'Les règles sportives ne doivent pas grouper create/update sans vérifier resource.data.');
  assert(!rulesSource.includes('allow create, update: if canWriteMedicalData()'), 'Les règles médicales ne doivent pas grouper create/update sans vérifier resource.data.');
  assert(!rulesSource.includes('allow create, update: if canWritePhysicalData()'), 'Les règles physiques ne doivent pas grouper create/update sans vérifier resource.data.');
  scopedCollections.forEach(collection => {
    assert(rulesSource.includes(`match /${collection}/`), `La collection ${collection} doit être déclarée dans firestore.rules.`);
  });
  assert(rulesSource.includes('canAccessScopedData(resource.data) && canAccessScopedData(request.resource.data)'), 'Les updates doivent valider l’ancien et le nouveau périmètre teamId/playerId.');
  assert(rulesSource.includes("canAccessModule('presences')"), 'Présences doit pouvoir lire les joueuses du périmètre via une requête Firestore filtrée.');
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
  assert(rulesSource.includes('function canDeleteRetiredPresenceImportSession'), 'Les anciennes sessions Présences importées doivent pouvoir être purgées par un administrateur.');
  assert(rulesSource.includes("sessionId.matches('xlsx-2025-.*')"), 'Les règles Firestore doivent cibler explicitement les anciens imports xlsx 2025-2026.');
  assert(appSource.includes("canAccessAllPlayersForModule('presences')"), 'La lecture cloud Présences doit gérer le scope complet du module.');
  assert(appSource.includes('readPresenceSessionsForTeams'), 'Le module Présences doit lire les sessions cloud via les teamIds autorisés.');
  assert(appSource.includes("field:'createdFromPresenceModule'"), 'Le module Présences doit cibler les sessions créées depuis Présences.');
  assert(appSource.includes('function isRetiredPresenceImportSession'), 'Le module Présences doit pouvoir purger les anciennes séances importées 2025-2026.');
  assert(appSource.includes("sessionId.startsWith('xlsx-')"), 'Les anciennes séances xlsx 2025-2026 doivent être reconnues pour la purge cloud.');
  assert(appSource.includes("moduleId:'tests-athletiques'"), 'Les Tests athlétiques doivent demander les joueuses dans leur scope module.');
  assert(fs.readFileSync('pages/tests-techniques.html', 'utf8').includes('moduleId:"tests"'), 'Les Tests techniques doivent demander les joueuses dans leur scope module.');
  assert(appSource.includes('async function athleticDeleteTest'), 'Les Tests athlétiques doivent exposer une suppression centralisée.');
  assert(appSource.includes('athleticSaveTest, athleticDeleteTest, athleticExport'), 'Le service central doit publier athleticDeleteTest au module.');
  assert(appSource.includes('function setLocalStorageWithQuotaRecovery'), 'Les sauvegardes locales critiques doivent rester tolérantes au quota navigateur.');
  assert(appSource.includes("return setLocalStorageWithQuotaRecovery('coachpulse:athleticTests'"), 'Les Tests athlétiques ne doivent pas être bloqués par un quota localStorage saturé.');
  assert(appSource.includes('function markAthleticTestDeleted'), 'Les Tests athlétiques supprimés doivent conserver une trace locale pour ne pas réapparaître depuis le fichier intégré.');
  assert(appSource.includes('async function cloudDeletedAthleticTestIds'), 'Les suppressions de Tests athlétiques doivent être lues depuis Firestore pour être partagées entre utilisateurs.');
  assert(appSource.includes("firebaseFns.collection(db, 'physicalTestDeletions')"), 'Les suppressions de Tests athlétiques doivent utiliser une collection Firestore dédiée.');
  assert(appSource.includes("parseStoredJson('coachpulse:athleticTests:deletedIds'"), 'La liste des tests athlétiques supprimés doit être persistée localement.');
  assert(appSource.includes('normalizeAthleticRows(rawRows, players).filter(row => !deletedIds.has(athleticRowStorageId(row)))'), 'Le chargement des Tests athlétiques doit masquer les tests supprimés après normalisation.');
  assert(fs.readFileSync('pages/tests-athletiques.html', 'utf8').includes('data-edit-athletic-test'), 'L’historique des Tests athlétiques doit permettre la modification.');
  assert(fs.readFileSync('pages/tests-athletiques.html', 'utf8').includes('data-delete-athletic-test'), 'L’historique des Tests athlétiques doit permettre la suppression.');
  assert(fs.readFileSync('pages/tests-athletiques.html', 'utf8').includes('id="historyCounter"'), 'L’historique des Tests athlétiques doit afficher un compteur de tests en attente.');
  assert(fs.readFileSync('pages/tests-athletiques.html', 'utf8').includes('data-finalize-athletic-test'), 'Les Tests athlétiques doivent garder une action d’enregistrement définitif par ligne.');
  assert(appSource.includes("finalized:true") || appSource.includes('finalized,'), 'La finalisation des Tests athlétiques doit être persistée dans les documents physicalTests.');
  assert(fs.readFileSync('pages/tests-athletiques.html', 'utf8').includes('rowFinalized'), 'L’historique des Tests athlétiques doit filtrer les lignes finalisées depuis la donnée partagée.');
  assert(fs.readFileSync('pages/tests-athletiques.html', 'utf8').includes('function historyRows(){return rows.filter(r=>!rowFinalized(r))}'), 'L’historique des Tests athlétiques doit rester global et ne pas dépendre de la joueuse/catégorie sélectionnée.');
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
  const u13Roster = Array.from({length:12}, (_, index) => ({playerId:`u13-${index + 1}`, teamId:'team-u13-a'}));
  const otherRoster = Array.from({length:9}, (_, index) => ({playerId:`other-${index + 1}`, teamId:'team-u16-a'}));
  const partialCloudEvent = {teamId:'team-u13-a', attendance:{'u13-1':{status:'present'}, 'u13-2':{status:'absent'}}};
  assert.equal(window.CoachPulsePresenceEventsService.attendanceRosterPlayers(u13Roster, partialCloudEvent).length, 12, 'Un refetch partiel ne doit jamais tronquer le roster U13A.');
  assert.equal(window.CoachPulsePresenceEventsService.attendanceRosterPlayers(otherRoster, partialCloudEvent).length, 9, 'La règle de roster doit rester générique pour les autres Teams.');
  let rapidEvent = {teamId:'team-u13-a', attendance:{}};
  ['present','absent','present','injured','present'].forEach((status, index) => {
    rapidEvent = {...rapidEvent, attendance:{...rapidEvent.attendance, [`u13-${(index % 3) + 1}`]:{status}}};
    const rendered = window.CoachPulsePresenceEventsService.attendanceRosterPlayers(u13Roster, rapidEvent);
    assert.equal(rendered.length, 12);
    assert.equal(new Set(rendered.map(player => player.playerId)).size, 12);
  });

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
  assert(presencePageSource.includes('athletic:procedureMinutes'), 'La procédure Présences doit enregistrer le contenu Athlétique.');
  assert(presencePageSource.includes('theoretical:procedureMinutes'), 'La procédure Présences doit enregistrer le contenu Théorique.');
  assert(presencePageSource.includes('value.athletic ?? value.athletique'), 'La procédure Présences doit relire Athlétique avec rétrocompatibilité.');
  assert(presencePageSource.includes('value.theoretical ?? value.theorique'), 'La procédure Présences doit relire Théorique avec rétrocompatibilité.');
  const appSource = fs.readFileSync('app.js', 'utf8');
  assert(appSource.includes('const safeSessionPayload = firestoreSafeData(sessionPayload);'), 'La sauvegarde des séances Présences doit nettoyer le payload Firestore.');
  assert(appSource.includes('const safeAttendancePayload = firestoreSafeData(row);'), 'La sauvegarde des lignes Présences doit nettoyer le payload Firestore.');
  assert(appSource.includes('athletic:minutes(source.athletic ?? source.athletique)'), 'Les snapshots cloud Présences doivent conserver Athlétique.');
  assert(appSource.includes('theoretical:minutes(source.theoretical ?? source.theorique)'), 'Les snapshots cloud Présences doivent conserver Théorique.');
  assert(appSource.includes('procedure:presencePlainProcedure(row.sessionSnapshot?.procedure || sessionPayload.procedure)'), 'Les snapshots Présences doivent conserver une procédure sérialisable.');
  assert(appSource.includes('embeddedAttendanceVersion:2'), 'La séance doit publier atomiquement une assiduité embarquée faisant autorité.');
  assert(appSource.includes('if(!embeddedAttendanceIsAuthoritative) rowsForSession.forEach'), 'Les lignes attendance partielles ne doivent pas écraser une séance atomique récente.');
  assert(presencePageSource.includes('const rosterPlayers = playersForTeam(event.teamId, event.date);'), 'Le rendu doit partir du roster de la Team à la date de séance.');
}

function testPresenceD2CodeStaysScopedToU19(){
  const presencePageSource = fs.readFileSync('pages/presences.html', 'utf8');
  const presenceConfigSource = fs.readFileSync('pages/presences/presence-config.js', 'utf8');
  const presenceServiceSource = fs.readFileSync('shared/services/presence-events-service.js', 'utf8');
  const appSource = fs.readFileSync('app.js', 'utf8');

  assert(presenceConfigSource.includes('short:"D2"'), 'Le code D2 doit être disponible dans les paramètres Présences.');
  assert(presenceConfigSource.includes('teamIds:["team-u19"]'), 'Le code D2 doit rester limité au teamId U19.');
  assert(presencePageSource.includes('function attendanceStatusesForTeam'), 'La feuille de présence doit filtrer les codes selon le teamId.');
  assert(presencePageSource.includes('allowedStatusIds.has(patch.status)'), 'La sauvegarde doit refuser un code non autorisé pour l’équipe.');
  assert(presenceServiceSource.includes("D2:{code:'D2'"), 'Le service partagé doit normaliser le code D2.');
  assert(appSource.includes("'D2'"), 'Les imports Présences doivent reconnaître le code D2.');
}

function testHomeDashboardStaysScopedToAuthorizedTeams(){
  const appSource = fs.readFileSync('app.js', 'utf8');

  assert(appSource.includes('const HOME_TEAM_SELECTION_KEY'), 'L’accueil doit conserver l’équipe sélectionnée localement.');
  assert(appSource.includes('async function homeAuthorizedTeams'), 'L’accueil doit charger les équipes via un helper dédié.');
  assert(appSource.includes('function hideLegacyHomeDashboard'), 'Le nouvel accueil doit masquer les anciens blocs statiques.');
  assert(appSource.includes("'.dashboard-hero,.metric-grid,.dashboard-grid'"), 'Les anciens blocs accueil ne doivent plus être visibles.');
  assert(appSource.includes('filterAuthorizedTeams(teams)'), 'L’accueil doit réutiliser le filtrage central des équipes autorisées.');
  assert(appSource.includes('canAccessTeamId(teamId)'), 'L’accueil doit vérifier le teamId avant affichage.');
  assert(appSource.includes('teamProfileLoadData({teamId:selectedTeamId, homeDashboard:true})'), 'L’accueil doit charger les données par teamId via la fiche équipe centralisée.');
  assert(appSource.includes('const allowHomeDashboard'), 'L’accueil doit réutiliser le chargeur fiche équipe sans exiger le module fiche équipe complet.');
  assert(appSource.includes('homeView.classList.contains'), 'L’accueil doit éviter les chargements quand la page n’est pas visible.');
}

function testPlayerDataAuditDetectsDuplicatesAndBrokenLinks(){
  const report = playerDataAudit.auditPlayers(playerDataAudit.collectionsFromExport({
    collections:{
      players:[
        {playerId:'player-a', nom:'DUPONT', prenom:'AVA', birth:'2013-01-01', status:'active'},
        {playerId:'player-b', nom:'DUPONT', prenom:'AVA', birth:'2013-01-01', status:'active'},
        {playerId:'player-old', nom:'MARTIN', prenom:'LINA', birth:'2010-05-10', status:'archived'}
      ],
      technicalTests:[
        {testId:'t1', playerId:'player-missing'},
        {testId:'t2', playerId:'player-old'}
      ]
    }
  }));

  assert(report.errors.some(issue => issue.type === 'duplicate-active-identity'), 'L’audit doit détecter les doublons actifs.');
  assert(report.warnings.some(issue => issue.type === 'unknown-linked-player'), 'L’audit doit détecter les historiques liés à un playerId absent.');
  assert(report.warnings.some(issue => issue.type === 'archived-player-not-merged'), 'L’audit doit signaler une joueuse archivée avec historique non fusionné.');
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

function testPlayerArchiveUsesDirectStatusPatch(){
  const appSource = fs.readFileSync('app.js', 'utf8');
  const match = appSource.match(/async function adminArchivePlayer[\s\S]*?\n}\nfunction isPlayerReference/);
  assert(match, 'La fonction adminArchivePlayer doit rester disponible.');
  const body = match[0];
  assert(body.includes("const nextStatus = archived ? 'archived' : 'active'"), 'L’archivage doit calculer explicitement le statut cible.');
  assert(body.includes('await firebaseFns.setDoc(ref, patch, {merge:true});'), 'L’archivage doit écrire un patch de statut direct.');
  assert(body.includes('Statut joueuse non modifié après écriture'), 'L’archivage doit vérifier le statut relu après écriture.');
  assert(!body.includes('adminUpdatePlayer('), 'L’archivage ne doit pas repasser par la mise à jour complète de fiche.');
}

function testPresenceInteractionsStayNonBlocking(){
  const appSource = fs.readFileSync('app.js', 'utf8');
  const presenceSource = fs.readFileSync('pages/presences.html', 'utf8');

  assert(appSource.includes("FIRESTORE_MANAGED_LOCAL_KEYS.has(String(key || ''))"), 'Les écritures Présence gérées par Firestore ne doivent pas déclencher une sauvegarde globale lourde.');
  assert(appSource.includes('if(Array.isArray(value)) return Array.from(value, firestoreSafeValue)'), 'Les tableaux provenant des iframes doivent être recréés dans le realm principal avant Firestore.');
  assert(!appSource.includes("setInterval(snapshotLocalData, 15000)"), 'La sauvegarde complète ne doit plus être exécutée toutes les 15 secondes.');
  assert(presenceSource.includes('schedulePresenceEventCloudSave(eventId);'), 'Les clics de présence doivent utiliser une sauvegarde cloud regroupée.');
  assert(!presenceSource.includes('await pushPresenceEventToCloud(events[index]);'), 'Un clic de présence ne doit pas attendre directement l’écriture Firestore complète.');
  assert(presenceSource.includes('return !cloudEvent || eventSyncStamp(event) > eventSyncStamp(cloudEvent);'), 'Les séances déjà présentes dans le cloud ne doivent pas être réenvoyées au chargement.');
  assert(presenceSource.includes('requestIdleCallback(persist, {timeout:3000})'), 'La persistance locale volumineuse doit attendre une période inactive du navigateur.');
  assert(presenceSource.includes('updateAttendanceDetailUi(events[index], playerId, patch);'), 'Un clic de présence doit mettre à jour uniquement la ligne concernée.');
  assert(presenceSource.includes('addEventListener("dblclick", event =>'), 'Le calendrier doit réserver le double-clic à la création d’un événement.');
  assert(presenceSource.includes('selectCalendarDate(day.dataset.selectDate);'), 'Le clic simple du calendrier doit uniquement sélectionner et afficher la journée.');
  ['match_championnat','match_coupe','match_amical'].forEach(type => {
    assert(presenceSource.includes(`value="${type}"`), `Le type ${type} doit être proposé dans le formulaire.`);
  });
}

testPlayerIdsAndSeasons();
testPlayerIdStaysStableOnEdit();
testTeamIdsStayShared();
testTeamIdNormalizationIsIdempotent();
testManualTeamEditOverridesDefaultCategoryTeam();
testEditedTeamIdsDoNotReAddRemovedEligibleTeam();
testPlayerFilteringAndDedupe();
testPermissions();
testPermissionUpdateDoesNotPromoteRole();
testAttendanceRosterUsesActiveTeamAssignmentAtSessionDate();
testPlayerMeasurementsAreIndependentAndHistorical();
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
testHomeDashboardStaysScopedToAuthorizedTeams();
testPlayerDataAuditDetectsDuplicatesAndBrokenLinks();
testPlayerProfileRenderStartsEmptyAndUsesPlayerIds();
testPlayerArchiveUsesDirectStatusPatch();
testPresenceInteractionsStayNonBlocking();

Promise.resolve()
  .then(testScopedPlayerReadFiltersInFirestore)
  .then(testMeasurementSaveWithoutSelectedInjuryPersistsAfterReload)
  .then(testPlayerProfileDataFallsBackToSelectedPlayerOnly)
  .then(() => {
    console.log('Core regression guards OK');
  });
