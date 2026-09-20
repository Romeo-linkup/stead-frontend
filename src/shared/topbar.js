import { renderSosButton } from './sos-button.js';
import { icon } from './icons.js';
import { apiFetch } from './api.js';

// Cached across page navigations within a session, so every renderShell()
// call doesn't refetch the business name on every hash change.
let cachedBusinessName = null;
let fetchPromise = null;

function getBusinessName() {
	if (cachedBusinessName) return Promise.resolve(cachedBusinessName);
	if (!fetchPromise) {
		fetchPromise = apiFetch('/settings')
			.then((s) => {
				cachedBusinessName = s.business_name || 'Your Property Business';
				return cachedBusinessName;
			})
			.catch(() => 'Your Property Business');
	}
	return fetchPromise;
}

// Call this after the owner updates the name so the topbar reflects it
// immediately, without needing a full page reload.
export function invalidateBusinessNameCache() {
	cachedBusinessName = null;
	fetchPromise = null;
}

export function renderTopbar(container, { title, isTenant = false, onMenuOpen }) {
	container.className = 'topbar';
	container.innerHTML = `
		<div class="topbar-left">
			<button class="iconbtn hamburger-toggle" type="button" aria-label="Open menu">${icon('menu')}</button>
			<div class="topbar-titles">
				<div class="business-name serif" id="topbar-business-name">Stead</div>
				<div class="pagetitle" style="font-size:12.5px; color:var(--slate);">${escapeHtml(title)}</div>
			</div>
		</div>
		<div class="topbar-right">
			<button class="iconbtn notification-bell" type="button" aria-label="Notifications">${icon('bell')}</button>
			${isTenant ? '<span class="sos-slot"></span>' : ''}
		</div>
	`;

	container.querySelector('.hamburger-toggle').addEventListener('click', () => {
		if (typeof onMenuOpen === 'function') onMenuOpen();
	});

	if (isTenant) {
		renderSosButton(container.querySelector('.sos-slot'));
	}

	// Fill in the real business name once fetched — "Stead" shows briefly
	// as a fallback on first load, then gets replaced.
	getBusinessName().then((name) => {
		const el = container.querySelector('#topbar-business-name');
		if (el) el.textContent = name;
	});
}

function escapeHtml(value) {
	const div = document.createElement('div');
	div.textContent = value == null ? '' : String(value);
	return div.innerHTML;
}