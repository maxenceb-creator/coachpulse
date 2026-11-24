const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadService(localStorage={getItem(){ return null; }, setItem(){}, removeItem(){}}){
  const window = {localStorage};
  vm.runInNewContext(fs.readFileSync('shared/services/presence-events-service.js', 'utf8'), {
    window, console, Date, TextEncoder, Set, Map
  });
  return window.CoachPulsePresenceEventsService;
}

function assertLight(snapshot, label){
  assert.deepEqual(Object.keys(snapshot).sort(), [
    'categorie', 'displayName', 'nom', 'playerId', 'prenom', 'subCategory', 'team', 'teamId', 'teamIds'
  ].sort(), `${label}: le snapshot doit respecter la liste blanche`);
  const serialized = JSON.stringify(snapshot).toLowerCase();
  for(const forbidden of ['photo', 'image', 'avatar', 'data:image']){
    assert(!serialized.includes(forbidden), `${label}: ${forbidden} ne doit pas être embarqué`);
  }
}

const service = loadService();
const imageData = 'data:image/png;base64,' + 'x'.repeat(2048);
const event = {
  id:'presence-event-creation', sessionId:'presence-session-creation', date:'2024-11-09',
  teamId:'team-u13-a', teamIds:['team-u13-a'], duration:75, updatedAt:'2026-11-09T10:00:00Z',
  attendance:{
    'player-a':{
      status:'present', minutes:75, comment:'RAS', attendanceId:'attendance-a', teamId:'team-u13-a',
      playerSnapshot:{playerId:'player-a', nom:'Dupont', prenom:'Ava', displayName:'Ava Dupont', team:'U13 A', teamId:'team-u13-a', teamIds:['team-u13-a'], categorie:'U13', subCategory:'A', photo:imageData, image:imageData, avatar:{src:imageData}, nested:{portrait:imageData}}
    }
  }
};

const created = service.sanitizePresenceEvent(event);
assertLight(created.attendance['player-a'].playerSnapshot, 'création');
assert.equal(created.attendance['player-a'].status, 'present');
assert.equal(created.attendance['player-a'].minutes, 75);
assert.equal(created.attendance['player-a'].comment, 'RAS');
assert.equal(created.attendance['player-a'].attendanceId, 'attendance-a');

const previouslySynced = {...created, cloudSyncedAt:'2026-11-09T10:00:00Z'};
const offlineModified = service.markEventPending(previouslySynced, '2026-11-09T10:05:00Z');
assert.equal(offlineModified.cloudSyncedAt, undefined, 'une modification hors ligne doit invalider l’acquittement cloud');
assert.equal(service.isPendingEvent(offlineModified), true, 'la modification doit rester pending après rechargement');
assert.equal(service.isPendingEvent({...previouslySynced, updatedAt:'2026-11-09T10:05:00Z'}), true, 'les anciens pending avec marqueur périmé doivent être reconnus');
const afterOfflineReload = JSON.parse(JSON.stringify(offlineModified));
assert.equal(service.isPendingEvent(afterOfflineReload), true, 'un rechargement hors ligne doit conserver le statut pending');
const olderCloud = {...previouslySynced, attendance:{'player-a':{...created.attendance['player-a'], status:'absent'}}, updatedAt:'2026-11-09T10:01:00Z', cloudSyncedAt:'2026-11-09T10:01:01Z'};
const pendingWithChange = {...afterOfflineReload, attendance:{'player-a':{...created.attendance['player-a'], status:'late', minutes:12, comment:'Transport'}}};
const mergedPending = service.mergeEventVersions(pendingWithChange, olderCloud);
assert.equal(mergedPending.attendance['player-a'].status, 'late', 'la fusion doit préserver la version locale pending face au cloud ancien');
assert.equal(mergedPending.attendance['player-a'].comment, 'Transport');
assert.equal(service.isPendingEvent(mergedPending), true, 'la fusion ne doit pas acquitter prématurément le pending');
const afterReconnectAck = {...mergedPending, cloudSyncedAt:'2026-11-09T10:06:00Z'};
assert.equal(service.isPendingEvent(afterReconnectAck), false, 'la confirmation cloud doit seule acquitter le pending rejoué');

const modified = service.sanitizePresenceEvent({
  ...created,
  updatedAt:'2026-11-09T11:00:00Z',
  attendance:{'player-a':{...created.attendance['player-a'], status:'late', minutes:12, comment:'Transport', playerSnapshot:{...created.attendance['player-a'].playerSnapshot, photo:imageData}}}
});
assertLight(modified.attendance['player-a'].playerSnapshot, 'modification');
assert.deepEqual(
  [modified.attendance['player-a'].status, modified.attendance['player-a'].minutes, modified.attendance['player-a'].comment],
  ['late', 12, 'Transport'],
  'les données métier doivent être préservées'
);

