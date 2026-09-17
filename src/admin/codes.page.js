// src/admin/codes.page.js
import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { getCurrentUser } from '../auth/session.js';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'property_manager', label: 'Property Manager' },
  { value: 'service_provider', label: 'Service Provider' },
  { value: 'tenant', label: 'Tenant' },
];

export async function renderCodes(root) {
  const content = renderShell(root, { activeHref: '#/admin/codes', title: 'Codes' });
  const user = getCurrentUser();

  content.innerHTML = `
    <div class="card">
      <h3 class="serif" style="margin-top:0;">Generate a code</h3>
      <form id="new-code-form">
        <div class="field">
          <label for="code-role">Role</label>
          <select id="code-role" name="role" required>
            ${ROLE_OPTIONS.map((r) => `<option value="${r.value}">${r.label}</option>`).join('')}
          </select>
        </div>
        <div class="field" id="district-field">
          <label for="code-district">District</label>
          <select id="code-district" name="district_id" required></select>
        </div>
        <div id="code-error" class="error-text" style="display:none;"></div>
        <button class="btn btn-primary" type="submit">Generate code</button>
      </form>
    </div>
    <div class="card">
      <h3 class="serif" style="margin-top:0;">Issued codes</h3>
      <div id="codes-list">Loading...</div>
    </div>
  `;

  const districtSelect = content.querySelector('#code-district');

  async function loadDistrictOptions() {
    try {
      const districts = await apiFetch('/districts');
      if (user.role === 'owner') {
        districtSelect.innerHTML = districts
          .map((d) => `<option value="${d.id}">${escapeHtml(d.name)}</option>`)
          .join('');
      } else {
        // admin/property_manager are locked to their own district
        const mine = districts.find((d) => d.id === user.district_id) || districts[0];
        districtSelect.innerHTML = mine
          ? `<option value="${mine.id}">${escapeHtml(mine.name)}</option>`
          : '';
        districtSelect.disabled = true;
      }
    } catch (err) {
      districtSelect.innerHTML = '';
    }
  }

  async function loadCodes() {
    const listEl = content.querySelector('#codes-list');
    try {
      const codes = await apiFetch('/codes');
      if (!codes.length) {
        listEl.innerHTML = '<p style="color:var(--slate);">No codes issued yet.</p>';
        return;
      }
      listEl.innerHTML = `
        <table class="list">
          <thead><tr><th>Code</th><th>Role</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${codes
              .map(
                (c) => `
              <tr>
                <td><code>${escapeHtml(c.code)}</code></td>
                <td>${escapeHtml(c.role.replace('_', ' '))}</td>
                <td><span class="badge ${c.active ? 'badge-active' : 'badge-inactive'}">${c.active ? 'Active' : 'Revoked'}</span></td>
                <td>${c.active ? `<button class="btn btn-danger revoke-btn" data-id="${c.id}" style="padding:5px 10px;font-size:12px;">Revoke</button>` : ''}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      `;
      listEl.querySelectorAll('.revoke-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('Revoke this code? Everyone using it will be signed out.')) return;
          await apiFetch(`/codes/${btn.dataset.id}/revoke`, { method: 'PATCH' });
          await loadCodes();
        });
      });
    } catch (err) {
      listEl.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
    }
  }

  function syncDistrictFieldVisibility() {
    const role = content.querySelector('#code-role').value;
    content.querySelector('#district-field').style.display = role === 'owner' ? 'none' : 'block';
  }

  content.querySelector('#code-role').addEventListener('change', syncDistrictFieldVisibility);

  content.querySelector('#new-code-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const errorBox = content.querySelector('#code-error');
    errorBox.style.display = 'none';
    try {
      await apiFetch('/codes', {
        method: 'POST',
        body: { role: form.role.value, district_id: Number(form.district_id.value) || undefined },
      });
      await loadCodes();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    }
  });

  await loadDistrictOptions();
  syncDistrictFieldVisibility();
  loadCodes();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
