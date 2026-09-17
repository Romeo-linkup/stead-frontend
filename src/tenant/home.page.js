// src/tenant/home.page.js
import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { getCurrentUser } from '../auth/session.js';
import { renderQuickAccessGrid, QUICK_ACCESS } from '../shared/quick-access-grid.js';

export async function renderHome(root) {
  const content = renderShell(root, { activeHref: '#/tenant/home', title: 'Home' });
  const user = getCurrentUser();

  content.innerHTML = `
    <div class="card">
      <h3 class="serif" style="margin-top:0;">Rent due</h3>
      <div id="rent-summary">Loading...</div>
    </div>
    <div class="card">
      <h3 class="serif" style="margin-top:0;">Recent activity</h3>
      <div id="activity-feed">Loading...</div>
    </div>
      <div id="quick-access-slot"></div>
  `;

  renderQuickAccessGrid(content.querySelector('#quick-access-slot'), QUICK_ACCESS.tenant);
  async function loadRentSummary() {
    const summaryEl = content.querySelector('#rent-summary');
    try {
      // Get the tenant's unit first
      const units = await apiFetch('/units');
      const tenantUnit = units.find(u => u.tenant_user_id === user.user_id);
      
      if (!tenantUnit) {
        summaryEl.innerHTML = '<p style="color:var(--slate);">No unit assigned.</p>';
        return;
      }

      // Get payments for this unit
      const payments = await apiFetch('/payments');
      const unitPayments = payments.filter(p => p.unit_id === tenantUnit.id);
      
      // Find the next outstanding or pending payment
      const nextPayment = unitPayments
        .filter(p => p.status === 'outstanding' || p.status === 'pending')
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];

      if (nextPayment) {
        const statusClass = nextPayment.status === 'outstanding' ? 'badge-inactive' : 'badge-active';
        summaryEl.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div>
              <div style="font-size:24px;font-weight:600;font-family:'Newsreader',serif;">R${Number(nextPayment.amount).toLocaleString()}</div>
              <div style="font-size:13px;color:var(--slate);">Due ${new Date(nextPayment.due_date).toLocaleDateString()}</div>
            </div>
            <span class="badge ${statusClass}">${nextPayment.status}</span>
          </div>
          <a href="#/tenant/pay" class="btn btn-outline" style="width:100%;text-align:center;">View all payments</a>
        `;
      } else {
        summaryEl.innerHTML = `
          <div style="color:var(--forest);margin-bottom:12px;">No outstanding payments</div>
          <a href="#/tenant/pay" class="btn btn-outline" style="width:100%;text-align:center;">View payment history</a>
        `;
      }
    } catch (err) {
      summaryEl.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
    }
  }

  async function loadActivityFeed() {
    const feedEl = content.querySelector('#activity-feed');
    try {
      // Get the tenant's unit
      const units = await apiFetch('/units');
      const tenantUnit = units.find(u => u.tenant_user_id === user.user_id);
      
      if (!tenantUnit) {
        feedEl.innerHTML = '<p style="color:var(--slate);">No unit assigned.</p>';
        return;
      }

      // Get maintenance requests and payments for this unit
      const [maintenance, payments] = await Promise.all([
        apiFetch('/maintenance'),
        apiFetch('/payments')
      ]);

      const unitMaintenance = maintenance.filter(m => m.unit_id === tenantUnit.id);
      const unitPayments = payments.filter(p => p.unit_id === tenantUnit.id);

      // Combine and sort by created_at descending
      const activities = [
        ...unitMaintenance.map(m => ({ ...m, type: 'maintenance' })),
        ...unitPayments.map(p => ({ ...p, type: 'payment' }))
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      if (!activities.length) {
        feedEl.innerHTML = '<p style="color:var(--slate);">No recent activity.</p>';
        return;
      }

      feedEl.innerHTML = `
        <table class="list">
          <thead><tr><th>Type</th><th>Details</th><th>Date</th></tr></thead>
          <tbody>
            ${activities.map(activity => {
              if (activity.type === 'maintenance') {
                return `
                  <tr>
                    <td><span style="font-size:12px;color:var(--slate);">Maintenance</span></td>
                    <td>${escapeHtml(activity.category)}</td>
                    <td>${new Date(activity.created_at).toLocaleDateString()}</td>
                  </tr>
                `;
              } else {
                return `
                  <tr>
                    <td><span style="font-size:12px;color:var(--slate);">Payment</span></td>
                    <td>R${Number(activity.amount).toLocaleString()} - ${activity.type}</td>
                    <td>${new Date(activity.created_at).toLocaleDateString()}</td>
                  </tr>
                `;
              }
            }).join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      feedEl.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
    }
  }

  await loadRentSummary();
  await loadActivityFeed();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
