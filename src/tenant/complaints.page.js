// src/tenant/complaints.page.js
import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';

const CATEGORIES = ['Noise / disturbance', 'Neighbour dispute', 'Building upkeep', 'Staff conduct', 'Other'];

export async function renderComplaints(root) {
  const content = renderShell(root, { activeHref: '#/tenant/complaints', title: 'Complaints' });

  content.innerHTML = `
    <div class="pagehead"><h2>Complaints & reports</h2><p>Reports go to the district admin.</p></div>
    <div class="card">
      <h3 class="serif" style="margin-top:0;">Submit a complaint</h3>
      <form id="complaint-form">
        <div class="field"><label for="complaint-category">Category</label><select id="complaint-category" name="category" required>${CATEGORIES.map(category => `<option>${category}</option>`).join('')}</select></div>
        <div class="field"><label for="complaint-description">Details</label><textarea id="complaint-description" name="description" rows="4" required placeholder="Describe what happened..."></textarea></div>
        <label style="display:flex;gap:10px;align-items:flex-start;font-size:13px;margin-bottom:14px;"><input name="is_anonymous" type="checkbox"><span><strong>Submit anonymously</strong><br><span style="color:var(--slate);">Your identity will be hidden from the admin.</span></span></label>
        <div id="complaint-form-error" class="error-text" hidden></div>
        <div id="complaint-result" class="small" style="color:var(--forest);" hidden></div>
        <button class="btn btn-primary" type="submit">Submit complaint</button>
      </form>
    </div>
    <div class="card">
      <h3 class="serif" style="margin-top:0;">Check anonymous status</h3>
      <form id="status-form" style="display:flex;gap:8px;flex-wrap:wrap;">
        <input name="tracking_code" required placeholder="CMP-TRACKING-CODE" style="flex:1;min-width:180px;">
        <button class="btn btn-outline" type="submit">Check status</button>
      </form>
      <div id="status-result" class="small" style="margin-top:12px;" hidden></div>
    </div>
  `;

  content.querySelector('#complaint-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.target;
    const error = content.querySelector('#complaint-form-error');
    const result = content.querySelector('#complaint-result');
    error.hidden = true;
    result.hidden = true;
    try {
      const complaint = await apiFetch('/complaints', {
        method: 'POST',
        body: { category: form.category.value, description: form.description.value.trim(), is_anonymous: form.is_anonymous.checked }
      });
      result.textContent = `Complaint submitted. Tracking code: ${complaint.tracking_code}`;
      result.hidden = false;
      form.reset();
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
    }
  });

  content.querySelector('#status-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.target;
    const result = content.querySelector('#status-result');
    result.hidden = true;
    try {
      const complaint = await apiFetch(`/complaints/status/${encodeURIComponent(form.tracking_code.value.trim())}`);
      result.textContent = `${complaint.category}: ${complaint.status}`;
      result.hidden = false;
    } catch (err) {
      result.textContent = err.message;
      result.style.color = 'var(--rust)';
      result.hidden = false;
    }
  });
}
