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
['loadPlayers', 'pullPresenceEventsFromCloud()', 'pullPresenceSettingsFromCloud()']
  .forEach(load => assert(parallelLoad.includes(load), `${load} doit participer au chargement parallèle.`));

const appSource = fs.readFileSync('app.js', 'utf8');
assert(appSource.includes("includeRetiredPresenceSeasons ? 'withRetiredPresenceSeasons' : 'activePresenceSeasons'"), "Le cache doit continuer à distinguer l'accès actif de l'accès historique.");
assert(appSource.includes('if(!includeRetiredPresenceSeasons || !presenceSettingsAdminAllowed()) return [];'), "L'accès explicite aux saisons retirées doit rester disponible et proté.");

console.log('Presence load performance checks passed.');
