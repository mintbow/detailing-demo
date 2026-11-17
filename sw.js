// Service worker: оболочка приложения и 3D-модели из кэша, API — всегда из сети.
// Пути считаются от scope, поэтому работает и в корне домена, и в подпапке (GitHub Pages).
// SHELL меняем при каждом изменении этого файла; MODELS — только если поменялись 3D-модели (иначе их перекачают заново).
const SHELL = 'shell-v3';
const MODELS = 'models-v2';
const B = new URL(self.registration.scope).pathname; // '/' или '/detailing-demo/'

// Страницу и настройки всегда сверяем с сервером: хостинг (GitHub Pages) разрешает кэшировать их 10 минут,
// и без этого после обновления приложение ещё 10 минут открывало старую версию.
const fresh = (url) => fetch(url, { cache: 'no-cache', credentials: 'same-origin' });

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll([B, `${B}icons/icon-192.png`])).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => ![SHELL, MODELS].includes(k)).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const p = url.pathname;
  if (p.startsWith(`${B}api/`)) return; // API — только сеть, без участия SW
  if (p.endsWith('manifest.webmanifest') || p.endsWith('studios.json')) {
    e.respondWith(fresh(e.request.url));
    return;
  }
  // Модели и собранные ассеты (имена с хэшем) неизменны — кэш в приоритете.
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
  // HTML — всегда свежий с сервера, без сети — из кэша.
  if (e.request.mode === 'navigate') {
    e.respondWith(fresh(e.request.url).then((res) => {
      const copy = res.clone();
      caches.open(SHELL).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match(B))));
  }
});
