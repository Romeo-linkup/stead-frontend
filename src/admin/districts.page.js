// src/admin/districts.page.js
import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';

export async function renderDistricts(root) {
  const content = renderShell(root, { activeHref: '#/admin/districts', title: 'Districts' });

  content.innerHTML = `
    <div class="card">
      <h3 class="serif" style="margin-top:0;">Add a district</h3>
      <form id="new-district-form">
        <div class="field">
          <label for="district-name">District name</label>
          <input id="district-name" name="name" placeholder="e.g. Sandton" required />
        </div>
        <div id="district-error" class="error-text" style="display:none;"></div>
        <button class="btn btn-primary" type="submit">Add district</button>
      </form>
    </div>
    <div class="card">
      <h3 class="serif" style="margin-top:0;">All districts</h3>
      <div id="districts-list">Loading...</div>
    </div>
  `;

  async function loadDistricts() {
    const listEl = content.querySelector('#districts-list');
    try {
      const districts = await apiFetch('/districts');
      if (!districts.length) {
        listEl.innerHTML = '<p style="color:var(--slate);">No districts yet.</p>';
        return;
      }
      listEl.innerHTML = `
        <table class="list">
          <thead><tr><th>Name</th><th>Added</th></tr></thead>
          <tbody>
            ${districts
              .map(
                (d) => `<tr><td>${escapeHtml(d.name)}</td><td>${new Date(d.created_at).toLocaleDateString()}</td></tr>`
              )
              .join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      listEl.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
    }
  }

  content.querySelector('#new-district-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const errorBox = content.querySelector('#district-error');
    errorBox.style.display = 'none';
    try {
      await apiFetch('/districts', { method: 'POST', body: { name: form.name.value.trim() } });
      form.reset();
      await loadDistricts();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    }
  });

  loadDistricts();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
