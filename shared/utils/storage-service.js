// CoachPulse shared storage service.
// Centralizes localStorage access and keeps an in-memory fallback for restricted browsers.

(function(global){
  const memory = new Map();
  const BACKUP_KEY_PREFIX = 'coachpulse:autoBackup';
  const LAST_AUTOSAVE_KEY = 'coachpulse:lastAutoSave';
  const DURABLE_DB_NAME = 'coachpulse-durable-storage';
  const DURABLE_STORE_NAME = 'snapshots';
  const durableRevisions = new Map();
  const durableWriteChains = new Map();

  function localStore(){
    try{
      return global.localStorage || null;
    }catch(_e){
      return null;
    }
  }

  function available(){
    const store = localStore();
    if(!store) return false;
    try{
      const probe = '__coachpulse_storage_probe__';
      store.setItem(probe, '1');
      store.removeItem(probe);
      return true;
    }catch(_e){
      return false;
    }
  }

  function isQuotaError(error){
    return !!error && (
      error.name === 'QuotaExceededError'
      || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      || error.code === 22
      || error.code === 1014
      || /quota/i.test(String(error.message || ''))
    );
  }

  function keys(){
    const all = new Set(memory.keys());
    const store = localStore();
    if(store){
      try{
        for(let i = 0; i < store.length; i += 1){
          const key = store.key(i);
          if(key) all.add(key);
        }
      }catch(_e){}
    }
    return [...all];
  }

  function get(key, fallback=''){
    const store = localStore();
    if(store){
      try{
        const value = store.getItem(key);
        if(value !== null && value !== undefined) return value;
      }catch(_e){}
    }
    return memory.has(key) ? memory.get(key) : fallback;
  }

  function clearNonEssentialBackups(options={}){
    const preserved = new Set(options.preserve || []);
    keys()
      .filter(key => !preserved.has(key) && (key.startsWith(BACKUP_KEY_PREFIX) || key === LAST_AUTOSAVE_KEY))
      .forEach(remove);
  }

  function serializedBytes(value){
    const text = String(value ?? '');
    try{ return new TextEncoder().encode(text).length; }
    catch(_e){ return text.length * 2; }
  }

  function usage(){
    const store = localStore();
    const rows = [];
    if(store){
      try{
        for(let i = 0; i < store.length; i += 1){
          const key = store.key(i);
          if(key) rows.push({key, bytes:serializedBytes(key) + serializedBytes(store.getItem(key) || '')});
        }
      }catch(_e){}
    }
    return {type:store ? 'localStorage' : 'memory', bytes:rows.reduce((sum, row) => sum + row.bytes, 0), items:rows.sort((a,b) => b.bytes - a.bytes)};
  }

  function set(key, value, options={}){
    const nextValue = String(value);
    memory.set(key, nextValue);
    const store = localStore();
    if(!store) return false;
    try{
      store.setItem(key, nextValue);
      return true;
    }catch(error){
      if(!options.recover || !isQuotaError(error)) throw error;
      let secondError = error;
      if(typeof options.cleanup === 'function'){
        try{ options.cleanup({key, value:nextValue, usage:usage()}); }catch(_cleanupError){}
        try{
          store.setItem(key, nextValue);
          return true;
        }catch(thirdError){
          if(!isQuotaError(thirdError)) throw thirdError;
          secondError = thirdError;
        }
      }
      console.warn('CoachPulse storage quota reached, value kept in memory only for', key, secondError);
      return false;
    }
  }

  function remove(key){
    memory.delete(key);
    const store = localStore();
    if(!store) return false;
    try{
      store.removeItem(key);
      return true;
    }catch(_e){
      return false;
    }
  }

  function removeWhere(predicate){
    keys().filter(predicate).forEach(remove);
  }

  function entries(options={}){
    return keys()
      .filter(key => !(options.exclude && options.exclude(key)))
      .map(key => [key, get(key, '')]);
  }

  function getJson(key, fallback){
    const raw = get(key, null);
    if(raw === null || raw === undefined || raw === '') return fallback;
    try{ return JSON.parse(raw); }
    catch(_e){ return fallback; }
  }

  function setJson(key, value, options={}){
    return set(key, JSON.stringify(value), options);
  }

  function durableMetaKey(key){ return `${key}:durableMeta`; }

  function openDurableDb(){
    return new Promise((resolve, reject) => {
      if(!global.indexedDB) return reject(Object.assign(new Error('IndexedDB indisponible'), {code:'storage/indexeddb-unavailable'}));
      let request;
      try{ request = global.indexedDB.open(DURABLE_DB_NAME, 1); }
      catch(error){ reject(error); return; }
      request.onupgradeneeded = () => {
        const db = request.result;
        if(!db.objectStoreNames.contains(DURABLE_STORE_NAME)) db.createObjectStore(DURABLE_STORE_NAME, {keyPath:'key'});
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Ouverture IndexedDB impossible'));
      request.onblocked = () => reject(Object.assign(new Error('Ouverture IndexedDB bloquée'), {code:'storage/indexeddb-blocked'}));
    });
  }

  async function durableDbRequest(mode, operation){
    const db = await openDurableDb();
    try{
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(DURABLE_STORE_NAME, mode);
        const request = operation(transaction.objectStore(DURABLE_STORE_NAME));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || transaction.error || new Error('Écriture IndexedDB impossible'));
        transaction.onabort = () => reject(transaction.error || new Error('Transaction IndexedDB annulée'));
      });
    }finally{
      try{ db.close(); }catch(_error){}
    }
  }

  function readLocalDurableSnapshot(key, fallback){
    const raw = get(key, null);
    let value = fallback;
    if(raw !== null && raw !== undefined && raw !== ''){
      try{ value = JSON.parse(raw); }catch(_error){}
    }
    let revision = 0;
    try{
      const meta = JSON.parse(localStore()?.getItem(durableMetaKey(key)) || 'null');
      revision = Number(meta?.revision) || 0;
    }catch(_error){}
    return {key, revision, value, source:'localStorage'};
  }

  async function getDurableJson(key, fallback){
    const local = readLocalDurableSnapshot(key, fallback);
    let indexed = null;
    try{ indexed = await durableDbRequest('readonly', store => store.get(key)); }
    catch(error){ console.warn('[CoachPulse persistence] Lecture IndexedDB indisponible', error); }
    const validIndexed = indexed && Number(indexed.revision) > 0 && Object.prototype.hasOwnProperty.call(indexed, 'value');
    const chosen = validIndexed && Number(indexed.revision) >= local.revision
      ? {...indexed, source:'indexedDB'}
      : local;
    durableRevisions.set(key, Math.max(local.revision, Number(indexed?.revision) || 0));
    memory.set(key, JSON.stringify(chosen.value));
    return chosen;
  }

  function setDurableJson(key, value){
    const previous = durableWriteChains.get(key) || Promise.resolve();
    const write = previous.catch(() => {}).then(async () => {
      const revision = Math.max(Date.now(), (durableRevisions.get(key) || 0) + 1);
      const snapshot = {key, revision, savedAt:new Date(revision).toISOString(), value};
      memory.set(key, JSON.stringify(value));
      let indexedDbSaved = false;
      let localStorageSaved = false;
      let indexedDbError = null;
      let localStorageError = null;
      try{
        await durableDbRequest('readwrite', store => store.put(snapshot));
        indexedDbSaved = true;
      }catch(error){ indexedDbError = error; }
      const store = localStore();
      if(store){
        try{
          store.setItem(key, JSON.stringify(value));
          store.setItem(durableMetaKey(key), JSON.stringify({revision, savedAt:snapshot.savedAt}));
          localStorageSaved = true;
        }catch(error){ localStorageError = error; }
      }else{
        localStorageError = Object.assign(new Error('localStorage indisponible'), {code:'storage/localstorage-unavailable'});
      }
      if(indexedDbSaved || localStorageSaved) durableRevisions.set(key, revision);
      return {ok:indexedDbSaved || localStorageSaved, revision, indexedDbSaved, localStorageSaved, indexedDbError, localStorageError};
    }).finally(() => {
      if(durableWriteChains.get(key) === write) durableWriteChains.delete(key);
    });
    durableWriteChains.set(key, write);
    return write;
  }

  function isPendingSync(){
    return get('coachpulse:pendingSync') === '1';
  }

  function markPendingSync(){
    return set('coachpulse:pendingSync', '1', {recover:true});
  }

  function clearPendingSync(){
    return remove('coachpulse:pendingSync');
  }

  const service = {
    available,
    get,
    set,
    remove,
    removeWhere,
    keys,
    entries,
    getJson,
    setJson,
    getDurableJson,
    setDurableJson,
    isQuotaError,
    clearNonEssentialBackups,
    usage,
    isPendingSync,
    markPendingSync,
    clearPendingSync
  };

  global.CoachPulseStorage = service;
  if(typeof module !== 'undefined' && module.exports) module.exports = service;
})(typeof window !== 'undefined' ? window : globalThis);
