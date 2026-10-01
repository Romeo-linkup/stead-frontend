import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { toast } from '../shared/toast.js';

export async function renderNotices(root) {
	const content = renderShell(root, { activeHref: '#/tenant/notices', title: 'Notices' });
	content.innerHTML = `
		<div class="pagehead"><h2>Notices</h2><p>Updates from your building admin</p></div>
		<div id="tenant-notices-list"></div>
		<div class="card">
			<b class="small">Leaving the property</b>
			<div id="move-out-content"><p class="small muted">Loading...</p></div>
		</div>
	`;

	await Promise.all([loadNotices(content), loadMoveOutNotice(content)]);
}

async function loadNotices(content) {
	const list = content.querySelector('#tenant-notices-list');
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

async function loadMoveOutNotice(content) {
	const target = content.querySelector('#move-out-content');
	try {
		const data = await apiFetch('/move-out-notices/mine');
		renderMoveOutNotice(target, data.notice, data.notice_period_months);
	} catch (err) {
		toast(err.message || 'Could not load your move-out notice.');
		target.innerHTML = '<p class="small muted">Could not load your move-out notice.</p>';
	}
}

function renderMoveOutNotice(target, notice, noticePeriodMonths) {
	const months = Number(noticePeriodMonths) || 3;
	const plannedDate = notice ? formatDateOnly(notice.intended_move_out_date) : '';
	let statusContent;

	if (!notice || notice.status === 'withdrawn') {
		const earliestDate = earliestMoveOutHint(months);
		statusContent = `
			<p class="small muted" style="margin:6px 0 12px;">${escapeHtml(months)} months' written notice is required before vacating.</p>
			<form id="move-out-form">
				<label class="field-label" for="planned-move-out-date">Planned move-out date</label>
				<input class="field" id="planned-move-out-date" type="date" min="${escapeHtml(earliestDate)}" required>
				<label class="field-label" for="move-out-reason">Reason (optional)</label>
				<textarea class="field" id="move-out-reason" rows="3" maxlength="500"></textarea>
				<button class="btn brass block" type="submit">Give notice</button>
			</form>
		`;
	} else {
		const acknowledged = notice.status === 'acknowledged';
		statusContent = `
			<p class="small muted" style="margin:6px 0 10px;">Notice submitted - move-out on ${escapeHtml(plannedDate)}</p>
			<div class="row">
				<span class="badge ${acknowledged ? 'finished' : 'pending'}">${acknowledged ? 'Acknowledged' : 'Submitted'}</span>
				${acknowledged ? `<span class="small muted">Acknowledged ${escapeHtml(formatDateOnly(notice.acknowledged_at))}</span>` : ''}
			</div>
			<button class="btn secondary sm" type="button" data-withdraw-notice="${escapeHtml(notice.id)}" style="margin-top:10px;">Withdraw notice</button>
		`;
	}

	target.innerHTML = statusContent;
	const form = target.querySelector('#move-out-form');
	if (form) {
		form.addEventListener('submit', async (event) => {
			event.preventDefault();
			const button = form.querySelector('button[type="submit"]');
			button.disabled = true;
			try {
				await apiFetch('/move-out-notices', {
					method: 'POST',
					body: {
						intended_move_out_date: form.querySelector('#planned-move-out-date').value,
						reason: form.querySelector('#move-out-reason').value,
					},
				});
				toast('Notice submitted.');
				await loadMoveOutNotice(target.closest('.card').parentElement);
			} catch (err) {
				toast(err.message || 'Could not submit your notice.');
			} finally {
				button.disabled = false;
			}
		});
	}

	const withdrawButton = target.querySelector('[data-withdraw-notice]');
	if (withdrawButton) {
		withdrawButton.addEventListener('click', async () => {
			if (!window.confirm('Withdraw your move-out notice?')) return;
			withdrawButton.disabled = true;
			try {
				await apiFetch(`/move-out-notices/${encodeURIComponent(withdrawButton.dataset.withdrawNotice)}/withdraw`, { method: 'PATCH' });
				toast('Notice withdrawn.');
				await loadMoveOutNotice(target.closest('.card').parentElement);
			} catch (err) {
				toast(err.message || 'Could not withdraw your notice.');
			} finally {
				withdrawButton.disabled = false;
			}
		});
	}
}

function earliestMoveOutHint(months) {
	const today = new Date();
	const target = new Date(today.getFullYear(), today.getMonth() + months, 1);
	const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
	const day = Math.min(today.getDate(), lastDay);
	return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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