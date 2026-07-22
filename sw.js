const CACHE_NAME = 'coachpulse-v6-4-63-20260722-responsive-collapsed-shell';
const CORE_ASSETS = [
  './', './index.html', './manifest.json', './app.js', './css/responsive.css',
  './shared/services/players-service.js',
  './shared/services/teams-service.js',
  './shared/services/permissions-service.js',
  './assets/coachpulse-logo-transparent.png', './assets/coachpulse-logo-clean.png', './assets/asse-logo-officiel.png', './assets/asse-logo.svg',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-1024.png',
  './pages/coach-stats.html', './pages/methodologie.html', './pages/presences.html', './pages/tests-techniques.html', './pages/tests-athletiques.html', './pages/data-hub.html', './pages/admin-database.html', './pages/suivi-medical.html', './pages/player-profile.html', './pages/team-profile.html',
  './pages/player-profile/playerProfile.css', './pages/player-profile/playerProfileData.js', './pages/player-profile/playerProfileFilters.js', './pages/player-profile/playerProfileStats.js', './pages/player-profile/playerProfileCompare.js', './pages/player-profile/playerProfileRender.js', './pages/player-profile/playerProfile.js',
  './pages/team-profile/teamProfile.css', './pages/team-profile/teamProfileData.js', './pages/team-profile/teamProfileFilters.js', './pages/team-profile/teamProfileMetrics.js', './pages/team-profile/teamProfileCharts.js', './pages/team-profile/teamProfileUI.js', './pages/team-profile/teamProfile.js',
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
      if(!response || !response.ok) return response;
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
      return response;
    }).catch(() => caches.match('./index.html')))
  );
});
