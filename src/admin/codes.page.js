// src/admin/codes.page.js
import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { getCurrentUser } from '../auth/session.js';
import { toast } from '../shared/toast.js';

// Roles the signed-in user may create codes for (per backend 3d).
const CREATABLE_ROLES = {
  owner: [
    { value: 'admin', label: 'Admin' },
    { value: 'property_manager', label: 'Property Manager' },
    { value: 'service_provider', label: 'Service Provider' },
    { value: 'tenant', label: 'Tenant' },
  ],
  admin: [
    { value: 'service_provider', label: 'Service Provider' },
    { value: 'tenant', label: 'Tenant' },
  ],
  property_manager: [
    { value: 'service_provider', label: 'Service Provider' },
    { value: 'tenant', label: 'Tenant' },
  ],
};

const ROLE_LABELS = {
  admin: 'Admin',
  property_manager: 'Property Manager',
  service_provider: 'Service Provider',
  tenant: 'Tenant',
};

export async function renderCodes(root) {
  const content = renderShell(root, { activeHref: '#/admin/codes', title: 'Codes' });
  const user = getCurrentUser();
  const roleOptions = CREATABLE_ROLES[user?.role] || [];

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
          ${roleOptions.map((r) => `<option value="${escapeAttr(r.value)}">${escapeHtml(r.label)}</option>`).join('')}
        </select>
        <div id="district-field">
          <label class="field-label" for="code-district">District</label>
          <select class="field" id="code-district" name="district_id" required></select>
        </div>
        <div id="unit-field" style="display:none;">
          <label class="field-label" for="code-unit">Unit</label>
          <select class="field" id="code-unit" name="unit_id"></select>
        </div>
        <div id="code-error" class="error-text" style="display:none;"></div>
        <button class="btn brass" type="submit">Generate code</button>
      </form>
    </div>
    <b class="small" style="display:block; margin:14px 0 8px;">Issued codes</b>
    <div id="codes-list">Loading...</div>
  `;

  const districtSelect = content.querySelector('#code-district');
  const unitField = content.querySelector('#unit-field');
  const unitSelect = content.querySelector('#code-unit');
  let districtNames = new Map();
  let allUnits = [];

  async function loadDistrictOptions() {
    try {
      const districts = await apiFetch('/districts');
      districtNames = new Map(districts.map((district) => [Number(district.id), district.name]));
      if (user.role === 'owner') {
        districtSelect.innerHTML = districts
          .map((d) => `<option value="${escapeAttr(d.id)}">${escapeHtml(d.name)}</option>`)
          .join('');
        districtSelect.disabled = false;
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

  async function loadUnits() {
    try {
      allUnits = await apiFetch('/units');
    } catch (err) {
      allUnits = [];
    }
  }

  function refreshUnitOptions() {
    const role = content.querySelector('#code-role').value;
    const districtId = Number(districtSelect.value);
    if (role !== 'tenant') {
      unitField.style.display = 'none';
      unitSelect.innerHTML = '';
      return;
    }
    unitField.style.display = 'block';
    // Only units in the chosen district without an active tenant code.
    const available = allUnits.filter(
      (u) => u.district_id === districtId && !u.has_active_tenant_code
    );
    unitSelect.innerHTML = available
      .map((u) => `<option value="${escapeAttr(u.id)}">${escapeHtml(u.property_name)} · ${escapeHtml(u.unit_number)}</option>`)
      .join('');
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
        const roleLabel = ROLE_LABELS[code.role] || code.role;
        const districtName = code.district_name
          || districtNames.get(Number(code.district_id))
          || (code.district_id == null ? 'All districts' : 'District');
        const unitProperty = code.unit_id != null
          ? `<div class="small muted">${escapeHtml(code.property_name || 'Property')} · ${escapeHtml(code.unit_number || 'Unit')}</div>`
          : '';
        return `
          <div class="card">
            <div class="row">
              <b class="small">${escapeHtml(districtName)} — ${escapeHtml(roleLabel)} code</b>
              <span class="small" style="font-family:'Newsreader',serif;">${escapeHtml(code.code)}</span>
            </div>
            ${unitProperty}
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

  content.querySelector('#code-role').addEventListener('change', () => {
    refreshUnitOptions();
  });
  districtSelect.addEventListener('change', () => {
    refreshUnitOptions();
  });

  content.querySelector('#new-code-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const errorBox = content.querySelector('#code-error');
    errorBox.style.display = 'none';
    const role = form.role.value;
    const body = {
      role,
      district_id: Number(form.district_id.value) || undefined,
    };
    if (role === 'tenant') {
      body.unit_id = Number(form.unit_id.value) || undefined;
    }
    try {
      await apiFetch('/codes', { method: 'POST', body });
      toast('Code generated.');
      await loadCodes();
    } catch (err) {
      toast(err.message || 'Could not generate code.');
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    }
  });

  await loadDistrictOptions();
  await loadUnits();
  refreshUnitOptions();
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
