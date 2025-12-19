const CACHE_NAME = 'map-tiles-cache-v1';
const TILE_URLS = [
    'tile.openstreetmap.org',
    'server.arcgisonline.com'
];

self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // Intercept map tile requests
    if (TILE_URLS.some(tileUrl => url.includes(tileUrl))) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((response) => {
                    // Return cached response if found, else fetch and cache
                    return response || fetch(event.request).then((networkResponse) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
        );
    }
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
});
