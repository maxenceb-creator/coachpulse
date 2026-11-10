const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const origin = 'https://coachpulse.test';
const swSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function sha256(relativePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relativePath))).digest('hex');
}

function scriptAssets(html) {
  return [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
    .map(match => `./${match[1].split('?')[0].replace(/^\.\//, '')}`);
}

function importSpecifiers(source) {
  return [...source.matchAll(/(?:from|import)\s*\(?["']([^"']+)["']/g)].map(match => match[1]);
}

function createProfileHarness({online=false, durable=true, cacheSnapshot, defaultSnapshot, cacheError, defaultError}={}) {
  const start = appSource.indexOf('function staffProfileAccessError');
  const end = appSource.indexOf('function isAdminLikeProfile', start);
  assert(start >= 0 && end > start, 'Helpers du bootstrap profil introuvables');
  const context = {
    navigator:{onLine:online},
    db:{},
    firebaseFns:{
      doc(_db, collection, uid){ return {collection, uid}; },
      async getDocFromCache(){ if(cacheError) throw cacheError; return cacheSnapshot; },
      async getDoc(){ if(defaultError) throw defaultError; return defaultSnapshot; }
    },
    syncStateService:{snapshot(){ return {persistence:{durable}}; }},
    normalizeLoadedStaffProfile(profile){ return {...profile}; },
    Error,
    String
  };
  vm.runInNewContext(`${appSource.slice(start, end)}\nglobalThis.profileTestApi={validateStaffProfileSnapshot,readUserProfileSnapshot};`, context, {filename:'app-profile-bootstrap.js'});
  return context.profileTestApi;
}

function profileSnapshot(data, exists=true) {
  return {exists(){ return exists; }, data(){ return data; }};
}

async function testOfflineProfileBootstrap() {
  const user = {uid:'staff-a'};
  const active = profileSnapshot({uid:'staff-a', status:'ACTIVE', role:'ENTRAINEUR'});
  let api = createProfileHarness({cacheSnapshot:active});
  let result = await api.readUserProfileSnapshot(user);
  assert.strictEqual(result.source, 'cache');
  assert.strictEqual(api.validateStaffProfileSnapshot(user, result.snap).uid, 'staff-a');

  api = createProfileHarness({cacheError:new Error('cache miss')});
  await assert.rejects(() => api.readUserProfileSnapshot(user), error => error.code === 'staff/cache-unavailable');

  api = createProfileHarness({cacheSnapshot:profileSnapshot({}, false)});
  result = await api.readUserProfileSnapshot(user);
  assert.throws(() => api.validateStaffProfileSnapshot(user, result.snap), error => error.code === 'staff/profile-missing');

  api = createProfileHarness({cacheSnapshot:profileSnapshot({uid:'staff-a', status:'INACTIVE'})});
  result = await api.readUserProfileSnapshot(user);
  assert.throws(() => api.validateStaffProfileSnapshot(user, result.snap), error => error.code === 'staff/profile-inactive');

  api = createProfileHarness({cacheSnapshot:profileSnapshot({uid:'staff-b', status:'ACTIVE'})});
  result = await api.readUserProfileSnapshot(user);
  assert.throws(() => api.validateStaffProfileSnapshot(user, result.snap), error => error.code === 'staff/profile-uid-mismatch');

  api = createProfileHarness({durable:false, cacheSnapshot:active});
  await assert.rejects(() => api.readUserProfileSnapshot(user), error => error.code === 'staff/cache-unavailable');

  api = createProfileHarness({online:true, defaultError:new Error('network unavailable')});
  await assert.rejects(() => api.readUserProfileSnapshot(user), error => error.code === 'staff/profile-read-unavailable');

  const authProfileCatch = appSource.slice(
    appSource.indexOf("await trackLoadingTask('profile:load'"),
    appSource.indexOf('// Le cache local est purgé', appSource.indexOf("await trackLoadingTask('profile:load'"))
  );
  assert(!authProfileCatch.includes('clearFirebaseAuthBrowserCache'), 'Une erreur réseau/cache efface encore la session Auth');
  const listener = appSource.slice(appSource.indexOf('function startStaffProfileSubscription'), appSource.indexOf('async function initFirebase'));
  assert(listener.includes("$('#authError').textContent = 'Profil staff révoqué ou supprimé.'"));
  assert(listener.includes('setLocked(true);'), 'Une révocation distante ne verrouille pas l’interface');
}

class FakeCache {
  constructor() {
    this.entries = new Map();
  }

  key(request) {
    const raw = typeof request === 'string' ? request : request.url;
    return new URL(raw, `${origin}/`).href;
  }

  async addAll(assets) {
    for(const asset of assets) {
      const pathname = new URL(asset, `${origin}/`).pathname.replace(/^\//, '');
      const localPath = pathname || 'index.html';
      assert(fs.existsSync(path.join(root, localPath)), `CORE_ASSET absent: ${asset}`);
      this.entries.set(this.key(asset), new Response(`cached:${asset}`, {status:200}));
    }
  }

  async put(request, response) {
    this.entries.set(this.key(request), response.clone());
  }

  async match(request, options={}) {
    const key = this.key(request);
    if(!options.ignoreSearch) return this.entries.get(key)?.clone();
    const wanted = new URL(key);
    for(const [candidate, response] of this.entries) {
      const url = new URL(candidate);
      if(url.origin === wanted.origin && url.pathname === wanted.pathname) return response.clone();
    }
    return undefined;
  }
}

class FakeCacheStorage {
  constructor() {
    this.caches = new Map();
  }

  async open(name) {
    if(!this.caches.has(name)) this.caches.set(name, new FakeCache());
    return this.caches.get(name);
  }

  async keys() {
    return [...this.caches.keys()];
  }

  async delete(name) {
    return this.caches.delete(name);
  }

  async match(request, options) {
    for(const cache of this.caches.values()) {
      const response = await cache.match(request, options);
      if(response) return response;
    }
    return undefined;
  }
}

async function run() {
  await testOfflineProfileBootstrap();
  const firebaseDir = 'vendor/firebase/10.12.5';
  const firebaseFiles = [
    `${firebaseDir}/firebase-app.js`,
    `${firebaseDir}/firebase-auth.js`,
    `${firebaseDir}/firebase-firestore.js`
  ];
  const expectedHashes = {
    [`${firebaseDir}/firebase-app.js`]: '7ffa909c4c1d4218f383a756292d353de9d0b90c3d5dd385215d6bdc8497d778',
    [`${firebaseDir}/firebase-auth.js`]: '40700f7048de28a549695ef850159248e80fcf78466cb118430fb6eab6dbbbff',
    [`${firebaseDir}/firebase-firestore.js`]: '49abfe28e1f5a0a137e90d31b7629ae3e3823a8cf8939d46a034a3274bd8b7ff'
  };

  assert(!appSource.includes('gstatic.com/firebasejs'), 'Le bootstrap dépend encore de gstatic');
  firebaseFiles.forEach(file => assert.strictEqual(sha256(file), expectedHashes[file], `Artefact Firebase modifié: ${file}`));
  assert.deepStrictEqual(importSpecifiers(read(firebaseFiles[0])), []);
  assert.deepStrictEqual(importSpecifiers(read(firebaseFiles[1])), ['./firebase-app.js']);
  assert.deepStrictEqual(importSpecifiers(read(firebaseFiles[2])), ['./firebase-app.js']);

  const requiredBootstrapAssets = [
    './shared/services/firestore-query-service.js',
    './shared/services/match-persistence-service.js',
    './shared/services/post-match-transactional-persistence-service.js',
    './shared/services/presence-access-context-service.js',
    ...firebaseFiles.map(file => `./${file}`)
  ];
  requiredBootstrapAssets.forEach(asset => assert(swSource.includes(`'${asset}'`), `CORE_ASSETS incomplet: ${asset}`));
  scriptAssets(indexSource).forEach(asset => assert(swSource.includes(`'${asset}'`), `Script index hors CORE_ASSETS: ${asset}`));

  // Security invariants: offline startup reuses the existing session only;
  // it does not introduce local persistence or bypass profile authorization.
  assert(appSource.includes('firebaseFns.browserSessionPersistence || firebaseFns.inMemoryPersistence'));
  assert(!appSource.includes('firebaseFns.browserLocalPersistence'));
  assert(appSource.includes('await trackLoadingTask(\'profile:load\''));
  assert(appSource.indexOf("await trackLoadingTask('profile:load'") < appSource.indexOf('setLocked(false);'));

  const listeners = {};
  const cacheStorage = new FakeCacheStorage();
  const oldCache = await cacheStorage.open('coachpulse-v6-4-98-local-first-sync-state');
  await oldCache.put(`${origin}/app.js?v=legacy`, new Response('stale-old-cache'));
  let online = true;
  const self = {
    location: new URL(`${origin}/sw.js`),
    addEventListener(type, handler) { listeners[type] = handler; },
    skipWaiting() { return Promise.resolve(); },
    clients: {claim() { return Promise.resolve(); }}
  };
  const context = {
    self,
    caches: cacheStorage,
    URL,
    Request,
    Response,
    Set,
    Promise,
    console,
    fetch(request) {
      if(!online) return Promise.reject(new TypeError('offline'));
      return Promise.resolve(new Response(`network:${typeof request === 'string' ? request : request.url}`, {status:200}));
    }
  };
  vm.runInNewContext(swSource, context, {filename:'sw.js'});

  let installPromise;
  listeners.install({waitUntil(promise) { installPromise = promise; }});
  await installPromise;
  const cacheNamesBeforeActivate = await cacheStorage.keys();
  const currentName = cacheNamesBeforeActivate.find(name => name.includes('offline-bootstrap'));
  assert(currentName, 'Le cache offline versionné n’a pas été installé');

  let activatePromise;
  listeners.activate({waitUntil(promise) { activatePromise = promise; }});
  await activatePromise;
  assert.deepStrictEqual(await cacheStorage.keys(), [currentName], 'Un ancien cache CoachPulse a survécu à l’activation');

  online = false;
  async function offlineFetch(pathname) {
    let responsePromise;
    listeners.fetch({
      request: new Request(`${origin}/${pathname}`),
      respondWith(promise) { responsePromise = promise; },
      waitUntil() {}
    });
    assert(responsePromise, `Requête non interceptée: ${pathname}`);
    return responsePromise;
  }

  const versionedApp = await offlineFetch('app.js?v=20261015-pr241');
  assert.strictEqual(await versionedApp.text(), 'cached:./app.js', 'Le ?v= ne résout pas vers le cache courant');
  for(const file of firebaseFiles) {
    const response = await offlineFetch(file);
    assert.strictEqual(response.status, 200, `Module Firebase indisponible hors ligne: ${file}`);
  }

  console.log('PWA offline bootstrap: local Firebase graph, complete CORE_ASSETS, versioned cache matching and access invariants OK.');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
