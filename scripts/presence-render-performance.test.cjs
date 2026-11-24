const assert = require('assert/strict');
const fs = require('fs');
const vm = require('vm');

const pageSource = fs.readFileSync('pages/presences.html', 'utf8');
const appSource = fs.readFileSync('app.js', 'utf8');
const serviceSource = fs.readFileSync('shared/services/presence-events-service.js', 'utf8');

const renderBlock = pageSource.match(/function render\(\)\{[\s\S]*?\n      \}\n      async function initPresenceCloud/)?.[0] || '';
assert(renderBlock, 'Le routeur de rendu Présences doit rester défini.');
['calendar', 'sessions', 'reports', 'prevention', 'settings'].forEach(panel => {
  assert(renderBlock.includes(`activePresenceTab === "${panel}"`), `Le panneau ${panel} doit être rendu explicitement.`);
});
assert(!renderBlock.includes('renderCalendarPage(events);\n        renderReports(events);'), 'Les panneaux invisibles ne doivent pas être rendus en chaîne.');
assert(renderBlock.includes('isPresenceAdmin()) renderSettings()'), 'Le panneau Paramètres doit conserver la garde ADMIN.');
assert(pageSource.includes('activePresenceTab = tab;'), 'La navigation doit mémoriser le panneau actif.');

const initSessionsBlock = pageSource.match(/function initSessions\(\)\{[\s\S]*?\n      \}\n      function activateTab/)?.[0] || '';
assert(initSessionsBlock, "L'initialisation des séances doit rester définie.");
assert(!initSessionsBlock.trimEnd().endsWith('renderSessionList();\n      }'), "L'initialisation ne doit pas construire la liste d'un panneau invisible.");

assert(pageSource.includes('presencePlayersByIdCache = new Map'), 'Les joueuses doivent être indexées une seule fois par playerId.');
const playerByIdBlock = pageSource.match(/function playerById\([\s\S]*?\n      \}/)?.[0] || '';
assert(playerByIdBlock.includes('presencePlayersByIdCache?.get'), 'playerById doit utiliser l’index mémoire.');
assert(!playerByIdBlock.includes('readJson('), 'playerById ne doit plus relire localStorage pour chaque présence.');

const sandbox = {window:{localStorage:{getItem:() => null, setItem:() => {}}}, console};
vm.runInNewContext(serviceSource, sandbox);
const service = sandbox.window.CoachPulsePresenceEventsService;
assert.equal(typeof service.indexAttendanceRowsBySessionId, 'function', "L'index des présences doit être exposé par le service partagé.");

function rowsFor(sessionCount, playersPerSession, teamId){
  return Array.from({length:sessionCount * playersPerSession}, (_, index) => ({
    attendanceId:`attendance-${index}`,
    sessionId:`session-${Math.floor(index / playersPerSession)}`,
    playerId:`player-${index % playersPerSession}`,
    teamId,
    status:index % 7 === 0 ? 'A' : 'P'
  }));
}

[8, 37, 100].forEach(sessionCount => {
  const rows = rowsFor(sessionCount, 48, 'team-limited');
  const indexed = service.indexAttendanceRowsBySessionId(rows);
  assert.equal(indexed.size, sessionCount, `${sessionCount} séances doivent être indexées sans perte.`);
  assert.equal([...indexed.values()].flat().length, rows.length, `${sessionCount} séances doivent préserver toutes les présences.`);
});

const trainerRows = rowsFor(37, 48, 'team-limited');
const adminRows = [...trainerRows, ...rowsFor(63, 48, 'team-global')];
assert.equal([...service.indexAttendanceRowsBySessionId(trainerRows).values()].flat().length, trainerRows.length, 'Le périmètre ENTRAÎNEUR doit rester inchangé.');
assert.equal([...service.indexAttendanceRowsBySessionId(adminRows).values()].flat().length, adminRows.length, 'Le périmètre ADMIN global doit rester inchangé.');

assert(appSource.includes("const attendance = scopedRecordsForModuleAccess(attendanceRows, 'presences');"), 'Les permissions doivent être appliquées avant l’indexation.');
assert(appSource.indexOf("scopedRecordsForModuleAccess(attendanceRows, 'presences')") < appSource.indexOf('indexAttendanceRowsBySessionId?.(attendance)'), 'Aucune présence ne doit être indexée avant le filtrage des permissions.');
assert(!appSource.includes('presenceCloudEventFromSession(session, attendance)'), 'Le rendu cloud ne doit plus rescanner toutes les présences pour chaque séance.');

console.log('Presence render performance checks passed for 8, 37 and 100 sessions.');
