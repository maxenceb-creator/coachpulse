// CoachPulse shared storage service.
// Centralizes localStorage access and keeps an in-memory fallback for restricted browsers.

(function(global){
  const memory = new Map();
  const BACKUP_KEY_PREFIX = 'coachpulse:autoBackup';
  const LAST_AUTOSAVE_KEY = 'coachpulse:lastAutoSave';

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

  function clearNonEssentialBackups(){
    keys()
      .filter(key => key.startsWith(BACKUP_KEY_PREFIX) || key === LAST_AUTOSAVE_KEY)
      .forEach(remove);
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
      clearNonEssentialBackups();
      try{
        store.setItem(key, nextValue);
        return true;
      }catch(secondError){
        if(!isQuotaError(secondError)) throw secondError;
        console.warn('CoachPulse storage quota reached, value kept in memory for', key, secondError);
        return false;
      }
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
    isQuotaError,
    clearNonEssentialBackups,
    isPendingSync,
    markPendingSync,
    clearPendingSync
  };

  global.CoachPulseStorage = service;
  if(typeof module !== 'undefined' && module.exports) module.exports = service;
})(typeof window !== 'undefined' ? window : globalThis);
