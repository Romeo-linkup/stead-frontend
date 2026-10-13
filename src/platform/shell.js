// src/platform/shell.js — minimal shell for platform admin
export function renderPlatformShell(root, { activeHref, title }) {
  root.innerHTML = `
    <div id="app">
      <header class="topbar">
        <div class="topbar-left">
          <h1 class="topbar-title">${title}</h1>
        </div>
        <nav class="platform-nav">
          <a href="#/platform" class="${activeHref === '#/platform' ? 'active' : ''}">Overview</a>
          <a href="#/platform/orgs" class="${activeHref === '#/platform/orgs' ? 'active' : ''}">Organisations</a>
          <a href="#/platform/ledger" class="${activeHref === '#/platform/ledger' ? 'active' : ''}">Ledger</a>
          <a href="#" id="platform-signout">Sign out</a>
        </nav>
      </header>
      <div class="content" id="page-content"></div>
    </div>
  `;

  const signoutBtn = root.querySelector('#platform-signout');
  signoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const { clearPlatformToken } = require('./api.js');
    clearPlatformToken();
    window.location.hash = '#/platform/login';
  });

  return root.querySelector('#page-content');
}
