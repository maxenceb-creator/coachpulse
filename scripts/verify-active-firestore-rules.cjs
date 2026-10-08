const crypto = require('node:crypto');
const fs = require('node:fs');
const {GoogleAuth} = require('google-auth-library');

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'coach-pulse-ee6b0';
const rulesPath = process.argv[2] || 'firestore.rules';

function sha256(value){
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function readJson(url, token){
  const response = await fetch(url, {headers:{Authorization:`Bearer ${token}`}});
  if(!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.json();
}

async function main(){
  const auth = new GoogleAuth({scopes:['https://www.googleapis.com/auth/cloud-platform']});
  const token = await auth.getAccessToken();
  if(!token) throw new Error('Jeton Google Cloud indisponible.');

  const release = await readJson(
    `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`,
    token
  );
  const ruleset = await readJson(`https://firebaserules.googleapis.com/v1/${release.rulesetName}`, token);
  const activeSource = ruleset.source?.files?.find(file => file.name === 'firestore.rules')?.content;
  if(typeof activeSource !== 'string') throw new Error('Source firestore.rules absente du ruleset actif.');

  const expected = sha256(fs.readFileSync(rulesPath));
  const active = sha256(activeSource);
  const match = expected === active;
  const lines = [
    `- Rules attendues (${rulesPath}): \`${expected}\``,
    `- Rules Firebase actives: \`${active}\``,
    `- Ruleset actif: \`${release.rulesetName}\``,
    `- Empreintes identiques: **${match ? 'oui' : 'non'}**`
  ];
  console.log(lines.join('\n'));

  if(process.env.GITHUB_OUTPUT){
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `expected_sha256=${expected}\nactive_sha256=${active}\nruleset=${release.rulesetName}\nmatch=${match}\n`);
  }
  if(process.env.GITHUB_STEP_SUMMARY){
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Empreinte Firestore Rules\n\n${lines.join('\n')}\n`);
  }
  if(!match) process.exitCode = 1;
}

main().catch(error => {
  console.error(`Vérification des Rules impossible: ${error.message}`);
  process.exitCode = 1;
});
