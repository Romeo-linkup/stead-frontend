import { getRoleNavigation, shortNavLabel } from './hamburger-menu.js';
import { icon } from './icons.js';

const BOTTOM = {
	tenant: ['#/tenant/home', '#/tenant/maintenance', '#/tenant/messages', '__menu'],
	service_provider: ['#/provider/tasks', '#/provider/messages', '__menu'],
	admin: ['#/admin/overview', '#/admin/maintenance', '#/admin/payments', '__menu'],
};

export function renderBottomNav(container, { activeHref, role, onMenuOpen }) {
	const items = BOTTOM[role] || BOTTOM.admin;
	const nav = getRoleNavigation(role);

	container.innerHTML = `
		<nav class="bottom-nav" aria-label="Quick navigation">
			${items.map(href => {
				if (href === '__menu') {
					return `<button class="bottom-menu" type="button" aria-label="Open menu">${icon('menu')}<span>Menu</span></button>`;
				}
				const item = nav.find(entry => entry[0] === href);
				if (!item) return '';
				const [, label, iconName] = item;
				const active = href === activeHref ? ' active' : '';
				return `<a href="${href}" class="bottom-nav-item${active}">${icon(iconName)}<span>${escapeHtml(shortNavLabel(label))}</span></a>`;
			}).join('')}
		</nav>
	`;

	const menuButton = container.querySelector('.bottom-menu');
	if (menuButton) {
		menuButton.addEventListener('click', () => {
			if (typeof onMenuOpen === 'function') onMenuOpen();
		});
	}
}

function escapeHtml(value) {
	const div = document.createElement('div');
	div.textContent = value == null ? '' : String(value);
	return div.innerHTML;
}
