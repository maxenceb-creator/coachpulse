const assert = require('node:assert/strict');
const {isRetryableStatus, readJson, sha256} = require('./verify-active-firestore-rules.cjs');

function response(status, body = {}){
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  };
}

async function run(){
  assert.equal(sha256('rules'), sha256('rules'), 'Des Rules identiques doivent avoir la même empreinte.');
  assert.notEqual(sha256('rules-a'), sha256('rules-b'), 'Des Rules différentes doivent demander un déploiement.');
  assert.equal(isRetryableStatus(409), false, 'HTTP 409 ne doit jamais être accepté ou retenté sans vérification stricte.');
  assert.equal(isRetryableStatus(503), true, 'HTTP 503 doit être retenté de façon limitée.');

  let calls = 0;
  const recovered = await readJson('https://example.test', 'token', {
    maxAttempts: 3,
    retryDelayMs: 0,
    fetchImpl: async () => {
      calls += 1;
      return calls < 3 ? response(503, {error:'unavailable'}) : response(200, {ok:true});
    }
  });
  assert.deepEqual(recovered, {ok:true});
  assert.equal(calls, 3, 'La récupération doit s’arrêter après le succès dans la limite prévue.');

  calls = 0;
  await assert.rejects(
    readJson('https://example.test', 'token', {
      maxAttempts: 3,
      retryDelayMs: 0,
      fetchImpl: async () => {
        calls += 1;
        return response(503, {error:'unavailable'});
      }
    }),
    /503/
  );
  assert.equal(calls, 3, 'Une erreur de récupération persistante doit arrêter après trois tentatives.');
  console.log('✓ Firestore Rules fingerprint and retry tests passed');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
