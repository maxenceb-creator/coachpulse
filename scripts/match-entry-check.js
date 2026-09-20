const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

// Execute the existing handlers without starting the UI, demo, timers or network.
// Geometry and real pointer interactions are checked separately in the browser.
function between(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert(from >= 0 && to > from, `Match test source boundary missing: ${start}`);
  return source.slice(from, to);
}

function fakeNode() {
  const classes = new Set();
  return {
    style: {}, value: 0, innerHTML: '', textContent: '',
    classList: {
      add(...names) { names.forEach(name => classes.add(name)); },
      remove(...names) { names.forEach(name => classes.delete(name)); },
      contains(name) { return classes.has(name); },
      toggle(name, force) {
        const enabled = force === undefined ? !classes.has(name) : force;
        if(enabled) classes.add(name); else classes.delete(name);
        return enabled;
      }
    },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
}

function matchHarness() {
  const nodes = new Map();
  const storage = new Map();
  const listeners = new Map();
  const getNode = id => {
    if(!nodes.has(id)) nodes.set(id, fakeNode());
    return nodes.get(id);
  };
  const sandbox = {
    console, Date, JSON, Math, Map, Set, URLSearchParams,
    navigator: {onLine: true},
    setTimeout() {}, clearTimeout() {}, setInterval() {},
    document: {
      body: fakeNode(), getElementById: getNode,
      head: {appendChild() {}}, createElement: fakeNode,
      querySelector() { return fakeNode(); }, querySelectorAll() { return []; }
    },
    CoachStatsNotify: {
      warn() {}, error() {}, success() {}, info() {}, ask: async () => true
    },
    PLAYER_DB: ['TEST ALICE', 'TEST BEA', 'TEST CLEO'].map((name, index) => ({
      name, playerId: `fixture-player-${index}`, team: 'U13 A', teamId: 'team-u13-a'
    }))
  };
  sandbox.window = sandbox;
  sandbox.parent = {postMessage() {}};
  sandbox.addEventListener = (name, callback) => listeners.set(name, callback);
  sandbox.CoachStatsStorage = {
    get(key, fallback) { return storage.get(key) || fallback; },
    setJson(key, value) { storage.set(key, JSON.stringify(value)); }
  };
  vm.createContext(sandbox);
  vm.runInContext(read('pages/coach-stats/coachStatsConfig.js'), sandbox);
  vm.runInContext(between(read('pages/coach-stats.html'), 'const ROSTER=', '/* CoachPulse V6.9.3 — Simulation'), sandbox);
  const run = source => vm.runInContext(source, sandbox);
  run(`
    renderAll=()=>{};renderLive=()=>{};renderPitch=()=>{};
    buildSystem=()=>{};buildZones=()=>{};showUndo=()=>{};flash=()=>{};showTab=()=>{};
    state.team='U13 A';state.teamId='team-u13-a';state.called=ROSTER.slice();
    state.lineup={GB:ROSTER[0],BU:ROSTER[1]};state.bench=[ROSTER[2]];
    ensure();state.selected=ROSTER[1];
  `);
  return {
    sandbox, storage, listeners, getNode, run,
    state: () => JSON.parse(run('JSON.stringify(state)'))
  };
}

function firestoreHarness() {
  const documents = new Map();
  const writes = [];
  const sandbox = {
    Date, JSON, Math, Set, Map, Promise,
    db: {}, currentUser: {uid: 'fixture-coach', email: 'coach@example.test'},
    navigator: {onLine: true},
    canEditModule: () => true, canViewModule: () => true,
    getAuthorizedTeamIds: () => ['team-u13-a'],
    teamsService: () => ({canonicalTeamId: () => 'team-u13-a'}),
    seasonFromDate: () => '2026-2027',
    stableFirestoreId: (...parts) => parts.filter(Boolean).join('-'),
    firestoreSafeData: value => JSON.parse(JSON.stringify(value)),
    firebaseFns: {
      doc: (_db, collection, id) => `${collection}/${id}`,
      getDoc: async ref => ({exists: () => documents.has(ref), data: () => documents.get(ref)}),
      setDoc: async (ref, value, options) => {
        writes.push({ref, value, options});
        documents.set(ref, {...documents.get(ref), ...value});
      },
      serverTimestamp: () => 'fixture-server-timestamp',
      collection: (_db, name) => name,
      where: (field, operator, value) => ({field, operator, value}),
      query: (collection, filter) => ({collection, filter}),
      getDocs: async query => {
        const collection = typeof query === 'string' ? query : query.collection;
        const filter = typeof query === 'string' ? null : query.filter;
        const rows = [...documents.entries()].filter(([ref, value]) =>
          ref.startsWith(`${collection}/`) && (!filter || (filter.operator === 'array-contains'
            ? Array.isArray(value[filter.field]) && value[filter.field].includes(filter.value)
            : value[filter.field] === filter.value)));
        return {forEach: callback => rows.forEach(([ref, value]) => callback({id: ref.split('/')[1], data: () => value}))};
      }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(between(read('app.js'), 'function matchDocumentId(', 'function playerForSeason('), sandbox);
  return {sandbox, documents, writes};
}

let checks = 0;
async function test(name, callback) {
  await callback();
  checks++;
  console.log(`PASS ${name}`);
}

async function main() {
  await test('tactical placement uses clamped relative coordinates and resets explicitly', () => {
    const h = matchHarness();
    h.run("saveTacticalPlacement('BU',1.4,-0.2);");
    let state = h.state();
    assert.deepEqual(state.tacticalPositions.BU, {x: 1, y: 0});
    assert.deepEqual(JSON.parse(h.storage.get('coachStatsV170')).tacticalPositions.BU, {x: 1, y: 0});
    assert.equal(h.run("JSON.stringify(tacticalPlacement('BU',50,50))"), JSON.stringify({x:100,y:0}));
    h.run('resetTacticalPlacement();');
    assert.deepEqual(h.state().tacticalPositions, {});
    h.run("state.tacticalPositions={GB:{x:.3,y:.4}};quickSystemChange('3-3-1');");
    assert.deepEqual(h.state().tacticalPositions, {});
  });

  await test('on-field role changes preserve identity, stats, time, placement and substitutions', () => {
    const h = matchHarness();
    h.run(`
      state.lineup={MC:ROSTER[0],BU:ROSTER[1]};state.bench=[ROSTER[2]];
      state.players[ROSTER[0]].seconds=127;state.players[ROSTER[0]].recup=2;
      state.tacticalPositions={MC:{x:.42,y:.31}};state.log=[];
    `);
    const before = h.state(), playerId = before.players['TEST ALICE'].playerId;
    assert.equal(h.run("changePlayerPosition('TEST ALICE','MOC')"), true);
    let state = h.state();
    assert.equal(state.lineup.MOC, 'TEST ALICE');
    assert.equal(state.lineup.MC, undefined);
    assert.equal(state.players['TEST ALICE'].playerId, playerId);
    assert.equal(state.players['TEST ALICE'].seconds, 127);
    assert.equal(state.players['TEST ALICE'].recup, 2);
    assert.deepEqual(state.tacticalPositions.MOC, {x:.42,y:.31});
    assert.deepEqual(state.bench, ['TEST CLEO']);
    assert.equal(state.log.length, 0);
    h.run("changePlayerPosition('TEST BEA','MOC');");
    state = h.state();
    assert.equal(state.lineup.MOC, 'TEST BEA');
    assert.equal(state.lineup.BU, 'TEST ALICE');
    assert.deepEqual(state.bench, ['TEST CLEO']);
    h.run("changePlayerPosition('TEST ALICE','MOC');");
    state = h.state();
    assert.equal(state.lineup.MOC, 'TEST ALICE');
    assert.equal(state.lineup.BU, 'TEST BEA');
    assert.equal(state.players['TEST ALICE'].seconds, 127);
    h.run("state.selected='TEST ALICE';stat('passe');");
    state = h.state();
    assert.equal(state.players['TEST ALICE'].passe, 1);
    assert.equal(state.log.at(-1).player, 'TEST ALICE');
    h.run("movePlayer('TEST CLEO','Banc','MOC','TEST ALICE');");
    state = h.state();
    assert.equal(state.lineup.MOC, 'TEST CLEO');
    assert.deepEqual(state.bench, ['TEST ALICE']);
    h.run("movePlayer('TEST ALICE','Banc','MOC','TEST CLEO');changePlayerPosition('TEST ALICE','AIG');resetTacticalPlacement();");
    state = h.state();
    assert.equal(state.lineup.AIG, 'TEST ALICE');
    assert.equal(state.players['TEST ALICE'].seconds, 127);
    assert.deepEqual(state.tacticalPositions, {});
  });

  await test('timer, match phases and starter/bench playing time', () => {
    const h = matchHarness();
    h.run('startMatch();startMatch();tick();tick();');
    let state = h.state();
    assert.equal(state.elapsed, 2);
    assert.equal(state.players['TEST ALICE'].seconds, 2);
    assert.equal(state.players['TEST ALICE'].positionSeconds.GB, 2);
    assert.equal(state.players['TEST CLEO'].seconds, 0);
    assert.equal(state.log.length, 1);
    h.run('halfTime();halfTime();tick();');
    assert.equal(h.state().elapsed, 2);
    h.run('resumeMatch();tick();finishMatch();tick();');
    state = h.state();
    assert.equal(state.elapsed, 3);
    assert.equal(state.running, false);
    assert.equal(state.matchEnded, true);
    assert.equal(state.log.length, 4);
    assert.equal(new Set(state.log.map(event => event.eventId)).size, 4);
  });

  await test('legacy position totals are normalized to the recorded playing time', () => {
    const h = matchHarness();
    h.run(`
      state.players['TEST ALICE'].seconds=1242;
      state.players['TEST ALICE'].positionSeconds={BU:1242,MG:685,MD:180};
      state.savedMatches=[{
        id:'legacy-times',matchId:'legacy-times',createdAt:new Date().toISOString(),
        players:{'TEST ALICE':{...blank(),seconds:600,positionSeconds:{BU:600,MG:300}}},log:[]
      }];
      ensure();
    `);
    const state = h.state();
    const livePositions = Object.values(state.players['TEST ALICE'].positionSeconds).reduce((sum, value) => sum + value, 0);
    const savedPositions = Object.values(state.savedMatches[0].players['TEST ALICE'].positionSeconds).reduce((sum, value) => sum + value, 0);
    assert.equal(livePositions, 1242);
    assert.equal(savedPositions, 600);
    assert.equal(state.players['TEST ALICE'].positionSeconds.BU > state.players['TEST ALICE'].positionSeconds.MG, true);
  });

  await test('player view filters ignore DOM globals and return the selected saved match', () => {
    const h = matchHarness();
    vm.runInContext(
      between(read('pages/coach-stats.html'), '(function(){\nconst playerViewFilters=', '\n})();') + '\n})();',
      h.sandbox
    );
    h.run(`
      window.v52MatchFilter={value:'dom-collision'};
      window.v52SeasonFilter={value:'dom-collision'};
      state.matchId='current-empty';state.players['TEST ALICE']=blank();state.called=['TEST ALICE'];
      state.savedMatches=[{
        id:'saved-filter-match',matchId:'saved-filter-match',createdAt:new Date().toISOString(),season:'2026-2027',
        called:['TEST ALICE'],players:{'TEST ALICE':{...blank(),seconds:120,positionSeconds:{DCG:120}}},log:[]
      }];
      setPlayerViewFilter('matchId','saved-filter-match');
      setPlayerViewFilter('season','2026-2027');
      setPlayerViewFilter('player','TEST ALICE');
    `);
    const html = h.getNode('playersV52').innerHTML;
    assert.match(html, /02:00/);
    assert.match(html, /1 source/);
    assert.doesNotMatch(html, /HTMLSelectElement/);
  });

  await test('match report reads the same event log as the live match view', () => {
    const h = matchHarness();
    vm.runInContext(
      between(read('pages/coach-stats.html'), "window.v51BilanFilter =", '</script>'),
      h.sandbox
    );
    h.run("state.log=[];recordAdvAction('butAdv',4);");
    assert.equal(h.run('v51Actions().length'), 1);
    assert.equal(h.run('v51Actions()[0].player'), 'Adversaire');
    assert.match(h.run("v51Events(()=>true,'vide')"), /But adverse zone 4/);
  });

  await test('field slot swaps keep tactical coordinates, time, stats and bench unchanged', () => {
    const h = matchHarness();
    h.run(`
      state.lineup={MC:ROSTER[0],MDC:ROSTER[1]};state.bench=[ROSTER[2]];
      state.tacticalPositions={MC:{x:.52,y:.30},MDC:{x:.42,y:.50}};
      state.players[ROSTER[0]].seconds=84;state.players[ROSTER[0]].recup=3;state.log=[];
      movePlayer(ROSTER[0],'MC','MDC',ROSTER[1]);
    `);
    const state = h.state();
    assert.equal(state.lineup.MC, 'TEST BEA');
    assert.equal(state.lineup.MDC, 'TEST ALICE');
    assert.deepEqual(state.tacticalPositions, {MC:{x:.52,y:.30},MDC:{x:.42,y:.50}});
    assert.equal(state.players['TEST ALICE'].seconds, 84);
    assert.equal(state.players['TEST ALICE'].recup, 3);
    assert.deepEqual(state.bench, ['TEST CLEO']);
    assert.equal(state.log.length, 0);
  });

  await test('player selection and starter/substitute swaps preserve the roster', () => {
    const h = matchHarness();
    h.run("openPlayerPanel('TEST CLEO');movePlayer('TEST CLEO','Banc','BU');startMatch();tick();");
    let state = h.state();
    assert.equal(state.selected, 'TEST CLEO');
    assert.equal(h.getNode('playerActionPanel').classList.contains('show'), true);
    assert.equal(state.lineup.BU, 'TEST CLEO');
    assert.deepEqual(state.bench, ['TEST BEA']);
    assert.equal(state.players['TEST CLEO'].seconds, 1);
    assert.equal(state.players['TEST BEA'].seconds, 0);
    h.run("movePlayer('TEST CLEO','BU','Banc','TEST BEA');");
    state = h.state();
    assert.equal(state.lineup.BU, 'TEST BEA');
    assert.deepEqual(state.bench, ['TEST CLEO']);
    assert.equal(new Set([...Object.values(state.lineup), ...state.bench]).size, 3);
  });

  await test('all nine zone numbers, one event per validation and zone cancellation', () => {
    const h = matchHarness();
    h.run("for(let zone=1;zone<=9;zone++){actionZone('tirCadre');zoneClick(zone);zoneClick(zone)}");
    let state = h.state();
    assert.equal(state.players['TEST BEA'].tirCadre, 9);
    assert.equal(state.log.length, 9);
    assert.deepEqual(state.log.map(event => event.zone), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    assert.deepEqual(Object.values(state.players['TEST BEA'].zones.tirCadre), Array(9).fill(1));
    assert.equal(new Set(state.log.map(event => event.eventId)).size, 9);
    assert(state.log.every(event => event.playerId && event.teamId));
    h.run("actionZone('centre');closeZones();zoneClick(4);");
    state = h.state();
    assert.equal(state.players['TEST BEA'].centre, 0);
    assert.equal(state.zonePending, null);
    assert.equal(h.getNode('zoneOverlay').style.pointerEvents, 'none');
  });

  await test('vertical pitch events preserve low, central, high and opponent zone IDs', () => {
    const h = matchHarness();
    h.run("zoneStat('recup');zoneClick(8);zoneStat('recup');zoneClick(5);actionZone('tirCadre');zoneClick(2);advZone('tirCadreAdv');zoneClick(1);");
    const state = h.state();
    assert.deepEqual(state.log.map(event => event.zone).filter(Number.isInteger), [8, 5, 2, 1]);
    assert.equal(state.players['TEST BEA'].zones.recup[8], 1);
    assert.equal(state.players['TEST BEA'].zones.recup[5], 1);
    assert.equal(state.players['TEST BEA'].zones.tirCadre[2], 1);
    assert.equal(state.opp.zones.tirCadreAdv[1], 1);
    assert.equal(state.selected, 'TEST BEA');
  });

  await test('goal, assist, score and action undo', () => {
    const h = matchHarness();
    h.run("goalFlow();zoneClick(6);assistForGoal('TEST ALICE');");
    assert.equal(h.state().scoreUs, 1);
    assert.equal(h.state().players['TEST ALICE'].passe, 1);
    h.run('undo();undo();');
    const state = h.state();
    assert.equal(state.scoreUs, 0);
    assert.equal(state.players['TEST BEA'].but, 0);
    assert.equal(state.players['TEST BEA'].zones.but[6], 0);
    assert.equal(state.players['TEST ALICE'].passe, 0);
    assert.equal(state.log.length, 0);
  });

  await test('existing ASSE and opponent action handlers update their own counters', () => {
    const h = matchHarness();
    for(const key of ['passe', 'tirCadre', 'tirNonCadre', 'centre', 'progression', 'entree20']) {
      h.run(`stat(${JSON.stringify(key)});`);
      assert.equal(h.state().players['TEST BEA'][key], 1);
    }
    for(const key of ['tirCadreAdv', 'tirNonCadreAdv', 'centreAdv', 'progressionAdv', 'entree20Adv']) {
      h.run(`advZone(${JSON.stringify(key)});zoneClick(3);`);
      assert.equal(h.state().opp[key], 1);
      assert.equal(h.state().opp.zones[key][3], 1);
    }
    h.run("advZone('butAdv');zoneClick(1);");
    assert.equal(h.state().scoreThem, 1);
    h.run('undo();');
    assert.equal(h.state().scoreThem, 0);
    assert.equal(h.state().opp.butAdv, 0);
    assert.equal(h.state().opp.zones.butAdv[1], 0);
    h.getNode('scoreUs').value = 3;
    h.getNode('scoreThem').value = 2;
    h.run('manualScore();');
    assert.equal(h.state().scoreUs, 3);
    assert.equal(h.state().scoreThem, 2);
  });

  await test('recoveries, duels, possession time and domination still use existing calculations', () => {
    const h = matchHarness();
    h.run("startMatch();recordPlayerAction(state.selected,'recup',3);tick();recordAdvAction('recupAdv',9);tick();");
    assert.equal(h.state().possessionTeam, 'adv');
    assert.equal(h.state().possessionUs, 1);
    assert.equal(h.state().possessionAdv, 1);
    assert.equal(h.run('possessionPct()'), 50);
    h.run("duelPlayer('won');duelPlayer('lost');duelAdv('won');duelAdv('lost');renderDomination();");
    const state = h.state();
    assert.equal(state.players['TEST BEA'].duelWon, 1);
    assert.equal(state.players['TEST BEA'].duelLost, 1);
    assert.equal(state.opp.duelWonAdv, 2);
    assert.equal(state.opp.duelLostAdv, 2);
    const before = Number.parseInt(h.getNode('domScore').textContent, 10);
    h.run("recordPlayerAction(state.selected,'but',2);renderDomination();");
    const after = Number.parseInt(h.getNode('domScore').textContent, 10);
    assert(Number.isFinite(before) && after > before && after <= 100);
  });

  await test('local saves, snapshots, current-match reload and saved-match roster/event restore', async () => {
    const h = matchHarness();
    h.run("startMatch();tick();recordPlayerAction(state.selected,'tirCadre',8);saveCurrentMatch();saveCurrentMatch();");
    const before = h.state();
    const saved = before.savedMatches[0];
    assert.equal(before.savedMatches.length, 1);
    assert.equal(saved.matchId, before.matchId);
    assert.equal(saved.syncStatus, 'pendingSync');
    assert.deepEqual(saved.log.map(event => event.eventId), before.log.map(event => event.eventId));
    assert(saved.players['TEST BEA'].playerId);
    assert.equal(saved.lineup.BU, 'TEST BEA');
    h.run('state.log=[];state.elapsed=0;load();');
    assert.equal(h.state().matchId, before.matchId);
    assert.deepEqual(h.state().log, before.log);
    assert.equal(h.state().elapsed, before.elapsed);
    assert.equal(JSON.parse(h.storage.get('coachStatsV170')).matchId, before.matchId);
    h.run("state.matchId='another-current-match';state.lineup.BU='TEST CLEO';state.log=[];state.players['TEST BEA'].tirCadre=100;");
    await h.run('restoreSavedMatch(state.savedMatches[0].id)');
    assert.equal(h.state().matchId, saved.matchId);
    assert.equal(h.state().lineup.BU, 'TEST BEA');
    assert.equal(h.state().players['TEST BEA'].tirCadre, 1);
    assert.deepEqual(h.state().log, saved.log);
    assert.equal(h.state().running, false);
    const restoredMatchId = h.state().matchId;
    await h.run('resetFullMatch()');
    assert.notEqual(h.state().matchId, restoredMatchId);
    assert.equal(h.state().savedMatches.length, 1);
  });

  await test('pendingSync, synced, syncError, network retry and idempotent Firestore writes', async () => {
    const h = matchHarness();
    const cloud = firestoreHarness();
    h.run("recordPlayerAction(state.selected,'tirCadre',4);saveCurrentMatch();");
    assert.equal(h.state().savedMatches[0].syncStatus, 'pendingSync');
    h.sandbox.parent.CoachPulseCentralData = {
      matchSaveToFirestore: async match => {
        const local = JSON.parse(h.storage.get('coachStatsV170'));
        assert.equal(local.savedMatches[0].syncStatus, 'pendingSync');
        assert.equal(local.savedMatches[0].matchId, match.matchId);
        return cloud.sandbox.matchSaveToFirestore(match);
      },
      matchListFromFirestore: cloud.sandbox.matchListFromFirestore
    };
    assert.equal(await h.run('syncSavedMatch(state.savedMatches[0],{silent:true})'), true);
    assert.equal(h.state().savedMatches[0].syncStatus, 'synced');
    const firstRefs = [...cloud.documents.keys()];
    await h.run('syncSavedMatch(state.savedMatches[0],{silent:true})');
    assert.deepEqual([...cloud.documents.keys()], firstRefs);
    assert.equal(firstRefs.filter(ref => ref.startsWith('matches/')).length, 1);
    assert.equal(firstRefs.filter(ref => ref.startsWith('matchEvents/')).length, 1);
    assert(cloud.writes.every(write => write.options.merge === true));
    const matchRef = firstRefs.find(ref => ref.startsWith('matches/'));
    delete cloud.documents.get(matchRef).log;
    delete cloud.documents.get(matchRef).events;
    const remote = await cloud.sandbox.matchListFromFirestore({teamId: 'team-u13-a'});
    assert.equal(remote.length, 1);
    assert.equal(remote[0].log[0].eventId, h.state().log[0].eventId);
    assert.equal((await cloud.sandbox.matchListFromFirestore({teamId: 'team-u16-a'})).length, 0);

    const otherDevice = matchHarness();
    otherDevice.sandbox.parent.CoachPulseCentralData = {
      matchSaveToFirestore: cloud.sandbox.matchSaveToFirestore,
      matchListFromFirestore: cloud.sandbox.matchListFromFirestore
    };
    await otherDevice.run('reconcileMatchesWithCloud()');
    assert.equal(otherDevice.state().savedMatches.length, 1);
    assert.equal(String(otherDevice.state().savedMatches[0].matchId), String(h.state().savedMatches[0].matchId));
    assert.equal(otherDevice.state().savedMatches[0].log[0].eventId, h.state().log[0].eventId);

    const legacyLocal = matchHarness();
    legacyLocal.sandbox.parent.CoachPulseCentralData = {
      matchSaveToFirestore: cloud.sandbox.matchSaveToFirestore,
      matchListFromFirestore: cloud.sandbox.matchListFromFirestore
    };
    legacyLocal.run(`state.savedMatches=[{...${JSON.stringify(h.state().savedMatches[0])},id:'legacy-local-only',matchId:'legacy-local-only',syncStatus:'synced'}];save()`);
    await legacyLocal.run('reconcileMatchesWithCloud()');
    assert.equal(legacyLocal.state().savedMatches.find(match => match.matchId === 'legacy-local-only').syncStatus, 'synced');
    assert(cloud.documents.has('matches/legacy-local-only'));
    assert([...cloud.documents.keys()].some(ref => ref.startsWith('matchEvents/') && cloud.documents.get(ref).matchId === 'legacy-local-only'));
    const refsAfterLegacyRecovery = [...cloud.documents.keys()];

    h.sandbox.navigator.onLine = false;
    cloud.sandbox.navigator.onLine = false;
    await h.run('syncSavedMatch(state.savedMatches[0],{silent:true})');
    assert.equal(h.state().savedMatches[0].syncStatus, 'pendingSync');
    h.sandbox.navigator.onLine = true;
    cloud.sandbox.navigator.onLine = true;
    cloud.sandbox.canEditModule = () => false;
    await h.run('syncSavedMatch(state.savedMatches[0],{silent:true})');
    assert.equal(h.state().savedMatches[0].syncStatus, 'syncError');
    assert(h.state().savedMatches[0].syncError);
    cloud.sandbox.canEditModule = () => true;
    await h.listeners.get('online')();
    assert.equal(h.state().savedMatches[0].syncStatus, 'synced');
    assert.equal(h.state().savedMatches[0].syncError, '');
    assert.deepEqual([...cloud.documents.keys()], refsAfterLegacyRecovery);
  });

  console.log(`Match entry guards OK (${checks} behavior groups; DOM/rendering and Firebase I/O mocked).`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
