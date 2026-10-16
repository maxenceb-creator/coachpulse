const assert = require('node:assert/strict');

class QuotaStorage {
  constructor(limit){ this.limit=limit; this.values=new Map(); }
  get length(){ return this.values.size; }
  key(index){ return [...this.values.keys()][index] ?? null; }
  getItem(key){ return this.values.has(key) ? this.values.get(key) : null; }
  removeItem(key){ this.values.delete(key); }
  setItem(key,value){
    const next=String(value);
    const bytes=[...this.values.entries()].reduce((sum,[storedKey,storedValue]) => sum + (storedKey===key ? 0 : storedKey.length+storedValue.length),0)+key.length+next.length;
    if(bytes>this.limit)throw Object.assign(new Error('The quota has been exceeded.'),{name:'QuotaExceededError',code:22});
    this.values.set(key,next);
  }
}

global.localStorage=new QuotaStorage(180);
delete require.cache[require.resolve('../shared/utils/storage-service.js')];
const storage=require('../shared/utils/storage-service.js');

storage.set('coachpulse:autoBackup:v5','recoverable-old-copy');
storage.set('coachStatsPostMatchDraftV1','durable-draft');
const stored=storage.set('coachpulse:autoBackup:v6','x'.repeat(200),{recover:true});
assert.equal(stored,false);
assert.equal(global.localStorage.getItem('coachpulse:autoBackup:v5'),'recoverable-old-copy','Une sauvegarde existante ne doit pas être supprimée sur quota.');
assert.equal(global.localStorage.getItem('coachStatsPostMatchDraftV1'),'durable-draft','Le brouillon existant ne doit pas être supprimé sur quota.');
assert.equal(storage.get('coachpulse:autoBackup:v6'),'x'.repeat(200),'La copie mémoire reste disponible tant que la page est ouverte.');

global.localStorage=new QuotaStorage(500);
global.localStorage.setItem('coachStatsPostMatchDraftV1',JSON.stringify({draft:{matchId:'legacy'}}));
assert.equal(storage.getJson('coachStatsPostMatchDraftV1',null).draft.matchId,'legacy','Les anciennes sauvegardes restent lisibles.');

console.log('Storage service checks passed: quota is explicit, memory fallback works, durable drafts and backups are not auto-deleted.');
