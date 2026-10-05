// Bump this constant by hand on each deploy (e.g., stead-v1, stead-v2, ...)
const VERSION = 'stead-v2';
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const PRECACHE_ASSETS = [
	'/',
	'/index.html',
	'/offline.html',
	'/manifest.json',
	'/icons/icon.svg',
	'/icons/icon-192.png',
	'/src/app.js',
	'/src/auth/signup.page.js',
	'/src/styles/tokens.css',
	'/src/shared/components.css',
];

self.addEventListener('install', event => {
	event.waitUntil(
		caches.open(SHELL_CACHE)
			.then(cache => cache.addAll(PRECACHE_ASSETS))
	);
});

self.addEventListener('activate', event => {
	event.waitUntil(
		caches.keys().then(keys => Promise.all(
			keys
				.filter(key => key.startsWith('stead-') && key !== SHELL_CACHE && key !== RUNTIME_CACHE)
				.map(key => caches.delete(key))
		)).then(() => self.clients.claim())
	);
});

self.addEventListener('message', event => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		self.skipWaiting();
	}
});

self.addEventListener('fetch', event => {
	const request = event.request;

	if (request.method !== 'GET') return;

	const url = new URL(request.url);

	if (url.origin !== self.location.origin) {
		if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
			event.respondWith(cacheFirst(request));
		}
		return;
	}

	if (request.headers.has('Authorization')) return;

	if (request.mode === 'navigate') {
		event.respondWith(networkFirst(request, 4000, '/index.html', '/offline.html'));
		return;
	}

	const ext = url.pathname.split('.').pop().toLowerCase();
	const isStatic = ['js', 'css', 'svg', 'png', 'json', 'woff2', 'html'].includes(ext);

	if (isStatic) {
		event.respondWith(networkFirstAndCache(request, 4000));
	}
});

function networkFirst(request, timeoutMs, fallbackPath, offlineFallback) {
	const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs));
	return Promise.race([fetch(request), timeout])
		.then(response => {
			if (!response.ok) throw new Error('not ok');
			return response;
		})
		.catch(() => caches.match(request))
		.then(cached => {
			if (cached) return cached;
			if (fallbackPath) return caches.match(fallbackPath);
			if (offlineFallback) return caches.match(offlineFallback);
			throw new Error('no cache match');
		});
}

function networkFirstAndCache(request, timeoutMs) {
	const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs));
	return Promise.race([fetch(request), timeout])
		.then(response => {
			if (!response.ok || response.type !== 'basic') throw new Error('not cacheable');
			const copy = response.clone();
			caches.open(RUNTIME_CACHE).then(cache => cache.put(request, copy));
			return response;
		})
		.catch(() => caches.match(request))
		.then(cached => {
			if (cached) return cached;
			throw new Error('no cache match');
		});
}

function cacheFirst(request) {
	return caches.match(request).then(cached => {
		if (cached) {
			fetch(request).then(response => {
				if (response.ok && response.type === 'basic') {
					const cache = caches.open(RUNTIME_CACHE);
					cache.then(c => c.put(request, response.clone()));
				}
			}).catch(() => {});
			return cached;
		}
		return fetch(request).then(response => {
			if (!response.ok || response.type !== 'basic') return response;
			const copy = response.clone();
			caches.open(RUNTIME_CACHE).then(cache => cache.put(request, copy));
			return response;
		});
	});
}
