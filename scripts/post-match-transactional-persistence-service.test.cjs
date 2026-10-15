const assert = require('node:assert/strict');
const Service = require('../shared/services/post-match-transactional-persistence-service.js');

const baseProfile = {status:'ACTIVE', permissionLevel:'SAISIE', allowedModules:['stats'], authorizedTeamIds:['team-u13']};
const baseMatch = {matchId:'match-1', teamId:'team-u13', entryMode:'FULL_POST_MATCH', players:{Alice:{but:1}}};

function mockFirestore({match=null, events=[], fail=null, beforeCommit=null}={}){
  const store = {match:match && structuredClone(match), events:new Map(events.map(event => [event.eventId, structuredClone(event)]))};
  const commits = [];
  const adapter = {
    doc(_db, collection, id){ return {kind:'doc',collection,id}; },
    collection(_db, collection){ return {kind:'collection',collection}; },
    where(field, operator, value){ return {field,operator,value}; },
    query(collection, condition){ return {kind:'query',collection:collection.collection,condition}; },
    serverTimestamp(){ return {__serverTimestamp:true}; },
    async runTransaction(_db, callback){
      if(fail === 'before') throw Object.assign(new Error('transaction unavailable'), {code:'unavailable'});
      const pending = [];
      const transaction = {
        async get(ref){
          if(ref.kind === 'doc') return {exists:() => Boolean(store.match), data:() => structuredClone(store.match)};
          return {docs:[...store.events.entries()].map(([id,data]) => ({id,data:() => structuredClone(data)}))};
        },
        set(ref,data,options){ pending.push({type:'set',ref,data:structuredClone(data),options}); },
        delete(ref){ pending.push({type:'delete',ref}); }
      };
      const result = await callback(transaction);
      if(beforeCommit) await beforeCommit({store,pending,result});
      if(fail === 'commit') throw Object.assign(new Error('commit failed'), {code:'aborted'});
      if(result?.ok){
        pending.forEach(write => {
          if(write.ref.collection === 'matches') store.match = {...(store.match || {}), ...write.data};
          else if(write.type === 'delete') store.events.delete(write.ref.id);
          else store.events.set(write.ref.id, {...(store.events.get(write.ref.id) || {}), ...write.data});
        });
        commits.push(pending);
      }
      return result;
    }
  };
  return {adapter,store,commits};
}

async function save(mock, overrides={}){
  return Service.savePostMatchTransactional({
    db:{}, firestore:mock.adapter, profile:baseProfile, matchId:'match-1', expectedRevision:0,
    matchSnapshot:baseMatch, nextEvents:[], ...overrides
  });
}

const tests = [];
function test(name, callback){ tests.push([name, callback]); }

test('premiere ecriture versionnee', async () => {
  const mock = mockFirestore();
  const result = await save(mock);
  assert.equal(result.revision, 1);
  assert.equal(mock.store.match.revision, 1);
});

test('revision attendue identique et increment atomique', async () => {
  const mock = mockFirestore({match:{...baseMatch,revision:4,historical:'kept'}});
  const result = await save(mock, {expectedRevision:4});
  assert.equal(result.revision, 5);
  assert.equal(mock.store.match.historical, 'kept');
});

test('revision distante superieure refuse sans ecriture', async () => {
  const mock = mockFirestore({match:{...baseMatch,revision:3}});
  const result = await save(mock, {expectedRevision:2});
  assert.equal(result.code, 'REVISION_CONFLICT');
  assert.equal(mock.commits.length, 0);
});

test('revision distante invalide refuse sans ecriture', async () => {
  const mock = mockFirestore({match:{...baseMatch,revision:'3'}});
  const result = await save(mock);
  assert.equal(result.code, 'INVALID_REMOTE_REVISION');
  assert.equal(mock.commits.length, 0);
});

test('conflit entre deux educateurs', async () => {
  const mock = mockFirestore({match:{...baseMatch,revision:1}});
  assert.equal((await save(mock,{expectedRevision:1})).ok, true);
  const stale = await save(mock,{expectedRevision:1});
  assert.equal(stale.code, 'REVISION_CONFLICT');
  assert.equal(mock.store.match.revision, 2);
});

test('evenement ajoute', async () => {
  const mock = mockFirestore();
  const result = await save(mock,{nextEvents:[{eventId:'e1',type:'goal'}]});
  assert.equal(result.events.added, 1);
  assert.equal(mock.store.events.get('e1').matchId, 'match-1');
});

