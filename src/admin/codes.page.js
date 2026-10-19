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
    { value: 'admin', label: 'Admin' },
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
  let me = user;
  let allDistricts = [];
  let allDistrictsLoaded = false;
  let createdCodeInfo = null;
  let editingCodeId = null;
  let codesListCache = [];

content.innerHTML = `
    <div class="pagehead">
      <h2>Codes & roles</h2>
      <p>Share each code with the person it was made for</p>
    </div>
    <div class="card">
      <h3 class="serif" style="margin-top:0;">Generate a code</h3>
      <div id="code-created-card" style="margin-bottom:12px; display:none;"></div>
      <form id="new-code-form">
        <label class="field-label" for="code-role">Role</label>
        <select class="field" id="code-role" name="role" required>
          ${roleOptions.map((r) => `<option value="${escapeAttr(r.value)}">${escapeHtml(r.label)}</option>`).join('')}
        </select>
        <div id="district-field">
          <label class="field-label" for="code-district">District</label>
          <select class="field" id="code-district" name="district_id" required></select>
        </div>
        <div id="admin-districts-box" style="display:none; margin:8px 0;">
          <div class="small" style="margin-bottom:6px;"><b>District access</b></div>
          <div id="admin-districts-list" style="display:flex; flex-direction:column; gap:4px;"></div>
          <div id="admin-all-districts-wrapper" style="margin-top:6px; display:none;">
            <label style="display:flex; align-items:center; gap:6px;">
              <input type="checkbox" id="admin-all-districts" name="admin_all_districts">
              <span class="small">All districts (including ones added later)</span>
            </label>
          </div>
          <div class="small muted" id="admin-districts-summary" style="margin-top:6px;">Access to 0 districts</div>
        </div>
        <div id="unit-field" style="display:none;">
          <label class="field-label" for="code-unit">Unit</label>
          <select class="field" id="code-unit" name="unit_id"></select>
        </div>
        <div id="code-error" class="error-text" style="display:none;"></div>
        <button class="btn brass" id="generate-btn" type="submit">Generate code</button>
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
      const [districts, meData] = await Promise.all([
        apiFetch('/districts'),
        apiFetch('/users/me').catch(() => null),
      ]);
      if (meData) me = meData;
      allDistricts = districts;
      allDistrictsLoaded = true;
      districtNames = new Map(districts.map((district) => [Number(district.id), district.name]));
      const isOwner = (me?.role || user?.role) === 'owner';
      const isAdmin = (me?.role || user?.role) === 'admin';
      const isPropertyManager = (me?.role || user?.role) === 'property_manager';
      const currentUser = me || user;
      if (isOwner || isAdmin) {
        districtSelect.innerHTML = districts
          .map((d) => `<option value="${escapeAttr(d.id)}">${escapeHtml(d.name)}</option>`)
          .join('');
        districtSelect.disabled = false;
      } else if (isPropertyManager) {
        const mine = districts.find((d) => d.id === currentUser.district_id) || districts[0];
        districtSelect.innerHTML = mine
          ? `<option value="${escapeAttr(mine.id)}">${escapeHtml(mine.name)}</option>`
          : '';
        districtSelect.disabled = true;
      } else {
        const mine = districts.find((d) => d.id === currentUser.district_id) || districts[0];
        districtSelect.innerHTML = mine
          ? `<option value="${escapeAttr(mine.id)}">${escapeHtml(mine.name)}</option>`
          : '';
        districtSelect.disabled = true;
      }
      renderAdminDistrictsBox();
    } catch (err) {
      districtSelect.innerHTML = '';
    }
  }

  function renderAdminDistrictsBox() {
    const adminBox = content.querySelector('#admin-districts-box');
    const adminList = content.querySelector('#admin-districts-list');
    const allWrapper = content.querySelector('#admin-all-districts-wrapper');
    const allCheckbox = content.querySelector('#admin-all-districts');
    const summary = content.querySelector('#admin-districts-summary');
    const role = content.querySelector('#code-role').value;
    const isOwner = (me?.role || user?.role) === 'owner';
    const hasAllDistricts = me?.all_districts === true;

    if (role !== 'admin') {
      adminBox.style.display = 'none';
      content.querySelector('#district-field').style.display = 'block';
      return;
    }

    content.querySelector('#district-field').style.display = 'none';
    adminBox.style.display = 'block';

    const showAllOption = isOwner || hasAllDistricts;
    allWrapper.style.display = showAllOption ? 'block' : 'none';

    adminList.innerHTML = allDistricts
      .map((d) => `
        <label style="display:flex; align-items:center; gap:6px;">
          <input type="checkbox" class="admin-district-checkbox" value="${escapeAttr(d.id)}" data-name="${escapeAttr(d.name)}">
          <span class="small">${escapeHtml(d.name)}</span>
        </label>
      `).join('');

    allCheckbox.checked = false;
    adminList.querySelectorAll('.admin-district-checkbox').forEach((cb) => {
      cb.checked = false;
      cb.disabled = false;
    });

    function updateSummary() {
      if (allCheckbox.checked) {
        summary.textContent = 'Access to all districts';
      } else {
        const checked = adminList.querySelectorAll('.admin-district-checkbox:checked');
        summary.textContent = `Access to ${checked.length} district${checked.length !== 1 ? 's' : ''}`;
      }
    }

    allCheckbox.addEventListener('change', () => {
      const checkboxes = adminList.querySelectorAll('.admin-district-checkbox');
      checkboxes.forEach((cb) => {
        cb.checked = false;
        cb.disabled = allCheckbox.checked;
      });
      updateSummary();
    });

    adminList.querySelectorAll('.admin-district-checkbox').forEach((cb) => {
      cb.addEventListener('change', updateSummary);
    });

    updateSummary();
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
      const activeCodes = codes.filter((code) => code.active);
      if (!activeCodes.length) {
        listEl.innerHTML = '<p style="color:var(--slate);">No active codes.</p>';
        return;
      }

      const sortedCodes = [...activeCodes].sort((a, b) => {
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
            <div class="row" style="margin-top:8px;"><span class="badge finished">Active</span><button class="btn secondary sm revoke-btn" data-id="${escapeAttr(code.id)}" type="button">Revoke</button></div>
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
    renderAdminDistrictsBox();
  });
  districtSelect.addEventListener('change', () => {
    refreshUnitOptions();
  });

  content.querySelector('#new-code-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const errorBox = content.querySelector('#code-error');
    const generateBtn = content.querySelector('#generate-btn');
    errorBox.style.display = 'none';
    const role = form.role.value;
    let body = { role };

    if (role === 'admin') {
      const adminList = content.querySelector('#admin-districts-list');
      const allCheckbox = content.querySelector('#admin-all-districts');
      const allDistrictsChecked = allCheckbox?.checked ?? false;
      const selectedCheckboxes = adminList?.querySelectorAll('.admin-district-checkbox:checked') ?? [];
      const districtIds = Array.from(selectedCheckboxes).map((cb) => Number(cb.value));

      if (!allDistrictsChecked && districtIds.length === 0) {
        toast('Choose at least one district.');
        return;
      }

      body.districts = districtIds;
      body.all_districts = allDistrictsChecked;
    } else {
      body.district_id = Number(form.district_id.value) || undefined;
      if (role === 'tenant') {
        body.unit_id = Number(form.unit_id.value) || undefined;
      }
    }

    const originalLabel = generateBtn.textContent;
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';

    try {
      await apiFetch('/codes', { method: 'POST', body });
      toast('Code generated.');
      await loadCodes();
    } catch (err) {
      toast(err.message || 'Could not generate code.');
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = originalLabel;
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
