const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('shared/utils/client-write-protocol.js', 'utf8');

function contextFor(minimumWriteProtocol){
  const values = new Map([
    ['coachStatsPostMatchDraftV1', '{"draft":true}'],
    ['coachpulse:pendingSync', '1'],
    ['ordinary-cache', 'reconstructible']
  ]);
  const localStorage = {
    get length(){ return values.size; },
    key(index){ return [...values.keys()][index] || null; },
    getItem(key){ return values.get(key) ?? null; }
  };
  const context = vm.createContext({
    console, Date, Blob, URL, setTimeout, clearTimeout, localStorage,
    fetch:async()=>({ok:true, json:async()=>({minimumWriteProtocol})})
  });
  context.globalThis = context;
  vm.runInContext(source, context);
  return context;
}

(async()=>{
  const compatible = contextFor(2);
  const result = await compatible.CoachPulseClientWriteProtocol.assertCompatible({force:true});
  assert.equal(result.compatible, true);

  const obsolete = contextFor(3);
  await assert.rejects(
    obsolete.CoachPulseClientWriteProtocol.assertCompatible({force:true}),
    error => error.code === 'CLIENT_WRITE_PROTOCOL_OBSOLETE' && error.obsoleteClient === true
  );
  const backup = obsolete.CoachPulseClientWriteProtocol.collectLocalBackup();
  assert.equal(backup.items['coachStatsPostMatchDraftV1'], '{"draft":true}');
  assert.equal(backup.items['coachpulse:pendingSync'], '1');
  assert.equal(backup.items['ordinary-cache'], undefined);
  assert.equal(valuesAfterBackupWasNotDeleted(backup), true);
  console.log('Client write protocol compatibility and local draft backup checks passed.');
})().catch(error=>{ console.error(error); process.exitCode=1; });

function valuesAfterBackupWasNotDeleted(backup){
  return Object.keys(backup.items).length === 2;
}
