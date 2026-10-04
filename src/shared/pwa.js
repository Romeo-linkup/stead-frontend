let deferredPrompt = null;
let hasReloaded = false;

export function initPwa() {
	if ('serviceWorker' in navigator) {
		try {
			window.addEventListener('load', () => {
				navigator.serviceWorker.register('/service-worker.js').then(registration => {
					checkForUpdate(registration);
					registration.addEventListener('updatefound', () => {
						const newWorker = registration.installing;
						newWorker.addEventListener('statechange', () => {
							if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
								showUpdateBanner();
							}
						});
					});
				}).catch(() => {});
			});

			navigator.serviceWorker.addEventListener('controllerchange', () => {
				if (!hasReloaded) {
					hasReloaded = true;
					window.location.reload();
				}
			});
		} catch (e) {}
	}

	window.addEventListener('offline', showOfflineBanner);
	window.addEventListener('online', hideOfflineBanner);

	if (!navigator.onLine) {
		showOfflineBanner();
	}

	window.addEventListener('beforeinstallprompt', event => {
		event.preventDefault();
		deferredPrompt = event;
		window.dispatchEvent(new CustomEvent('stead-install-available'));
	});

	window.addEventListener('appinstalled', () => {
		deferredPrompt = null;
		window.dispatchEvent(new CustomEvent('stead-install-changed'));
	});
}

function checkForUpdate(registration) {
	if (registration.waiting) {
		showUpdateBanner();
	}
}

function showUpdateBanner() {
	let banner = document.querySelector('.pwa-banner');
	if (banner) return;

	banner = document.createElement('div');
	banner.className = 'pwa-banner';
	const message = document.createElement('span');
	message.textContent = 'A new version is available.';
	const button = document.createElement('button');
	button.className = 'btn brass sm';
	button.textContent = 'Refresh';
	button.addEventListener('click', () => {
		navigator.serviceWorker.getRegistration().then(registration => {
			if (registration && registration.waiting) {
				registration.waiting.postMessage({ type: 'SKIP_WAITING' });
			}
		});
	});
	banner.appendChild(message);
	banner.appendChild(button);
	document.body.appendChild(banner);
}

function showOfflineBanner() {
	let bar = document.querySelector('.offline-bar');
	if (bar) return;

	bar = document.createElement('div');
	bar.className = 'offline-bar';
	bar.textContent = 'You\'re offline. Changes can\'t be saved until you reconnect.';
	document.body.appendChild(bar);
}

function hideOfflineBanner() {
	const bar = document.querySelector('.offline-bar');
	if (bar) bar.remove();
}

export function canInstall() {
	return deferredPrompt !== null;
}

export async function promptInstall() {
	if (!deferredPrompt) return;
	deferredPrompt.prompt();
	const { outcome } = await deferredPrompt.userChoice;
	if (outcome === 'accepted') {
		deferredPrompt = null;
	}
	window.dispatchEvent(new CustomEvent('stead-install-changed'));
}

export function isStandalone() {
	return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

export function isIos() {
	const ua = navigator.userAgent.toLowerCase();
	const isIpad = /ipad/.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
	return /iphone|ipod/.test(ua) || isIpad;
}
