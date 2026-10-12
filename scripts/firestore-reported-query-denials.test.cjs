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

function exactQuery(db, collectionName) {
  return query(
    collection(db, collectionName),
    where('teamIds', 'array-contains-any', [ALLOWED_TEAM])
  );
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

    process.stdout.write('Exact Safari queries\n');
    for (const collectionName of COLLECTIONS) {
      await expectDecision(
        `${collectionName} LIST teamIds array-contains-any [${ALLOWED_TEAM}]`,
        'DENY',
        () => getDocs(exactQuery(coachDb, collectionName))
      );
    }

    process.stdout.write('Negative profiles\n');
    for (const collectionName of COLLECTIONS) {
      await expectDecision(
        `${collectionName} LIST without required ${REQUIRED_MODULE[collectionName]} module`,
        'DENY',
        () => getDocs(exactQuery(noModuleDb, collectionName))
      );
      await expectDecision(
        `${collectionName} LIST outside authorized teams`,
        'DENY',
        () => getDocs(exactQuery(outsideDb, collectionName))
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
