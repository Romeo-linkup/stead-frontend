import { icon } from './icons.js';

export const QUICK_ACCESS = {
	tenant: [
		{ href: '#/tenant/maintenance', label: 'Report maintenance', iconName: 'wrench' },
		{ href: '#/tenant/messages', label: 'Message admin', iconName: 'message' },
		{ href: '#/tenant/pay', label: 'Rent & accounts', iconName: 'wallet' },
		{ href: '#/tenant/lease', label: 'My lease', iconName: 'document' },
	],
	admin: [
		{ href: '#/admin/properties', label: 'Review properties', iconName: 'building' },
		{ href: '#/admin/emergency', label: 'Emergency alerts', iconName: 'siren' },
		{ href: '#/admin/payments', label: 'Payments', iconName: 'wallet' },
		{ href: '#/admin/maintenance', label: 'Maintenance', iconName: 'wrench' },
	],
};

export function renderQuickAccessGrid(container, items = []) {
	container.innerHTML = `
		<div class="quick-access-grid">
			${items.map(item => `
				<a class="quick-access-item" href="${item.href}">
					<span class="quick-access-icon">${icon(item.iconName || 'plus')}</span>
					<span>${escapeHtml(item.label)}</span>
				</a>
			`).join('')}
		</div>
	`;
}

function escapeHtml(value) {
	const div = document.createElement('div');
	div.textContent = value == null ? '' : String(value);
	return div.innerHTML;
}
