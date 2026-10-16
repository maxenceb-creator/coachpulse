const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const statistics = require('../shared/services/match-statistics-service.js');
const persistence = require('../shared/services/post-match-transactional-persistence-service.js');

const root = path.resolve(__dirname, '..');
const editor = fs.readFileSync(path.join(root, 'pages/coach-stats/post-match-editor.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'pages/coach-stats.html'), 'utf8');

assert.match(html, /post-match-editor\.js\?v=241/);
assert.match(html, /CoachPulsePostMatchEditor\.editMatch/);
assert.doesNotMatch(html, /live-manual-editor|live-manual-statistics-service/);
assert.match(editor, /beforeunload/);
assert.match(editor, /coachStatsLiveManualDraftV1/);
assert.match(editor, /Exporter le brouillon/);
assert.match(editor, /Ouvrir une copie Après-match/);
assert.doesNotMatch(editor, /remove\(LEGACY_LIVE_DRAFT_KEY\)/);
assert.match(editor, /nextEventsComplete:true/);
assert.match(editor, /Préparer la sauvegarde/);
assert.match(editor, /matchPrepareHistoricalEventsRevision/);
assert.match(editor, /Stockage du navigateur saturé/);
assert.match(editor, /coachpulse-post-match-draft/);
assert.match(editor, /event\.eventId=event\.eventId\|\|event\.id/);
assert.doesNotMatch(editor, /draft\.entryMode=draft\.entryMode==='LIVE'\?'FULL_POST_MATCH'/);
assert.match(editor, /participated:true,seconds:null/);
assert.match(editor, /adjustEventEffect\(event,-1\)/);
assert.match(editor, /SCORE_EVENTS_MISMATCH/);
assert.doesNotMatch(editor, /log\.push\([^)]*(?:stat|manual)/i);

const normalized = statistics.normalizePlayers({Alice:{but:null,recup:'',seconds:null}}, {unknown:'preserve'});
assert.equal(normalized.Alice.but, null);
assert.equal(normalized.Alice.recup, null);
assert.equal(normalized.Alice.seconds, null);

const documents = new Map();
const writes = [];
const firestore = {
  doc: (_db, collection, id) => `${collection}/${id}`,
  collection: (_db, name) => name,
  where: (field, operator, value) => ({field, operator, value}),
  query: (collection, ...filters) => ({collection, filters}),
  getDocs: async () => ({docs:[]}),
  serverTimestamp: () => 'server-time',
  runTransaction: async (_db, callback) => {
    const pending=[];
    const transaction={
      get:async ref=>({id:String(ref).split('/')[1],ref,exists:()=>documents.has(ref),data:()=>documents.get(ref)}),
      set:(ref,value,options)=>pending.push({type:'set',ref,value,options}),
      delete:ref=>pending.push({type:'delete',ref})
    };
    const result=await callback(transaction);
    if(result.ok)pending.forEach(write=>{writes.push(write);if(write.type==='delete')documents.delete(write.ref);else documents.set(write.ref,{...documents.get(write.ref),...write.value});});
    return result;
  }
};

(async()=>{
  const result=await persistence.savePostMatchTransactional({
    db:{},firestore,matchId:'retro-1',expectedRevision:0,expectedEventsRevision:0,nextEvents:[],nextEventsComplete:true,
    profile:{status:'ACTIVE',role:'ENTRAINEUR_ADJOINT',permissionLevel:'SAISIE',allowedModules:['stats'],authorizedTeamIds:['team-1']},
    matchSnapshot:{matchId:'retro-1',teamId:'team-1',entryMode:'FULL_POST_MATCH',statsSource:'MANUAL',players:{Alice:{playerId:'alice',but:null,recup:'',seconds:null}},opp:{butAdv:null}}
  });
  assert.equal(result.ok,true);
  const saved=documents.get('matches/retro-1');
  assert.equal(saved.players.Alice.but,null);
  assert.equal(saved.players.Alice.recup,null);
  assert.equal(saved.players.Alice.seconds,null);
  assert.equal(saved.opp.butAdv,null);
  assert.equal(writes.length,1);
  console.log('Post-match editor checks passed: UI wiring, stable events, permissions, atomic save and unknown values.');
})().catch(error=>{console.error(error);process.exitCode=1;});
