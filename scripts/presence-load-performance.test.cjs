const assert = require('assert/strict');
const fs = require('fs');

const source = fs.readFileSync('pages/presences.html', 'utf8');

const pullEvents = source.match(/async function pullPresenceEventsFromCloud\(\)[\s\S]*?\n      }/)?.[0] || '';
assert(pullEvents, 'Le chargement cloud des séances doit rester défini.');
assert(pullEvents.includes('api.presenceListEvents()'), 'Le chargement normal ne doit lire que les saisons actives.');
assert(!pullEvents.includes('includeRetiredPresenceSeasons:true'), 'Les saisons retirées doivent rester accessibles uniquement sur demande explicite.');
assert(!pullEvents.includes('deleteRetiredPresenceEventsFromCloud'), 'Le chargement normal ne doit pas modifier les saisons retirées.');

const initCloud = source.match(/async function initPresenceCloud\(\)[\s\S]*?\n      }\n      initTabs\(\);/)?.[0] || '';
assert(initCloud, "L'initialisation cloud du module Séances doit rester définie.");
const parallelLoad = initCloud.match(/Promise\.all\(\[([\s\S]*?)\]\)/)?.[1] || '';
['loadPlayers', 'pullPresenceMonthFromCloud(presenceMonthKey(calendarPageMonth))', 'pullPresenceSettingsFromCloud()']
  .forEach(load => assert(parallelLoad.includes(load), `${load} doit participer au chargement parallèle.`));

const appSource = fs.readFileSync('app.js', 'utf8');
assert(appSource.includes("includeRetiredPresenceSeasons ? 'withRetiredPresenceSeasons' : 'activePresenceSeasons'"), "Le cache doit continuer à distinguer l'accès actif de l'accès historique.");
assert(appSource.includes('if(!includeRetiredPresenceSeasons || !presenceSettingsAdminAllowed()) return [];'), "L'accès explicite aux saisons retirées doit rester disponible et proté.");

['local-cache-read', 'normalization', 'first-render', 'firestore-load', 'post-sync-render', 'ui-long-task']
  .forEach(stage => assert(source.includes(`"${stage}"`), `Le diagnostic doit mesurer ${stage}.`));
assert(source.includes('localStorage.getItem("coachpulse:debugPerf") === "1"'), 'Le diagnostic UI doit être désactivé hors mode debug.');
assert(source.includes('window.CoachPulsePresencePerf = api'), 'Un snapshot du diagnostic Séances doit être accessible en debug.');
assert(source.includes('entry.duration > 50'), 'Les longues tâches UI doivent respecter le seuil de 50 ms.');
assert(appSource.includes("recordPerfEvent('presences:firestore-load'"), 'Le diagnostic doit relever la durée, les requêtes et les documents Firestore.');
assert(appSource.includes("recordPerfEvent('presences:firestore-cache-hit'"), 'Le diagnostic doit distinguer un cache Firestore réutilisé.');
assert(appSource.includes("recordPerfEvent('presences:firestore-month-load'"), 'Le diagnostic doit mesurer les lectures Firestore mensuelles.');
assert(source.includes('prefetchAdjacentPresenceMonths'), 'Les mois adjacents doivent être préchargés en arrière-plan.');
assert(source.includes('coachpulse:presenceProgressiveMonths'), "Le retour au chargement historique doit rester pilotable.");
assert(source.includes('failed-precondition'), "L'absence d'index doit déclencher le chargement historique.");
assert(source.includes('presenceNavigationRequestId'), 'Les réponses mensuelles obsolètes doivent être ignorées après navigation.');
assert(appSource.includes('presenceLoadEventAttendance'), 'Le détail des présences doit être chargé à la demande.');

const diagnosticBlock = source.match(/const presencePerf = \(\(\) => \{[\s\S]*?\n      \}\)\(\);/)?.[0] || '';
['playerId', 'teamId', 'email', 'name', 'title'].forEach(field => {
  assert(!diagnosticBlock.includes(field), `Le diagnostic ne doit pas exposer de donnée personnelle (${field}).`);
});

console.log('Presence load performance checks passed.');
