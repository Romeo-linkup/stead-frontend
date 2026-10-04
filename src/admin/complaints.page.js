// src/admin/complaints.page.js
import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { toast } from '../shared/toast.js';

export async function renderComplaints(root) {
	const content = renderShell(root, { activeHref: '#/admin/complaints', title: 'Complaints' });

	const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
	const viewId = params.get('view');

	if (viewId) {
		await renderComplaintDetail(content, viewId);
	} else {
		await renderComplaintList(content, params);
	}
}

async function renderComplaintList(content, params) {
	const status = params.get('status') || 'open';
	const query = status === 'all' ? '' : `?status=${status}`;

	content.innerHTML = `
		<div class="pagehead"><h2>Complaints</h2><p>Anonymous reports never expose the submitter's identity.</p></div>
		<div style="margin-bottom:14px;">
			<label class="field-label" for="status-filter">Status</label>
			<select class="field" id="status-filter" style="max-width:200px;">
				<option value="open" ${status === 'open' ? 'selected' : ''}>Open</option>
				<option value="resolved" ${status === 'resolved' ? 'selected' : ''}>Resolved</option>
				<option value="all" ${status === 'all' ? 'selected' : ''}>All</option>
			</select>
		</div>
		<div id="complaints-list">Loading...</div>
	`;

	const statusSelect = content.querySelector('#status-filter');
	statusSelect.addEventListener('change', () => {
		const newStatus = statusSelect.value;
		window.location.hash = newStatus === 'all' ? '#/admin/complaints' : `#/admin/complaints?status=${newStatus}`;
	});

	try {
		const complaints = await apiFetch(`/complaints${query}`);
		const list = content.querySelector('#complaints-list');

		if (!complaints.length) {
			const emptyText = status === 'open' ? 'No open complaints.' : status === 'resolved' ? 'No resolved complaints.' : 'No complaints yet.';
			list.innerHTML = `<div class="card"><p class="small muted">${emptyText}</p></div>`;
			return;
		}

		list.innerHTML = complaints.map(complaint => {
			const badgeClass = complaint.status === 'resolved' ? 'finished' : 'outstanding';
			const submitted = complaint.is_anonymous
				? 'Submitted anonymously'
				: `${escapeHtml(complaint.submitted_by_name || '')}${complaint.unit_number ? ' · Unit ' + escapeHtml(complaint.unit_number) : ''}`;
			const date = new Date(complaint.created_at).toLocaleDateString('en-ZA');

			return `
				<a class="card complaint-card" href="#/admin/complaints?view=${complaint.id}" style="display:block;color:inherit;text-decoration:none;">
					<div class="row">
						<b class="small">${escapeHtml(complaint.category)}</b>
						<span class="badge ${badgeClass}">${escapeHtml(complaint.status)}</span>
					</div>
					<p class="small muted" style="margin:6px 0;">${submitted} · ${escapeHtml(date)}</p>
					<p class="small muted clamp-2">${escapeHtml(complaint.description)}</p>
					<span class="small" style="color:var(--brass-dark);font-weight:600;">Read full complaint</span>
				</a>
			`;
		}).join('');
	} catch (err) {
		content.querySelector('#complaints-list').innerHTML = `<div class="card"><p class="error-text">${escapeHtml(err.message)}</p></div>`;
	}
}

async function renderComplaintDetail(content, id) {
	try {
		const complaint = await apiFetch(`/complaints/${id}`);

		content.innerHTML = `
			<div class="pagehead">
				<h2>${escapeHtml(complaint.category)}</h2>
				<p class="small muted">Tracking code <code>${escapeHtml(complaint.tracking_code)}</code></p>
			</div>
			<div class="card">
				<div class="row"><b class="small">Status</b><span class="badge ${complaint.status === 'resolved' ? 'finished' : 'outstanding'}">${escapeHtml(complaint.status)}</span></div>
				<div class="row"><b class="small">Submitted by</b><span class="small">${complaint.is_anonymous ? 'Anonymous' : escapeHtml(complaint.submitted_by_name || '')}</span></div>
				${!complaint.is_anonymous && complaint.unit_number ? `<div class="row"><b class="small">Unit</b><span class="small">${escapeHtml(complaint.unit_number)}</span></div>` : ''}
				${!complaint.is_anonymous && complaint.property_name ? `<div class="row"><b class="small">Property</b><span class="small">${escapeHtml(complaint.property_name)}</span></div>` : ''}
				<div class="row"><b class="small">Submitted</b><span class="small">${new Date(complaint.created_at).toLocaleString('en-ZA')}</span></div>
				${complaint.resolved_at ? `<div class="row"><b class="small">Resolved</b><span class="small">${new Date(complaint.resolved_at).toLocaleString('en-ZA')}</span></div>` : ''}
			</div>
			<div class="card">
				<b class="small">Details</b>
				<p style="white-space:pre-wrap;word-break:break-word;margin:8px 0 0;">${escapeHtml(complaint.description)}</p>
				${complaint.is_anonymous ? '<p class="small muted">This report was submitted anonymously. The submitter\'s identity and unit are hidden.</p>' : ''}
			</div>
			<div style="display:flex;gap:8px;margin-top:14px;">
				${complaint.status === 'open' ? '<button class="btn brass" id="resolve-btn">Mark as resolved</button>' : '<button class="btn secondary" id="reopen-btn">Reopen</button>'}
				<a class="btn secondary" href="#/admin/complaints">Back to complaints</a>
			</div>
		`;

		if (complaint.status === 'open') {
			content.querySelector('#resolve-btn').addEventListener('click', async () => {
				if (!window.confirm('Mark this complaint as resolved?')) return;
				try {
					await apiFetch(`/complaints/${id}/resolve`, { method: 'PATCH' });
					toast('Complaint resolved.');
					await renderComplaintDetail(content, id);
				} catch (err) {
					toast(err.message || 'Could not resolve complaint.');
				}
			});
		} else {
			content.querySelector('#reopen-btn').addEventListener('click', async () => {
				if (!window.confirm('Reopen this complaint?')) return;
				try {
					await apiFetch(`/complaints/${id}/reopen`, { method: 'PATCH' });
					toast('Complaint reopened.');
					await renderComplaintDetail(content, id);
				} catch (err) {
					toast(err.message || 'Could not reopen complaint.');
				}
			});
		}
	} catch (err) {
		content.innerHTML = `
			<div class="card">
				<p class="error-text">${escapeHtml(err.message)}</p>
				<a class="btn secondary" href="#/admin/complaints" style="display:inline-block;margin-top:14px;">Back to complaints</a>
			</div>
		`;
	}
}

function escapeHtml(value) {
	const div = document.createElement('div');
	div.textContent = value == null ? '' : String(value);
	return div.innerHTML;
}
