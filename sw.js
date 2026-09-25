// Offline: všechny soubory v cache, cache-first.
// Při každé změně souborů zvýšit VERSION (a doplnit nové soubory do FILES).
const VERSION = 'v15';
const CACHE = `kasirka-${VERSION}`;
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/app.js',
  'js/storage.js',
  'js/i18n.js',
  'js/calc.js',
  'js/schedule.js',
  'js/holidays.js',
  'js/ui/entry.js',
  'js/ui/month.js',
  'js/ui/compare.js',
  'js/ui/settings.js',
  'js/ui/share.js',
  'i18n/cs.js',
  'i18n/en.js',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r ?? fetch(e.request)));
});
