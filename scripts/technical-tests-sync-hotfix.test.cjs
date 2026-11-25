const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const appSource = fs.readFileSync('app.js', 'utf8');
const pageSource = fs.readFileSync('pages/tests-techniques.html', 'utf8');
const firestorePayloadService = require('../shared/utils/firestore-payload-service.js');

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

const syncGuardContext = vm.createContext({
  Error,
  currentUser:{uid:'uid-a'},
  currentScope:'team-a',
  technicalAccessScopeKey(){ return this.currentScope; },
  syncStateService:{isCurrent:() => true}
});
vm.runInContext(sourceBetween(appSource, 'function assertSyncCloudAttemptCurrent', 'async function syncCloud'), syncGuardContext);

async function simulateGuardedTransaction(context, changeIdentity){
  const writes = [];
  const transaction = {
    async get(){
      changeIdentity(context);
      return {exists:() => true};
    },
    update(){ writes.push('update'); }
  };
  await assert.rejects(async () => {
    context.assertSyncCloudAttemptCurrent('attempt-a', 'uid-a', 'team-a');
    await transaction.get();
    context.assertSyncCloudAttemptCurrent('attempt-a', 'uid-a', 'team-a');
    transaction.update();
  }, error => error.name === 'SyncCloudAttemptChangedError');
  assert.deepEqual(writes, [], 'Un changement de compte ou de périmètre après transaction.get() doit interrompre la tentative sans écriture.');
}

const syncScopeGuardContext = vm.createContext({
  Error,
  currentUser:{uid:'uid-a'},
  currentScope:'team-a',
  technicalAccessScopeKey(){ return this.currentScope; },
  syncStateService:{isCurrent:() => true}
});
vm.runInContext(sourceBetween(appSource, 'function assertSyncCloudAttemptCurrent', 'async function syncCloud'), syncScopeGuardContext);

const pageContext = vm.createContext({
  storageJson:() => [row('active', 1), row('deleted', 2, {deleted:true})],
  TECHNICAL_ROWS_KEY:'coachStatsV13Rows'
});
vm.runInContext(`${sourceFunction(pageSource, 'rowFinalized')};${sourceFunction(pageSource, 'localRows')};`, pageContext);
assert.equal(pageContext.rowFinalized(row('deleted', 2, {deleted:true})), false);
assert.deepEqual(Array.from(pageContext.localRows(), item => item.technicalTestId), ['active']);

