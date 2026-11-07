const assert = require('assert/strict');
const fs = require('fs');
const presenceContexts = require('../shared/services/presence-access-context-service.js');

const appSource = fs.readFileSync('app.js', 'utf8');
const pageSource = fs.readFileSync('pages/presences.html', 'utf8');
const indexes = JSON.parse(fs.readFileSync('firestore.indexes.json', 'utf8'));

const monthlyStart = appSource.indexOf('async function presenceListEventsByMonth');
const monthlyEnd = appSource.indexOf('async function presenceLoadEventAttendance', monthlyStart);
const monthlyBlock = appSource.slice(monthlyStart, monthlyEnd);
assert(monthlyStart >= 0 && monthlyEnd > monthlyStart, 'Le lecteur mensuel doit être défini.');
assert(monthlyBlock.includes("{field:'date', operator:'>=', value:range.start}"), 'La borne de début du mois est obligatoire.');
assert(monthlyBlock.includes("{field:'date', operator:'<', value:range.next}"), 'La borne exclusive du mois suivant est obligatoire.');
assert(!monthlyBlock.includes("collection(db, 'attendance')"), 'Le chargement mensuel ne doit pas lire les présences détaillées.');
assert(monthlyBlock.includes('complete:true'), 'Un mois ne doit être marqué complet qu’après toutes les requêtes réussies.');
assert(monthlyBlock.includes('requestId'), 'Le cache mensuel doit rejeter les écritures obsolètes.');

const attendanceStart = monthlyEnd;
const attendanceEnd = appSource.indexOf('function presenceSettingsAdminAllowed', attendanceStart);
const attendanceBlock = appSource.slice(attendanceStart, attendanceEnd);
assert(attendanceBlock.includes("where('sessionId', 'in', [sessionId])"), 'Le détail doit être borné à une séance.');
assert(attendanceBlock.includes("where('teamId', 'in', chunk)"), 'Le détail ENTRAÎNEUR doit contraindre teamId.');
assert(attendanceBlock.includes("where('teamIds', 'array-contains-any', chunk)"), 'Le détail ENTRAÎNEUR doit contraindre les alias teamIds.');
assert(attendanceBlock.includes("scopedRecordsForModuleAccess(uniqueRows, 'presences')"), 'Les permissions doivent être réappliquées au détail.');

['createdFromPresenceModule', 'source'].forEach(discriminator => {
  const adminIndex = indexes.indexes.some(index => index.collectionGroup === 'sessions'
    && index.fields.some(field => field.fieldPath === discriminator)
    && index.fields.some(field => field.fieldPath === 'date'));
  assert(adminIndex, `Index mensuel global manquant pour ${discriminator}.`);
  ['teamId', 'teamIds'].forEach(scope => {
    const scopedIndex = indexes.indexes.some(index => index.collectionGroup === 'sessions'
      && index.fields.some(field => field.fieldPath === discriminator)
      && index.fields.some(field => field.fieldPath === scope)
      && index.fields.some(field => field.fieldPath === 'date'));
    assert(scopedIndex, `Index mensuel ${scope} manquant pour ${discriminator}.`);
  });
});

['teamId', 'teamIds'].forEach(scope => {
  const detailIndex = indexes.indexes.some(index => index.collectionGroup === 'attendance'
    && index.fields.some(field => field.fieldPath === 'sessionId')
    && index.fields.some(field => field.fieldPath === scope));
  assert(detailIndex, `Index de détail attendance manquant pour ${scope}.`);
});

assert(pageSource.includes('presenceCompleteMonths.add(scopedMonthKey)'), 'Le mois complet doit être suivi par contexte côté interface.');
assert(pageSource.includes('presenceMonthLoads.has(scopedMonthKey)'), 'Les lectures concurrentes du même contexte/mois doivent être dédupliquées.');
assert(pageSource.includes('presenceAdjacentMonthKey(monthKey, offset)'), 'M-1 et M+1 doivent être préchargés.');
assert(pageSource.includes('["reports","prevention"].includes(tab)'), 'Les vues historiques doivent conserver un chargement complet à la demande.');
assert(pageSource.includes('if(event.cloudSyncedAt) return false;'), 'Un cache historique déjà synchronisé ne doit pas être repoussé après une lecture mensuelle.');
assert(pageSource.includes('function invalidatePresenceAccessContext'), 'Le changement de droits doit avoir un point d’invalidation unique.');
assert(pageSource.includes('presenceContextIsCurrent(token)'), 'Les résultats asynchrones doivent vérifier leur génération avant application.');
assert(pageSource.includes('stopPresenceEventsSubscription?.()'), 'Le listener du contexte précédent doit être détaché immédiatement.');
assert(monthlyBlock.includes('cacheGeneration !== presenceCacheGeneration'), 'Le cache mensuel central doit rejeter une ancienne génération.');
assert(attendanceBlock.includes('cacheGeneration !== presenceCacheGeneration'), 'Le détail attendance doit rejeter une ancienne génération.');

