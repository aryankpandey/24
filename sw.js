const CACHE_NAME = '24-cache-v7';
const urlsToCache = [
    './',
    './index.html',
    './login.html',
    './profile.html',
    './about.html',
    './contact.html',
    './tools.html',
    './year-tracker.html',
    './countdown.html',
    './goal-reminder.html',
    './focus-mode.html',
    './life-moments.html',
    './settings.html',
    './admin.html',
    './style.css',
    './script.js',
    './auth-client.js',
    './settings.js',
    './admin.js',
    './theme-manager.js',
    './storage-service.js',
    './supabase-config.js',
    './tools.js',
    './utils.js',
    './manifest.json',
    './icons/icon-192.svg',
    './icons/icon-512.svg',
    './icons/upi-qr.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('activate', event => {
    const cacheAllowlist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheAllowlist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', event => {
    // Network-only for API endpoints
    if (event.request.url.includes('/api/')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                return response || fetch(event.request);
            })
    );
});
