import { logout, getCurrentUser } from '../auth/session.js';
import { icon } from './icons.js';
import { apiFetch } from './api.js';
import { getThemePreference, setThemePreference } from './theme.js';
import { logoSvg } from './logo.js';
import { canInstall, promptInstall, isStandalone, isIos } from './pwa.js';
import { canActOrgWide, seeMultipleDistricts, userDistrictIds } from './scope.js';

// Cached across page navigations within a session, so every renderShell()
// call doesn't refetch the business name on every hash change.
let cachedBusinessName = null;
let fetchPromise = null;
let installRefresh = null;
let themeRefresh = null;
let avatarCache = { userId: null, url: undefined, promise: null };

// Cached per signed-in user, so a second person signing in on the same device never sees the first person's photo.
export function getMyAvatarUrl() {
	const userId = getCurrentUser()?.user_id;
	if (avatarCache.userId !== userId) avatarCache = { userId, url: undefined, promise: null };
	if (avatarCache.url !== undefined) return Promise.resolve(avatarCache.url);
	if (!avatarCache.promise) {
		const cache = avatarCache;
		cache.promise = apiFetch('/users/me')
			.then((me) => { cache.url = me.avatar_url || null; return cache.url; })
			.catch(() => { cache.promise = null; return null; });
	}
	return avatarCache.promise;
}

export function invalidateMyAvatarCache() {
	avatarCache = { userId: null, url: undefined, promise: null };
}

export function getBusinessName() {
	if (cachedBusinessName) return Promise.resolve(cachedBusinessName);
	if (!fetchPromise) {
		fetchPromise = apiFetch('/settings')
			.then((s) => {
				cachedBusinessName = s.business_name || 'Stead';
				return cachedBusinessName;
			})
			.catch(() => {
				// Don't cache the fallback — drop the in-flight promise so the
				// next renderShell() retries (e.g. right after signing in).
				fetchPromise = null;
				return 'Stead';
			});
	}
	return fetchPromise;
}

// Call this after the owner updates the name so the brand block reflects it
// immediately, without needing a full page reload.
export function invalidateBusinessNameCache() {
	cachedBusinessName = null;
	fetchPromise = null;
}

const NAV = {
	tenant: [
		['#/tenant/home', 'Home', 'home'],
		['#/tenant/pay', 'Rent & accounts', 'wallet'],
		['#/tenant/maintenance', 'Maintenance', 'wrench'],
		['#/tenant/lease', 'My lease', 'document'],
		['#/tenant/complaints', 'Complaints', 'message'],
		['#/tenant/notices', 'Notices', 'bullhorn'],
		['#/tenant/info', 'Property info', 'info'],
		['#/tenant/profile', 'My profile', 'profile'],
	],
	service_provider: [
		['#/provider/tasks', 'My tasks', 'wrench'],
		['#/provider/notices', 'Notices', 'bullhorn'],
		['#/provider/info', 'Site info', 'info'],
		['#/provider/profile', 'My profile', 'profile'],
	],
	admin: [
		['#/admin/overview', 'Overview', 'gauge'],
		['#/admin/districts', 'Districts', 'building'],
		['#/admin/properties', 'Properties', 'building'],
		['#/admin/tenants', 'Tenants & leases', 'users'],
		['#/admin/maintenance', 'Maintenance', 'wrench'],
		['#/admin/complaints', 'Complaints', 'message'],
		['#/admin/payments', 'Payments', 'wallet'],
		['#/admin/invoices', 'Invoices', 'invoice'],
		['#/admin/cashflow', 'Cashflow', 'wallet', ['owner', 'admin']],
		['#/admin/codes', 'Codes & roles', 'key'],
		['#/admin/settings', 'Settings', 'sliders', ['owner', 'admin']],
		['#/admin/audit', 'Audit log', 'list'],
		['#/admin/notices', 'Notices', 'bullhorn'],
		['#/admin/info', 'Property info', 'info'],
		['#/admin/emergency', 'Emergency alerts', 'siren'],
		['#/admin/profile', 'My profile', 'profile'],
	],
};

export function getRoleNavigation(role) {
	const currentRole = getCurrentUser()?.role;
	return (NAV[role] || NAV.admin).filter((entry) => !entry[3] || entry[3].includes(currentRole));
}

// The bottom nav truncates the nav label to its first word, matching the
// mockup's bottomNav().
export function shortNavLabel(label) {
	return label.split(' ')[0];
}

// Page title for the topbar comes from the nav entry for the current page.
export function getNavLabel(role, href) {
	const item = getRoleNavigation(role).find(([entryHref]) => entryHref === href);
	return item ? item[1] : '';
}

function resolveRole(user) {
	if (user.role === 'service_provider') return 'service_provider';
	if (user.role === 'tenant') return 'tenant';
	return 'admin';
}

function formatRole(role) {
	return (role || 'user').replaceAll('_', ' ');
}

function escapeHtml(value) {
	const div = document.createElement('div');
	div.textContent = value == null ? '' : String(value);
	return div.innerHTML;
}

function navLink([href, label, iconName], activeHref) {
	const active = href === activeHref ? ' active' : '';
	return `<a data-menu-link href="${href}" class="${active.trim()}">${icon(iconName)}<span>${escapeHtml(label)}</span></a>`;
}

function themeButtonGroup() {
	const pref = getThemePreference();
	const options = [
		['system', 'System'],
		['light', 'Light'],
		['dark', 'Dark'],
	];

	return `<div class="appearance-picker">
		<div class="appearance-label">Appearance</div>
		<div class="appearance-group">
			${options.map(([value, label]) => `<button type="button" class="btn secondary sm" data-theme-pref="${value}" aria-pressed="${pref === value}">${label}</button>`).join('')}
		</div>
	</div>`;
}

