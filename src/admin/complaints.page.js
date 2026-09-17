// src/admin/complaints.page.js
import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';

export async function renderComplaints(root) {
  const content = renderShell(root, { activeHref: '#/admin/complaints', title: 'Complaints' });
  content.innerHTML = `<div class="pagehead"><h2>Complaints</h2><p>Anonymous reports never expose the submitter's identity.</p></div><div class="card"><div id="complaints-list">Loading...</div></div>`;
  try {
    const complaints = await apiFetch('/complaints');
    const list = content.querySelector('#complaints-list');
    if (!complaints.length) { list.innerHTML = '<p style="color:var(--slate);">No complaints yet.</p>'; return; }
    list.innerHTML = `<table class="list"><thead><tr><th>Category</th><th>Details</th><th>Submitted by</th><th>Status</th><th>Tracking</th></tr></thead><tbody>${complaints.map(complaint => `<tr><td>${escapeHtml(complaint.category)}</td><td>${escapeHtml(complaint.description)}</td><td>${complaint.is_anonymous ? 'Anonymous' : escapeHtml(complaint.submitted_by_name || 'Named tenant')}</td><td><span class="badge ${complaint.status === 'resolved' ? 'badge-active' : 'badge-inactive'}">${escapeHtml(complaint.status)}</span></td><td><code>${escapeHtml(complaint.tracking_code)}</code></td></tr>`).join('')}</tbody></table>`;
  } catch (err) { content.querySelector('#complaints-list').innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`; }
}

function escapeHtml(value) { const div = document.createElement('div'); div.textContent = value; return div.innerHTML; }
