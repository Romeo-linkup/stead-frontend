// src/platform/ledger.page.js
import { platformFetch, platformFetchBlob, saveBlob } from './api.js';
import { renderPlatformShell } from './shell.js';

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function renderPlatformLedger(root) {
  const content = renderPlatformShell(root, { activeHref: '#/platform/ledger', title: 'Stead platform' });

  content.innerHTML = `
    <div id="error" class="auth-error" style="display:none;"></div>
    <div id="loading">Loading...</div>
    <div id="ledger-content" style="display:none;">
      <h2>Platform ledger</h2>

      <div class="ledger-actions">
        <button class="btn secondary" id="verify-btn">Verify chain</button>
        <button class="btn secondary" id="export-btn">Export CSV</button>
      </div>

      <div id="verify-result" style="display:none;"></div>

      <div class="ledger-filters">
        <input type="text" id="org-filter" class="field" placeholder="Organisation ID" />
        <input type="text" id="type-filter" class="field" placeholder="Event type" />
        <input type="date" id="from-filter" class="field" />
        <input type="date" id="to-filter" class="field" />
        <button class="btn secondary" id="apply-filters">Apply filters</button>
        <button class="btn secondary" id="clear-filters">Clear</button>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Time</th>
              <th>Actor type</th>
              <th>Actor ID</th>
              <th>Org ID</th>
              <th>Org name</th>
              <th>Event type</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody id="ledger-table"></tbody>
        </table>
      </div>

      <div class="pagination">
        <button class="btn secondary" id="prev-page" disabled>Previous</button>
        <span id="page-info">Page 1</span>
        <button class="btn secondary" id="next-page" disabled>Next</button>
      </div>
    </div>

    <div id="export-modal" class="modal" style="display:none;">
      <div class="modal-content">
        <h3>Export ledger to CSV</h3>
        <p class="muted">Maximum range: 31 days</p>
        <form id="export-form">
          <label class="field-label">From date</label>
          <input type="date" id="export-from" class="field" required />
          <label class="field-label">To date</label>
          <input type="date" id="export-to" class="field" required />
          <div class="modal-actions">
            <button class="btn secondary" type="button" id="cancel-export">Cancel</button>
            <button class="btn brass" type="submit" id="confirm-export">Export</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const errorBox = content.querySelector('#error');
  const loading = content.querySelector('#loading');
  const ledgerContent = content.querySelector('#ledger-content');
  const verifyBtn = content.querySelector('#verify-btn');
  const exportBtn = content.querySelector('#export-btn');
  const verifyResult = content.querySelector('#verify-result');
  const orgFilter = content.querySelector('#org-filter');
  const typeFilter = content.querySelector('#type-filter');
  const fromFilter = content.querySelector('#from-filter');
  const toFilter = content.querySelector('#to-filter');
  const applyFiltersBtn = content.querySelector('#apply-filters');
  const clearFiltersBtn = content.querySelector('#clear-filters');
  const ledgerTable = content.querySelector('#ledger-table');
  const prevBtn = content.querySelector('#prev-page');
  const nextBtn = content.querySelector('#next-page');
  const pageInfo = content.querySelector('#page-info');
  const exportModal = content.querySelector('#export-modal');

  let currentPage = 1;
  let currentFilters = { org: '', type: '', from: '', to: '' };

  async function loadLedger() {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
      });
      if (currentFilters.org) params.set('org', currentFilters.org);
      if (currentFilters.type) params.set('type', currentFilters.type);
      if (currentFilters.from) params.set('from', currentFilters.from);
      if (currentFilters.to) params.set('to', currentFilters.to);

      const data = await platformFetch(`/platform/ledger?${params}`);

      loading.style.display = 'none';
      ledgerContent.style.display = 'block';

      ledgerTable.innerHTML = data.ledger.map(entry => `
        <tr>
          <td>${entry.id}</td>
          <td>${new Date(entry.occurred_at).toLocaleString()}</td>
          <td>${escapeHtml(entry.actor_type)}</td>
          <td>${entry.actor_id || '-'}</td>
          <td>${entry.organization_id || '-'}</td>
          <td>${escapeHtml(entry.organization_name || '-')}</td>
          <td>${escapeHtml(entry.event_type)}</td>
          <td>${escapeHtml(JSON.stringify(entry.detail))}</td>
        </tr>
      `).join('');

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

  verifyBtn.addEventListener('click', async () => {
    verifyBtn.disabled = true;
    verifyBtn.textContent = 'Verifying...';

    try {
      const data = await platformFetch('/platform/ledger/verify');
      verifyResult.style.display = 'block';
      if (data.ok) {
        verifyResult.innerHTML = `
          <div class="verify-success">
            <strong>✓ Chain verified</strong><br>
            Checked ${data.checked} entries<br>
            Head hash: <code>${data.head_hash || 'none'}</code> (ID: ${data.head_id || 'none'})
            <button class="btn secondary sm" id="copy-hash">Copy hash</button>
          </div>
        `;
        content.querySelector('#copy-hash').addEventListener('click', () => {
          navigator.clipboard.writeText(data.head_hash || '');
        });
      } else {
        verifyResult.innerHTML = `
          <div class="verify-error">
            <strong>✗ Chain verification failed</strong><br>
            Checked ${data.checked} entries<br>
            First bad ID: ${data.firstBadId}
          </div>
        `;
      }
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    } finally {
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'Verify chain';
    }
  });

  exportBtn.addEventListener('click', () => {
    exportModal.style.display = 'flex';
  });

  content.querySelector('#cancel-export').addEventListener('click', () => {
    exportModal.style.display = 'none';
  });

  content.querySelector('#export-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const from = content.querySelector('#export-from').value;
    const to = content.querySelector('#export-to').value;
    const confirmBtn = content.querySelector('#confirm-export');

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Exporting...';

    try {
      const params = new URLSearchParams({ from, to });
      const blob = await platformFetchBlob(`/platform/ledger/export.csv?${params}`);
      saveBlob(blob, 'platform-ledger.csv');
      exportModal.style.display = 'none';
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Export';
    }
  });

  applyFiltersBtn.addEventListener('click', () => {
    currentFilters.org = orgFilter.value;
    currentFilters.type = typeFilter.value;
    currentFilters.from = fromFilter.value;
    currentFilters.to = toFilter.value;
    currentPage = 1;
    loadLedger();
  });

  clearFiltersBtn.addEventListener('click', () => {
    orgFilter.value = '';
    typeFilter.value = '';
    fromFilter.value = '';
    toFilter.value = '';
    currentFilters = { org: '', type: '', from: '', to: '' };
    currentPage = 1;
    loadLedger();
  });

  prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadLedger();
    }
  });

  nextBtn.addEventListener('click', () => {
    currentPage++;
    loadLedger();
  });

  loadLedger();
}
