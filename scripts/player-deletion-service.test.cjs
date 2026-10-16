const assert = require('node:assert/strict');
const Players = require('../shared/services/players-service.js');

function snapshot(id, data){
  return {id, exists:() => data !== undefined, data:() => data === undefined ? undefined : structuredClone(data)};
}

function mockFirestore({matches={}, events=[], collections={}, failMatch='', failDelete=''}={}){
  const store = {
    matches:new Map(Object.entries(structuredClone(matches))),
    matchEvents:new Map(events.map(event => [event.eventId, structuredClone(event)])),
    players:new Map([['p1',{playerId:'p1'}]]),
    ...Object.fromEntries(Object.entries(collections).map(([name, rows]) => [name, new Map(rows.map(row => [row.id, structuredClone(row.data)]))]))
  };
  const commits = [];
  const adapter = {
    doc(_db, collection, id){ return {collection,id}; },
    collection(_db, collection){ return {collection}; },
    serverTimestamp(){ return {serverTimestamp:true}; },
    async getDocs(ref){
      const rows = store[ref.collection] || new Map();
      return {forEach(callback){ for(const [id,data] of rows) callback(snapshot(id,data)); }};
    },
    async deleteDoc(ref){
      if(`${ref.collection}/${ref.id}` === failDelete) throw Object.assign(new Error('delete failed'), {code:'unavailable'});
      store[ref.collection]?.delete(ref.id);
    },
    async runTransaction(_db, callback){
      const pending = [];
      const transaction = {
        async get(ref){ return snapshot(ref.id, store[ref.collection]?.get(ref.id)); },
        set(ref,data,options){ pending.push({type:'set',ref,data:structuredClone(data),options}); },
        delete(ref){ pending.push({type:'delete',ref}); }
      };
      const result = await callback(transaction);
      if(result.matchId === failMatch) throw Object.assign(new Error('conflict'), {code:'aborted'});
      for(const write of pending){
        if(write.type === 'delete') store[write.ref.collection].delete(write.ref.id);
        else store[write.ref.collection].set(write.ref.id, write.options?.merge
          ? {...(store[write.ref.collection].get(write.ref.id) || {}), ...write.data}
          : write.data);
      }
      commits.push(pending);
      return result;
    }
  };
  return {adapter,store,commits};
}

async function remove(mock, collections=['matchEvents']){
  return Players.deletePlayerReferences({playerId:'p1',collections}, {firebaseFns:mock.adapter,db:{}});
}

const tests = [];
function test(name, callback){ tests.push([name, callback]); }

test('suppression administrative autorisee et revisions atomiques', async () => {
  const mock = mockFirestore({matches:{m1:{matchId:'m1',revision:2,eventsRevision:5}},events:[{eventId:'e1',matchId:'m1',playerId:'p1'}]});
  const result = await remove(mock);
  assert.equal(result.ok,true);
  assert.equal(mock.store.matchEvents.has('e1'),false);
  assert.equal(mock.store.matches.get('m1').revision,3);
  assert.equal(mock.store.matches.get('m1').eventsRevision,6);
  assert.equal(mock.store.matches.get('m1').matchId,'m1');
});

test('plusieurs evenements du meme match produisent un seul increment', async () => {
  const mock = mockFirestore({matches:{m1:{matchId:'m1',revision:0,eventsRevision:0}},events:[
    {eventId:'e1',matchId:'m1',playerId:'p1'}, {eventId:'e2',matchId:'m1',playerIds:['p1']},
    {eventId:'other',matchId:'m1',playerId:'p2'}
  ]});
  const result = await remove(mock);
  assert.equal(result.refCounts.matchEvents,2);
  assert.equal(mock.store.matches.get('m1').revision,1);
  assert.equal(mock.store.matches.get('m1').eventsRevision,1);
  assert.equal(mock.store.matchEvents.has('other'),true);
});

