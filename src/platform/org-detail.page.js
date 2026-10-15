// src/platform/org-detail.page.js
import { platformFetch } from './api.js';
import { renderPlatformShell } from './shell.js';
import { escapeHtml } from './format.js';

export function renderPlatformOrgDetail(root) {
  const params = new URLSearchParams(window.location.hash.split('?')[1]);
  const orgId = params.get('view');

  if (!orgId) {
    window.location.hash = '#/platform/orgs';
    return;
  }

  const content = renderPlatformShell(root, { activeHref: '#/platform/orgs', title: 'Stead platform' });

  content.innerHTML = `
    <div id="error" class="auth-error" style="display:none;"></div>
    <div id="loading">Loading...</div>
    <div id="org-detail-content" style="display:none;">
      <div class="org-header">
        <h2 id="org-name">-</h2>
        <div class="org-status" id="org-status">-</div>
      </div>

      <div class="org-actions">
        <button class="btn secondary" id="suspend-btn">Suspend</button>
        <button class="btn secondary" id="unsuspend-btn" style="display:none;">Unsuspend</button>
        <button class="btn secondary" id="dispute-btn">Open dispute access</button>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-value" id="kpi-districts">-</div>
          <div class="kpi-label">Districts</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value" id="kpi-properties">-</div>
          <div class="kpi-label">Properties</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value" id="kpi-units">-</div>
          <div class="kpi-label">Units</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value" id="kpi-users">-</div>
          <div class="kpi-label">Users</div>
        </div>
      </div>

      <h3>District breakdown</h3>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>District</th>
              <th class="num">Properties</th>
              <th class="num">Units</th>
              <th class="num">Users</th>
              <th class="num">Active codes</th>
            </tr>
          </thead>
          <tbody id="districts-table"></tbody>
        </table>
      </div>

      <h3>Notes</h3>
      <div id="notes-list"></div>
      <form id="add-note-form" class="add-note-form">
        <textarea id="note-input" class="field" placeholder="Add a note (1-1000 characters)..." maxlength="1000"></textarea>
        <button class="btn brass" type="submit" id="add-note-btn">Add note</button>
      </form>

      <h3>Recent ledger entries</h3>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Event</th>
              <th>Actor</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody id="ledger-table"></tbody>
        </table>
      </div>

      <div id="dispute-section" style="display:none;">
        <h3>Dispute access</h3>
        <div id="dispute-notice" class="muted"></div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor role</th>
                <th>Action</th>
                <th>Entity</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody id="audit-table"></tbody>
          </table>
        </div>
        <div class="audit-filters">
          <input type="date" id="audit-from" class="field" />
          <input type="date" id="audit-to" class="field" />
          <input type="number" id="audit-limit" class="field" placeholder="Limit (max 500)" min="1" max="500" value="100" />
          <button class="btn secondary" id="load-audit-btn">Load audit</button>
        </div>
      </div>
    </div>

    <div id="suspend-modal" class="modal" style="display:none;">
      <div class="modal-content">
        <h3>Suspend organisation</h3>
        <form id="suspend-form">
          <label class="field-label">Reason (5-300 characters)</label>
          <textarea id="suspend-reason" class="field" required minlength="5" maxlength="300"></textarea>
          <div class="modal-actions">
            <button class="btn secondary" type="button" id="cancel-suspend">Cancel</button>
            <button class="btn brass" type="submit" id="confirm-suspend">Suspend</button>
          </div>
        </form>
      </div>
    </div>

    <div id="dispute-modal" class="modal" style="display:none;">
      <div class="modal-content">
        <h3>Open dispute access</h3>
        <p class="muted">This grants 24-hour access to the organisation's audit log. The owner will be notified by email.</p>
        <form id="dispute-form">
          <label class="field-label">Reason (10-500 characters)</label>
          <textarea id="dispute-reason" class="field" required minlength="10" maxlength="500"></textarea>
          <div class="modal-actions">
            <button class="btn secondary" type="button" id="cancel-dispute">Cancel</button>
            <button class="btn brass" type="submit" id="confirm-dispute">Grant access</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const errorBox = content.querySelector('#error');
  const loading = content.querySelector('#loading');
  const orgDetailContent = content.querySelector('#org-detail-content');
  const suspendBtn = content.querySelector('#suspend-btn');
  const unsuspendBtn = content.querySelector('#unsuspend-btn');
  const disputeBtn = content.querySelector('#dispute-btn');
  const suspendModal = content.querySelector('#suspend-modal');
  const disputeModal = content.querySelector('#dispute-modal');

  let currentOrg = null;

  async function loadOrgDetail() {
    try {
      const data = await platformFetch(`/platform/orgs/${orgId}`);

      loading.style.display = 'none';
      orgDetailContent.style.display = 'block';
      currentOrg = data.org;

      content.querySelector('#org-name').textContent = data.org.name;
      const statusDiv = content.querySelector('#org-status');
      statusDiv.textContent = data.org.status;
      statusDiv.className = `org-status status-badge ${data.org.status}`;

      content.querySelector('#kpi-districts').textContent = data.org.districts;
      content.querySelector('#kpi-properties').textContent = data.org.properties;
      content.querySelector('#kpi-units').textContent = data.org.units;
      const totalUsers = (parseInt(data.org.admins) || 0) +
                        (parseInt(data.org.property_managers) || 0) +
                        (parseInt(data.org.service_providers) || 0) +
                        (parseInt(data.org.tenants) || 0);
      content.querySelector('#kpi-users').textContent = totalUsers;

      suspendBtn.style.display = data.org.status === 'active' ? 'inline-block' : 'none';
      unsuspendBtn.style.display = data.org.status === 'suspended' ? 'inline-block' : 'none';

      const districtsTable = content.querySelector('#districts-table');
      if (data.district_breakdown.length === 0) {
        districtsTable.innerHTML = '<tr><td colspan="5" class="muted">No districts</td></tr>';
      } else {
        districtsTable.innerHTML = data.district_breakdown.map(d => {
          const totalUsers = (parseInt(d.admins) || 0) +
                            (parseInt(d.property_managers) || 0) +
                            (parseInt(d.service_providers) || 0) +
                            (parseInt(d.tenants) || 0);
          return `
            <tr>
              <td>${escapeHtml(d.name)}</td>
              <td class="num">${d.properties}</td>
              <td class="num">${d.units}</td>
              <td class="num">${totalUsers}</td>
              <td class="num">${d.active_codes}</td>
            </tr>
          `;
        }).join('');
      }

      const notesList = content.querySelector('#notes-list');
      if (data.notes.length > 0) {
        notesList.innerHTML = data.notes.map(note => `
          <div class="note-item">
            <div class="note-date">${new Date(note.created_at).toLocaleString()}</div>
            <div class="note-text">${escapeHtml(note.note)}</div>
          </div>
        `).join('');
      } else {
        notesList.innerHTML = '<p class="muted">No notes</p>';
      }

      const ledgerTable = content.querySelector('#ledger-table');
      if (data.ledger.length === 0) {
        ledgerTable.innerHTML = '<tr><td colspan="4" class="muted">No ledger entries</td></tr>';
      } else {
        ledgerTable.innerHTML = data.ledger.map(entry => `
          <tr>
            <td>${new Date(entry.occurred_at).toLocaleString()}</td>
            <td>${escapeHtml(entry.event_type)}</td>
            <td>${escapeHtml(entry.actor_type)} ${escapeHtml(String(entry.actor_id || ''))}</td>
            <td class="cell-detail">${escapeHtml(JSON.stringify(entry.detail))}</td>
          </tr>
        `).join('');
      }
    } catch (err) {
      loading.style.display = 'none';
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    }
  }

  // Add note
  const addNoteForm = content.querySelector('#add-note-form');
  const addNoteBtn = content.querySelector('#add-note-btn');

  addNoteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const note = content.querySelector('#note-input').value.trim();
    if (!note) return;

    addNoteBtn.disabled = true;
    addNoteBtn.textContent = 'Adding...';

    try {
      await platformFetch(`/platform/orgs/${orgId}/notes`, {
        method: 'POST',
        body: { note },
      });
      content.querySelector('#note-input').value = '';
      loadOrgDetail();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    } finally {
      addNoteBtn.disabled = false;
      addNoteBtn.textContent = 'Add note';
    }
  });

  // Suspend modal
  suspendBtn.addEventListener('click', () => {
    suspendModal.style.display = 'flex';
  });

  content.querySelector('#cancel-suspend').addEventListener('click', () => {
    suspendModal.style.display = 'none';
  });

  content.querySelector('#suspend-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const reason = content.querySelector('#suspend-reason').value.trim();
    const confirmBtn = content.querySelector('#confirm-suspend');

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Suspending...';

    try {
      await platformFetch(`/platform/orgs/${orgId}/suspend`, {
        method: 'POST',
        body: { reason },
      });
      suspendModal.style.display = 'none';
      loadOrgDetail();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Suspend';
    }
  });

  // Unsuspend
  unsuspendBtn.addEventListener('click', async () => {
    try {
      await platformFetch(`/platform/orgs/${orgId}/unsuspend`, {
        method: 'POST',
      });
      loadOrgDetail();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    }
  });

  // Dispute access modal
  disputeBtn.addEventListener('click', () => {
    disputeModal.style.display = 'flex';
  });

  content.querySelector('#cancel-dispute').addEventListener('click', () => {
    disputeModal.style.display = 'none';
  });

  content.querySelector('#dispute-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const reason = content.querySelector('#dispute-reason').value.trim();
    const confirmBtn = content.querySelector('#confirm-dispute');

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Granting...';

    try {
      const data = await platformFetch(`/platform/orgs/${orgId}/dispute-access`, {
        method: 'POST',
        body: { reason },
      });
      disputeModal.style.display = 'none';
      content.querySelector('#dispute-section').style.display = 'block';
      content.querySelector('#dispute-notice').textContent = `Access recorded. Expires ${new Date(data.expires_at).toLocaleString()}.`;
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Grant access';
    }
  });

  // Load audit
  content.querySelector('#load-audit-btn').addEventListener('click', async () => {
    const from = content.querySelector('#audit-from').value;
    const to = content.querySelector('#audit-to').value;
    const limit = content.querySelector('#audit-limit').value;

    const params = new URLSearchParams({ limit });
    if (from) params.set('from', from);
    if (to) params.set('to', to);

    try {
      const data = await platformFetch(`/platform/orgs/${orgId}/audit?${params}`);
      const auditTable = content.querySelector('#audit-table');
      if (data.audit.length === 0) {
        auditTable.innerHTML = '<tr><td colspan="5" class="muted">No audit entries</td></tr>';
      } else {
        auditTable.innerHTML = data.audit.map(row => `
          <tr>
            <td>${new Date(row.created_at).toLocaleString()}</td>
            <td>${escapeHtml(row.actor_role || '-')}</td>
            <td>${escapeHtml(row.action)}</td>
            <td>${escapeHtml(row.entity_type || '-')} ${escapeHtml(String(row.entity_id || ''))}</td>
            <td>${escapeHtml(row.ip || '-')}</td>
          </tr>
        `).join('');
      }
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    }
  });

  loadOrgDetail();
}
