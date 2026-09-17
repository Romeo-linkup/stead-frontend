import { renderSosButton } from './sos-button.js';
import { icon } from './icons.js';

export function renderTopbar(container, { title, isTenant = false, onMenuOpen }) {
	container.className = 'topbar';
	container.innerHTML = `
		<div class="topbar-left">
			<button class="iconbtn hamburger-toggle" type="button" aria-label="Open menu">${icon('menu')}</button>
			<div class="pagetitle serif">${escapeHtml(title)}</div>
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
}

function escapeHtml(value) {
	const div = document.createElement('div');
	div.textContent = value == null ? '' : String(value);
	return div.innerHTML;
}
