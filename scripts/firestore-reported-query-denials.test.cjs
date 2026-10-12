const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {initializeTestEnvironment} = require('@firebase/rules-unit-testing');
const {collection, doc, getDoc, getDocs, query, setDoc, where} = require('firebase/firestore');

const PROJECT_ID = 'demo-coachpulse-reported-denials';
const ALLOWED_TEAM = 'team-u13-a';
const OTHER_ALLOWED_TEAM = 'team-u13-b';
const OUTSIDE_TEAM = 'team-u16-a';
const COLLECTIONS = ['technicalTests', 'physicalTests', 'injuries'];

const FULL_MODULES = [
  'stats',
  'presences',
  'tests',
  'tests-athletiques',
  'methodologie',
  'medical',
  'playerProfile',
  'teamProfile'
];

const REQUIRED_MODULE = {
  technicalTests: 'tests',
  physicalTests: 'tests-athletiques',
  injuries: 'medical'
};

function staffProfile(overrides = {}) {
  return {
    role: 'ENTRAINEUR',
    permissionLevel: 'EDITEUR',
    status: 'ACTIVE',
    allowedModules: FULL_MODULES,
    authorizedTeamIds: [ALLOWED_TEAM, OTHER_ALLOWED_TEAM],
    teamIds: [ALLOWED_TEAM, OTHER_ALLOWED_TEAM],
    allowedTeamIds: [ALLOWED_TEAM, OTHER_ALLOWED_TEAM],
    ...overrides
  };
}

function teamIdsQuery(db, collectionName, teamIds = [ALLOWED_TEAM]) {
  return query(
    collection(db, collectionName),
    where('teamIds', 'array-contains-any', teamIds)
  );
}

function teamIdQuery(db, collectionName, teamIds = [ALLOWED_TEAM]) {
  return query(collection(db, collectionName), where('teamId', 'in', teamIds));
}

async function outcome(operation) {
  try {
    const value = await operation();
    return {decision: 'ALLOW', value};
  } catch (error) {
    if (error && error.code === 'permission-denied') return {decision: 'DENY', error};
    throw error;
  }
}

async function expectDecision(label, expected, operation) {
  const result = await outcome(operation);
  process.stdout.write(`${label}: ${result.decision}\n`);
  assert.equal(result.decision, expected, `${label} should be ${expected}`);
  return result.value;
}

