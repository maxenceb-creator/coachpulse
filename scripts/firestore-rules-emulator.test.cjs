const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {initializeTestEnvironment, assertSucceeds, assertFails} = require('@firebase/rules-unit-testing');
const {collection, doc, getDoc, getDocs, query, setDoc, where, writeBatch} = require('firebase/firestore');

async function main() {
  const environment = await initializeTestEnvironment({
    projectId: 'demo-coachpulse-rules',
    firestore: {rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8')}
  });
  try {
    await environment.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, 'staff_members', 'coach'), {
        status: 'ACTIVE', role: 'COACH', permissionLevel: 'SAISIE',
        allowedModules: ['database', 'playerProfile', 'stats', 'presences', 'tests', 'medical'],
        authorizedTeamIds: ['U11']
      });
      await setDoc(doc(db, 'staff_members', 'reader'), {
        status: 'ACTIVE', role: 'LECTURE', permissionLevel: 'LECTEUR',
        allowedModules: ['database', 'playerProfile', 'stats', 'presences', 'tests', 'medical'],
        authorizedTeamIds: ['U11']
      });
      await setDoc(doc(db, 'staff_members', 'editor'), {
        status: 'ACTIVE', role: 'RESPONSABLE', permissionLevel: 'EDITEUR',
        allowedModules: ['stats', 'presences', 'tests'], authorizedTeamIds: ['U11']
      });
      await setDoc(doc(db, 'staff_members', 'noTests'), {
        status: 'ACTIVE', role: 'COACH', permissionLevel: 'SAISIE',
        allowedModules: ['presences'], authorizedTeamIds: ['U11']
      });
      await setDoc(doc(db, 'staff_members', 'admin'), {
        status: 'ACTIVE', role: 'ADMIN', permissionLevel: 'ADMIN'
      });
      await setDoc(doc(db, 'staff_members', 'limited'), {
        status: 'ACTIVE', role: 'COACH', permissionLevel: 'SAISIE',
        allowedModules: ['database', 'tests'], authorizedTeamIds: ['U11'], playerIds: ['pU11']
      });
      await setDoc(doc(db, 'staff_members', 'allPlayers'), {
        status: 'ACTIVE', role: 'COACH', permissionLevel: 'SAISIE',
        allowedModules: ['tests'], authorizedTeamIds: ['U11'],
        moduleScopes: {tests: {allPlayers: true}}
      });
      await setDoc(doc(db, 'staff_members', 'inactive'), {
        status: 'INACTIVE', role: 'ADMIN', permissionLevel: 'ADMIN'
      });
      for (const teamId of ['U11', 'U13']) {
        await setDoc(doc(db, 'players', `p${teamId}`), {playerId: `p${teamId}`, teamId, status: 'ACTIVE'});
        await setDoc(doc(db, 'matches', `m${teamId}`), {matchId: `m${teamId}`, teamId});
        await setDoc(doc(db, 'sessions', `s${teamId}`), {sessionId: `s${teamId}`, teamId, teamIds: [teamId], source: 'Présences', createdFromPresenceModule: true});
        await setDoc(doc(db, 'matchEvents', `e${teamId}`), {eventId: `e${teamId}`, matchId: `m${teamId}`});
        await setDoc(doc(db, 'attendance', `a${teamId}`), {attendanceId: `a${teamId}`, sessionId: `s${teamId}`, teamId});
        await setDoc(doc(db, 'technicalTests', `t${teamId}`), {testId: `t${teamId}`, playerId: `p${teamId}`});
        await setDoc(doc(db, 'injuries', `i${teamId}`), {injuryId: `i${teamId}`, playerId: `p${teamId}`});
      }
      await setDoc(doc(db, 'players', 'pDual'), {
        playerId: 'pDual', teamId: 'U13', teamIds: ['U13', 'U11'], status: 'ACTIVE'
      });
      await setDoc(doc(db, 'technicalTests', 'tDual'), {testId: 'tDual', playerId: 'pDual'});
      await setDoc(doc(db, 'players', 'pLegacy'), {playerId: 'pLegacy', teamId: 'U11', status: 'ACTIVE'});
      await setDoc(doc(db, 'sessions', 'sLegacy'), {sessionId: 'sLegacy', teamId: 'U11', source: 'Présences'});
      await setDoc(doc(db, 'attendance', 'aLegacy'), {attendanceId: 'aLegacy', sessionId: 'sLegacy'});
      await setDoc(doc(db, 'attendance', 'aDual'), {
        attendanceId: 'aDual', sessionId: 'sU11', playerId: 'pDual', teamId: 'U13', teamIds: ['U13', 'U11']
      });
      await setDoc(doc(db, 'technicalTests', 'tLegacy'), {testId: 'tLegacy', playerId: 'pLegacy'});
      await setDoc(doc(db, 'sessions', 'xlsx-2026-05-old'), {sessionId: 'xlsx-2026-05-old', teamId: 'U11', source: 'Import présence'});
      await setDoc(doc(db, 'players', 'pOrphan'), {playerId: 'pOrphan', status: 'ACTIVE'});
      await setDoc(doc(db, 'sessions', 'sOrphan'), {sessionId: 'sOrphan', source: 'Présences'});
    });

    const db = environment.authenticatedContext('coach').firestore();
    for (const [collection, prefix] of [
      ['players', 'p'], ['matches', 'm'], ['sessions', 's'], ['matchEvents', 'e'],
      ['attendance', 'a'], ['technicalTests', 't'], ['injuries', 'i']
    ]) {
      process.stdout.write(`Checking ${collection} authorized read\n`);
      await assertSucceeds(getDoc(doc(db, collection, `${prefix}U11`)));
      process.stdout.write(`Checking ${collection} denied read\n`);
      await assertFails(getDoc(doc(db, collection, `${prefix}U13`)));
    }
    await assertSucceeds(getDoc(doc(db, 'players', 'pDual')));
    await assertSucceeds(getDoc(doc(db, 'technicalTests', 'tDual')));
    await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), 'players', 'pU11')));
    await assertFails(getDoc(doc(db, 'unexpected', 'record')));
    const readerDb = environment.authenticatedContext('reader').firestore();
    const editorDb = environment.authenticatedContext('editor').firestore();
    const noTestsDb = environment.authenticatedContext('noTests').firestore();
    const adminDb = environment.authenticatedContext('admin').firestore();
    const limitedDb = environment.authenticatedContext('limited').firestore();
    const allPlayersDb = environment.authenticatedContext('allPlayers').firestore();
    const inactiveDb = environment.authenticatedContext('inactive').firestore();
    process.stdout.write('Checking role and player scope reads\n');
    await assertSucceeds(getDoc(doc(readerDb, 'players', 'pU11')));
    await assertFails(getDoc(doc(readerDb, 'players', 'pU13')));
    await assertSucceeds(getDoc(doc(adminDb, 'players', 'pU13')));
    await assertSucceeds(getDoc(doc(limitedDb, 'players', 'pU11')));
    await assertFails(getDoc(doc(limitedDb, 'players', 'pDual')));
    await assertSucceeds(getDoc(doc(allPlayersDb, 'players', 'pU13')));
    await assertSucceeds(getDoc(doc(allPlayersDb, 'technicalTests', 'tU13')));
    await assertFails(getDoc(doc(inactiveDb, 'players', 'pU11')));
    await assertFails(getDoc(doc(noTestsDb, 'technicalTests', 'tU11')));
    process.stdout.write('Checking historical scope formats\n');
    for (const [name, id] of [
      ['players', 'pLegacy'], ['sessions', 'sLegacy'], ['attendance', 'aLegacy'],
      ['technicalTests', 'tLegacy'], ['sessions', 'xlsx-2026-05-old']
    ]) await assertSucceeds(getDoc(doc(db, name, id)));
    await assertFails(getDoc(doc(db, 'players', 'pOrphan')));
    await assertFails(getDoc(doc(db, 'sessions', 'sOrphan')));
    process.stdout.write('Checking read-only role cannot write\n');
    await assertFails(setDoc(doc(readerDb, 'technicalTests', 'readerTest'), {testId: 'readerTest', playerId: 'pU11'}));
    await assertFails(setDoc(doc(readerDb, 'matches', 'readerMatch'), {matchId: 'readerMatch', teamId: 'U11'}));
    await assertFails(setDoc(doc(noTestsDb, 'technicalTests', 'noModuleTest'), {testId: 'noModuleTest', playerId: 'pU11'}));
    process.stdout.write('Checking editor and admin writes\n');
    await assertSucceeds(setDoc(doc(editorDb, 'technicalTests', 'editorTest'), {testId: 'editorTest', playerId: 'pU11'}));
    await assertSucceeds(setDoc(doc(adminDb, 'matches', 'adminMatch'), {matchId: 'adminMatch', teamId: 'U13'}));
    process.stdout.write('Checking authorized match update\n');
    await assertSucceeds(setDoc(doc(db, 'matches', 'mU11'), {matchId: 'mU11', teamId: 'U11', score: '1-0'}));
    process.stdout.write('Checking authorized match event update\n');
    await assertSucceeds(setDoc(doc(db, 'matchEvents', 'eU11'), {eventId: 'eU11', matchId: 'mU11', type: 'goal'}));
    process.stdout.write('Checking authorized attendance create\n');
    await assertSucceeds(setDoc(doc(db, 'attendance', 'newU11'), {attendanceId: 'newU11', sessionId: 'sU11', teamId: 'U11'}));
    process.stdout.write('Checking authorized attendance update\n');
    await assertSucceeds(setDoc(doc(db, 'attendance', 'aU11'), {attendanceId: 'aU11', sessionId: 'sU11', teamId: 'U11', status: 'P'}));
    process.stdout.write('Checking authorized technical test create\n');
    await assertSucceeds(setDoc(doc(db, 'technicalTests', 'newU11'), {testId: 'newU11', playerId: 'pU11'}));
    process.stdout.write('Checking authorized technical test update\n');
    await assertSucceeds(setDoc(doc(db, 'technicalTests', 'tU11'), {testId: 'tU11', playerId: 'pU11', finalized: true}));
    process.stdout.write('Checking rejected cross-team match update\n');
    await assertFails(setDoc(doc(db, 'matches', 'mU11'), {matchId: 'mU11', teamId: 'U13'}));
    process.stdout.write('Checking rejected cross-team writes\n');
    await assertFails(setDoc(doc(db, 'matchEvents', 'newU13'), {eventId: 'newU13', matchId: 'mU13'}));
    await assertFails(setDoc(doc(db, 'matchEvents', 'eU11'), {eventId: 'eU11', matchId: 'mU13'}));
    await assertFails(setDoc(doc(db, 'attendance', 'newU13'), {attendanceId: 'newU13', sessionId: 'sU13'}));
    await assertFails(setDoc(doc(db, 'attendance', 'aU11'), {attendanceId: 'aU11', sessionId: 'sU13'}));
    await assertFails(setDoc(doc(db, 'technicalTests', 'newU13'), {testId: 'newU13', playerId: 'pU13'}));
    await assertFails(setDoc(doc(db, 'technicalTests', 'tU11'), {testId: 'tU11', playerId: 'pU13'}));
    await assertFails(setDoc(doc(limitedDb, 'matchEvents', 'limitedEvent'), {eventId: 'limitedEvent', matchId: 'mU11'}));
    await assertFails(setDoc(doc(inactiveDb, 'matches', 'inactiveMatch'), {matchId: 'inactiveMatch', teamId: 'U11'}));
    process.stdout.write('Checking atomic presence deletion and tombstone\n');
    const sessionQueries = [
      query(collection(db, 'sessions'), where('source', '==', 'Présences'), where('teamId', '==', 'U11')),
      query(collection(db, 'sessions'), where('source', '==', 'Présences'), where('teamIds', 'array-contains', 'U11')),
      query(collection(db, 'sessions'), where('createdFromPresenceModule', '==', true), where('teamId', '==', 'U11')),
      query(collection(db, 'sessions'), where('createdFromPresenceModule', '==', true), where('teamIds', 'array-contains', 'U11'))
    ];
    for (const sessionQuery of sessionQueries) {
      assert.equal((await assertSucceeds(getDocs(sessionQuery))).docs.some(snapshot => snapshot.id === 'sU11'), true);
    }
    const directAttendanceQuery = query(collection(db, 'attendance'), where('teamId', '==', 'U11'));
    const dualAttendanceQuery = query(collection(db, 'attendance'), where('teamIds', 'array-contains', 'U11'));
    const [directAttendance, dualAttendance] = await Promise.all([
      assertSucceeds(getDocs(directAttendanceQuery)), assertSucceeds(getDocs(dualAttendanceQuery))
    ]);
    const matchingAttendance = new Map();
    for (const result of [directAttendance, dualAttendance]) result.forEach(snapshot => {
      if (snapshot.data().sessionId === 'sU11') matchingAttendance.set(snapshot.id, snapshot.ref);
    });
    assert.equal(matchingAttendance.size, 3);
    const deletion = writeBatch(db);
    matchingAttendance.forEach(ref => deletion.delete(ref));
    deletion.delete(doc(db, 'sessions', 'sU11'));
    deletion.set(doc(db, 'presenceDeletionLogs', 'sU11'), {
      deletionId: 'sU11', sessionId: 'sU11', teamId: 'U11', source: 'Présences'
    });
    await assertSucceeds(deletion.commit());
    assert.equal((await getDoc(doc(db, 'sessions', 'sU11'))).exists(), false);
    assert.equal((await getDocs(directAttendanceQuery)).size, 0);
    assert.equal((await getDocs(dualAttendanceQuery)).size, 0);
    await assertFails(setDoc(doc(db, 'sessions', 'sU11'), {sessionId: 'sU11', teamId: 'U11', source: 'Présences'}));
    await assertFails(setDoc(doc(db, 'attendance', 'recreatedU11'), {attendanceId: 'recreatedU11', sessionId: 'sU11'}));
    const foreignDeletion = writeBatch(db);
    foreignDeletion.delete(doc(db, 'sessions', 'sU13'));
    foreignDeletion.set(doc(db, 'presenceDeletionLogs', 'sU13'), {
      deletionId: 'sU13', sessionId: 'sU13', teamId: 'U13', source: 'Présences'
    });
    await assertFails(foreignDeletion.commit());
    assert.equal((await getDoc(doc(adminDb, 'sessions', 'sU13'))).exists(), true);
    assert.equal((await getDoc(doc(db, 'matches', 'mU11'))).data().teamId, 'U11');
    process.stdout.write('Firestore rules emulator guards OK\n');
  } finally {
    await environment.cleanup();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