function access(uid, teams, options={}){
  return {
    type:'coachpulse-access-context',
    user:{uid},
    profile:{
      uid,
      permissionLevel:options.permissionLevel || 'EDITEUR',
      role:options.role || 'ENTRAINEUR',
      authorizedTeamIds:teams,
      moduleScopes:{presences:{allPlayers:options.allPlayers === true}},
      modulePermissions:{presences:{read:true, write:true}}
    },
    modules:{presences:{read:true, write:true, delete:false}}
  };
}

const events = [
  {id:'u13', teamId:'team-u13-a'},
  {id:'u11', teamId:'team-u11-a'},
  {id:'unknown'}
];

async function testContextIsolation(){
  const trainerA = access('uid-a', ['team-u13-a']);
  const trainerB = access('uid-b', ['team-u11-a']);
  assert.notEqual(presenceContexts.contextKey(trainerA), presenceContexts.contextKey(trainerB), 'Deux UID ne doivent jamais partager un cache.');
  assert.deepEqual(presenceContexts.filterEvents(trainerB, events).map(row => row.id), ['u11'], 'B ne doit voir aucune donnée U13, même offline.');
  assert.deepEqual(presenceContexts.filterPlayers(trainerB, [
    {id:'player-u13', rosterTeamIds:['team-u13-a']},
    {id:'player-u11', seasonHistory:{'2026-2027':{teamId:'team-u11-a'}}}
  ]).map(row => row.id), ['player-u11'], 'Le roster offline doit être filtré avec le même contexte.');

  const trainer = access('uid-a', ['team-u13-a']);
  const admin = access('uid-a', ['team-u13-a'], {permissionLevel:'ADMIN', role:'ADMIN', allPlayers:true});
  assert.notEqual(presenceContexts.contextKey(trainer), presenceContexts.contextKey(admin), 'ENTRAINEUR et ADMIN doivent avoir des caches distincts.');

  const tracker = presenceContexts.createTracker(admin);
  const adminToken = tracker.capture();
  tracker.update(trainer);
  assert.equal(tracker.isCurrent(adminToken), false, 'ADMIN vers ENTRAINEUR doit invalider l’ancienne génération.');
  assert.deepEqual(presenceContexts.filterEvents(trainer, events).map(row => row.id), ['u13'], 'Les données hors équipes doivent disparaître immédiatement.');

  const wide = access('uid-a', ['team-u11-a','team-u13-a']);
  tracker.update(wide);
  const wideMonthKey = tracker.monthKey('2026-11');
  const wideGeneration = tracker.generation();
  tracker.update(access('uid-a', ['team-u11-a']));
  assert.notEqual(tracker.monthKey('2026-11'), wideMonthKey, 'Le retrait d’une équipe doit isoler le cache mensuel.');
  assert.equal(tracker.generation(), wideGeneration + 1, 'Le retrait d’une équipe doit incrémenter la génération.');

  const permissionGeneration = tracker.generation();
  tracker.update(access('uid-a', ['team-u11-a'], {permissionLevel:'LECTEUR'}));
  tracker.update(access('uid-a', ['team-u11-a'], {permissionLevel:'EDITEUR', role:'RESPONSABLE', allPlayers:true}));
  assert.equal(tracker.generation(), permissionGeneration + 2, 'Permission, rôle et allPlayers doivent changer de génération sans changement d’UID.');

  const requestToken = tracker.capture();
  let applyCount = 0;
  const oldRequest = Promise.resolve().then(() => { if(tracker.isCurrent(requestToken)) applyCount += 1; });
  tracker.update(access('', []));
  await oldRequest;
  assert.equal(applyCount, 0, 'Une réponse arrivée après logout ne doit produire aucun effet.');

  let listenerCallbacks = 0;
  let unsubscribeCount = 0;
  const listenerToken = tracker.capture();
  const oldCallback = () => { if(tracker.isCurrent(listenerToken)) listenerCallbacks += 1; };
  const unsubscribe = () => { unsubscribeCount += 1; };
  unsubscribe();
  tracker.update(trainerB);
  oldCallback();
  const newToken = tracker.capture();
  if(tracker.isCurrent(newToken)) listenerCallbacks += 1;
  assert.equal(unsubscribeCount, 1, 'L’ancien listener doit être désabonné.');
  assert.equal(listenerCallbacks, 1, 'Seul le listener du nouveau contexte doit avoir un effet.');

  let navigationRequestId = 0;
  let visibleMonth = '';
  const navigate = async (month, delay) => {
    const requestId = ++navigationRequestId;
    const token = tracker.capture();
    await new Promise(resolve => setTimeout(resolve, delay));
    if(requestId === navigationRequestId && tracker.isCurrent(token)) visibleMonth = month;
  };
  await Promise.all([navigate('2026-10', 12), navigate('2026-11', 8), navigate('2026-12', 4), navigate('2026-11', 0)]);
  assert.equal(visibleMonth, '2026-11', 'La navigation rapide doit conserver uniquement le dernier mois visible.');
}

testContextIsolation().then(() => {
  console.log('Presence progressive month checks passed.');
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
