const assert = require('node:assert/strict');
const fs = require('node:fs');

function idbRequest(operation){
  const request = {};
  setTimeout(() => {
    try{ request.result = operation(); request.onsuccess?.(); }
    catch(error){ request.error = error; request.onerror?.(); }
  }, 0);
  return request;
}
function fakeIndexedDb(){
  const rows = new Map();
  return {rows, open(){
    const request = {};
    setTimeout(() => {
      request.result = {
        objectStoreNames:{contains:() => true}, createObjectStore(){}, close(){},
        transaction(){ return {objectStore(){ return {
          get:key => idbRequest(() => rows.get(key)),
          put:value => idbRequest(() => (rows.set(value.key, structuredClone(value)), value.key))
        }; }}; }
      };
      request.onsuccess?.();
    }, 0);
    return request;
  }};
}
class Storage {
  constructor({quota=false}={}){ this.quota = quota; this.values = new Map(); }
  get length(){ return this.values.size; }
  key(index){ return [...this.values.keys()][index] || null; }
  getItem(key){ return this.values.has(key) ? this.values.get(key) : null; }
  removeItem(key){ this.values.delete(key); }
  setItem(key, value){
    if(this.quota) throw Object.assign(new Error('quota exceeded'), {name:'QuotaExceededError', code:22});
    this.values.set(key, String(value));
  }
}
function loadStorage(localStorage, indexedDB){
  global.localStorage = localStorage;
  global.indexedDB = indexedDB;
  delete require.cache[require.resolve('../shared/utils/storage-service.js')];
  return require('../shared/utils/storage-service.js');
}

(async () => {
  const key = 'coachpulse:presenceEvents:v1';
  const pending = [{
    id:'presence-event-pending', sessionId:'presence-session-pending', status:'late', minutes:17,
    comment:'Transport', updatedAt:'2026-11-09T10:05:00.000Z', syncMarker:'retry-1',
    attendance:{p1:{status:'late', minutes:17, comment:'Transport', attendanceId:'a1', playerSnapshot:{playerId:'p1'}}}
  }];
  const db = fakeIndexedDb();
  const saturated = new Storage({quota:true});
  let service = loadStorage(saturated, db);
  const quotaResult = await service.setDurableJson(key, pending);
  assert.equal(quotaResult.indexedDbSaved, true, 'QuotaExceededError doit basculer vers IndexedDB');
  assert.equal(quotaResult.localStorageSaved, false);
  assert.equal(quotaResult.ok, true);

  service = loadStorage(saturated, db);
  const reload = await service.getDurableJson(key, []);
  assert.equal(reload.source, 'indexedDB');
  assert.deepEqual(reload.value, pending, 'IDs, pending, statuts, minutes, commentaires et marqueurs doivent être intacts');

  const availableLocal = new Storage();
  availableLocal.setItem(key, JSON.stringify([{id:'stale-local', updatedAt:'2026-11-09T09:00:00.000Z'}]));
  availableLocal.setItem(`${key}:durableMeta`, JSON.stringify({revision:1}));
  service = loadStorage(availableLocal, db);
  const conflict = await service.getDurableJson(key, []);
  assert.equal(conflict.value[0].id, 'presence-event-pending', 'localStorage ancien ne doit pas écraser IndexedDB');

  const changed = structuredClone(conflict.value);
  Object.assign(changed[0], {status:'present', minutes:75, comment:'Modifié hors ligne', updatedAt:'2026-11-09T10:10:00.000Z'});
  delete changed[0].cloudSyncedAt;
  assert.equal((await service.setDurableJson(key, changed)).ok, true);
  service = loadStorage(availableLocal, db);
  assert.deepEqual((await service.getDurableJson(key, [])).value, changed, 'la modification hors ligne doit survivre au rechargement');

  service = loadStorage(new Storage(), undefined);
  const localOnly = await service.setDurableJson(key, pending);
  assert.equal(localOnly.ok, true, 'localStorage reste un fallback si IndexedDB est indisponible');
  assert.equal(localOnly.indexedDbSaved, false);
  assert.equal(localOnly.localStorageSaved, true);

  service = loadStorage(new Storage({quota:true}), undefined);
  assert.equal((await service.setDurableJson(key, pending)).ok, false, 'l’échec des deux stockages doit être explicite');
  assert(!JSON.stringify(reload.value).includes('data:image'), 'aucune photo Base64 ne doit être réintroduite');

  const pageSource = fs.readFileSync('pages/presences.html', 'utf8');
  assert(pageSource.includes('await hydratePresenceEventsFromDurableStorage();'));
  assert(pageSource.includes('await markPresenceEventsSynced(syncedIds);'), 'la reconnexion doit persister le marqueur sans nouvelle modification');
  assert(pageSource.includes('if(!await savePresenceEvents(nextEvents))'), 'le formulaire doit attendre la persistance durable');
  console.log('Presence durable storage checks passed: quota, reload, offline edit, reconnect marker, unavailable IDB, conflict and pending integrity.');
})().catch(error => { console.error(error); process.exitCode = 1; });
