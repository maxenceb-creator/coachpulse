const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const firestorePayloadService = require('../shared/utils/firestore-payload-service.js');

const appSource = fs.readFileSync(require.resolve('../app.js'), 'utf8');
const start = appSource.indexOf('const LEGACY_PRESENCE_TOP_LEVEL_KEYS');
const end = appSource.indexOf('function technicalSettledReadSummary', start);
assert.ok(start >= 0 && end > start, 'Le réconciliateur Présences doit être extractible.');
const source = appSource.slice(start, end);
const mergedSource = appSource.slice(appSource.indexOf('function mergedCommonBaseItems'), appSource.indexOf('function countLocalDataItems'));

const legacySession = (overrides={}) => ({
  sessionId:'presence-session-2026-09-12-u13', date:'2026-09-12', start:'10:00', end:'11:30', duration:90,
  type:'Séance', theme:'Conservation', categories:['U13F'], team:'U13F', teamId:'team-u13', teamIds:['team-u13'], source:'Présences',
  comment:'Séance complète', metadata:{cycle:'C1'}, procedure:{warmup:15, technical:25, game:50},
  entries:{
    'player-a':{code:'P', minutes:90, note:'RAS', playerName:'Alpha A', teamId:'team-u13', teamIds:['team-u13'], metadata:{sourceRow:2}},
    'player-b':{code:'AJ', minutes:0, note:'École', playerName:'Beta B', teamId:'team-u13', teamIds:['team-u13'], metadata:{sourceRow:3}}
  },
  ...overrides
});
const legacyValue = sessions => JSON.stringify({sessions});
const cloudSession = legacy => ({...legacy, startTime:legacy.start, endTime:legacy.end, entries:undefined});
const cloudAttendance = legacy => Object.entries(legacy.entries).map(([playerId, row], index) => ({
  ...row, id:`attendance-${index}`, attendanceId:`attendance-${index}`, sessionId:legacy.sessionId, playerId, status:row.code, comment:row.note
}));

function contextFor(options={}){
  const state = {pendingSync:options.pendingSync === true, durable:options.durable || {value:[], source:'indexedDB', revision:1, indexedDbReadComplete:options.indexedDbComplete !== false}};
  const context = vm.createContext({
    Error, Array, JSON, Map, Set, Object, Promise, String, Number,
    currentUser:{uid:'uid-a'}, frame:{contentWindow:{CoachPulsePresenceReconciliationState:() => options.frameState || {}}},
    stableFirestoreId:(...parts) => parts.join('-'),
    presenceUiStatusFromCode:value => ({P:'present', AJ:'excused', R:'late'}[String(value)] || String(value || '')),
    presencePlainProcedure:value => ({warmup:Number(value?.warmup || 0), technical:Number(value?.technical || 0), athletic:Number(value?.athletic || 0), theoretical:Number(value?.theoretical || 0), situation:Number(value?.situation || 0), game:Number(value?.game || 0)}),
    presenceEventsService:() => ({isPendingEvent:event => event.pending === true}),
    storage:{isPendingSync:() => state.pendingSync, getDurableJson:async () => state.durable, getJson:(_key, fallback) => options.pendingBackup || fallback},
    presenceSettingsAdminAllowed:() => options.fullScope !== false,
    canAccessAllPlayersForModule:() => options.fullScope !== false,
    db:{},
    firebaseFns:{
      collection:(_db, name) => name,
      doc:(_db, collection, id) => ({collection, id}),
      getDocsFromServer:async name => {
        if(options.partialCollection === name) throw new Error('partial read');
        const rows = name === 'sessions' ? (options.sessions || []) : name === 'attendance' ? (options.attendance || []) : (options.deletionLogs || []);
        return {metadata:{fromCache:options.fromCache === true, hasPendingWrites:options.serverPending === true}, forEach(callback){ rows.forEach(row => callback({id:row.id || row.sessionId, data:() => row, metadata:{fromCache:false, hasPendingWrites:false}})); }};
      }
    }
  });
  vm.runInContext(source, context);
  return {context, state};
}

