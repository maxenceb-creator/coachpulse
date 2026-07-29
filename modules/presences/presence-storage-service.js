(function(){
  "use strict";

  const DATA_KEY = "presenceSeanceV3_6_Excel";
  const META_KEY = "presenceSeanceV3_6_Excel:meta";
  const PENDING_KEY = "coachpulse:pendingSync";
  const CLIENT_ID_KEY = "coachpulse:clientId";

  function clone(value){
    try{return JSON.parse(JSON.stringify(value));}catch(_){return value}
  }

  function parseJson(value, fallback){
    try{return value ? JSON.parse(value) : fallback;}catch(_){return fallback}
  }

  function clientId(){
    try{
      let id = localStorage.getItem(CLIENT_ID_KEY);
      if(!id){
        id = "cp-presences-" + Math.random().toString(36).slice(2) + "-" + Date.now().toString(36);
        localStorage.setItem(CLIENT_ID_KEY, id);
      }
      return id;
    }catch(_){
      return "cp-presences-local";
    }
  }

  function readMeta(){
    return parseJson(localStorage.getItem(META_KEY), null) || {};
  }

  function sessionCount(state){
    return Array.isArray(state?.sessions) ? state.sessions.length : 0;
  }

  function writeMeta(state, reason){
    const previous = readMeta();
    const now = Date.now();
    const meta = {
      updatedAtMs: now,
      updatedAtIso: new Date(now).toISOString(),
      revision: Number(previous.revision || 0) + 1,
      clientId: clientId(),
      reason: reason || "save",
      sessionCount: sessionCount(state)
    };
    localStorage.setItem(META_KEY, JSON.stringify(meta));
    return meta;
  }

  function notifyLocalChange(meta){
    try{localStorage.setItem(PENDING_KEY, "1")}catch(_){}
    try{
      window.parent?.postMessage?.({
        type: "coachpulse-local-change",
        source: "presences",
        key: DATA_KEY,
        meta
      }, "*");
    }catch(_){}
  }

  function load(fallback){
    const stored = parseJson(localStorage.getItem(DATA_KEY), null);
    if(stored && typeof stored === "object") return stored;
    return clone(fallback || {sessions:[], current:null});
  }

  function save(state, options){
    const opts = options || {};
    localStorage.setItem(DATA_KEY, JSON.stringify(state || {sessions:[], current:null}));
    const meta = writeMeta(state, opts.reason);
    if(opts.notify !== false) notifyLocalChange(meta);
    return meta;
  }

  function clear(options){
    const empty = {sessions:[], current:null};
    return save(empty, {...(options || {}), reason: options?.reason || "clear"});
  }

  window.CoachPulsePresenceStorage = {
    DATA_KEY,
    META_KEY,
    load,
    save,
    clear,
    readMeta,
    parseJson
  };
})();
