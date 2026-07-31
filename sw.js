const CACHE_NAME = 'coachpulse-v6-4-67-20260729-tablet-cache-refresh';
const CORE_ASSETS = [
  './', './index.html', './manifest.json', './app.js', './css/responsive.css',
  './shared/services/players-service.js',
  './shared/services/teams-service.js',
  './shared/services/permissions-service.js',
  './shared/utils/module-registry.js',
  './assets/coachpulse-logo-transparent.png', './assets/coachpulse-logo-clean.png', './assets/asse-logo-officiel.png', './assets/asse-logo.svg',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-1024.png',
  './pages/coach-stats.html', './pages/methodologie.html', './pages/presences.html', './pages/tests-techniques.html', './pages/tests-athletiques.html', './pages/data-hub.html', './pages/admin-database.html', './pages/suivi-medical.html', './pages/player-profile.html', './pages/team-profile.html',
  './pages/coach-stats/heatmap-tooltips.css', './pages/coach-stats/heatmap-tooltips.js',
  './pages/methodologie/embedded-colors.css', './pages/methodologie/embedded-colors.js',
  './pages/player-profile/playerProfile.css', './pages/player-profile/playerProfileData.js', './pages/player-profile/playerProfileFilters.js', './pages/player-profile/playerProfileStats.js', './pages/player-profile/playerProfileCompare.js', './pages/player-profile/playerProfileRender.js', './pages/player-profile/playerProfile.js',
  './pages/team-profile/teamProfile.css', './pages/team-profile/teamProfileData.js', './pages/team-profile/teamProfileFilters.js', './pages/team-profile/teamProfileMetrics.js', './pages/team-profile/teamProfileCharts.js', './pages/team-profile/teamProfileUI.js', './pages/team-profile/teamProfile.js',
  './connectors/fichesJoueusesConnector.js', './connectors/presencesConnector.js',
  './connectors/testsConnectorCore.js', './connectors/testsTechniquesConnector.js', './connectors/testsPhysiquesConnector.js'
];
const NETWORK_FIRST_ASSETS = new Set(['./', './index.html', './app.js', './css/responsive.css']);

function assetKey(url) {
  if(url.origin !== self.location.origin) return '';
  return url.pathname === '/' ? './' : `.${url.pathname}`;
}

function cacheResponse(request, response) {
  if(!response || !response.ok) return response;
  const copy = response.clone();
  caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
  return response;
}

function networkFirst(request) {
  const freshRequest = new Request(request, {cache: 'reload'});
  return fetch(freshRequest)
    .then(response => cacheResponse(request, response))
    .catch(() => caches.match(request).then(cached => cached || caches.match('./index.html')));
}

function cacheFirst(request) {
  return caches.match(request).then(cached => cached || fetch(request).then(response => cacheResponse(request, response)));
}

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
  if(event.request.mode === 'navigate' || NETWORK_FIRST_ASSETS.has(assetKey(url))) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  event.respondWith(cacheFirst(event.request).catch(() => caches.match('./index.html')));
});
