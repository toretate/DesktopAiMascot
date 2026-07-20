const CACHE_VERSION = 'tonarice-pwa-v1';
const APP_SHELL = ['/', '/manifest.webmanifest', '/icons/tonarice.svg'];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.filter((key) => key.startsWith('tonarice-pwa-') && key !== CACHE_VERSION)
                .map((key) => caches.delete(key)),
        )),
    );
    self.clients.claim();
});

const shouldCache = (request, url) => {
    if (request.method !== 'GET' || url.origin !== self.location.origin) {
        return false;
    }

    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_ws')) {
        return false;
    }

    return ['document', 'script', 'style', 'font', 'image'].includes(request.destination)
        || url.pathname.startsWith('/_nuxt/');
};

const staleWhileRevalidate = async (request, event) => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request);
    const networkResponse = fetch(request).then((response) => {
        if (response.ok) {
            cache.put(request, response.clone());
        }
        return response;
    });

    if (cached) {
        event.waitUntil(networkResponse.catch(() => undefined));
        return cached;
    }

    return networkResponse;
};

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (!shouldCache(event.request, url)) {
        return;
    }

    event.respondWith(staleWhileRevalidate(event.request, event));
});