async function main() {
  const environment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8')}
  });

  try {
    await environment.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, 'staff_members', 'reportedCoach'), staffProfile());
      await setDoc(doc(db, 'staff_members', 'noRequiredModule'), staffProfile({
        allowedModules: ['stats', 'presences', 'methodologie', 'teamProfile']
      }));
      await setDoc(doc(db, 'staff_members', 'outsideCoach'), staffProfile({
        authorizedTeamIds: [OUTSIDE_TEAM], teamIds: [OUTSIDE_TEAM], allowedTeamIds: [OUTSIDE_TEAM]
      }));
      await setDoc(doc(db, 'staff_members', 'inactiveCoach'), staffProfile({status: 'INACTIVE'}));
      await setDoc(doc(db, 'staff_members', 'technicalProfileCoach'), staffProfile({
        allowedModules: ['playerProfile']
      }));
      await setDoc(doc(db, 'staff_members', 'physicalTestsCoach'), staffProfile({
        allowedModules: ['tests']
      }));
      await setDoc(doc(db, 'staff_members', 'physicalProfileCoach'), staffProfile({
        allowedModules: ['playerProfile']
      }));
      await setDoc(doc(db, 'staff_members', 'injuryProfileCoach'), staffProfile({
        allowedModules: ['playerProfile']
      }));

      for (const collectionName of COLLECTIONS) {
        await setDoc(doc(db, collectionName, 'team-id-only'), {teamId: ALLOWED_TEAM});
        await setDoc(doc(db, collectionName, 'team-ids-only'), {teamIds: [ALLOWED_TEAM]});
        await setDoc(doc(db, collectionName, 'both-team-fields'), {
          teamId: ALLOWED_TEAM, teamIds: [ALLOWED_TEAM]
        });
        await setDoc(doc(db, collectionName, 'outside-team'), {
          teamId: OUTSIDE_TEAM, teamIds: [OUTSIDE_TEAM]
        });
        await setDoc(doc(db, collectionName, 'no-team-scope'), {label: 'no team scope'});
      }
    });

    const coachDb = environment.authenticatedContext('reportedCoach').firestore();
    const noModuleDb = environment.authenticatedContext('noRequiredModule').firestore();
    const outsideDb = environment.authenticatedContext('outsideCoach').firestore();
    const inactiveDb = environment.authenticatedContext('inactiveCoach').firestore();
    const unauthenticatedDb = environment.unauthenticatedContext().firestore();
    const technicalProfileDb = environment.authenticatedContext('technicalProfileCoach').firestore();
    const physicalTestsDb = environment.authenticatedContext('physicalTestsCoach').firestore();
    const physicalProfileDb = environment.authenticatedContext('physicalProfileCoach').firestore();
    const injuryProfileDb = environment.authenticatedContext('injuryProfileCoach').firestore();

    process.stdout.write('Authorized team-scoped LIST queries\n');
    for (const collectionName of COLLECTIONS) {
      const byTeamIds = await expectDecision(
        `${collectionName} LIST teamIds array-contains-any [${ALLOWED_TEAM}]`,
        'ALLOW',
        () => getDocs(teamIdsQuery(coachDb, collectionName))
      );
      assert.deepEqual(byTeamIds.docs.map(snapshot => snapshot.id).sort(), [
        'both-team-fields', 'team-ids-only'
      ]);

      const byTeamId = await expectDecision(
        `${collectionName} LIST teamId in [${ALLOWED_TEAM}]`,
        'ALLOW',
        () => getDocs(teamIdQuery(coachDb, collectionName))
      );
      assert.deepEqual(byTeamId.docs.map(snapshot => snapshot.id).sort(), [
        'both-team-fields', 'team-id-only'
      ]);
    }

    process.stdout.write('Alternative permitted modules\n');
    await expectDecision('technicalTests LIST with playerProfile module', 'ALLOW', () =>
      getDocs(teamIdsQuery(technicalProfileDb, 'technicalTests')));
    await expectDecision('physicalTests LIST with tests module', 'ALLOW', () =>
      getDocs(teamIdsQuery(physicalTestsDb, 'physicalTests')));
    await expectDecision('physicalTests LIST with playerProfile module', 'ALLOW', () =>
      getDocs(teamIdQuery(physicalProfileDb, 'physicalTests')));
    await expectDecision('injuries LIST with playerProfile module', 'ALLOW', () =>
      getDocs(teamIdQuery(injuryProfileDb, 'injuries')));

    process.stdout.write('Negative profiles\n');
    for (const collectionName of COLLECTIONS) {
      await expectDecision(
        `${collectionName} LIST without required ${REQUIRED_MODULE[collectionName]} module`,
        'DENY',
        () => getDocs(teamIdsQuery(noModuleDb, collectionName))
      );
      await expectDecision(
        `${collectionName} LIST outside authorized teams`,
        'DENY',
        () => getDocs(teamIdsQuery(outsideDb, collectionName))
      );
      await expectDecision(
        `${collectionName} LIST inactive user`,
        'DENY',
        () => getDocs(teamIdsQuery(inactiveDb, collectionName))
      );
      await expectDecision(
        `${collectionName} LIST unauthenticated user`,
        'DENY',
        () => getDocs(teamIdsQuery(unauthenticatedDb, collectionName))
      );
      await expectDecision(
        `${collectionName} LIST broad teamId query`,
        'DENY',
        () => getDocs(teamIdQuery(coachDb, collectionName, [ALLOWED_TEAM, OUTSIDE_TEAM]))
      );
      await expectDecision(
        `${collectionName} LIST broad teamIds query`,
        'DENY',
        () => getDocs(teamIdsQuery(coachDb, collectionName, [ALLOWED_TEAM, OUTSIDE_TEAM]))
      );
      await expectDecision(
        `${collectionName} LIST without team filter`,
        'DENY',
        () => getDocs(collection(coachDb, collectionName))
      );
    }

    process.stdout.write('Document scope variants\n');
    for (const collectionName of COLLECTIONS) {
      for (const documentId of ['team-id-only', 'team-ids-only', 'both-team-fields']) {
        await expectDecision(
          `${collectionName}/${documentId} GET`,
          'ALLOW',
          () => getDoc(doc(coachDb, collectionName, documentId))
        );
      }
      await expectDecision(
        `${collectionName}/outside-team GET`,
        'DENY',
        () => getDoc(doc(coachDb, collectionName, 'outside-team'))
      );
      await expectDecision(
        `${collectionName}/no-team-scope GET`,
        'DENY',
        () => getDoc(doc(coachDb, collectionName, 'no-team-scope'))
      );
    }

    process.stdout.write('Reported Firestore query reproduction matrix OK\n');
  } finally {
    await environment.cleanup();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
