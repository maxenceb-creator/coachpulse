const fs = require('fs');
const path = require('path');
const vm = require('vm');

class MemoryStorage {
  constructor(seed){
    this.store = new Map(seed ? Array.from(seed.entries()) : []);
  }
  get length(){ return this.store.size; }
  key(index){ return Array.from(this.store.keys())[index] || null; }
  getItem(key){ return this.store.has(key) ? this.store.get(key) : null; }
  setItem(key, value){ this.store.set(key, String(value)); }
  removeItem(key){ this.store.delete(key); }
  clear(){ this.store.clear(); }
}

function loadPresenceStorage(storage){
  const code = fs.readFileSync(path.join(__dirname, '..', 'modules', 'presences', 'presence-storage-service.js'), 'utf8');
  const context = {
    localStorage: storage,
    window: {
      parent: {
        postMessage(message){
          storage.setItem('__lastMessage', JSON.stringify(message));
        }
      }
    },
    Math,
    Date,
    JSON,
    String
  };
  context.window.localStorage = storage;
  vm.createContext(context);
  vm.runInContext(code, context, {filename:'presence-storage-service.js'});
  return context.window.CoachPulsePresenceStorage;
}

const storage = new MemoryStorage();
const firstLoad = loadPresenceStorage(storage);
const initial = firstLoad.load({sessions:[], current:null});

if(!Array.isArray(initial.sessions) || initial.sessions.length !== 0){
  throw new Error('Le chargement initial doit être vide.');
}

const session = {
  id: 'test-session-persistence',
  date: '2026-08-03',
  start: '15:30',
  end: '17:00',
  duration: 90,
  type: 'Entraînement',
  theme: 'Test persistance',
  teamId: 'team-u13-a',
  teamIds: ['team-u13-a'],
  entries: {
    'player-test': {code:'P', minutes:90, note:''}
  }
};

firstLoad.save({sessions:[session], current:session.id}, {reason:'test-create-session'});

const secondLoad = loadPresenceStorage(storage);
const restored = secondLoad.load({sessions:[], current:null});

if(restored.current !== session.id){
  throw new Error('La séance courante n’a pas été restaurée.');
}
if(!restored.sessions.some(item => item.id === session.id && item.date === '2026-08-03')){
  throw new Error('La séance créée ne persiste pas après rechargement.');
}

const meta = secondLoad.readMeta();
if(!meta.updatedAtMs || meta.sessionCount !== 1){
  throw new Error('La métadonnée de sauvegarde Présences est absente ou incohérente.');
}

console.log('Test Présences OK : création, sauvegarde et rechargement conservent la séance.');
