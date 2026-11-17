// Service worker: оболочка приложения и 3D-модели из кэша, API — всегда из сети.
// Пути считаются от scope, поэтому работает и в корне домена, и в подпапке (GitHub Pages).
const VERSION = 'v2';
const SHELL = `shell-${VERSION}`;
const MODELS = `models-${VERSION}`;
const B = new URL(self.registration.scope).pathname; // '/' или '/detailing-app/'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll([B, `${B}icons/icon-192.png`])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => ![SHELL, MODELS].includes(k)).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const p = url.pathname;
  if (p.startsWith(`${B}api/`) || p.endsWith('manifest.webmanifest') || p.endsWith('studios.json')) return; // только сеть
  // Модели и собранные ассеты неизменны — кэш в приоритете.
  if (p.startsWith(`${B}cars/`) || p.startsWith(`${B}assets/`)) {
    e.respondWith(caches.open(MODELS).then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) c.put(e.request, res.clone());
      return res;
    }));
    return;
  }
  // HTML — сначала сеть (свежая версия), без сети — из кэша.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(SHELL).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match(B))));
  }
});
