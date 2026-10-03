import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { getCurrentUser } from '../auth/session.js';
import { toast } from '../shared/toast.js';

const AUDIENCE_LABELS = {
	all: 'Everyone',
	tenants: 'Tenants only',
	providers: 'Service providers only',
};

export async function renderNotices(root) {
	const content = renderShell(root, { activeHref: '#/admin/notices', title: 'Notices' });
	const isOwner = getCurrentUser()?.role === 'owner';
	content.innerHTML = `
		<div class="pagehead"><h2>Notices</h2><p>Post an update — visible to tenants and service providers</p></div>
		<div class="card">
			<form id="notice-form">
				<label class="field-label" for="notice-title">Title</label>
				<input class="field" id="notice-title" maxlength="120" placeholder="e.g. Water outage" required>
				<label class="field-label" for="notice-body">Message</label>
				<textarea class="field" id="notice-body" rows="3" maxlength="2000" placeholder="Details..."></textarea>
				<label class="field-label" for="notice-audience">Audience</label>
				<select class="field" id="notice-audience">
					<option value="all">Everyone</option>
					<option value="tenants">Tenants only</option>
					<option value="providers">Service providers only</option>
				</select>
				${isOwner ? `
					<label class="field-label" for="notice-district">District</label>
					<select class="field" id="notice-district"><option value="">All districts</option></select>
				` : ''}
				<button class="btn brass block" type="submit">Post notice</button>
			</form>
		</div>
		<b class="small" style="display:block; margin:14px 0 8px;">Sent notices</b>
		<div id="admin-notices-list"></div>
		<b class="small" style="display:block; margin:14px 0 8px;">Move-out notices</b>
		<div id="move-out-notices-list"></div>
	`;

	content.querySelector('#notice-form').addEventListener('submit', (event) => postNotice(event, content, isOwner));
	if (isOwner) loadDistricts(content);
	await Promise.all([loadNotices(content), loadMoveOutNotices(content)]);
}

async function loadDistricts(content) {
	const select = content.querySelector('#notice-district');
	try {
		const districts = await apiFetch('/districts');
		select.innerHTML = '<option value="">All districts</option>' + districts.map((district) =>
			`<option value="${escapeHtml(district.id)}">${escapeHtml(district.name)}</option>`
		).join('');
	} catch (err) {
		toast(err.message || 'Could not load districts.');
	}
}

async function postNotice(event, content, isOwner) {
	event.preventDefault();
	const form = event.currentTarget;
	const button = form.querySelector('button[type="submit"]');
	const districtSelect = content.querySelector('#notice-district');
	button.disabled = true;
	try {
		await apiFetch('/notices', {
			method: 'POST',
			body: {
				title: form.querySelector('#notice-title').value,
				body: form.querySelector('#notice-body').value,
				audience: form.querySelector('#notice-audience').value,
				...(isOwner ? { district_id: districtSelect.value ? Number(districtSelect.value) : null } : {}),
			},
		});
		form.reset();
		if (isOwner && districtSelect) districtSelect.value = '';
		toast('Notice posted.');
		await loadNotices(content);
	} catch (err) {
		toast(err.message || 'Could not post notice.');
	} finally {
		button.disabled = false;
	}
}

async function loadNotices(content) {
	const list = content.querySelector('#admin-notices-list');
	try {
		const notices = await apiFetch('/notices');
		if (!notices.length) {
			list.innerHTML = '<div class="card"><p class="small muted">No notices yet.</p></div>';
			return;
		}
		list.innerHTML = notices.map((notice) => `
			<div class="card notice-item">
				<div class="row"><b class="small">${escapeHtml(notice.title)}</b><span class="small muted">${escapeHtml(formatTimestamp(notice.created_at))}</span></div>
				<p class="small muted" style="margin:6px 0 0;">${escapeHtml(notice.body).replace(/\r?\n/g, '<br>')}</p>
				<p class="small muted" style="margin:6px 0;">${escapeHtml(AUDIENCE_LABELS[notice.audience] || notice.audience)} · ${escapeHtml(notice.district_name || 'All districts')}</p>
				<button class="btn secondary sm" type="button" data-delete-notice="${escapeHtml(notice.id)}">Delete</button>
			</div>
		`).join('');
		list.querySelectorAll('[data-delete-notice]').forEach((button) => {
			button.addEventListener('click', () => deleteNotice(content, button));
		});
	} catch (err) {
		toast(err.message || 'Could not load notices.');
		list.innerHTML = '<div class="card"><p class="small muted">Could not load notices.</p></div>';
	}
}

