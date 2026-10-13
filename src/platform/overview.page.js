// src/platform/overview.page.js
import { platformFetch } from './api.js';
import { renderPlatformShell } from './shell.js';
import { logoSvg } from '../shared/logo.js';

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function renderPlatformOverview(root) {
  const content = renderPlatformShell(root, { activeHref: '#/platform', title: 'Stead platform' });

  content.innerHTML = `
    <div id="error" class="auth-error" style="display:none;"></div>
    <div id="loading">Loading...</div>
    <div id="overview-content" style="display:none;">
      <h2>Overview</h2>

      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-value" id="kpi-orgs">-</div>
          <div class="kpi-label">Organisations</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value" id="kpi-active-30">-</div>
          <div class="kpi-label">Active (30 days)</div>
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

      <h3>Users by role</h3>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody id="users-table"></tbody>
        </table>
      </div>

      <h3>Codes by role</h3>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Issued</th>
              <th>Registered</th>
              <th>Active</th>
              <th>Revoked</th>
            </tr>
          </thead>
          <tbody id="codes-table"></tbody>
        </table>
      </div>

      <h3>Signups per week (last 12 weeks)</h3>
      <div id="signups-chart"></div>

      <h3>Audit events per day (last 30 days)</h3>
      <div id="audit-chart"></div>
    </div>
  `;

  const errorBox = content.querySelector('#error');
  const loading = content.querySelector('#loading');
  const overviewContent = content.querySelector('#overview-content');

  async function loadOverview() {
    try {
      const data = await platformFetch('/platform/overview');

      loading.style.display = 'none';
      overviewContent.style.display = 'block';

      content.querySelector('#kpi-orgs').textContent = data.organizations;
      content.querySelector('#kpi-active-30').textContent = data.active_30_days;
      content.querySelector('#kpi-units').textContent = data.units;
      content.querySelector('#kpi-users').textContent = data.users_by_role.reduce((sum, r) => sum + parseInt(r.count), 0);

      const usersTable = content.querySelector('#users-table');
      usersTable.innerHTML = data.users_by_role.map(row => `
        <tr>
          <td>${escapeHtml(row.role)}</td>
          <td>${row.count}</td>
        </tr>
      `).join('');

      const codesTable = content.querySelector('#codes-table');
      codesTable.innerHTML = data.codes_by_role.map(row => `
        <tr>
          <td>${escapeHtml(row.role)}</td>
          <td>${row.issued}</td>
          <td>${row.registered}</td>
          <td>${row.active}</td>
          <td>${row.revoked}</td>
        </tr>
      `).join('');

      const signupsChart = content.querySelector('#signups-chart');
      if (data.signups_per_week.length > 0) {
        const maxCount = Math.max(...data.signups_per_week.map(r => parseInt(r.count)));
        signupsChart.innerHTML = data.signups_per_week.map(row => {
          const week = new Date(row.week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const width = maxCount > 0 ? (parseInt(row.count) / maxCount * 100) : 0;
          return `
            <div class="bar-row">
              <div class="bar-label">${week}</div>
              <div class="score-bar"><div style="width:${width}%;"></div></div>
              <div class="bar-value">${row.count}</div>
            </div>
          `;
        }).join('');
      } else {
        signupsChart.innerHTML = '<p class="muted">No data</p>';
      }

      const auditChart = content.querySelector('#audit-chart');
      if (data.audit_events_per_day.length > 0) {
        const maxCount = Math.max(...data.audit_events_per_day.map(r => parseInt(r.count)));
        auditChart.innerHTML = data.audit_events_per_day.map(row => {
          const day = new Date(row.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const width = maxCount > 0 ? (parseInt(row.count) / maxCount * 100) : 0;
          return `
            <div class="bar-row">
              <div class="bar-label">${day}</div>
              <div class="score-bar"><div style="width:${width}%;"></div></div>
              <div class="bar-value">${row.count}</div>
            </div>
          `;
        }).join('');
      } else {
        auditChart.innerHTML = '<p class="muted">No data</p>';
      }
    } catch (err) {
      loading.style.display = 'none';
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    }
  }

  loadOverview();
}
