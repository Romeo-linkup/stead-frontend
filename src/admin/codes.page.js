// src/admin/codes.page.js
import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { getCurrentUser } from '../auth/session.js';
import { toast } from '../shared/toast.js';

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner / Admin' },
  { value: 'property_manager', label: 'Property Manager' },
  { value: 'service_provider', label: 'Service Provider' },
  { value: 'tenant', label: 'Tenant' },
];

export async function renderCodes(root) {
  const content = renderShell(root, { activeHref: '#/admin/codes', title: 'Codes' });
  const user = getCurrentUser();

  content.innerHTML = `
    <div class="pagehead">
      <h2>Codes &amp; roles</h2>
      <p>Generated per district — share the relevant code with each group</p>
    </div>
    <div class="card">
      <h3 class="serif" style="margin-top:0;">Generate a code</h3>
      <form id="new-code-form">
        <label class="field-label" for="code-role">Role</label>
        <select class="field" id="code-role" name="role" required>
          ${ROLE_OPTIONS.map((r) => `<option value="${escapeAttr(r.value)}">${escapeHtml(r.label)}</option>`).join('')}
        </select>
        <div id="district-field">
          <label class="field-label" for="code-district">District</label>
          <select class="field" id="code-district" name="district_id" required></select>
        </div>
        <div id="code-error" class="error-text" style="display:none;"></div>
        <button class="btn brass" type="submit">Generate code</button>
      </form>
    </div>
    <b class="small" style="display:block; margin:14px 0 8px;">Issued codes</b>
    <div id="codes-list">Loading...</div>
  `;

  const districtSelect = content.querySelector('#code-district');
  let districtNames = new Map();

  async function loadDistrictOptions() {
    try {
      const districts = await apiFetch('/districts');
      districtNames = new Map(districts.map((district) => [Number(district.id), district.name]));
      if (user.role === 'owner') {
        districtSelect.innerHTML = districts
          .map((d) => `<option value="${escapeAttr(d.id)}">${escapeHtml(d.name)}</option>`)
          .join('');
      } else {
        // admin/property_manager are locked to their own district
        const mine = districts.find((d) => d.id === user.district_id) || districts[0];
        districtSelect.innerHTML = mine
          ? `<option value="${escapeAttr(mine.id)}">${escapeHtml(mine.name)}</option>`
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

      const sortedCodes = [...codes].sort((a, b) => {
        const activeDifference = Number(b.active) - Number(a.active);
        if (activeDifference) return activeDifference;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      listEl.innerHTML = sortedCodes.map((code) => {
        const roleLabel = ROLE_OPTIONS.find((role) => role.value === code.role)?.label || code.role;
        const districtName = code.district_name
          || districtNames.get(Number(code.district_id))
          || (code.district_id == null ? 'All districts' : 'District');
        return `
          <div class="card">
            <div class="row">
              <b class="small">${escapeHtml(districtName)} — ${escapeHtml(roleLabel)} code</b>
              <span class="small" style="font-family:'Newsreader',serif;">${escapeHtml(code.code)}</span>
            </div>
            ${code.active
              ? `<div class="row" style="margin-top:8px;"><span class="badge finished">Active</span><button class="btn secondary sm revoke-btn" data-id="${escapeAttr(code.id)}" type="button">Revoke</button></div>`
              : '<p class="small muted" style="margin:8px 0 0;">Revoked</p>'}
          </div>
        `;
      }).join('');
      listEl.querySelectorAll('.revoke-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('Revoke this code? Everyone using it will be signed out.')) return;
          try {
            await apiFetch(`/codes/${encodeURIComponent(btn.dataset.id)}/revoke`, { method: 'PATCH' });
            toast('Code revoked.');
            await loadCodes();
          } catch (err) {
            toast(err.message);
          }
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
  await loadCodes();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function escapeAttr(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
