const assert = require('node:assert/strict');
const fs = require('node:fs');

const hosting = fs.readFileSync('.github/workflows/firebase-hosting-merge.yml', 'utf8');
const rules = fs.readFileSync('.github/workflows/firebase-firestore-rules-production.yml', 'utf8');
const preview = fs.readFileSync('.github/workflows/firebase-hosting-pull-request.yml', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

assert.match(hosting, /push:\s*\n\s*branches:\s*\n\s*- main/);
assert.match(hosting, /verify-active-firestore-rules\.cjs --expected-sha256-file firestore\.compat\.sha256/);
assert.match(hosting, /Deploy Firebase Hosting only/);
assert.doesNotMatch(hosting, /deploy --only firestore:rules/);
assert.doesNotMatch(hosting, /workflow_dispatch/);

assert.match(rules, /workflow_dispatch:/);
assert.doesNotMatch(rules, /\npush:/);
assert.doesNotMatch(rules, /\npull_request:/);
assert.match(rules, /github\.ref == 'refs\/heads\/main'/);
assert.match(rules, /inputs\.confirmation == 'DEPLOY_FIRESTORE_RULES'/);
assert.match(rules, /expected_active_sha256/);
assert.match(rules, /verify-active-firestore-rules\.cjs --expected-sha256/);
assert.match(rules, /deploy --only firestore:rules/);
assert.match(rules, /HTTP Error: 409/);
assert.match(rules, /HTTP Error: \(429\|500\|502\|503\|504\)/);
assert.match(rules, /Verify deployed Firestore Rules fingerprint/);
assert.doesNotMatch(rules, /action-hosting-deploy|hosting:channel:deploy/);

assert.match(preview, /on: pull_request/);
assert.doesNotMatch(preview, /deploy --only firestore:rules/);
assert.match(preview, /--expected-sha256-file firestore\.compat\.sha256/);
assert.doesNotMatch(packageJson.scripts['deploy:prod'], /firebase deploy/);
assert.match(packageJson.scripts['deploy:hosting:prod'], /--only hosting/);
console.log('Production release workflow separation checks passed.');
