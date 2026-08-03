const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const swPath = path.join(root, 'sw.js');
const appPath = path.join(root, 'app.js');
const errors = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function fail(message) {
  errors.push(message);
}

function loadServiceWorkerMetadata() {
  const source = fs.readFileSync(swPath, 'utf8');
  const sandbox = {
    self: {
      location: {origin: 'https://coachpulse.local'},
      addEventListener() {},
      skipWaiting() {}
    },
    caches: {
      open() { return Promise.resolve({addAll() {}, put() {}}); },
      keys() { return Promise.resolve([]); },
      delete() { return Promise.resolve(true); },
      match() { return Promise.resolve(null); }
    },
    clients: {claim() {}},
    fetch() { return Promise.reject(new Error('network disabled in audit')); },
    Request,
    URL,
    Promise,
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(`${source}\nglobalThis.__SW_AUDIT__ = {CACHE_NAME, CORE_ASSETS, NETWORK_FIRST_ASSETS:Array.from(NETWORK_FIRST_ASSETS)};`, sandbox);
  return {source, meta: sandbox.__SW_AUDIT__};
}

function assertExistingPrecacheAssets(assets) {
  assets.forEach(asset => {
    if(typeof asset !== 'string') {
      fail(`Asset PWA invalide: ${String(asset)}`);
      return;
    }
    if(!asset.startsWith('./')) {
      fail(`Asset PWA hors racine relative: ${asset}`);
      return;
    }
    if(asset === './') return;
    const relativePath = asset.slice(2);
    if(relativePath.includes('..')) {
      fail(`Asset PWA avec chemin parent interdit: ${asset}`);
      return;
    }
    if(!fs.existsSync(path.join(root, relativePath))) {
      fail(`Asset PWA precache introuvable: ${asset}`);
    }
  });
}

function assertShellStrategy(source, networkFirstAssets) {
  [
    './',
    './index.html',
    './app.js',
    './css/responsive.css'
  ].forEach(asset => {
    if(!networkFirstAssets.includes(asset)) fail(`Asset shell non network-first: ${asset}`);
  });

  [
    'new Request(request, {cache: \'reload\'})',
    'event.request.mode === \'navigate\'',
    'self.skipWaiting()',
    'self.clients.claim()',
    'keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))'
  ].forEach(snippet => {
    if(!source.includes(snippet)) fail(`Garde-fou service worker manquant: ${snippet}`);
  });
}

function assertCriticalAssets(assets) {
  [
    './manifest.json',
    './pages/player-profile.html',
    './pages/team-profile.html',
    './pages/presences.html',
    './shared/services/players-service.js',
    './shared/services/teams-service.js',
    './shared/services/permissions-service.js',
    './shared/utils/module-registry.js'
  ].forEach(asset => {
    if(!assets.includes(asset)) fail(`Asset critique non precache: ${asset}`);
  });
}

function assertCacheName(cacheName) {
  if(!/^coachpulse-v[0-9][a-z0-9-]*$/i.test(cacheName || '')) {
    fail(`Nom de cache PWA invalide: ${cacheName || '(vide)'}`);
  }
}

const {source, meta} = loadServiceWorkerMetadata();
const appSource = fs.readFileSync(appPath, 'utf8');

assertCacheName(meta.CACHE_NAME);
assertExistingPrecacheAssets(meta.CORE_ASSETS);
assertCriticalAssets(meta.CORE_ASSETS);
assertShellStrategy(source, meta.NETWORK_FIRST_ASSETS);
[
  'const APP_SHELL_CACHE_PREFIX',
  'async function clearAppShellCacheOnLaunch',
  "if(!navigator.onLine || !('caches' in window)) return;",
  'keys.filter(key => key.startsWith(APP_SHELL_CACHE_PREFIX)).map(key => caches.delete(key))',
  "navigator.serviceWorker.register('./sw.js', {updateViaCache:'none'})"
].forEach(snippet => {
  if(!appSource.includes(snippet)) fail(`Garde-fou cache au lancement manquant: ${snippet}`);
});
if(appSource.includes('localStorage.clear()')) fail('Le nettoyage du cache ne doit pas vider localStorage.');
if(appSource.includes('indexedDB.deleteDatabase')) fail('Le nettoyage du cache ne doit pas supprimer IndexedDB.');

if(errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('PWA tablet guards OK');
