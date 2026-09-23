const {execFileSync} = require('node:child_process');

function parseArgs(argv) {
  const args = {project:'', apply:false};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--project') args.project = argv[++index] || '';
    else if (argv[index] === '--apply') args.apply = true;
  }
  return args;
}

function stringValue(field) {
  return String(field?.stringValue || '').trim();
}

function stringArray(field) {
  return (field?.arrayValue?.values || []).map(stringValue).filter(Boolean);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.project) throw new Error('Usage: node scripts/migrate-attendance-team-scope.cjs --project PROJECT_ID [--apply]');

  const accessToken = String(process.env.GOOGLE_OAUTH_ACCESS_TOKEN || execFileSync('gcloud', ['auth', 'print-access-token'], {encoding:'utf8'})).trim();
  const request = async (url, options={}) => {
    const response = await fetch(url, {
      ...options,
      headers:{Authorization:`Bearer ${accessToken}`, 'Content-Type':'application/json', ...(options.headers || {})},
      body:options.data ? JSON.stringify(options.data) : undefined
    });
    if (!response.ok) {
      const error = new Error(`Firestore API ${response.status}: ${await response.text()}`);
      error.status = response.status;
      throw error;
    }
    return response.status === 204 ? null : response.json();
  };
  const databaseRoot = `projects/${args.project}/databases/(default)`;
  const runQueryUrl = `https://firestore.googleapis.com/v1/${databaseRoot}/documents:runQuery`;
  const response = await request(runQueryUrl, {
    method:'POST',
    data:{structuredQuery:{from:[{collectionId:'attendance'}]}}
  });
  const documents = (response || []).map(item => item.document).filter(Boolean);
  const candidates = documents.filter(document => {
    const fields = document.fields || {};
    return !stringValue(fields.teamId) && stringArray(fields.teamIds).length === 0;
  });
  const sessionCache = new Map();
  const changes = [];
  const skipped = [];

  for (const attendance of candidates) {
    const sessionId = stringValue(attendance.fields?.sessionId);
    if (!sessionId) {
      skipped.push({attendance:attendance.name, reason:'sessionId manquant'});
      continue;
    }
    if (!sessionCache.has(sessionId)) {
      const sessionUrl = `https://firestore.googleapis.com/v1/${databaseRoot}/documents/sessions/${encodeURIComponent(sessionId)}`;
      try {
        sessionCache.set(sessionId, await request(sessionUrl));
      } catch (error) {
        if (error?.status === 404) sessionCache.set(sessionId, null);
        else throw error;
      }
    }
    const session = sessionCache.get(sessionId);
    if (!session) {
      skipped.push({attendance:attendance.name, sessionId, reason:'session introuvable'});
      continue;
    }
    const teamId = stringValue(session.fields?.teamId);
    const teamIds = [...new Set([teamId, ...stringArray(session.fields?.teamIds)].filter(Boolean))];
    if (!teamId && teamIds.length === 0) {
      skipped.push({attendance:attendance.name, sessionId, reason:'session sans équipe'});
      continue;
    }
    changes.push({attendance:attendance.name, sessionId, teamId:teamId || teamIds[0], teamIds});
  }

  console.log(JSON.stringify({mode:args.apply ? 'apply' : 'dry-run', scanned:documents.length, candidates:candidates.length, changes, skipped}, null, 2));
  if (!args.apply) return;

  for (const change of changes) {
    const updateMask = ['teamId', 'teamIds'].map(field => `updateMask.fieldPaths=${field}`).join('&');
    await request(`https://firestore.googleapis.com/v1/${change.attendance}?${updateMask}`, {
      method:'PATCH',
      data:{fields:{
        teamId:{stringValue:change.teamId},
        teamIds:{arrayValue:{values:change.teamIds.map(value => ({stringValue:value}))}}
      }}
    });
  }
  console.log(`Migration appliquée : ${changes.length} document(s) attendance mis à jour.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