test('plusieurs matchs sont traites independamment', async () => {
  const mock = mockFirestore({matches:{m1:{revision:1,eventsRevision:1},m2:{revision:4,eventsRevision:7}},events:[
    {eventId:'e1',matchId:'m1',playerId:'p1'}, {eventId:'e2',matchId:'m2',playerId:'p1'}
  ]});
  await remove(mock);
  assert.equal(mock.commits.length,2);
  assert.equal(mock.store.matches.get('m1').revision,2);
  assert.equal(mock.store.matches.get('m2').eventsRevision,8);
});

test('conflit de revision ne supprime ni evenement ni joueuse', async () => {
  const mock = mockFirestore({matches:{m1:{revision:0,eventsRevision:0}},events:[{eventId:'e1',matchId:'m1',playerId:'p1'}],failMatch:'m1'});
  await assert.rejects(remove(mock), error => error.code === 'aborted');
  assert.equal(mock.store.matchEvents.has('e1'),true);
  assert.equal(mock.store.players.has('p1'),true);
});

test('echec intermediaire est repris sans doubler les revisions terminees', async () => {
  const mock = mockFirestore({matches:{m1:{revision:0,eventsRevision:0},m2:{revision:3,eventsRevision:3}},events:[
    {eventId:'e1',matchId:'m1',playerId:'p1'}, {eventId:'e2',matchId:'m2',playerId:'p1'}
  ],failMatch:'m2'});
  await assert.rejects(remove(mock));
  assert.equal(mock.store.matchEvents.has('e1'),false);
  assert.equal(mock.store.matchEvents.has('e2'),true);
  mock.adapter.runTransaction = mock.adapter.runTransaction.bind(null);
  const retry = mockFirestore({matches:Object.fromEntries(mock.store.matches),events:[...mock.store.matchEvents.values()]});
  await remove(retry);
  assert.equal(retry.store.matches.get('m1').revision,1);
  assert.equal(retry.store.matches.get('m2').revision,4);
  assert.equal(retry.store.matchEvents.size,0);
});

test('reference deja absente est idempotente', async () => {
  const mock = mockFirestore({matches:{m1:{revision:2,eventsRevision:2}}});
  const result = await remove(mock);
  assert.equal(result.refCounts.matchEvents,0);
  assert.equal(mock.store.matches.get('m1').revision,2);
  assert.equal(mock.commits.length,0);
});

test('matchId manquant bloque toute suppression critique', async () => {
  const mock = mockFirestore({matches:{m1:{revision:0,eventsRevision:0}},events:[
    {eventId:'broken',playerId:'p1'}, {eventId:'valid',matchId:'m1',playerId:'p1'}
  ]});
  await assert.rejects(remove(mock), error => error.code === 'INVALID_MATCH_EVENT_REFERENCE');
  assert.equal(mock.store.matchEvents.size,2);
});

test('transaction trop grande est refusee avant la premiere ecriture', async () => {
  const events = Array.from({length:500}, (_, index) => ({eventId:`e${index}`,matchId:'m1',playerId:'p1'}));
  const mock = mockFirestore({matches:{m1:{revision:0,eventsRevision:0}},events});
  await assert.rejects(remove(mock), error => error.code === 'TRANSACTION_TOO_LARGE');
  assert.equal(mock.store.matchEvents.size,500);
  assert.equal(mock.commits.length,0);
});

test('echec sur une autre collection reste visible et conserve la joueuse', async () => {
  const mock = mockFirestore({collections:{attendance:[{id:'a1',data:{playerId:'p1'}}]},failDelete:'attendance/a1'});
  await assert.rejects(remove(mock,['matchEvents','attendance']));
  assert.equal(mock.store.attendance.has('a1'),true);
  assert.equal(mock.store.players.has('p1'),true);
});

(async () => {
  for(const [name, callback] of tests){ await callback(); console.log(`PASS ${name}`); }
  console.log(`Player deletion service checks passed: ${tests.length}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
