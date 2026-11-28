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
  ...row, id:row.attendanceId || `attendance-${index}`, attendanceId:row.attendanceId || `attendance-${index}`, sessionId:legacy.sessionId, playerId, status:row.status || row.code, comment:row.comment || row.note
}));

function contextFor(options={}){
  const state = {
    pendingSync:options.pendingSync === true,
    durable:options.durable || {value:[], source:'indexedDB', revision:1, indexedDbReadComplete:options.indexedDbComplete !== false},
    frameState:options.frameState === null ? null : (options.frameState || {revision:1, contextRevision:'context-a'})
  };
  const frameWindow = options.missingFrameState ? {} : {CoachPulsePresenceReconciliationState:() => state.frameState};
  const context = vm.createContext({
    Error, Array, JSON, Map, Set, Object, Promise, String, Number,
    currentUser:{uid:'uid-a'}, frame:{contentWindow:frameWindow},
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
  return {context, state, frameWindow};
}

(async () => {
  const legacy = legacySession();
  const completeOptions = {sessions:[cloudSession(legacy)], attendance:cloudAttendance(legacy)};
  const complete = contextFor(completeOptions).context;
  const result = await complete.reconcileLegacyPresence({presenceSeanceV3_6_Excel:legacyValue([legacy])}, {uid:'uid-a', scope:'all', token:'attempt-a'});
  assert.equal(result.confirmed, true);
  assert.equal(result.totalSessions, 1);
  assert.equal(result.totalAttendance, 2);

  const richLegacy = legacySession({
    id:'presence-session-2026-09-12-u13', startTime:'10:00', endTime:'11:30', title:'Conservation',
    category:'U13F', categorie:'U13F', comments:'Séance complète', note:'Séance complète', meta:{cycle:'C1'},
    sessionProcedure:{warmup:15, technical:25, game:50}, createdAt:'2026-09-12T08:00:00.000Z',
    createdAtIso:'2026-09-12T08:00:00.000Z', updatedAt:'2026-09-12T12:00:00.000Z', updatedAtIso:'2026-09-12T12:00:00.000Z',
    entries:{'player-a':{
      code:'P', status:'P', minutes:90, duration:90, note:'RAS', comment:'RAS', attendanceId:'attendance-rich',
      playerId:'player-a', playerName:'Alpha A', joueuse:'Alpha A', teamId:'team-u13', teamIds:['team-u13'],
      playerSnapshot:{playerId:'player-a', displayName:'Alpha A', teamId:'team-u13'}, metadata:{sourceRow:2}, meta:{sourceRow:2},
      createdAt:'2026-09-12T08:00:00.000Z', createdAtIso:'2026-09-12T08:00:00.000Z',
      updatedAt:'2026-09-12T12:00:00.000Z', updatedAtIso:'2026-09-12T12:00:00.000Z'
    }}
  });
  const sessionTargets = {
    id:['id','sessionId'], sessionId:['sessionId','id'], date:['date'], start:['start','startTime'], startTime:['startTime','start'],
    end:['end','endTime'], endTime:['endTime','end'], duration:['duration'], type:['type'], theme:['theme','title'], title:['title','theme'],
    categories:['categories'], category:['category','categories'], categorie:['categorie','categories'], team:['team'], teamId:['teamId'], teamIds:['teamIds'],
    source:['source'], comment:['comment','comments','note'], comments:['comments','comment','note'], note:['note','comment','comments'],
    metadata:['metadata','meta'], meta:['meta','metadata'], procedure:['procedure','sessionProcedure'], sessionProcedure:['sessionProcedure','procedure'],
    createdAt:['createdAt','createdAtIso'], createdAtIso:['createdAtIso','createdAt'], updatedAt:['updatedAt','updatedAtIso'], updatedAtIso:['updatedAtIso','updatedAt']
  };
  const entryTargets = {
    code:['code','status'], status:['status','code'], minutes:['minutes','duration'], duration:['duration','minutes'], note:['note','comment'], comment:['comment','note'],
    attendanceId:['attendanceId','id'], playerId:['playerId'], playerName:['playerName','joueuse'], joueuse:['joueuse','playerName'], teamId:['teamId'], teamIds:['teamIds'],
    playerSnapshot:['playerSnapshot'], createdAt:['createdAt','createdAtIso'], createdAtIso:['createdAtIso','createdAt'],
    updatedAt:['updatedAt','updatedAtIso'], updatedAtIso:['updatedAtIso','updatedAt'], metadata:['metadata','meta'], meta:['meta','metadata']
  };
  const allowedKeys = name => {
    const match = appSource.match(new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\);`));
    assert.ok(match, `${name} doit rester inspectable.`);
    return [...match[1].matchAll(/'([^']+)'/g)].map(item => item[1]).sort();
  };
  assert.deepEqual([...Object.keys(sessionTargets), 'entries'].sort(), allowedKeys('LEGACY_PRESENCE_SESSION_KEYS'), 'Chaque propriété de séance autorisée doit avoir une preuve explicite.');
  assert.deepEqual(Object.keys(entryTargets).sort(), allowedKeys('LEGACY_PRESENCE_ENTRY_KEYS'), 'Chaque propriété de présence autorisée doit avoir une preuve explicite.');
  assert.ok(appSource.indexOf('await assertPresenceLocalReconciliationCurrent(presenceReconciliation.localProof);') > appSource.indexOf('await assertPresenceReconciliationCurrent(transaction, presenceReconciliation);'), 'La preuve locale doit être revalidée dans la transaction après la preuve serveur.');
  for(const [key, targets] of Object.entries(sessionTargets)){
    for(const mode of ['missing','divergent']){
      const options = {sessions:[cloudSession(richLegacy)], attendance:cloudAttendance(richLegacy)};
      targets.forEach(target => mode === 'missing' ? delete options.sessions[0][target] : (options.sessions[0][target] = `divergent-${key}`));
      await assert.rejects(() => contextFor(options).context.reconcileLegacyPresence({presenceSeanceV3_6_Excel:legacyValue([richLegacy])}, {uid:'uid-a', scope:'all', token:'attempt-a'}), error => error.unresolved?.length > 0, `session.${key} ${mode}`);
    }
  }
  for(const [key, targets] of Object.entries(entryTargets)){
    for(const mode of ['missing','divergent']){
      const options = {sessions:[cloudSession(richLegacy)], attendance:cloudAttendance(richLegacy)};
      targets.forEach(target => mode === 'missing' ? delete options.attendance[0][target] : (options.attendance[0][target] = `divergent-${key}`));
      await assert.rejects(() => contextFor(options).context.reconcileLegacyPresence({presenceSeanceV3_6_Excel:legacyValue([richLegacy])}, {uid:'uid-a', scope:'all', token:'attempt-a'}), error => error.unresolved?.length > 0, `attendance.${key} ${mode}`);
    }
  }

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
    {...completeOptions, missingFrameState:true},
    {...completeOptions, frameState:null},
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

  const changedLocal = contextFor(completeOptions);
  const changedLocalResult = await changedLocal.context.reconcileLegacyPresence({presenceSeanceV3_6_Excel:legacyValue([legacy])}, {uid:'uid-a', scope:'all', token:'attempt-a'});
  changedLocal.state.frameState = {...changedLocal.state.frameState, revision:2};
  await assert.rejects(() => changedLocal.context.assertPresenceLocalReconciliationCurrent(changedLocalResult.localProof), error => error.unresolved?.[0]?.reason === 'concurrent-local-change');
  changedLocal.state.frameState = {revision:1, contextRevision:'context-b'};
  await assert.rejects(() => changedLocal.context.assertPresenceLocalReconciliationCurrent(changedLocalResult.localProof), error => error.unresolved?.[0]?.reason === 'concurrent-local-change');
  changedLocal.state.frameState = {revision:1, contextRevision:'context-a'};
  changedLocal.state.durable = {...changedLocal.state.durable, revision:2};
  await assert.rejects(() => changedLocal.context.assertPresenceLocalReconciliationCurrent(changedLocalResult.localProof), error => error.unresolved?.[0]?.reason === 'concurrent-local-change');

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
