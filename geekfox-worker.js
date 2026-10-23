/* Geekfox companion worker. Keep beside index.svg when publishing. */
self.__requestWorkerActivation = () => self.skipWaiting();
importScripts('https://cdn.jsdelivr.net/gh/lucideproxy/svg@8b35ef07ef9788b060a78fbb504112e28e134b1d/dfkw6/otzrpt.js');
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
const contentPath = new URL('geekfox-content/', self.location.href).pathname;
self.addEventListener('fetch', event => {
    if (!new URL(event.request.url).pathname.startsWith(contentPath)) return;
    event.respondWith((async () => {
        // Browsers suspend idle workers, which discards the in-memory routing map.
        // Wait for the open app to reconnect before routing the first new request.
        if (!_zm9ikyq.shouldRoute(event)) {
            for (const client of await self.clients.matchAll({includeUncontrolled:true})) {
                client.postMessage({$controller$swrevive:{}});
            }
            for (let attempt=0; attempt<160 && !_zm9ikyq.shouldRoute(event); attempt++) {
                if (attempt && attempt % 20 === 0) for (const client of await self.clients.matchAll({includeUncontrolled:true})) client.postMessage({$controller$swrevive:{}});
                await new Promise(resolve => setTimeout(resolve,50));
            }
        }
        if (!_zm9ikyq.shouldRoute(event)) return new Response('Geekfox connection expired. Reload the dashboard and try again.',{status:503});
        return _zm9ikyq.route(event);
    })());
});