test('evenement modifie', async () => {
  const mock = mockFirestore({events:[{eventId:'e1',matchId:'match-1',value:1}]});
  const result = await save(mock,{nextEvents:[{eventId:'e1',value:2}]});
  assert.equal(result.events.modified, 1);
  assert.equal(mock.store.events.get('e1').value, 2);
});

test('suppression physique autorisee seulement sur liste exhaustive', async () => {
  const mock = mockFirestore({events:[{eventId:'e1',matchId:'match-1'}]});
  const result = await save(mock,{nextEventsComplete:true,deletionStrategy:'PHYSICAL'});
  assert.equal(result.events.removed, 1);
  assert.equal(mock.store.events.has('e1'), false);
});

test('suppression logique autorisee seulement sur liste exhaustive', async () => {
  const mock = mockFirestore({events:[{eventId:'e1',matchId:'match-1'}]});
  const result = await save(mock,{nextEventsComplete:true,deletionStrategy:'LOGICAL'});
  assert.equal(result.events.removed, 1);
  assert.equal(mock.store.events.get('e1').deleted, true);
});

test('liste partielle sans suppression', async () => {
  const mock = mockFirestore({events:[{eventId:'keep',matchId:'match-1'},{eventId:'unloaded',matchId:'match-1'}]});
  const result = await save(mock,{nextEvents:[{eventId:'keep',matchId:'match-1'}],nextEventsComplete:false});
  assert.equal(result.events.removed, 0);
  assert.equal(mock.store.events.has('unloaded'), true);
});

test('liste vide non exhaustive sans suppression', async () => {
  const mock = mockFirestore({events:[{eventId:'keep',matchId:'match-1'}]});
  await save(mock,{nextEvents:[]});
  assert.equal(mock.store.events.has('keep'), true);
});

test('erreur transaction et absence ecriture partielle', async () => {
  const mock = mockFirestore({events:[{eventId:'old',matchId:'match-1'}],fail:'commit'});
  const before = structuredClone([...mock.store.events]);
  const result = await save(mock,{nextEvents:[{eventId:'new'}],nextEventsComplete:true});
  assert.equal(result.code, 'aborted');
  assert.deepEqual([...mock.store.events], before);
  assert.equal(mock.store.match, null);
});

test('preservation des donnees historiques et normalisation', async () => {
  const mock = mockFirestore({match:{...baseMatch,revision:2,legacy:{kept:true}}});
  await save(mock,{expectedRevision:2,matchSnapshot:{...baseMatch,players:{Alice:{but:'2',unknown:'kept'}}}});
  assert.deepEqual(mock.store.match.legacy,{kept:true});
  assert.equal(mock.store.match.players.Alice.but,2);
  assert.equal(mock.store.match.players.Alice.unknown,'kept');
});

test('permissions module equipe et niveau refusees avant Firestore', async () => {
  const mock = mockFirestore();
  const result = await save(mock,{profile:{...baseProfile,permissionLevel:'LECTEUR'}});
  assert.equal(result.code,'PERMISSION_DENIED');
  assert.equal(mock.commits.length,0);
});

test('statistiques manuelles ne creent aucun evenement fictif', async () => {
  const mock = mockFirestore();
  const result = await save(mock,{matchSnapshot:{...baseMatch,statsSource:'MANUAL',players:{Alice:{but:4}}}});
  assert.equal(result.events.added,0);
  assert.equal(mock.store.events.size,0);
});

test('operation trop grande refuse toute ecriture', async () => {
  const events = Array.from({length:Service.MAX_TRANSACTION_WRITES},(_,index) => ({eventId:`e${index}`}));
  const mock = mockFirestore();
  const result = await save(mock,{nextEvents:events});
  assert.equal(result.code,'TRANSACTION_TOO_LARGE');
  assert.equal(mock.commits.length,0);
});

test('service reserve aux parcours apres-match et non au Live', async () => {
  const mock = mockFirestore();
  const result = await save(mock,{matchSnapshot:{...baseMatch,entryMode:'LIVE'}});
  assert.equal(result.code,'INVALID_ENTRY_MODE');
  assert.equal(mock.commits.length,0);
});

(async () => {
  for(const [name, callback] of tests){ await callback(); console.log(`PASS ${name}`); }
  console.log(`Post-match transactional persistence checks passed: ${tests.length}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
