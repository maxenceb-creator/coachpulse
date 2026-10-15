const assert = require('node:assert/strict');
const Persistence = require('../shared/services/match-persistence-service.js');

let checks = 0;
function test(name, callback){
  callback();
  checks += 1;
  console.log(`PASS ${name}`);
}

test('legacy match without revision remains compatible and distinct from invalid revision', () => {
  const legacy = {matchId:'legacy', scoreUs:2, futureField:{kept:true}};
  const compatible = Persistence.compatibleMatch(legacy);
  assert.equal(Persistence.matchVersionInfo(legacy).state, 'ABSENT');
  assert.equal(compatible.revision, 0);
  assert.equal(compatible.revisionState, 'ABSENT');
  assert.equal(compatible.schemaVersion, 0);
  assert.equal(compatible.entryMode, 'LIVE');
  assert.equal(compatible.statsSource, 'EVENTS');
  assert.equal(compatible.status, 'COMPLETED');
  assert.equal(compatible.updatedAt, null);
  assert.deepEqual(compatible.futureField, {kept:true});
});

test('valid match revision is retained', () => {
  assert.deepEqual(Persistence.matchVersionInfo({revision:4}), {state:'VALID',valid:true,revision:4});
  assert.equal(Persistence.compatibleMatch({revision:4}).revision, 4);
});

test('identical revisions authorize a next revision', () => {
  assert.deepEqual(Persistence.compareRevisions(3, 3), {
    ok:true, conflict:false, code:'REVISION_MATCH', expectedRevision:3, remoteRevision:3, nextRevision:4,
    message:'La revision distante correspond a la revision attendue.'
  });
});

test('higher remote revision rejects stale modification with an actionable conflict', () => {
  const result = Persistence.compareRevisions(2, 3);
  assert.equal(result.ok, false);
  assert.equal(result.conflict, true);
  assert.equal(result.code, 'REVISION_CONFLICT');
  assert.match(result.message, /Rechargez/);
});

test('invalid revision is rejected rather than treated as absent', () => {
  assert.equal(Persistence.matchVersionInfo({revision:'2'}).state, 'INVALID');
  assert.equal(Persistence.compareRevisions(2, '3').code, 'INVALID_REMOTE_REVISION');
  assert.equal(Persistence.compareRevisions(-1, 0).code, 'INVALID_EXPECTED_REVISION');
});

test('partial event list keeps added modified and unchanged events without preparing removals', () => {
  const previous = [
    {eventId:'same', type:'shot'},
    {eventId:'changed', type:'shot', value:1},
    {eventId:'removed', type:'goal'}
  ];
  const next = [
    {eventId:'same', type:'shot'},
    {eventId:'changed', type:'shot', value:2},
    {eventId:'added', type:'assist'}
  ];
  const result = Persistence.reconcileEvents(previous, next);
  assert.deepEqual(result.added.map(item => item.eventId), ['added']);
  assert.deepEqual(result.modified.map(item => item.eventId), ['changed']);
  assert.deepEqual(result.removed, []);
  assert.deepEqual(result.unchanged.map(item => item.eventId), ['same']);
  assert.equal(result.nextEventsComplete, false);
});

test('explicitly partial event list never prepares removals', () => {
  const result = Persistence.reconcileEvents(
    [{eventId:'loaded'},{eventId:'not-loaded'}],
    [{eventId:'loaded'}],
    {nextEventsComplete:false}
  );
  assert.deepEqual(result.removed, []);
  assert.equal(result.nextEventsComplete, false);
});

test('explicitly complete event list detects missing events', () => {
  const result = Persistence.reconcileEvents(
    [{eventId:'kept'},{eventId:'removed'}],
    [{eventId:'kept'}],
    {nextEventsComplete:true}
  );
  assert.deepEqual(result.removed.map(item => item.eventId), ['removed']);
  assert.equal(result.nextEventsComplete, true);
});

test('complete event list prepares physical removals', () => {
  const result = Persistence.reconcileEvents([{eventId:'removed'}], [], {
    nextEventsComplete:true,
    deletionStrategy:'PHYSICAL'
  });
  assert.deepEqual(result.removed, [{eventId:'removed',strategy:'PHYSICAL',before:{eventId:'removed'}}]);
});

