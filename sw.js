const CACHE_NAME = 'coachpulse-v6-4-47-20260708-admin-seed-allowlist';
const CORE_ASSETS = [
  './', './index.html', './manifest.json', './app.js',
  './shared/services/players-service.js',
  './shared/services/teams-service.js',
  './shared/services/permissions-service.js',
  './assets/coachpulse-logo-transparent.png', './assets/coachpulse-logo-clean.png', './assets/asse-logo-officiel.png', './assets/asse-logo.svg',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-1024.png',
  './pages/coach-stats.html', './pages/methodologie.html', './pages/presences.html', './pages/tests-techniques.html', './pages/tests-athletiques.html', './pages/data-hub.html', './pages/admin-database.html', './pages/suivi-medical.html',
  './connectors/fichesJoueusesConnector.js', './connectors/presencesConnector.js',
  './connectors/testsConnectorCore.js', './connectors/testsTechniquesConnector.js', './connectors/testsPhysiquesConnector.js'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if(url.hostname.includes('gstatic.com') || url.hostname.includes('googleapis.com')) return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match('./index.html')))
  );
});
