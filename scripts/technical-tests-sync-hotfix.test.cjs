const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const appSource = fs.readFileSync('app.js', 'utf8');
const pageSource = fs.readFileSync('pages/tests-techniques.html', 'utf8');

function sourceBetween(start, end){
  const from = appSource.indexOf(start);
  const to = appSource.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `Bloc introuvable: ${start}`);
  return appSource.slice(from, to);
}

const context = vm.createContext({JSON, Map, Object});
context.technicalRowStorageId = row => String(row.technicalTestId || row.testId || row.id || '').trim();
vm.runInContext(sourceBetween('function technicalReconciliationFingerprint', 'async function reconcileLegacyTechnicalTests'), context);

const row = (id, score, extra={}) => ({technicalTestId:id, playerId:'player-a', teamId:'team-a', date:'2026-11-20', season:'2026-2027', tests:{max_pfp:score}, ...extra});

// Avant hotfix, une seule clé technique synthétique suffit à dépasser 900 Kio.
const oversized = {items:{coachStatsV13Rows:JSON.stringify([row('large', 12, {blob:'x'.repeat(930 * 1024)})])}};
assert.ok(Buffer.byteLength(JSON.stringify(oversized)) > 900 * 1024);

const confirmedPlan = context.technicalLegacyReconciliationPlan([row('same', 12)], [row('same', 12)]);
assert.equal(confirmedPlan.confirmed, true, 'Une copie identique dans technicalTests doit autoriser le retrait legacy.');
assert.equal(confirmedPlan.total, 1);
assert.equal(confirmedPlan.unresolved.length, 0);
assert.equal(context.technicalLegacyReconciliationPlan([row('legacy-only', 12)], []).unresolved[0].reason, 'legacy-only');
assert.equal(context.technicalLegacyReconciliationPlan([row('conflict', 12)], [row('conflict', 13, {updatedAtIso:'2026-11-25T12:00:00Z'})]).unresolved[0].reason, 'conflict');
assert.equal(context.technicalLegacyReconciliationPlan([row('deleted', 12)], [], ['deleted']).confirmed, true, 'Un tombstone dédié doit empêcher la recréation d’un test supprimé.');

const collectSource = sourceBetween('function collectLocalStorage()', 'function purgeUnauthorizedLocalData');
const collectContext = vm.createContext({
  Object,
  storage:{entries:({exclude}) => [['coachStatsV13Rows','large'], ['legacyOther','kept']].filter(([key]) => !exclude(key))},
  FIRESTORE_MANAGED_LOCAL_KEYS:new Set(['coachStatsV13Rows']),
  CLOUD_SYNC_LOCAL_ONLY_KEYS:new Set(['coachpulse:technicalTestsPending'])
});
vm.runInContext(`${collectSource};this.items=collectLocalStorage();`, collectContext);
assert.equal(collectContext.items.coachStatsV13Rows, undefined);
assert.equal(collectContext.items.legacyOther, 'kept', 'Les autres clés legacy ne doivent pas régresser.');

assert.ok(appSource.includes("if(key === 'coachStatsV13Rows' && !technicalLegacyCloudItemConfirmed) preserved[key] = value"), 'La copie cloud doit rester tant que la réconciliation n’est pas confirmée.');
assert.ok(appSource.includes("localRow?.syncPending !== true"), 'Une lecture cloud ne doit pas écraser une écriture locale en attente.');
assert.ok(appSource.includes("currentUser?.uid || 'anonymous'"), 'Le cache technique doit rester isolé par compte.');
assert.ok(appSource.includes("getAuthorizedTeamIds().slice().sort().join(',')"), 'Le cache technique doit rester isolé par équipe.');
const deleteSource = /async function technicalDeleteTest[\s\S]*?function presenceUiStatusFromCode/.exec(appSource)[0];
assert.ok(deleteSource.includes("deleted:true") && deleteSource.includes("await firebaseFns.setDoc(firebaseFns.doc(db, 'technicalTests'"), 'Une suppression doit créer un tombstone dédié avant le nettoyage local.');
assert.ok(!deleteSource.includes('.catch('), 'Un échec de suppression Firestore ne doit plus être avalé.');
assert.ok(appSource.includes("if(stored === false) throw new Error('Sauvegarde locale des tests techniques impossible."), 'Un échec de sauvegarde locale doit interrompre le flux.');
assert.ok(pageSource.includes('pendingRowsFromBackup()') && pageSource.includes('pendingRowsFromAutoBackup()'), 'Les brouillons doivent survivre au rechargement.');
assert.ok(pageSource.includes('recoverPendingRows()') && pageSource.includes('loadTechnicalData(true'), 'Les écritures en attente doivent être récupérées et les données dédiées relues après reconnexion/rechargement.');

console.log('Technical tests sync hotfix scenarios passed.');