const rows = service.attendanceRowsFromEvent(modified);
assert.equal(rows.length, 1);
assertLight(rows[0].playerSnapshot, 'payload attendance');
assert.equal(rows[0].sessionId, 'presence-session-creation');
assert.equal(rows[0].playerId, 'player-a');
assert.equal(rows[0].status, 'R');

const legacyDirectImages = service.sanitizePresenceEvent({
  ...modified,
  attendance:{'player-a':{
    ...modified.attendance['player-a'], photo:imageData, image:imageData,
    avatar:{src:imageData}, nested:{portrait:imageData, safe:'conservé'}, attachment:imageData
  }}
});
const legacySerialized = JSON.stringify(legacyDirectImages.attendance['player-a']).toLowerCase();
assert(!legacySerialized.includes('data:image'), 'les images Base64 legacy doivent être retirées récursivement');
assert(!legacySerialized.includes('"photo"'), 'les champs photo directs doivent être retirés');
assert.equal(legacyDirectImages.attendance['player-a'].nested.safe, 'conservé');
assert.equal(legacyDirectImages.attendance['player-a'].status, 'late');
assert.equal(legacyDirectImages.attendance['player-a'].minutes, 12);
assert.equal(legacyDirectImages.attendance['player-a'].comment, 'Transport');
assert.equal(legacyDirectImages.attendance['player-a'].attendanceId, 'attendance-a');

const legacyStorage = {
  getItem(key){ return key === service.STORAGE_KEY ? JSON.stringify([event]) : null; },
  setItem(){}, removeItem(){}
};
const legacyService = loadService(legacyStorage);
const legacyRows = legacyService.collectionsForPlayer('player-a');
assert.equal(legacyRows.attendance.length, 1, 'un événement legacy avec photo doit rester lisible');
assertLight(legacyRows.attendance[0].playerSnapshot, 'lecture legacy');

class QuotaStorage {
  get length(){ return 0; }
  key(){ return null; }
  getItem(){ return null; }
  removeItem(){}
  setItem(){ throw Object.assign(new Error('quota exceeded'), {name:'QuotaExceededError', code:22}); }
}
global.localStorage = new QuotaStorage();
delete require.cache[require.resolve('../shared/utils/storage-service.js')];
const storage = require('../shared/utils/storage-service.js');
assert.equal(storage.setJson(service.STORAGE_KEY, [modified], {recover:true}), false, 'un quota dépassé doit produire un retour d’échec explicite');
assert.equal(storage.getJson(service.STORAGE_KEY, [])[0].id, modified.id, 'le fallback mémoire doit préserver l’événement pending');

const pageSource = fs.readFileSync('pages/presences.html', 'utf8');
const appSource = fs.readFileSync('app.js', 'utf8');
assert(pageSource.includes('byId.set(event.id, normalizePresenceEventForStorage(merged));'), 'les fusions local/cloud doivent repasser par la normalisation légère');
assert(pageSource.includes('mergeEventVersions(current, event)'), 'une version locale pending doit rester prioritaire pendant la fusion');
assert(pageSource.includes('if(!isPendingPresenceEvent(event)) return false;'), 'la reprise doit sélectionner tous les événements pending');
assert(pageSource.includes('window.addEventListener("online"'), 'la reconnexion doit relancer explicitement la reprise des présences');
assert(pageSource.includes('contextRefresh:true, syncPending:true, reason:"online"'), 'la reconnexion doit forcer lecture puis rejeu des pending');
assert(pageSource.includes('events[index] = markPresenceEventPending'), 'une présence modifiée doit être marquée pending');
assert(pageSource.includes('if(!persisted) warnPresenceLocalSaveFailure();'), 'la sauvegarde locale doit vérifier son retour');
assert(pageSource.includes('code:"presence/local-save-failed"'), 'le formulaire ne doit pas annoncer une sauvegarde locale réussie après échec');
assert(appSource.includes('const sanitizedEvent = service?.sanitizePresenceEvent'), 'le payload Firestore doit partir d’un événement assaini');
assert(appSource.includes('service?.sanitizeAttendanceMap ? service.sanitizeAttendanceMap'), 'sessions.attendance doit être assaini avant écriture');
assert(appSource.includes('playerSnapshot:service?.lightPlayerSnapshot'), 'les documents attendance doivent reconstruire un snapshot léger');

console.log('Presence light snapshot checks passed: creation, modification, merge normalization, local quota, Firestore payload guards and legacy reads.');
