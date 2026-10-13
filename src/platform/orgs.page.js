// src/platform/orgs.page.js
import { platformFetch } from './api.js';
import { renderPlatformShell } from './shell.js';

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function renderPlatformOrgs(root) {
  const content = renderPlatformShell(root, { activeHref: '#/platform/orgs', title: 'Stead platform' });

  content.innerHTML = `
    <div id="error" class="auth-error" style="display:none;"></div>
    <div id="loading">Loading...</div>
    <div id="orgs-content" style="display:none;">
      <h2>Organisations</h2>

      <div class="orgs-filters">
        <input type="text" id="search-input" class="field" placeholder="Search by name or owner email..." />
        <select id="status-select" class="field">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <select id="sort-select" class="field">
          <option value="created_at">Newest first</option>
          <option value="name">Name A-Z</option>
          <option value="status">Status</option>
          <option value="last_activity_at">Last activity</option>
        </select>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Districts</th>
              <th>Properties</th>
              <th>Units</th>
              <th>Users</th>
              <th>Active codes</th>
              <th>Last activity</th>
            </tr>
          </thead>
          <tbody id="orgs-table"></tbody>
        </table>
      </div>

      <div class="pagination">
        <button class="btn secondary" id="prev-page" disabled>Previous</button>
        <span id="page-info">Page 1</span>
        <button class="btn secondary" id="next-page" disabled>Next</button>
      </div>
    </div>
  `;

  const errorBox = content.querySelector('#error');
  const loading = content.querySelector('#loading');
  const orgsContent = content.querySelector('#orgs-content');
  const searchInput = content.querySelector('#search-input');
  const statusSelect = content.querySelector('#status-select');
  const sortSelect = content.querySelector('#sort-select');
  const orgsTable = content.querySelector('#orgs-table');
  const prevBtn = content.querySelector('#prev-page');
  const nextBtn = content.querySelector('#next-page');
  const pageInfo = content.querySelector('#page-info');

  let currentPage = 1;
  let currentFilters = { search: '', status: '', sort: 'created_at' };

  async function loadOrgs() {
    try {
      const params = new URLSearchParams({
        search: currentFilters.search,
        status: currentFilters.status,
        sort: currentFilters.sort,
        page: currentPage.toString(),
      });

      const data = await platformFetch(`/platform/orgs?${params}`);

      loading.style.display = 'none';
      orgsContent.style.display = 'block';

      orgsTable.innerHTML = data.orgs.map(org => {
        const totalUsers = (parseInt(org.admins) || 0) +
                          (parseInt(org.property_managers) || 0) +
                          (parseInt(org.service_providers) || 0) +
                          (parseInt(org.tenants) || 0);
        const lastActivity = org.last_activity_at
          ? new Date(org.last_activity_at).toLocaleDateString()
          : 'Never';

        return `
          <tr>
            <td><a href="#/platform/orgs?view=${org.id}">${escapeHtml(org.name)}</a></td>
            <td>${escapeHtml(org.owner_email || '-')}</td>
            <td><span class="status-badge ${org.status}">${escapeHtml(org.status)}</span></td>
            <td>${org.districts}</td>
            <td>${org.properties}</td>
            <td>${org.units}</td>
            <td>${totalUsers}</td>
            <td>${org.active_codes}</td>
            <td>${lastActivity}</td>
          </tr>
        `;
      }).join('');

      const totalPages = Math.ceil(data.total / data.per_page);
      pageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
      prevBtn.disabled = currentPage <= 1;
      nextBtn.disabled = currentPage >= totalPages;
    } catch (err) {
      loading.style.display = 'none';
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    }
  }

  searchInput.addEventListener('input', (e) => {
    currentFilters.search = e.target.value;
    currentPage = 1;
    loadOrgs();
  });

  statusSelect.addEventListener('change', (e) => {
    currentFilters.status = e.target.value;
    currentPage = 1;
    loadOrgs();
  });

  sortSelect.addEventListener('change', (e) => {
    currentFilters.sort = e.target.value;
    currentPage = 1;
    loadOrgs();
  });

  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadOrgs();
    }
  });

  nextBtn.addEventListener('click', () => {
    currentPage++;
    loadOrgs();
  });

  loadOrgs();
}
