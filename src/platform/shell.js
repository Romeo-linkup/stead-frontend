// src/platform/shell.js — responsive shell for the platform admin
import { clearPlatformToken } from './api.js';
import { logoSvg } from '../shared/logo.js';

const LINKS = [
  { href: '#/platform', label: 'Overview' },
  { href: '#/platform/orgs', label: 'Organisations' },
  { href: '#/platform/ledger', label: 'Ledger' },
];

export function renderPlatformShell(root, { activeHref, title = 'Stead platform' } = {}) {
  root.innerHTML = `
    <div class="pf-shell">
      <header class="pf-header">
        <div class="pf-header-inner">
          <a class="pf-brand" href="#/platform">
            <span class="pf-logo">${logoSvg({ size: 28 })}</span>
            <span class="pf-brand-text serif">${title}</span>
          </a>
          <nav class="pf-nav" aria-label="Platform">
            ${LINKS.map(
              (l) =>
                `<a href="${l.href}" class="${l.href === activeHref ? 'active' : ''}"${
                  l.href === activeHref ? ' aria-current="page"' : ''
                }>${l.label}</a>`
            ).join('')}
          </nav>
          <button type="button" class="pf-signout" id="platform-signout">Sign out</button>
        </div>
      </header>
      <main class="pf-main" id="page-content"></main>
    </div>
  `;

  root.querySelector('#platform-signout').addEventListener('click', () => {
    clearPlatformToken();
    window.location.hash = '#/platform/login';
  });

  return root.querySelector('#page-content');
}
