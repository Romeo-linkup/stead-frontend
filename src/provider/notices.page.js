import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { toast } from '../shared/toast.js';

export async function renderNotices(root) {
	const content = renderShell(root, { activeHref: '#/provider/notices', title: 'Notices' });
	content.innerHTML = `
		<div class="pagehead"><h2>Notices</h2><p>From admin</p></div>
		<div id="provider-notices-list"></div>
	`;

	const list = content.querySelector('#provider-notices-list');
	try {
		const notices = await apiFetch('/notices');
		list.innerHTML = notices.length
			? notices.map((notice) => `
				<div class="card notice-item">
					<div class="row"><b class="small">${escapeHtml(notice.title)}</b><span class="small muted">${escapeHtml(formatTimestamp(notice.created_at))}</span></div>
					<p class="small muted" style="margin:6px 0 0;">${escapeHtml(notice.body).replace(/\r?\n/g, '<br>')}</p>
				</div>
			`).join('')
			: '<div class="card"><p class="small muted">No notices yet.</p></div>';
	} catch (err) {
		toast(err.message || 'Could not load notices.');
		list.innerHTML = '<div class="card"><p class="small muted">Could not load notices.</p></div>';
	}
}

function formatTimestamp(value) {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? String(value || '') : date.toLocaleString();
}

function escapeHtml(value) {
	const div = document.createElement('div');
	div.textContent = value == null ? '' : String(value);
	return div.innerHTML;
}