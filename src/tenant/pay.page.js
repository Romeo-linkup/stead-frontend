// src/tenant/pay.page.js
import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { getCurrentUser } from '../auth/session.js';

export async function renderPay(root) {
  const content = renderShell(root, { activeHref: '#/tenant/pay', title: 'Payments' });
  const user = getCurrentUser();

  content.innerHTML = `
    <div class="card">
      <h3 class="serif" style="margin-top:0;">Payment history</h3>
      <div id="payments-list">Loading...</div>
    </div>
  `;

  async function loadPayments() {
    const listEl = content.querySelector('#payments-list');
    try {
      // Get the tenant's unit
      const units = await apiFetch('/units');
      const tenantUnit = units.find(u => u.tenant_user_id === user.user_id);
      
      if (!tenantUnit) {
        listEl.innerHTML = '<p style="color:var(--slate);">No unit assigned.</p>';
        return;
      }

      // Get all payments and filter to this tenant's unit
      const payments = await apiFetch('/payments');
      const unitPayments = payments.filter(p => p.unit_id === tenantUnit.id);

      if (!unitPayments.length) {
        listEl.innerHTML = '<p style="color:var(--slate);">No payments found.</p>';
        return;
      }

      listEl.innerHTML = `
        <table class="list">
          <thead><tr><th>Amount</th><th>Type</th><th>Due date</th><th>Status</th></tr></thead>
          <tbody>
            ${unitPayments
              .map(
                (p) => {
                  const statusClass = p.status === 'paid' ? 'badge-active' : 'badge-inactive';
                  return `
                  <tr>
                    <td>R${Number(p.amount).toLocaleString()}</td>
                    <td>${escapeHtml(p.type)}</td>
                    <td>${new Date(p.due_date).toLocaleDateString()}</td>
                    <td><span class="badge ${statusClass}">${p.status}</span></td>
                  </tr>
                `}
              )
              .join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      listEl.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
    }
  }

  await loadPayments();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