test('complete event list prepares logical removals', () => {
  const result = Persistence.reconcileEvents([{eventId:'removed'}], [], {
    nextEventsComplete:true,
    deletionStrategy:'LOGICAL'
  });
  assert.deepEqual(result.removed, [{
    eventId:'removed', strategy:'LOGICAL', before:{eventId:'removed'},
    tombstone:{eventId:'removed',deleted:true}
  }]);
});

test('empty partial event list does not remove previous events', () => {
  const result = Persistence.reconcileEvents([{eventId:'not-loaded'}], []);
  assert.deepEqual(result.removed, []);
  assert.equal(result.nextEventsComplete, false);
});

test('empty explicitly complete event list removes previous events', () => {
  const result = Persistence.reconcileEvents([{eventId:'removed'}], [], {nextEventsComplete:true});
  assert.deepEqual(result.removed.map(item => item.eventId), ['removed']);
  assert.equal(result.nextEventsComplete, true);
});

test('partial event list preserves additions and modifications', () => {
  const result = Persistence.reconcileEvents(
    [{eventId:'modified',value:1},{eventId:'not-loaded'}],
    [{eventId:'modified',value:2},{eventId:'added',value:1}]
  );
  assert.deepEqual(result.added.map(item => item.eventId), ['added']);
  assert.deepEqual(result.modified.map(item => item.eventId), ['modified']);
  assert.deepEqual(result.removed, []);
});

test('duplicate event identifiers are rejected explicitly', () => {
  assert.throws(
    () => Persistence.reconcileEvents([], [{eventId:'duplicate'},{eventId:'duplicate'}]),
    /duplicate identifier duplicate/
  );
});

test('stable event identifiers are preserved', () => {
  const result = Persistence.reconcileEvents([{eventId:'stable', value:1}], [{eventId:'stable', value:2}]);
  assert.equal(result.modified[0].eventId, 'stable');
  assert.equal(result.modified[0].after.eventId, 'stable');
  assert.throws(() => Persistence.reconcileEvents([{value:1}], []), /stable identifier/);
});

test('manual statistics do not create synthetic events', () => {
  const result = Persistence.reconcileEvents([], []);
  assert.deepEqual(result.added, []);
  assert.deepEqual(result.modified, []);
  assert.deepEqual(result.removed, []);
  assert.deepEqual(result.unchanged, []);
});

test('logical deletion is explicit and leaves the source event unchanged', () => {
  const previous = Object.freeze([Object.freeze({eventId:'retired', value:1})]);
  const result = Persistence.reconcileEvents(previous, [], {deletionStrategy:'LOGICAL',nextEventsComplete:true});
  assert.deepEqual(result.removed[0].tombstone, {eventId:'retired',value:1,deleted:true});
  assert.equal(previous[0].deleted, undefined);
});

test('inputs and returned snapshots are independent and unknown fields survive', () => {
  const previous = [{eventId:'event-1', nested:{value:1}, unknown:'kept'}];
  const next = [{eventId:'event-1', nested:{value:2}, unknown:'kept'}];
  const beforePrevious = structuredClone(previous);
  const beforeNext = structuredClone(next);
  const result = Persistence.reconcileEvents(previous, next);
  result.modified[0].after.nested.value = 99;
  assert.deepEqual(previous, beforePrevious);
  assert.deepEqual(next, beforeNext);
  assert.equal(result.modified[0].after.unknown, 'kept');
});

test('versioning enumerations and correction records expose the future contract', () => {
  assert.equal(Persistence.SCHEMA_VERSION, 1);
  assert.deepEqual([...Persistence.ENTRY_MODES], ['LIVE','QUICK_POST_MATCH','FULL_POST_MATCH']);
  assert.deepEqual([...Persistence.STATS_SOURCES], ['EVENTS','MANUAL','MIXED']);
  assert.deepEqual([...Persistence.MATCH_STATUSES], ['DRAFT','COMPLETED']);
  const correction = Persistence.createChangeRecord({
    field:'players.alice.but', oldValue:1, newValue:2, author:{uid:'coach-1'},
    changedAt:'2026-10-15T10:00:00.000Z', reason:'Video review', initialRevision:4, resultingRevision:5,
    targetType:'STAT_TOTAL'
  });
  assert.equal(correction.initialRevision, 4);
  assert.equal(correction.resultingRevision, 5);
  assert.equal(correction.targetType, 'STAT_TOTAL');
  assert.throws(() => Persistence.createChangeRecord({initialRevision:2,resultingRevision:4}), /consecutive/);
});

console.log(`Match persistence service checks passed: ${checks}`);
