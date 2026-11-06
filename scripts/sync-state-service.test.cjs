const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('shared/utils/sync-state-service.js', 'utf8');
const context = vm.createContext({console, Date, JSON, Map, Set});
context.globalThis = context;
vm.runInContext(source, context);
const sync = context.CoachPulseSyncState;

sync.resetForTests();
assert.equal(sync.snapshot().state, 'unknown');
sync.setPersistence('available');
sync.setUser('uid-a');
sync.declareLocal('draft:1', {kind:'draft'});
assert.equal(sync.snapshot().state, 'local');
sync.markSyncing('draft:1');
assert.equal(sync.snapshot().state, 'syncing');
sync.confirm('draft:1');
assert.equal(sync.snapshot().notificationSequence, 1);
assert.equal(sync.snapshot().state, 'unknown');
sync.setCoverage({complete:true, covered:['all'], uncovered:[]});
assert.equal(sync.snapshot().state, 'synced');
sync.declareLocal('write:2');
sync.markSyncing('write:2');
sync.confirm('draft:1');
assert.equal(sync.snapshot().state, 'syncing');
sync.fail('write:2', new Error('server'));
assert.equal(sync.snapshot().state, 'error');
sync.conflict('write:2', 'revision');
assert.equal(sync.snapshot().state, 'conflict');

sync.setUser('uid-b');
assert.equal(sync.snapshot().operations.length, 0);
sync.setPersistence('failed-precondition', {code:'failed-precondition'});
sync.declareLocal('write:b');
assert.equal(sync.snapshot().state, 'error');
sync.setUser(null);
assert.equal(sync.snapshot().state, 'unknown');
const notificationsBeforeReconnect = sync.snapshot().notificationSequence;
sync.setUser('uid-a');
assert.ok(sync.snapshot().operations.length >= 2);
assert.equal(sync.snapshot().notificationSequence, notificationsBeforeReconnect);
sync.setPersistence('available');
sync.declareLocal('write:3');
sync.confirm('write:2');
sync.confirm('write:3');
sync.confirm('write:3');
assert.equal(sync.snapshot().notificationSequence, notificationsBeforeReconnect + 1);

// Hors ligne puis reconnexion : la tentative de reconnexion remplace l'état local.
sync.resetForTests();
sync.setPersistence('available');
sync.setUser('uid-offline');
const offline = sync.declareLocal('legacy-cloud:uid-offline', {kind:'draft'}).operationToken;
assert.equal(sync.snapshot().state, 'local');
const reconnect = sync.markSyncing('legacy-cloud:uid-offline').operationToken;
assert.equal(sync.isCurrent(offline), false);
assert.equal(sync.isCurrent(reconnect), true);
sync.confirm('legacy-cloud:uid-offline', {token:reconnect});
assert.equal(sync.snapshot().state, 'unknown');

// Deux synchronisations portant le même operationId ne peuvent pas se terminer
// dans le désordre et écraser l'état de la tentative la plus récente.
sync.setCoverage({complete:true, covered:['all'], uncovered:[]});
const first = sync.markSyncing('legacy-cloud:uid-offline').operationToken;
const second = sync.markSyncing('legacy-cloud:uid-offline').operationToken;
assert.equal(sync.confirm('legacy-cloud:uid-offline', {token:first}).accepted, false);
assert.equal(sync.snapshot().state, 'syncing');
assert.equal(sync.fail('legacy-cloud:uid-offline', new Error('late failure'), {token:first}).accepted, false);
assert.equal(sync.snapshot().state, 'syncing');
assert.equal(sync.confirm('legacy-cloud:uid-offline', {token:second}).accepted, true);
assert.equal(sync.snapshot().state, 'synced');

// Un callback de l'ancien utilisateur reste obsolète même si cet UID redevient actif.
const uidAToken = sync.markSyncing('legacy-cloud:uid-offline').operationToken;
sync.setUser('uid-other');
assert.equal(sync.confirm('legacy-cloud:uid-offline', {token:uidAToken}).accepted, false);
assert.equal(sync.snapshot().operations.length, 0);
sync.setUser('uid-offline');
assert.equal(sync.isCurrent(uidAToken), false);
assert.equal(sync.fail('legacy-cloud:uid-offline', new Error('late uid failure'), {token:uidAToken}).accepted, false);
assert.equal(sync.snapshot().state, 'syncing');
assert.equal(sync.snapshot().coverage.complete, true);
console.log('Sync state service scenarios passed.');