(async () => {
  await simulateGuardedTransaction(syncGuardContext, context => { context.currentUser = {uid:'uid-b'}; });
  await simulateGuardedTransaction(syncScopeGuardContext, context => { context.currentScope = 'team-b'; });
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

  await assert.rejects(
    () => reconcileContext.reconcileLegacyTechnicalTests({coachStatsV13Rows:JSON.stringify([{date:'08/06/2026', playerName:'Ligne historique'}])}, {uid:'uid-a', scope:'team-a'}),
    error => error.name === 'TechnicalTestsReconciliationError' && error.unresolved?.[0]?.reason === 'protected-idless-row',
    'La ligne sans ID du 08/06/2026 ne doit jamais être retirée automatiquement.'
  );

  const mergeContext = vm.createContext({Set, FIRESTORE_MANAGED_LOCAL_KEYS:new Set(['coachStatsV13Rows', 'coachStatsV170']), CLOUD_SYNC_LOCAL_ONLY_KEYS:new Set()});
  vm.runInContext(sourceBetween(appSource, 'function mergedCommonBaseItems', 'function countLocalDataItems'), mergeContext);
  const independentlyMerged = mergeContext.mergedCommonBaseItems(
    {coachStatsV13Rows:'technical-history', coachStatsV170:'match-history', preference:'kept'},
    {localDraft:'pending'},
    {removableLegacyKeys:new Set(['coachStatsV170'])}
  );
  assert.equal(independentlyMerged.coachStatsV13Rows, 'technical-history', 'Une preuve technique manquante ne doit pas retirer la clé technique.');
  assert.equal(Object.hasOwn(independentlyMerged, 'coachStatsV170'), false, 'Une autre clé prouvée doit pouvoir être retirée indépendamment.');
  assert.equal(independentlyMerged.localDraft, 'pending', 'Les données locales en attente doivent rester dans le payload.');

  const syncFunctions = [
    sourceBetween(appSource, 'function mergedCommonBaseItems', 'function countLocalDataItems'),
    sourceBetween(appSource, 'function technicalReconciliationFingerprint', 'function technicalAccessScopeKey'),
    sourceBetween(appSource, 'function assertSyncCloudAttemptCurrent', 'async function pullCloud')
  ].join('\n');
  const canonicalRows = Array.from({length:48}, (_, index) => row(`technical-${index}`, index + 1, {
    comment:`Résultat technique ${index}`,
    finalized:true,
    status:'finalized'
  }));
  const legacyRows = canonicalRows.map(source => ({...source}));
  const targetInitialBytes = 995859;
  const initialPayload = padding => ({
    version:'CoachPulse PWA', savedAt:'2026-11-25T10:00:00.000Z', user:{uid:'uid-a'},
    items:{sharedModule:{kept:true, label:'donnée commune'}, coachStatsV13Rows:JSON.stringify(legacyRows.map((item, index) => index ? item : {...item, legacyPadding:'x'.repeat(padding)}))}
  });
  const baseBytes = firestorePayloadService.inspectSize(initialPayload(0)).bytes;
  const oversizedPayload = initialPayload(targetInitialBytes - baseBytes);
  const oversizedInspection = firestorePayloadService.inspectSize(oversizedPayload);
  assert.equal(oversizedInspection.bytes, targetInitialBytes, 'Le document synthétique doit reproduire exactement les 995859 octets estimés.');
  assert.throws(
    () => firestorePayloadService.prepare(oversizedPayload, {rootPath:'$', maxBytes:900 * 1024}),
    error => error.name === 'FirestorePayloadError'
      && error.path === '$.items.coachStatsV13Rows'
      && error.reason.includes('document estimé à 995859 octets (budget 921600)'),
    'Avant réconciliation, le payload legacy doit reproduire le dépassement initial exact.'
  );

  async function runSyncScenario(cloudRows, initialDocument=oversizedPayload){
    const commonDocument = structuredClone(initialDocument);
    const technicalTests = structuredClone(cloudRows);
    const writes = [];
    const storageState = new Map();
    const syncState = {
      token:'attempt-sync-cloud', current:true, confirmed:false, failed:false,
      markSyncing(){ return {operationToken:this.token}; },
      isCurrent(token){ return this.current && token === this.token; },
      confirm(){ this.confirmed = true; return {accepted:true}; },
      fail(_operation, error){ this.failed = true; this.error = error; return {accepted:true}; },
      declareLocal(){}
    };
    const context = vm.createContext({
      Error, Array, Date, JSON, Map, Set, Object, Promise, String, TextEncoder, structuredClone,
      console, navigator:{onLine:true}, applyingCloud:false, db:{kind:'mock-firestore'},
      currentUser:{uid:'uid-a', email:'coach@example.test'}, CLIENT_ID:'behavior-test-client',
      FIRESTORE_MANAGED_LOCAL_KEYS:new Set(['coachStatsV13Rows']), CLOUD_SYNC_LOCAL_ONLY_KEYS:new Set(),
      firestorePayloadService, syncStateService:syncState,
      snapshotLocalData(){}, updateSyncState(){}, updateCloudKpis(){}, notifySuccess(){}, notifyError(){},
      safeLoadingCall(){ return {end(){}, fail(){}}; }, loadingFailureContext(){ return {}; },
      cleanError(error){ return error.message; }, debugPerfEnabled(){ return false; },
      getCloudRef(){ return {path:'coachpulse_common_base/uid-a'}; },
      buildPayload(){ return {version:'CoachPulse PWA', savedAt:'2026-11-25T10:00:01.000Z', user:{uid:'uid-a'}, items:{localModule:{kept:true}}}; },
      collectLocalStorage(){ return {localModule:{kept:true}}; },
      localTechnicalPayload(){ return []; },
      technicalAccessScopeKey(){ return 'all'; },
      listPlayers:async () => [],
      normalizeTechnicalRows(rows){ return rows.map(item => ({...item, reconciliationSourceId:item.reconciliationSourceId || item.technicalTestId})); },
      normalizeTechnicalRowsForReconciliation(rows){ return rows.map(item => ({...item, reconciliationSourceId:item.reconciliationSourceId || item.technicalTestId})); },
      technicalRowStorageId(item, fallback=''){ return String(item.technicalTestId || item.testId || item.id || fallback); },
      technicalListData:async filters => {
        filters.reconciliationProof({
          uid:'uid-a', scope:'all', attempt:filters.reconciliationAttempt, complete:true,
          serverConfirmed:true, hasPendingWrites:false,
          rows:technicalTests.map(item => ({...item, reconciliationSourceId:item.technicalTestId})), deletedIds:[]
        });
        return technicalTests;
      },
      hashItems(value){ return String(firestorePayloadService.inspectSize(value).bytes); },
      storage:{
        set(key, value){ storageState.set(key, value); }, clearPendingSync(){ storageState.set('pending', false); },
        markPendingSync(){ storageState.set('pending', true); }
      },
      firebaseFns:{
        getDocFromServer:async () => ({exists:() => true, data:() => structuredClone(commonDocument)}),
        serverTimestamp:() => 'mock-server-timestamp', waitForPendingWrites:async () => {},
        runTransaction:async (_db, callback) => callback({
          get:async () => ({exists:() => true, data:() => structuredClone(commonDocument)}),
          update(_ref, document){ writes.push(structuredClone(document)); Object.assign(commonDocument, structuredClone(document)); },
          set(_ref, document){ writes.push(structuredClone(document)); Object.assign(commonDocument, structuredClone(document)); }
        })
      }
    });
    vm.runInContext(syncFunctions, context);
    await context.syncCloud(false);
    await Promise.resolve();
    return {commonDocument, technicalTests, writes, storageState, syncState};
  }

  const success = await runSyncScenario(canonicalRows);
  assert.equal(success.writes.length, 1, `La synchronisation globale doit effectuer une écriture Firestore unique (${success.syncState.error?.stack || 'sans erreur'}).`);
  assert.equal(Object.hasOwn(success.commonDocument.items, 'coachStatsV13Rows'), false, 'La clé legacy doit être supprimée après preuve complète.');
  assert.deepEqual(success.commonDocument.items.sharedModule, {kept:true, label:'donnée commune'});
  assert.deepEqual(success.commonDocument.items.localModule, {kept:true});
  assert.deepEqual(success.technicalTests, canonicalRows, 'Chaque résultat technique doit rester conservé dans technicalTests.');
  const finalBytes = firestorePayloadService.inspectSize(success.writes[0]).bytes;
  assert.ok(finalBytes < 900 * 1024, `Le payload réconcilié (${finalBytes} octets) doit rester sous 900 Kio.`);
  assert.equal(success.storageState.get('pending'), false);
  assert.equal(success.syncState.failed, false);

  for(const unsafeRows of [canonicalRows.slice(0, -1), canonicalRows.map((item, index) => index === 0 ? {...item, comment:'divergent'} : item)]){
    const unsafe = await runSyncScenario(unsafeRows);
    assert.equal(unsafe.writes.length, 0, 'Une preuve manquante ou divergente ne doit produire aucune écriture destructive.');
    assert.equal(Object.hasOwn(unsafe.commonDocument.items, 'coachStatsV13Rows'), true, 'La clé legacy doit être conservée si la preuve échoue.');
    assert.deepEqual(unsafe.commonDocument.items.sharedModule, {kept:true, label:'donnée commune'});
    assert.equal(unsafe.storageState.get('pending'), true);
    assert.equal(unsafe.syncState.failed, true);
  }
  const compactLegacy = {
    version:'CoachPulse PWA', savedAt:'2026-11-25T10:00:00.000Z', user:{uid:'uid-a'},
    items:{sharedModule:{kept:true}, coachStatsV13Rows:JSON.stringify(legacyRows)}
  };
  const incompleteButIndependent = await runSyncScenario(canonicalRows.slice(0, -1), compactLegacy);
  assert.equal(incompleteButIndependent.writes.length, 1, 'Une preuve technique incomplète ne doit pas bloquer les autres écritures autorisées si le payload reste sous budget.');
  assert.equal(incompleteButIndependent.commonDocument.items.coachStatsV13Rows, compactLegacy.items.coachStatsV13Rows, 'Le snapshot technique non qualifié doit rester strictement inchangé.');
  assert.deepEqual(incompleteButIndependent.commonDocument.items.localModule, {kept:true}, 'La donnée locale indépendante doit être synchronisée.');
  assert.equal(incompleteButIndependent.syncState.failed, false);
  console.log(`syncCloud payload: ${targetInitialBytes} -> ${finalBytes} bytes; ${canonicalRows.length} technical results preserved.`);
  console.log('Technical tests sync behavioral scenarios passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