async function deleteNotice(content, button) {
	if (!window.confirm('Delete this notice?')) return;
	button.disabled = true;
	try {
		await apiFetch(`/notices/${encodeURIComponent(button.dataset.deleteNotice)}`, { method: 'DELETE' });
		toast('Notice deleted.');
		await loadNotices(content);
	} catch (err) {
		toast(err.message || 'Could not delete notice.');
	} finally {
		button.disabled = false;
	}
}

async function loadMoveOutNotices(content) {
	const list = content.querySelector('#move-out-notices-list');
	try {
		const notices = await apiFetch('/move-out-notices');
		if (!notices.length) {
			list.innerHTML = '<p class="small muted">No move-out notices.</p>';
			return;
		}
		list.innerHTML = `
			<div class="table-wrap"><table class="simple">
				<thead><tr><th>Unit</th><th>Tenant</th><th>Move-out date</th><th>Status</th><th></th></tr></thead>
				<tbody>${notices.map((notice) => moveOutRow(notice)).join('')}</tbody>
			</table></div>
		`;
		list.querySelectorAll('[data-acknowledge]').forEach((button) => {
			button.addEventListener('click', () => acknowledgeNotice(content, button));
		});
	} catch (err) {
		toast(err.message || 'Could not load move-out notices.');
		list.innerHTML = '<p class="small muted">Could not load move-out notices.</p>';
	}
}

function moveOutRow(notice) {
	const statusClass = notice.status === 'submitted' ? 'pending' : notice.status === 'acknowledged' ? 'finished' : '';
	const reason = notice.reason ? `<div class="small muted">${escapeHtml(notice.reason)}</div>` : '';
	const unit = `${escapeHtml(notice.unit_number)}<div class="small muted">${escapeHtml(notice.property_name)}</div>`;
	const tenant = `${escapeHtml(notice.tenant_name)}${reason}`;
	const acknowledge = notice.status === 'submitted'
		? `<button class="btn brass sm" type="button" data-acknowledge="${escapeHtml(notice.id)}">Acknowledge</button>`
		: '';
	return `<tr><td>${unit}</td><td>${tenant}</td><td>${escapeHtml(formatDateOnly(notice.intended_move_out_date))}</td><td><span class="badge ${statusClass}">${escapeHtml(notice.status)}</span></td><td>${acknowledge}</td></tr>`;
}

async function acknowledgeNotice(content, button) {
	button.disabled = true;
	try {
		await apiFetch(`/move-out-notices/${encodeURIComponent(button.dataset.acknowledge)}/acknowledge`, { method: 'PATCH' });
		toast('Move-out notice acknowledged.');
		await loadMoveOutNotices(content);
	} catch (err) {
		toast(err.message || 'Could not acknowledge move-out notice.');
	} finally {
		button.disabled = false;
	}
}

function formatTimestamp(value) {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? String(value || '') : date.toLocaleString();
}

function formatDateOnly(value) {
	const text = String(value || '').slice(0, 10);
	const [year, month, day] = text.split('-').map(Number);
	if (!year || !month || !day) return text;
	return new Date(year, month - 1, day).toLocaleDateString();
}

function escapeHtml(value) {
	const div = document.createElement('div');
	div.textContent = value == null ? '' : String(value);
	return div.innerHTML;
}