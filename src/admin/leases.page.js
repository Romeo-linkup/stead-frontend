// src/admin/leases.page.js
import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';

export async function renderLeases(root) {
  const content = renderShell(root, { activeHref: '#/admin/leases', title: 'Leases' });

  content.innerHTML = `
    <div class="card">
      <h3 class="serif" style="margin-top:0;">Create a new lease</h3>
      <form id="new-lease-form">
        <div class="field">
          <label for="lease-unit">Unit</label>
          <select id="lease-unit" name="unit_id" required></select>
        </div>
        <div class="field">
          <label for="lessor-name">Lessor name</label>
          <input id="lessor-name" name="lessor_name" required placeholder="Property owner name">
        </div>
        <div class="field">
          <label for="lessor-id">Lessor ID number</label>
          <input id="lessor-id" name="lessor_id_number" required placeholder="ID number">
        </div>
        <div class="field">
          <label for="lessee-name">Lessee name</label>
          <input id="lessee-name" name="lessee_name" required placeholder="Tenant name">
        </div>
        <div class="field">
          <label for="lessee-id">Lessee ID number</label>
          <input id="lessee-id" name="lessee_id_number" required placeholder="ID number">
        </div>
        <div class="field">
          <label for="start-date">Start date</label>
          <input id="start-date" name="start_date" type="date" required>
        </div>
        <div class="field">
          <label for="duration">Duration (months)</label>
          <input id="duration" name="duration_months" type="number" required min="1" value="12">
        </div>
        <div class="field">
          <label for="end-date">End date</label>
          <input id="end-date" name="end_date" type="date" required>
        </div>
        <div class="field">
          <label for="rent-amount">Monthly rent (R)</label>
          <input id="rent-amount" name="rent_amount" type="number" required min="0" step="0.01">
        </div>
        <div class="field">
          <label for="deposit-amount">Deposit (R)</label>
          <input id="deposit-amount" name="deposit_amount" type="number" required min="0" step="0.01">
        </div>
        <div id="lease-error" class="error-text" style="display:none;"></div>
        <button class="btn btn-primary" type="submit">Create lease</button>
      </form>
    </div>
    <div class="card">
      <h3 class="serif" style="margin-top:0;">All leases</h3>
      <div id="leases-list">Loading...</div>
    </div>
  `;

  const unitSelect = content.querySelector('#lease-unit');

  async function loadUnits() {
    try {
      const units = await apiFetch('/units');
      unitSelect.innerHTML = units
        .map(u => `<option value="${u.id}">${escapeHtml(u.property_name)} - ${escapeHtml(u.unit_number)}</option>`)
        .join('');
    } catch (err) {
      unitSelect.innerHTML = '';
    }
  }

  async function loadLeases() {
    const listEl = content.querySelector('#leases-list');
    try {
      const leases = await apiFetch('/leases');
      if (!leases.length) {
        listEl.innerHTML = '<p style="color:var(--slate);">No leases yet.</p>';
        return;
      }

      listEl.innerHTML = `
        <table class="list">
          <thead><tr><th>Unit</th><th>Lessee</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            ${leases.map(lease => {
              const statusClass = lease.status === 'signed' ? 'badge-active' : 
                                lease.status === 'sent' ? 'badge-active' : 'badge-inactive';
              return `
              <tr>
                <td>Unit ${lease.unit_id}</td>
                <td>${escapeHtml(lease.lessee_name)}</td>
                <td><span class="badge ${statusClass}">${lease.status}</span></td>
                <td>${new Date(lease.created_at).toLocaleDateString()}</td>
                <td>
                  ${lease.status === 'draft' ? 
                    `<button class="btn btn-primary send-btn" data-id="${lease.id}" style="padding:5px 10px;font-size:12px;">Send</button>` : 
                    lease.status === 'sent' ?
                    `<span style="font-size:12px;color:var(--slate);">Awaiting signature</span>` :
                    `<span style="font-size:12px;color:var(--forest);">Signed</span>`
                  }
                </td>
              </tr>
            `}).join('')}
          </tbody>
        </table>
      `;

      listEl.querySelectorAll('.send-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Send this lease to the tenant for signature?')) return;
          try {
            await apiFetch(`/leases/${btn.dataset.id}/send`, { method: 'PATCH' });
            await loadLeases();
          } catch (err) {
            alert(`Error: ${err.message}`);
          }
        });
      });
    } catch (err) {
      listEl.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
    }
  }

  content.querySelector('#new-lease-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const errorBox = content.querySelector('#lease-error');
    errorBox.style.display = 'none';
    
    try {
      // Calculate end date if not provided
      const startDate = new Date(form.start_date.value);
      const durationMonths = parseInt(form.duration_months.value);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + durationMonths);
      
      if (!form.end_date.value) {
        form.end_date.value = endDate.toISOString().split('T')[0];
      }

      // Default terms
      const defaultTerms = {
        additional_charges: 'The tenant shall be responsible for utilities and services as specified in the schedule.',
        payments: 'Rent shall be paid by electronic transfer to the landlord\'s designated bank account. The tenant shall provide proof of payment upon request.',
        pets: 'No pets shall be kept on the premises without the landlord\'s prior written consent.',
        assignment_subletting: 'The tenant shall not assign or sublet the premises without the landlord\'s prior written consent.',
        sundry_duties: 'The tenant shall keep the premises in a clean and habitable condition, and shall comply with all reasonable rules and regulations of the property.',
        maintenance: 'The landlord shall be responsible for structural maintenance, while the tenant shall be responsible for day-to-day maintenance and minor repairs.',
        special_remedy: 'In the event of breach, the landlord shall have all remedies available at law and equity, including but not limited to eviction and damages.',
        option_of_renewal: 'This lease may be renewed upon mutual agreement of both parties, subject to rent adjustment and terms to be negotiated.'
      };

      await apiFetch('/leases', {
        method: 'POST',
        body: {
          unit_id: Number(form.unit_id.value),
          lessor_name: form.lessor_name.value.trim(),
          lessor_id_number: form.lessor_id.value.trim(),
          lessee_name: form.lessee_name.value.trim(),
          lessee_id_number: form.lessee_id.value.trim(),
          start_date: form.start_date.value,
          duration_months: durationMonths,
          end_date: form.end_date.value,
          rent_amount: Number(form.rent_amount.value),
          deposit_amount: Number(form.deposit_amount.value),
          terms_json: defaultTerms
        }
      });

      form.reset();
      await loadLeases();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    }
  });

  await loadUnits();
  await loadLeases();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