(async () => {
  const legacy = legacySession();
  const completeOptions = {sessions:[cloudSession(legacy)], attendance:cloudAttendance(legacy)};
  const complete = contextFor(completeOptions).context;
  const result = await complete.reconcileLegacyPresence({presenceSeanceV3_6_Excel:legacyValue([legacy])}, {uid:'uid-a', scope:'all', token:'attempt-a'});
  assert.equal(result.confirmed, true);
  assert.equal(result.totalSessions, 1);
  assert.equal(result.totalAttendance, 2);

  for(const [label, mutate, reason] of [
    ['séance manquante', options => { options.sessions = []; }, 'unconfirmed-deletion'],
    ['présence manquante', options => { options.attendance = options.attendance.slice(0, 1); }, 'missing-attendance'],
    ['statut divergent', options => { options.attendance[0].status = 'R'; }, 'attendance-conflict'],
    ['durée divergente', options => { options.attendance[0].minutes = 42; }, 'attendance-conflict'],
    ['commentaire divergent', options => { options.attendance[0].comment = 'Autre'; }, 'attendance-conflict'],
    ['séance ambiguë', options => { options.sessions.push({...options.sessions[0]}); }, 'ambiguous-session'],
    ['présence ambiguë', options => { options.attendance.push({...options.attendance[0], id:'duplicate'}); }, 'ambiguous-attendance']
  ]){
    const options = structuredClone(completeOptions);
    mutate(options);
    await assert.rejects(() => contextFor(options).context.reconcileLegacyPresence({presenceSeanceV3_6_Excel:legacyValue([legacy])}, {uid:'uid-a', scope:'all', token:'attempt-a'}), error => (error.unresolved || []).some(item => item.reason === reason), label);
  }

  const unsupported = legacySession({futureBusinessField:'must-stay'});
  await assert.rejects(() => contextFor(completeOptions).context.reconcileLegacyPresence({presenceSeanceV3_6_Excel:legacyValue([unsupported])}, {uid:'uid-a', scope:'all', token:'attempt-a'}), error => error.unresolved?.[0]?.reason === 'unsupported-property');
  await assert.rejects(
    () => contextFor(completeOptions).context.reconcileLegacyPresence({presenceSeanceV3_6_Excel:JSON.stringify({sessions:[legacySession({rawCategories:['U12','U13']})], current:legacy.sessionId})}, {uid:'uid-a', scope:'all', token:'attempt-a'}),
    error => error.unresolved?.[0]?.reason === 'unsupported-property',
    'Les propriétés historiques rawCategories/current non conservées côté serveur doivent bloquer le retrait.'
  );

  const deletionLog = {id:legacy.sessionId, sessionId:legacy.sessionId, date:legacy.date, source:'Présences', deletedBy:'uid-admin', deletedAtIso:'2026-10-01T10:00:00Z'};
  const deleted = await contextFor({sessions:[], attendance:[], deletionLogs:[deletionLog]}).context.reconcileLegacyPresence({presenceSeanceV3_6_Excel:legacyValue([legacy])}, {uid:'uid-a', scope:'all', token:'attempt-a'});
  assert.deepEqual(Array.from(deleted.deletedSessionIds), [legacy.sessionId]);
  await assert.rejects(() => contextFor({sessions:[], attendance:[], deletionLogs:[{...deletionLog, deletedBy:''}]}).context.reconcileLegacyPresence({presenceSeanceV3_6_Excel:legacyValue([legacy])}, {uid:'uid-a', scope:'all', token:'attempt-a'}), error => error.unresolved?.some(item => item.reason === 'unconfirmed-deletion'));

  const historical = legacySession({sessionId:'presence-session-2025-09-12-u13', date:'2025-09-12'});
  await assert.rejects(() => contextFor({sessions:[], attendance:[], deletionLogs:[]}).context.reconcileLegacyPresence({presenceSeanceV3_6_Excel:legacyValue([historical])}, {uid:'uid-a', scope:'all', token:'attempt-a'}), error => error.unresolved?.some(item => item.reason === 'unconfirmed-deletion'), 'La saison 2025-2026 ne constitue jamais une preuve de suppression.');

  for(const options of [
    {...completeOptions, pendingSync:true},
    {...completeOptions, durable:{value:[{pending:true}], source:'indexedDB', revision:2, indexedDbReadComplete:true}},
    {...completeOptions, indexedDbComplete:false},
    {...completeOptions, frameState:{pendingCloudWrites:1}},
    {...completeOptions, pendingBackup:[{id:'draft'}]},
    {...completeOptions, partialCollection:'attendance'},
    {...completeOptions, fullScope:false},
    {...completeOptions, fromCache:true},
    {...completeOptions, serverPending:true}
  ]) await assert.rejects(() => contextFor(options).context.reconcileLegacyPresence({presenceSeanceV3_6_Excel:legacyValue([legacy])}, {uid:'uid-a', scope:'all', token:'attempt-a'}));

  const changedAccount = contextFor(completeOptions);
  changedAccount.context.firebaseFns.getDocsFromServer = async name => {
    changedAccount.context.currentUser = {uid:'uid-b'};
    const rows = name === 'sessions' ? completeOptions.sessions : name === 'attendance' ? completeOptions.attendance : [];
    return {metadata:{}, forEach(callback){ rows.forEach(row => callback({id:row.id || row.sessionId, data:() => row, metadata:{}})); }};
  };
  await assert.rejects(() => changedAccount.context.reconcileLegacyPresence({presenceSeanceV3_6_Excel:legacyValue([legacy])}, {uid:'uid-a', scope:'all', token:'attempt-a'}));

  assert.equal(complete.presenceLegacyValueUnchanged({presenceSeanceV3_6_Excel:legacyValue([legacy])}, result), true);
  assert.equal(complete.presenceLegacyValueUnchanged({presenceSeanceV3_6_Excel:legacyValue([{...legacy, theme:'Concurrent'}])}, result), false);
  const evidenceRows = new Map([
    ...completeOptions.sessions.map(row => [`sessions/${row.sessionId}`, row]),
    ...completeOptions.attendance.map(row => [`attendance/${row.id}`, row])
  ]);
  await complete.assertPresenceReconciliationCurrent({get:async ref => ({id:ref.id, exists:() => true, data:() => evidenceRows.get(`${ref.collection}/${ref.id}`)})}, result);
  await assert.rejects(
    () => complete.assertPresenceReconciliationCurrent({get:async ref => ({id:ref.id, exists:() => true, data:() => ({...evidenceRows.get(`${ref.collection}/${ref.id}`), comment:'Concurrent'})})}, result),
    error => error.unresolved?.[0]?.reason === 'concurrent-change'
  );

  const mergeContext = vm.createContext({Set, FIRESTORE_MANAGED_LOCAL_KEYS:new Set(['presenceSeanceV3_6_Excel','coachStatsV13Rows']), CLOUD_SYNC_LOCAL_ONLY_KEYS:new Set()});
  vm.runInContext(mergedSource, mergeContext);
  const beforeItems = {presenceSeanceV3_6_Excel:legacyValue([{...legacy, metadata:{padding:'x'.repeat(940000)}}]), coachStatsV13Rows:'protected', preference:'kept'};
  const beforeBytes = firestorePayloadService.inspectSize({items:beforeItems}).bytes;
  assert.ok(beforeBytes > 921600);
  const kept = mergeContext.mergedCommonBaseItems(beforeItems, {localDraft:'pending'}, {removableLegacyKeys:new Set(['coachStatsV13Rows'])});
  assert.ok(Object.hasOwn(kept, 'presenceSeanceV3_6_Excel'));
  const afterItems = mergeContext.mergedCommonBaseItems(beforeItems, {localDraft:'pending'}, {removableLegacyKeys:new Set(['presenceSeanceV3_6_Excel'])});
  assert.equal(Object.hasOwn(afterItems, 'presenceSeanceV3_6_Excel'), false);
  assert.equal(afterItems.coachStatsV13Rows, 'protected');
  assert.equal(afterItems.localDraft, 'pending');
  const afterBytes = firestorePayloadService.inspectSize({items:afterItems}).bytes;
  assert.ok(afterBytes < beforeBytes);
  assert.deepEqual(completeOptions.sessions, [cloudSession(legacy)]);
  assert.deepEqual(completeOptions.attendance, cloudAttendance(legacy));
  console.log(`Presence reconciliation payload: ${beforeBytes} -> ${afterBytes} bytes; ${result.totalSessions} session and ${result.totalAttendance} attendance rows preserved.`);
  console.log('Presence reconciliation hotfix scenarios passed.');
})().catch(error => { console.error(error); process.exitCode = 1; });
