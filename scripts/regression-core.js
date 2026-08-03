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
  assert(appSource.includes('filterAuthorizedRecords(normalizeAthleticRows'), 'Les tests athlétiques chargés doivent être filtrés par autorisations.');
  assert(appSource.includes("readWhere(name, 'teamIds', 'array-contains', teamId)"), 'La fiche équipe doit lire les tests via teamIds.');
  assert(athleticSource.includes('playerSnapshotForAthletic'), 'La page Tests athlétiques doit envoyer une snapshot joueuse.');
  assert(athleticSource.includes('teamIds:snapshot.teamIds'), 'La page Tests athlétiques doit envoyer les teamIds dans le payload.');
}

function testMedicalDataStayLinkedToPlayerAndTeamIds(){
  const appSource = fs.readFileSync('app.js', 'utf8');
  const medicalSource = fs.readFileSync('pages/suivi-medical.html', 'utf8');

  assert(appSource.includes('function medicalTeamIdsFromSources'), 'Le médical doit centraliser les teamIds.');
  assert(appSource.includes('const enrichAndFilter = source =>'), 'Les lectures médicales doivent hériter du périmètre des blessures parentes.');
  assert(appSource.includes('filterAuthorizedRecords(scopedInjuries)'), 'Les lectures médicales doivent être filtrées par autorisations.');
  assert(appSource.includes("throw new Error('Accès non autorisé à cette joueuse.')"), 'Les écritures médicales doivent vérifier la joueuse.');
  assert(appSource.includes("throw new Error('Accès non autorisé à cette équipe.')"), 'Les écritures médicales doivent vérifier le teamId.');
  assert(medicalSource.includes('teamIds=[...new Set'), 'Le formulaire médical doit transmettre les teamIds.');
  assert(medicalSource.includes('teamId:injury.teamId||injury.playerSnapshot?.teamId'), 'Les évolutions médicales doivent reprendre le teamId de la blessure.');
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
      }
    }
  }];
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
  assert.equal(byTeam.attendance.length, 1);
  assert.equal(byTeam.attendance[0].playerId, 'player-a');
  assert.equal(byTeam.attendance[0].teamId, 'team-u13-a');
  assert.equal(byTeam.attendance[0].teamIds.join(','), 'team-u13-a');
  assert.equal(byPlayer.sessions[0].teamId, 'team-u13-a');
  assert.equal(byPlayer.attendance[0].playerSnapshot.playerId, 'player-a');
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
testPlayerFilteringAndDedupe();
testPermissions();
testPermissionsRespectTeamHistoryAndModuleScope();
testModuleRegistry();
testAthleticTestsStayLinkedToPlayerAndTeamIds();
testMedicalDataStayLinkedToPlayerAndTeamIds();
testMatchDataStayLinkedToPlayerAndTeamIds();
testPresenceEventsStayLinkedToPlayerAndTeamIds();
testPlayerProfileRenderStartsEmptyAndUsesPlayerIds();

Promise.resolve()
  .then(testPlayerProfileDataFallsBackToSelectedPlayerOnly)
  .then(() => {
    console.log('Core regression guards OK');
  });
