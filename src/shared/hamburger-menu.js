import { logout, getCurrentUser } from '../auth/session.js';
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
		['#/tenant/messages', 'Notices', 'bullhorn'],
		['#/tenant/info', 'Property info', 'info'],
		['#/tenant/profile', 'My profile', 'profile'],
	],
	service_provider: [
		['#/provider/tasks', 'My tasks', 'wrench'],
		['#/provider/messages', 'Notices', 'bullhorn'],
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
		['#/admin/codes', 'Codes & roles', 'key'],
		['#/admin/audit', 'Audit log', 'list'],
		['#/admin/emergency', 'Emergency alerts', 'siren'],
		['#/admin/profile', 'My profile', 'profile'],
	],
};

export function getRoleNavigation(role) {
	return NAV[role] || NAV.admin;
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

export function renderHamburgerMenu(container, { activeHref }) {
	const user = getCurrentUser() || {};
	const role = resolveRole(user);
	const nav = getRoleNavigation(role);
	const name = user.name || (role === 'tenant' ? 'Tenant' : role === 'service_provider' ? 'Service provider' : 'Admin');
	const sub = user.district_name || formatRole(user.role);

	container.innerHTML = `
		<aside class="sidebar" aria-label="Main navigation">
			<div class="brand">
				<div class="mark">${icon('key')}</div>
				<div class="txt"><div id="brand-business-name">Stead</div><div>Property management</div></div>
			</div>
			<div class="sidebar-who">
				<div class="avatar">${escapeHtml(name.charAt(0).toUpperCase())}</div>
				<div>
					<div class="who-name">${escapeHtml(name)}</div>
					<div class="who-sub">${escapeHtml(sub)}</div>
				</div>
			</div>
			<nav>${nav.map(item => navLink(item, activeHref)).join('')}</nav>
			<button class="logout sidebar-logout" type="button">${icon('logout')} Log out</button>
		</aside>
		<div class="menu-overlay" aria-hidden="true">
			<div class="menu-panel" role="dialog" aria-label="Navigation menu">
				<div class="menu-who">
					<div class="avatar">${escapeHtml(name.charAt(0).toUpperCase())}</div>
					<div>
						<div class="who-name">${escapeHtml(name)}</div>
						<div class="who-sub">${escapeHtml(sub)}</div>
					</div>
				</div>
				<nav class="menu-list">
					${nav.map(item => navLink(item, activeHref)).join('')}
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

	// Fill in the real business name once fetched — "Stead" shows briefly
	// as a fallback on first load, then gets replaced.
	getBusinessName().then((businessName) => {
		const el = container.querySelector('#brand-business-name');
		if (el) el.textContent = businessName;
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

	return { open, close };
}
