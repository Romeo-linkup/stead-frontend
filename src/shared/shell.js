import { getCurrentUser } from '../auth/session.js';
import { renderTopbar } from './topbar.js';
import { renderHamburgerMenu } from './hamburger-menu.js';
import { renderBottomNav } from './bottom-nav.js';

function resolveRole(user) {
	if (user.role === 'service_provider') return 'service_provider';
	if (user.role === 'tenant') return 'tenant';
	return 'admin';
}

export function renderShell(root, { activeHref, title }) {
	const user = getCurrentUser();
	const role = resolveRole(user);

	root.innerHTML = `
		<div id="app">
			<div id="menu-root"></div>
			<div class="main">
				<header id="topbar-root"></header>
				<div class="content" id="page-content"></div>
				<div id="bottom-nav-root"></div>
			</div>
		</div>
	`;

	const menu = renderHamburgerMenu(root.querySelector('#menu-root'), { activeHref });
	renderTopbar(root.querySelector('#topbar-root'), {
		title,
		isTenant: role === 'tenant',
		onMenuOpen: menu.open,
	});
	renderBottomNav(root.querySelector('#bottom-nav-root'), {
		activeHref,
		role,
		onMenuOpen: menu.open,
	});

	return root.querySelector('#page-content');
}
