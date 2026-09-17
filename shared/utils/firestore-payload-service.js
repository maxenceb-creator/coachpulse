// CoachPulse Firestore payload boundary.
// Rebuilds JSON-like values in the current realm before they reach the Web SDK.
(function(global){
  const OMIT = Symbol('coachpulse.firestore.omit');
  const FIRESTORE_ATOMIC_TYPES = new Set(['Timestamp', 'GeoPoint', 'DocumentReference', 'Bytes', 'FieldValue']);

  class FirestorePayloadError extends Error {
    constructor(message, details={}){
      super(message);
      this.name = 'FirestorePayloadError';
      this.path = details.path || '$';
      this.valueType = details.valueType || 'unknown';
      this.reason = details.reason || message;
    }
  }
  function valueType(value){
    if(value === null) return 'null';
    if(Array.isArray(value)) return 'array';
    return value?.constructor?.name || typeof value;
  }
  function childPath(path, key){
    return /^[A-Za-z_$][\w$]*$/.test(String(key)) ? `${path}.${key}` : `${path}[${JSON.stringify(String(key))}]`;
  }
  function invalid(path, value, reason){
    throw new FirestorePayloadError(`Payload Firestore invalide à ${path} : ${reason}.`, {path, valueType:valueType(value), reason});
  }
  function isDomNode(value){
    return !!value && typeof value === 'object' && (
      (typeof global.Node === 'function' && value instanceof global.Node)
      || (Number.isInteger(value.nodeType) && typeof value.nodeName === 'string')
    );
  }
  function isFirestoreAtomic(value){
    const name = value?.constructor?.name || '';
    if(!FIRESTORE_ATOMIC_TYPES.has(name)) return false;
    if(name === 'Timestamp') return typeof value.toDate === 'function' && typeof value.toMillis === 'function';
    if(name === 'GeoPoint') return Number.isFinite(value.latitude) && Number.isFinite(value.longitude);
    if(name === 'DocumentReference') return typeof value.path === 'string' && !!value.firestore;
    return true;
  }
  function sanitizeValue(value, path, ancestors, options){
    const type = typeof value;
    if(value === undefined || type === 'function' || type === 'symbol') return OMIT;
    if(value === null || type === 'string' || type === 'boolean') return value;
    if(type === 'number'){
      if(!Number.isFinite(value)) invalid(path, value, 'nombre non fini');
      return value;
    }
    if(type === 'bigint') invalid(path, value, 'BigInt non pris en charge');
    if(type !== 'object') invalid(path, value, `type ${type} non pris en charge`);
    if(isDomNode(value)) invalid(path, value, 'nœud DOM non sérialisable');
    if(options.preserveFirestoreTypes !== false && isFirestoreAtomic(value)) return value;
    const tag = Object.prototype.toString.call(value);
    if(tag === '[object Date]'){
      const time = value.getTime();
      if(!Number.isFinite(time)) invalid(path, value, 'date invalide');
      return new Date(time).toISOString();
    }
    if(ancestors.has(value)) invalid(path, value, 'référence circulaire');
    ancestors.add(value);
    try{
      if(Array.isArray(value)){
        const output = [];
        Array.from(value).forEach((item, index) => {
          const safe = sanitizeValue(item, `${path}[${index}]`, ancestors, options);
          if(safe !== OMIT) output.push(safe);
        });
        return output;
      }
      if(tag === '[object Set]'){
        const output = [];
        Array.from(value.values()).forEach((item, index) => {
          const safe = sanitizeValue(item, `${path}[${index}]`, ancestors, options);
          if(safe !== OMIT) output.push(safe);
        });
        return output;
      }
      const source = tag === '[object Map]' ? Object.fromEntries(value.entries()) : value;
      const output = {};
      Object.keys(source).forEach(key => {
        let item;
        try{ item = source[key]; }
        catch(error){ invalid(childPath(path, key), source, `propriété illisible (${error?.message || 'erreur'})`); }
        const safe = sanitizeValue(item, childPath(path, key), ancestors, options);
        if(safe !== OMIT) output[key] = safe;
      });
      return output;
    }finally{
      ancestors.delete(value);
    }
  }
  function sanitize(value, options={}){
    const safe = sanitizeValue(value, options.rootPath || '$', new WeakSet(), options);
    return safe === OMIT ? undefined : safe;
  }
  function byteLength(value){
    return new TextEncoder().encode(String(value)).length;
  }
  function inspectSize(value, path='$'){
    if(value === null) return {bytes:1, largest:{path, bytes:1}};
    if(typeof value !== 'object'){
      const bytes = byteLength(value);
      return {bytes, largest:{path, bytes}};
    }
    let bytes = Array.isArray(value) ? 2 : 2;
    let largest = {path, bytes:0};
    Object.keys(value).forEach(key => {
      const nested = inspectSize(value[key], Array.isArray(value) ? `${path}[${key}]` : childPath(path, key));
      bytes += byteLength(key) + nested.bytes + 2;
      if(nested.largest.bytes > largest.bytes) largest = nested.largest;
    });
    return {bytes, largest};
  }
  function validate(value, options={}){
    try{
      const safe = sanitize(value, options);
      if(Number.isFinite(options.maxBytes)){
        const size = inspectSize(safe, options.rootPath || '$');
        if(size.bytes > options.maxBytes){
          invalid(size.largest.path, safe, `document estimé à ${size.bytes} octets (budget ${options.maxBytes})`);
        }
      }
      return {valid:true, value:safe, issues:[]};
    }
    catch(error){
      if(!(error instanceof FirestorePayloadError)) throw error;
      return {valid:false, value:undefined, issues:[{path:error.path, valueType:error.valueType, reason:error.reason, message:error.message}]};
    }
  }
  function prepare(value, options={}){
    const result = validate(value, options);
    if(!result.valid) throw new FirestorePayloadError(result.issues[0].message, result.issues[0]);
    return result.value;
  }
  const service = {FirestorePayloadError, sanitize, validate, prepare, inspectSize};
  global.CoachPulseFirestorePayload = service;
  if(typeof module !== 'undefined' && module.exports) module.exports = service;
})(typeof window !== 'undefined' ? window : globalThis);
