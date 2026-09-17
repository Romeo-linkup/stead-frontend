// src/tenant/maintenance.page.js
import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { getCurrentUser } from '../auth/session.js';

const CATEGORIES = ['Plumbing', 'Electrical', 'Appliance', 'Structural', 'Other'];

export async function renderMaintenance(root) {
  const content = renderShell(root, { activeHref: '#/tenant/maintenance', title: 'Maintenance' });
  const user = getCurrentUser();

  content.innerHTML = `
    <div class="card">
      <h3 class="serif" style="margin-top:0;">Submit a request</h3>
      <form id="maintenance-form">
        <div class="field">
          <label for="category">Category</label>
          <select id="category" name="category" required>
            ${CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="description">Description</label>
          <textarea id="description" name="description" rows="4" required placeholder="Describe the issue..."></textarea>
        </div>
        <div class="field">
          <label for="photo">Photo (optional)</label>
          <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp">
          <div style="font-size:11px;color:var(--slate);margin-top:4px;">JPG, PNG, or WEBP, max 5MB</div>
        </div>
        <div id="form-error" class="error-text" style="display:none;"></div>
        <button class="btn btn-primary" type="submit">Submit request</button>
      </form>
    </div>
    <div class="card">
      <h3 class="serif" style="margin-top:0;">Your requests</h3>
      <div id="requests-list">Loading...</div>
    </div>
  `;

  async function loadRequests() {
    const listEl = content.querySelector('#requests-list');
    try {
      // Get the tenant's unit
      const units = await apiFetch('/units');
      const tenantUnit = units.find(u => u.tenant_user_id === user.user_id);
      
      if (!tenantUnit) {
        listEl.innerHTML = '<p style="color:var(--slate);">No unit assigned.</p>';
        return;
      }

      // Get maintenance requests for this unit
      const requests = await apiFetch('/maintenance');
      const unitRequests = requests.filter(r => r.unit_id === tenantUnit.id);

      if (!unitRequests.length) {
        listEl.innerHTML = '<p style="color:var(--slate);">No maintenance requests yet.</p>';
        return;
      }

      listEl.innerHTML = `
        <table class="list">
          <thead><tr><th>Category</th><th>Description</th><th>Status</th><th>Photo</th></tr></thead>
          <tbody>
            ${unitRequests
              .map(
                (r) => {
                  const statusClass = r.status === 'finished' ? 'badge-active' : 'badge-inactive';
                  return `
                  <tr>
                    <td>${escapeHtml(r.category)}</td>
                    <td>${escapeHtml(r.description)}</td>
                    <td><span class="badge ${statusClass}">${r.status}</span></td>
                    <td>${r.before_photo_url ? `<a href="${escapeHtml(r.before_photo_url)}" target="_blank" style="color:var(--brass-dark);">View</a>` : '-'}</td>
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

  content.querySelector('#maintenance-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const errorBox = content.querySelector('#form-error');
    errorBox.style.display = 'none';
    
    try {
      // Get the tenant's unit
      const units = await apiFetch('/units');
      const tenantUnit = units.find(u => u.tenant_user_id === user.user_id);
      
      if (!tenantUnit) {
        throw new Error('No unit assigned.');
      }

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('unit_id', tenantUnit.id);
      formData.append('category', form.category.value);
      formData.append('description', form.description.value);
      
      const photoInput = form.querySelector('#photo');
      if (photoInput.files[0]) {
        formData.append('photo', photoInput.files[0]);
      }

      await apiFetch('/maintenance', {
        method: 'POST',
        body: formData,
        isFormData: true
      });

      form.reset();
      await loadRequests();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    }
  });

  await loadRequests();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