function isAndroid() {
	return /android/i.test(navigator.userAgent);
}

function installBlock() {
	if (isStandalone()) return '';

	if (canInstall()) {
		return `<div class="install-block">
			<div class="appearance-label">Install app</div>
			<button type="button" class="btn brass sm" data-install-btn>Install</button>
		</div>`;
	}

	if (isIos()) {
		return `<div class="install-block">
			<div class="appearance-label">Install app</div>
			<p class="small muted">On iPhone: tap the Share button, then Add to Home Screen.</p>
		</div>`;
	}

	if (isAndroid()) {
		return `<div class="install-block">
			<div class="appearance-label">Install app</div>
			<p class="small muted">Open your browser menu and choose Install app or Add to Home screen.</p>
		</div>`;
	}

	return '';
}

function syncThemeButtons(container) {
	const pref = getThemePreference();
	container.querySelectorAll('[data-theme-pref]').forEach(button => {
		const isActive = button.dataset.themePref === pref;
		button.setAttribute('aria-pressed', String(isActive));
		button.classList.toggle('active', isActive);
		button.classList.toggle('secondary', !isActive);
		if (isActive) {
			button.classList.remove('secondary');
		}
	});
}

export function renderHamburgerMenu(container, { activeHref }) {
	const user = getCurrentUser() || {};
	const role = resolveRole(user);
	const nav = getRoleNavigation(role);
	const name = user.name || (role === 'tenant' ? 'Tenant' : role === 'service_provider' ? 'Service provider' : 'Admin');
	const sub = user.district_name || formatRole(user.role);

	container.innerHTML = `
		<aside class="sidebar" aria-label="Main navigation">
			<div class="brand">
				<div class="mark">${logoSvg({ size: 28, variant: 'dark' })}</div>
				<div class="txt"><div class="brand-business-name">Stead</div><div>Property management</div></div>
			</div>
			<div class="sidebar-who">
				<div class="avatar">${escapeHtml(name.charAt(0).toUpperCase())}</div>
				<div>
					<div class="who-name">${escapeHtml(name)}</div>
					<div class="who-sub">${escapeHtml(sub)}</div>
				</div>
			</div>
			<nav>${nav.map(item => navLink(item, activeHref)).join('')}</nav>
			<div class="install-slot">${installBlock()}</div>
			${themeButtonGroup()}
			<button class="logout sidebar-logout" type="button">${icon('logout')} Log out</button>
		</aside>
		<div class="menu-overlay" aria-hidden="true">
			<div class="menu-panel" role="dialog" aria-label="Navigation menu">
				<div class="menu-brand">
					<div class="mark">${logoSvg({ size: 28 })}</div>
					<div class="txt"><div class="brand-business-name">Stead</div><div>Property management</div></div>
				</div>
				<div class="menu-who">
					<div class="avatar">${escapeHtml(name.charAt(0).toUpperCase())}</div>
					<div>
						<div class="who-name">${escapeHtml(name)}</div>
						<div class="who-sub">${escapeHtml(sub)}</div>
					</div>
				</div>
				<nav class="menu-list">
					${nav.map(item => navLink(item, activeHref)).join('')}
					<div class="install-slot">${installBlock()}</div>
					${themeButtonGroup()}
					<button class="logout menu-logout" type="button">${icon('logout')} Log out</button>
				</nav>
			</div>
		</div>
	`;

	const overlay = container.querySelector('.menu-overlay');
	const close = () => {
		overlay.classList.remove('open');
		overlay.setAttribute('aria-hidden', 'true');
	};
	const open = () => {
		overlay.classList.add('open');
		overlay.setAttribute('aria-hidden', 'false');
	};

	const updateThemeControls = () => {
		syncThemeButtons(container);
	};

	// "Stead" is only a fallback until the real business name arrives.
	getBusinessName().then((businessName) => {
		container.querySelectorAll('.brand-business-name').forEach((el) => {
			el.textContent = businessName;
		});
	});

	getMyAvatarUrl().then((url) => {
		if (!url || !String(url).startsWith('https://')) return;
		container.querySelectorAll('.avatar').forEach((el) => {
			const img = document.createElement('img');
			img.src = url;
			img.alt = '';
			img.className = 'avatar-img';
			el.replaceChildren(img);
		});
	});

	overlay.addEventListener('click', event => {
		if (event.target === overlay) close();
	});
	container.querySelectorAll('.logout').forEach(button => {
		button.addEventListener('click', logout);
	});
	container.querySelectorAll('a[data-menu-link]').forEach(link => {
		link.addEventListener('click', close);
	});
	container.querySelectorAll('[data-theme-pref]').forEach(button => {
		button.addEventListener('click', () => {
			setThemePreference(button.dataset.themePref);
			updateThemeControls();
		});
	});

	// One delegated handler covers every install button (sidebar copy and mobile menu copy).
	container.addEventListener('click', (event) => {
		if (event.target.closest('[data-install-btn]')) promptInstall();
	});

	// Keep exactly one live set of window listeners, so navigation does not stack them.
	if (themeRefresh) window.removeEventListener('stead-theme-change', themeRefresh);
	themeRefresh = updateThemeControls;
	window.addEventListener('stead-theme-change', themeRefresh);

	if (installRefresh) {
		window.removeEventListener('stead-install-available', installRefresh);
		window.removeEventListener('stead-install-changed', installRefresh);
	}
	installRefresh = () => {
		container.querySelectorAll('.install-slot').forEach((slot) => {
			slot.innerHTML = installBlock();
		});
	};
	window.addEventListener('stead-install-available', installRefresh);
	window.addEventListener('stead-install-changed', installRefresh);

	updateThemeControls();

	return { open, close };
}
