const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const appSource = fs.readFileSync('app.js', 'utf8');
const pageSource = fs.readFileSync('pages/tests-techniques.html', 'utf8');

function sourceBetween(source, start, end){
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `Bloc introuvable: ${start}`);
  return source.slice(from, to);
}

function sourceFunction(source, name){
  const match = new RegExp(`function ${name}\\([^\\n]+`).exec(source);
  assert.ok(match, `Fonction introuvable: ${name}`);
  return match[0];
}

const reconciliation = vm.createContext({JSON, Map, Set, Object});
reconciliation.technicalRowStorageId = row => String(row.technicalTestId || row.testId || row.id || '').trim();
vm.runInContext(sourceBetween(appSource, 'function technicalReconciliationFingerprint', 'async function reconcileLegacyTechnicalTests'), reconciliation);

const row = (id, score, extra={}) => ({technicalTestId:id, playerId:'player-a', teamId:'team-a', date:'2026-11-20', season:'2026-2027', tests:{max_pfp:score}, ...extra});

const normalization = vm.createContext({
  technicalRowStorageId:source => source.technicalTestId,
  normalizeTechnicalRows:rows => rows.length ? [{...rows[rows.length - 1], tests:{...rows[rows.length - 1].tests}}] : []
});
vm.runInContext(sourceBetween(appSource, 'function normalizeTechnicalRowsForReconciliation', 'function technicalReconciliationFingerprint'), normalization);
const separatelyNormalized = normalization.normalizeTechnicalRowsForReconciliation([row('history-a', 10), row('history-b', 12)]);
assert.equal(separatelyNormalized.length, 2, 'La normalisation de preuve doit conserver chaque occurrence historique.');
assert.deepEqual(Array.from(separatelyNormalized, item => item.tests.max_pfp), [10, 12]);

const complete = reconciliation.technicalSettledReadSummary(
  [{status:'fulfilled', value:[row('primary', 10)]}],
  [{status:'fulfilled', value:[row('fallback', 11)]}]
);
assert.equal(complete.complete, true);
assert.equal(complete.rows.length, 2);

const secondaryFailure = new Error('secondary query denied');
const incomplete = reconciliation.technicalSettledReadSummary(
  [{status:'fulfilled', value:[row('primary', 10)]}],
  [{status:'rejected', reason:secondaryFailure}]
);
assert.equal(incomplete.complete, false, 'Une requête secondaire échouée doit invalider la preuve de lecture complète.');
assert.equal(incomplete.error, secondaryFailure);

const sharedCopy = row('shared', 7, {comment:'identique'});
const crossSourceCandidates = reconciliation.technicalDeduplicateCrossSource(
  [sharedCopy, row('historical-duplicate', 8), row('historical-duplicate', 8)],
  [{...sharedCopy}, row('local-only', 9)]
);
assert.equal(crossSourceCandidates.length, 4);
assert.equal(crossSourceCandidates.filter(item => item.technicalTestId === 'historical-duplicate').length, 2);
assert.equal(reconciliation.technicalLegacyValueUnchanged(
  {coachStatsV13Rows:'original', concurrentModule:{kept:true}},
  {confirmed:true, originalLegacyValue:'original'}
), true);
assert.equal(reconciliation.technicalLegacyValueUnchanged(
  {coachStatsV13Rows:'concurrent-change'},
  {confirmed:true, originalLegacyValue:'original'}
), false, 'Une modification concurrente de la clé legacy doit imposer une nouvelle preuve.');

const historical = [
  row('history', 10, {reconciliationSourceId:'history'}),
  row('history', 12, {reconciliationSourceId:'history'})
];
assert.equal(reconciliation.technicalLegacyReconciliationPlan(historical, historical).confirmed, true);
assert.equal(
  reconciliation.technicalLegacyReconciliationPlan(historical, [row('history', 12, {reconciliationSourceId:'history'})]).confirmed,
  false,
  'Une ligne cloud fusionnée ne doit pas masquer la perte d’un enregistrement historique.'
);
assert.equal(reconciliation.technicalLegacyReconciliationPlan([row('deleted', 12)], [], ['deleted']).confirmed, true);
assert.equal(reconciliation.technicalLegacyReconciliationPlan([row('business', 12, {comment:'A'})], [row('business', 12, {comment:'B'})]).confirmed, false);
assert.equal(reconciliation.technicalLegacyReconciliationPlan([row('business', 12, {objectifs:{max_pfp:20}})], [row('business', 12, {objectifs:{max_pfp:25}})]).confirmed, false);

