// Kill-switch for leftover Workbox SW after the PWA revert.
// Served at /sw.js (vite-plugin-pwa's default URL) so the browser
// replaces the old worker, then this script uninstalls itself.
// Prefer Cache-Control: no-cache on this file if Nginx can set it.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.navigate(client.url);
      }
    })(),
  );
});
