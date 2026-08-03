const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const requiredFiles = [
  'app.js',
  'sw.js',
  'firestore.rules',
  'pages/player-profile.html',
  'pages/player-profile/playerProfile.js',
  'pages/team-profile.html',
  'pages/team-profile/teamProfile.js',
  'shared/services/permissions-service.js',
  'shared/services/players-service.js',
  'shared/services/teams-service.js',
  'scripts/pwa-tablet-check.js',
  'docs/pwa-tablet-checklist.md'
];

const conflictMarkers = ['<<<<<<<', '=======', '>>>>>>>'];
const errors = [];
const warnings = [];
const ignoredDirs = new Set(['.git', 'node_modules', 'public', 'output', '.firebase', 'coverage']);

function read(relativePath) {
  const file = path.join(root, relativePath);
  if(!fs.existsSync(file)) {
    errors.push(`Fichier manquant: ${relativePath}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}

function listFiles(dir, predicate, found = []) {
  if(!fs.existsSync(dir)) return found;
  fs.readdirSync(dir, {withFileTypes:true}).forEach(entry => {
    if(ignoredDirs.has(entry.name)) return;
    const fullPath = path.join(dir, entry.name);
    if(entry.isDirectory()) {
      listFiles(fullPath, predicate, found);
      return;
    }
    const relativePath = path.relative(root, fullPath);
    if(!predicate || predicate(relativePath)) found.push(relativePath);
  });
  return found;
}

function readJson(relativePath) {
  try {
    return JSON.parse(read(relativePath));
  } catch(err) {
    errors.push(`JSON invalide: ${relativePath}`);
    return null;
  }
}

function checkDuplicateHtmlIds(relativePath) {
  const content = read(relativePath);
  const ids = {};
  for(const match of content.matchAll(/\sid=["']([^"']+)["']/g)) {
    ids[match[1]] = (ids[match[1]] || 0) + 1;
  }
  Object.entries(ids).forEach(([id, count]) => {
    if(count > 1) warnings.push(`ID HTML duplique dans ${relativePath}: ${id} (${count} fois)`);
  });
}

requiredFiles.forEach(relativePath => {
  const content = read(relativePath);
  conflictMarkers.forEach(marker => {
    if(content.includes(marker)) errors.push(`Marqueur de conflit ${marker} dans ${relativePath}`);
  });
});

const sw = read('sw.js');
[
  './pages/player-profile.html',
  './pages/team-profile.html',
  './pages/team-profile/teamProfile.js',
  './shared/services/permissions-service.js',
  './css/responsive.css'
].forEach(asset => {
  if(!sw.includes(asset)) errors.push(`Asset PWA non precache: ${asset}`);
});

const app = read('app.js');
if(!app.includes('staff_members')) errors.push('Collection staff_members absente de app.js');
if(app.includes("'staff','settings'")) errors.push('Ancienne collection staff encore dans FIRESTORE_COLLECTIONS');

if(!sw.includes('NETWORK_FIRST_ASSETS') || !sw.includes('networkFirst')) {
  errors.push('Service worker sans strategie network-first pour les fichiers shell critiques');
}
if(!sw.includes('skipWaiting()') || !sw.includes('clients.claim()')) {
  errors.push('Service worker sans activation immediate de la nouvelle version');
}

const firebaseConfig = readJson('firebase.json');
if(firebaseConfig) {
  if(firebaseConfig.hosting?.public !== 'public') {
    errors.push('Firebase Hosting ne publie pas uniquement le dossier public');
  }
  const predeploy = firebaseConfig.hosting?.predeploy || [];
  if(!Array.isArray(predeploy) || !predeploy.includes('npm run build:public')) {
    errors.push('Firebase Hosting ne reconstruit pas public avant de deployer');
  }
}

['index.html', ...listFiles(path.join(root, 'pages'), file => file.endsWith('.html'))]
  .forEach(checkDuplicateHtmlIds);

const secretLikeFiles = listFiles(root, file => {
  const base = path.basename(file).toLowerCase();
  return base === '.env'
    || base.startsWith('.env.')
    || /service[-_]?account.*\.json$/.test(base)
    || /(^|[-_])(secret|token|private[-_]?key)([-_.]|$)/.test(base);
});
if(secretLikeFiles.length) {
  errors.push(`Fichiers sensibles possibles detectes: ${secretLikeFiles.join(', ')}`);
}

if(errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

if(warnings.length) {
  console.warn(warnings.join('\n'));
}

console.log('Audit statique CoachPulse OK');
