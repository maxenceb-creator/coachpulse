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
          ref.startsWith(`${collection}/`) && (!filter || value[filter.field] === filter.value));
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
    h.run("state.lineup.BU='TEST CLEO';state.log=[];state.players['TEST BEA'].tirCadre=100;");
    await h.run('restoreSavedMatch(state.savedMatches[0].id)');
    assert.equal(h.state().lineup.BU, 'TEST BEA');
    assert.equal(h.state().players['TEST BEA'].tirCadre, 1);
    assert.deepEqual(h.state().log, saved.log);
    assert.equal(h.state().running, false);
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
    const remote = await cloud.sandbox.matchListFromFirestore({teamId: 'team-u13-a'});
    assert.equal(remote.length, 1);
    assert.equal(remote[0].log[0].eventId, h.state().log[0].eventId);
    assert.equal((await cloud.sandbox.matchListFromFirestore({teamId: 'team-u16-a'})).length, 0);

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
    assert.deepEqual([...cloud.documents.keys()], firstRefs);
  });

  console.log(`Match entry guards OK (${checks} behavior groups; DOM/rendering and Firebase I/O mocked).`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
