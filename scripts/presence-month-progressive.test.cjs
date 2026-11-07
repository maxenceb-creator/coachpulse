const assert = require('assert/strict');
const fs = require('fs');

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

assert(pageSource.includes('presenceCompleteMonths.add(monthKey)'), 'Le mois complet doit être suivi côté interface.');
assert(pageSource.includes('presenceMonthLoads.has(monthKey)'), 'Les lectures concurrentes du même mois doivent être dédupliquées.');
assert(pageSource.includes('presenceAdjacentMonthKey(monthKey, offset)'), 'M-1 et M+1 doivent être préchargés.');
assert(pageSource.includes('["reports","prevention"].includes(tab)'), 'Les vues historiques doivent conserver un chargement complet à la demande.');
assert(pageSource.includes('if(event.cloudSyncedAt) return false;'), 'Un cache historique déjà synchronisé ne doit pas être repoussé après une lecture mensuelle.');

console.log('Presence progressive month checks passed.');