const remaining = reconciliation.technicalRowsWithoutTombstones(
  [row('active', 1), row('inline-deleted', 2, {deleted:true}), row('cached', 3)],
  ['cached']
);
assert.deepEqual(remaining.map(item => item.technicalTestId), ['active']);

const pageContext = vm.createContext({
  storageJson:() => [row('active', 1), row('deleted', 2, {deleted:true})],
  TECHNICAL_ROWS_KEY:'coachStatsV13Rows'
});
vm.runInContext(`${sourceFunction(pageSource, 'rowFinalized')};${sourceFunction(pageSource, 'localRows')};`, pageContext);
assert.equal(pageContext.rowFinalized(row('deleted', 2, {deleted:true})), false);
assert.deepEqual(Array.from(pageContext.localRows(), item => item.technicalTestId), ['active']);

(async () => {
  const reconcileContext = vm.createContext({
    Error, Array, JSON, Map, Set, Object,
    currentUser:{uid:'uid-a'},
    technicalRowStorageId:source => String(source.technicalTestId || source.testId || source.id || ''),
    technicalAccessScopeKey:() => 'team-a',
    localTechnicalPayload:() => [row('legacy', 4)],
    technicalListData:async () => [],
    listPlayers:async () => { throw new Error('ne doit pas être appelée'); }
  });
  vm.runInContext(sourceBetween(appSource, 'function technicalReconciliationFingerprint', 'async function reconcileLegacyTechnicalTests'), reconcileContext);
  vm.runInContext(sourceBetween(appSource, 'async function reconcileLegacyTechnicalTests', 'function technicalAccessScopeKey'), reconcileContext);
  await assert.rejects(
    () => reconcileContext.reconcileLegacyTechnicalTests({coachStatsV13Rows:JSON.stringify([row('legacy', 4)])}, {uid:'uid-a', scope:'team-a'}),
    error => error.name === 'TechnicalTestsReconciliationError' && error.unresolved?.[0]?.reason === 'incomplete-read'
  );
  await assert.rejects(
    () => reconcileContext.reconcileLegacyTechnicalTests({coachStatsV13Rows:'{invalid-json'}, {uid:'uid-a', scope:'team-a'}),
    error => error.name === 'TechnicalTestsReconciliationError' && error.unresolved?.[0]?.reason === 'invalid-json'
  );
  await assert.rejects(
    () => reconcileContext.reconcileLegacyTechnicalTests({coachStatsV13Rows:{not:'an array'}}, {uid:'uid-a', scope:'team-a'}),
    error => error.name === 'TechnicalTestsReconciliationError' && error.unresolved?.[0]?.reason === 'unexpected-type'
  );
  let serverReadCount = 0;
  reconcileContext.technicalListData = async filters => {
    serverReadCount += 1;
    filters.reconciliationProof({uid:'uid-b', scope:'team-a', complete:true, serverConfirmed:true, hasPendingWrites:false, rows:[], deletedIds:[]});
  };
  await assert.rejects(
    () => reconcileContext.reconcileLegacyTechnicalTests({coachStatsV13Rows:JSON.stringify([row('legacy', 4)])}, {uid:'uid-a', scope:'team-a'}),
    error => error.name === 'TechnicalTestsReconciliationError' && error.unresolved?.[0]?.reason === 'incomplete-read'
  );
  assert.equal(serverReadCount, 1);
  for(const unsafeProof of [
    {uid:'uid-a', scope:'team-a', complete:true, serverConfirmed:false, hasPendingWrites:false, rows:[], deletedIds:[]},
    {uid:'uid-a', scope:'team-a', complete:true, serverConfirmed:true, hasPendingWrites:true, rows:[], deletedIds:[]},
    {uid:'uid-a', scope:'team-b', complete:true, serverConfirmed:true, hasPendingWrites:false, rows:[], deletedIds:[]}
  ]){
    reconcileContext.technicalListData = async filters => filters.reconciliationProof(unsafeProof);
    await assert.rejects(
      () => reconcileContext.reconcileLegacyTechnicalTests({coachStatsV13Rows:JSON.stringify([row('legacy', 4)])}, {uid:'uid-a', scope:'team-a'}),
      error => error.name === 'TechnicalTestsReconciliationError' && error.unresolved?.[0]?.reason === 'incomplete-read'
    );
  }
  const absent = await reconcileContext.reconcileLegacyTechnicalTests({}, {uid:'uid-a', scope:'team-a'});
  assert.equal(absent.skipped, true);
  assert.equal(serverReadCount, 1, 'La collection technique ne doit pas être relue si la clé legacy cloud est absente.');
  console.log('Technical tests sync behavioral scenarios passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
