(function(global){
  'use strict';
  const STATES=Object.freeze({UNKNOWN:'unknown',LOCAL:'local',SYNCING:'syncing',SYNCED:'synced',ERROR:'error',CONFLICT:'conflict'});
  const PERSISTENCE=Object.freeze({UNKNOWN:'unknown',AVAILABLE:'available',FAILED_PRECONDITION:'failed-precondition',UNIMPLEMENTED:'unimplemented',ERROR:'error'});
  const registries=new Map(), listeners=new Set();
  let activeUid=null, persistence={status:PERSISTENCE.UNKNOWN,durable:false,code:'',message:''};
  let coverage={complete:false,covered:['legacy-cloud-sync'],uncovered:['matchs','présences','tests-techniques','tests-physiques','fiches-individuelles','médical','gestion-utilisateurs','brouillons-applicatifs']};
  let lastSignature='', cycleHadPending=false, notificationSequence=0;
  function registry(uid){if(!registries.has(uid)) registries.set(uid,new Map());return registries.get(uid)}
  function cleanError(error){return String(error?.message||error||'').slice(0,240)}
  function currentOperations(){return activeUid?[...registry(activeUid).values()].map(row=>({...row})):[]}
  function aggregate(operations){
    if(!activeUid)return STATES.UNKNOWN;
    if(operations.some(row=>row.state===STATES.CONFLICT))return STATES.CONFLICT;
    if(operations.some(row=>row.state===STATES.ERROR))return STATES.ERROR;
    if(operations.some(row=>row.state===STATES.SYNCING))return STATES.SYNCING;
    if(operations.some(row=>row.state===STATES.LOCAL))return persistence.durable?STATES.LOCAL:STATES.ERROR;
    if(operations.length&&operations.every(row=>row.state===STATES.SYNCED))return coverage.complete?STATES.SYNCED:STATES.UNKNOWN;
    return STATES.UNKNOWN;
  }
  function snapshot(extra={}){const operations=currentOperations();const counts=operations.reduce((out,row)=>{out[row.state]=(out[row.state]||0)+1;return out},{});return{uid:activeUid,state:aggregate(operations),operations,counts,persistence:{...persistence},coverage:{...coverage,covered:[...coverage.covered],uncovered:[...coverage.uncovered]},notificationSequence,...extra}}
  function emit(reason){const value=snapshot({reason});const signature=JSON.stringify({uid:value.uid,state:value.state,counts:value.counts,persistence:value.persistence.status,coverage:value.coverage.complete,notificationSequence});if(signature===lastSignature)return value;lastSignature=signature;listeners.forEach(listener=>{try{listener(value)}catch(error){console.error('[CoachPulse Sync State] listener',error)}});return value}
  function update(id,state,options={}){if(!activeUid)return snapshot();const operationId=String(id||'').trim();if(!operationId)throw new Error('Un identifiant de synchronisation stable est requis.');const rows=registry(activeUid),previous=rows.get(operationId)||{};rows.set(operationId,{id:operationId,kind:options.kind==='draft'?'draft':'firestore',module:String(options.module||previous.module||'unknown'),state,error:state===STATES.ERROR?cleanError(options.error):'',updatedAt:Date.now()});if(state===STATES.LOCAL||state===STATES.SYNCING)cycleHadPending=true;if(state===STATES.SYNCED&&cycleHadPending){const active=[...rows.values()];if(active.length&&active.every(row=>row.state===STATES.SYNCED)){cycleHadPending=false;notificationSequence+=1}}return emit(`operation:${state}`)}
  function setUser(uid){const next=String(uid||'').trim()||null;if(next===activeUid)return snapshot();activeUid=next;cycleHadPending=false;lastSignature='';return emit('user')}
  function setPersistence(status,options={}){const normalized=Object.values(PERSISTENCE).includes(status)?status:PERSISTENCE.ERROR;persistence={status:normalized,durable:normalized===PERSISTENCE.AVAILABLE,code:String(options.code||''),message:cleanError(options.message||'')};return emit('persistence')}
  function setCoverage(next={}){coverage={complete:next.complete===true,covered:Array.isArray(next.covered)?[...new Set(next.covered.map(String))]:coverage.covered,uncovered:Array.isArray(next.uncovered)?[...new Set(next.uncovered.map(String))]:coverage.uncovered};return emit('coverage')}
  function subscribe(listener,options={}){if(typeof listener!=='function')throw new TypeError('Un abonnement requiert une fonction.');listeners.add(listener);if(options.immediate!==false)listener(snapshot({reason:'subscribe'}));return()=>listeners.delete(listener)}
  function resetForTests(){registries.clear();activeUid=null;persistence={status:PERSISTENCE.UNKNOWN,durable:false,code:'',message:''};coverage={complete:false,covered:['legacy-cloud-sync'],uncovered:['modules-non-couverts']};cycleHadPending=false;notificationSequence=0;lastSignature=''}
  global.CoachPulseSyncState={STATES,PERSISTENCE,setUser,setPersistence,setCoverage,declareLocal:(id,options)=>update(id,STATES.LOCAL,options),markSyncing:(id,options)=>update(id,STATES.SYNCING,options),confirm:(id,options)=>update(id,STATES.SYNCED,options),fail:(id,error,options={})=>update(id,STATES.ERROR,{...options,error}),conflict:(id,error,options={})=>update(id,STATES.CONFLICT,{...options,error}),subscribe,snapshot,resetForTests};
})(typeof window!=='undefined'?window:globalThis);
