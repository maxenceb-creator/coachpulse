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
  'shared/services/teams-service.js'
];

const conflictMarkers = ['<<<<<<<', '=======', '>>>>>>>'];
const errors = [];

function read(relativePath) {
  const file = path.join(root, relativePath);
  if(!fs.existsSync(file)) {
    errors.push(`Fichier manquant: ${relativePath}`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
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

if(errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('Audit statique CoachPulse OK');
