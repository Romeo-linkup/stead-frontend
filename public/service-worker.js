const CACHE_NAME = 'stead-shell-v8';
const APP_SHELL = [
	'/index.html',
	'/icons/icon.svg',
	'/icons/icon-dark.svg',
	'/icons/icon-light.svg',
	'/icons/icon-maskable.svg',
	'/icons/icon-192.png',
	'/icons/icon-512.png',
	'/icons/icon-maskable-512.png',
	'/icons/apple-touch-icon.png',
	'/src/styles/tokens.css',
	'/src/shared/components.css',
	'/src/app.js',
	'/src/admin/invoices.page.js',
	'/src/admin/settings.page.js',
	'/src/shared/theme.js',
	'/src/shared/logo.js',
	'/src/shared/signature-pad.js',
];

self.addEventListener('install', event => {
	event.waitUntil(
		caches.open(CACHE_NAME)
			.then(cache => cache.addAll(APP_SHELL))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', event => {
	event.waitUntil(
		caches.keys().then(keys => Promise.all(
			keys
				.filter(key => key !== CACHE_NAME)
				.map(key => caches.delete(key))
		)).then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', event => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);
	if (url.origin !== self.location.origin) return;

	event.respondWith(
		caches.match(event.request).then(cached => {
			return cached || fetch(event.request).then(response => {
				const copy = response.clone();
				caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
				return response;
			}).catch(() => caches.match('/index.html'));
		})
	);
});
