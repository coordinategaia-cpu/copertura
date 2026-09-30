// Tiene l'app nel telefono per aprirla senza rete e invia la coda quando torna il segnale.
importScripts('config.js', 'coda.js');

const VERSIONE = 'copertura-v2';
const FILE = ['./', 'index.html', 'config.js', 'coda.js', 'manifest.webmanifest',
  'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSIONE).then((c) => c.addAll(FILE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((chiavi) => Promise.all(chiavi.filter((k) => k !== VERSIONE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Prima la copia salvata (funziona senza rete), intanto si aggiorna dalla rete se c'è.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.searchParams.has('misura')) return;   // la misura della connessione deve andare in rete
  e.respondWith(caches.open(VERSIONE).then(async (cache) => {
    const salvata = await cache.match(e.request, { ignoreSearch: true });
    const dallaRete = fetch(e.request)
      .then((r) => { if (r.ok) cache.put(e.request, r.clone()); return r; })
      .catch(() => salvata);
    return salvata || dallaRete;
  }));
});

// Android/Chrome: il sistema risveglia l'app quando torna la connessione.
self.addEventListener('sync', (e) => {
  if (e.tag === 'invia-segnalazioni') e.waitUntil(Coda.invia());
});
