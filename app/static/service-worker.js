const CACHE_NAME = 'my-cache-v3';
const urlsToCache = [
    '/',
    '/static/css/styles.css',
    '/static/js/script.js',
    '/static/images/icon-192x192.png',
    '/offline.html'
];

// Install event - Cache essential resources
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(urlsToCache))
            .catch((error) => console.error('Failed to cache files on install:', error))
    );
    self.skipWaiting();
});

// Fetch event - Network-first for API calls, Cache-first for others with offline fallback
self.addEventListener('fetch', (event) => {
    if (event.request.url.includes('/api/')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, response.clone());
                        return response;
                    });
                })
                .catch(() => caches.match(event.request) || new Response('{"error": "Network error"}', {
                    headers: { 'Content-Type': 'application/json' }
                }))
        );
    } else {
        event.respondWith(
            caches.match(event.request)
                .then((response) => {
                    return response || fetch(event.request)
                        .then((networkResponse) => {
                            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
                            return networkResponse;
                        });
                })
                .catch(() => caches.match('/offline.html'))
        );
    }
});

// Activate event - Clear old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// Background Sync for form submissions when back online
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-forms') {
        event.waitUntil(syncOfflineForms());
    }
});

const syncOfflineForms = async () => {
    const formData = JSON.parse(localStorage.getItem('offlineFormData'));
    if (formData) {
        try {
            const response = await fetch('/submit-form', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            if (response.ok) {
                localStorage.removeItem('offlineFormData');
            }
        } catch (error) {
            console.error('Error syncing form:', error);
        }
    }
};

// Listen for skip waiting message
self.addEventListener('message', (event) => {
    if (event.data.action === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
