// Change v1 to v2 (or v3, etc., every time you push a massive code update)
const CACHE_NAME = 'hydrostack-v5'; 

const ASSETS_TO_CACHE = [
    './index.html',
    './worker.css',
    './worker.js',
    './manifest.json'
];

// ... rest of the file stays exactly the same

// Install Event: Cache the files
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Activate Event: Destroy old caches and take over the page
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    // If the cache name doesn't match our current version, nuke it
                    if (cache !== CACHE_NAME) {
                        console.log('HydroStack: Clearing old cache ->', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Instantly control all open clients/tabs
    );
});

// Fetch Event: Serve from cache if offline
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            // Return cached file, or fetch from network if not in cache
            return response || fetch(event.request);
        }).catch(() => {
            // If offline and file not cached, fallback to index.html
            if (event.request.mode === 'navigate') {
                return caches.match('./index.html');
            }
        })
    );
});