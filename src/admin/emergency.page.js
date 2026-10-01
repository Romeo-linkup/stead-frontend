import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { toast } from '../shared/toast.js';

let alertsIntervalId = null;

export async function renderEmergency(root) {
	if (alertsIntervalId !== null) {
		window.clearInterval(alertsIntervalId);
		alertsIntervalId = null;
	}

	const content = renderShell(root, { activeHref: '#/admin/emergency', title: 'Emergency alerts' });
	content.innerHTML = `
		<div class="pagehead"><h2>Emergency alerts</h2><p>Live district alerts, refreshed every 15 seconds.</p></div>
		<div id="emergency-list">Loading...</div>
	`;

	async function loadAlerts() {
		const list = content.querySelector('#emergency-list');
		try {
			const alerts = await apiFetch('/emergency');
			if (!alerts.length) {
				list.innerHTML = '<div class="card"><p style="color:var(--slate);margin:0;">No emergency alerts.</p></div>';
				return;
			}

			list.innerHTML = alerts.map(alert => {
				const statusDetails = {
					unacknowledged: { label: 'Unacknowledged', badge: 'outstanding', action: 'acknowledge' },
					acknowledged: { label: 'Acknowledged', badge: 'pending', action: 'resolve' },
					resolved: { label: 'Resolved', badge: 'finished', action: null },
				};
				const status = statusDetails[alert.status] || { label: alert.status || 'Unknown', badge: 'pending', action: null };
				const urgent = alert.status === 'unacknowledged';
				const location = `${alert.property_name || 'Property'}, Unit ${alert.unit_number || '-'}`;
				const actionButton = status.action
					? `<div class="row" style="margin-top:8px;"><button class="btn ${status.action === 'acknowledge' ? 'rust' : 'secondary'} sm" data-action="${status.action}" data-id="${escapeAttr(alert.id)}">${status.action === 'acknowledge' ? 'Acknowledge' : 'Resolve'}</button></div>`
					: '';
				return `
					<div class="card">
						<div class="row"><b class="small" style="color:${urgent ? 'var(--rust)' : 'inherit'};">${escapeHtml(location)}</b><span class="badge ${status.badge}">${escapeHtml(status.label)}</span></div>
						<p class="small muted" style="margin:6px 0;">Triggered by ${escapeHtml(alert.triggered_by_name || 'Tenant')} · ${escapeHtml(formatDate(alert.created_at))}</p>
						${actionButton}
					</div>
				`;
			}).join('');
		} catch (err) {
			list.innerHTML = `<div class="card"><p class="error-text">${escapeHtml(err.message)}</p></div>`;
		}
	}

	content.addEventListener('click', async event => {
		const button = event.target.closest('[data-action]');
		if (!button) return;
		button.disabled = true;
		try {
			await apiFetch(`/emergency/${encodeURIComponent(button.dataset.id)}/${button.dataset.action}`, { method: 'PATCH', body: {} });
			toast(button.dataset.action === 'acknowledge' ? 'Alert acknowledged.' : 'Alert marked resolved.');
			await loadAlerts();
		} catch (err) {
			button.disabled = false;
			toast(err.message);
		}
	});

	await loadAlerts();
	alertsIntervalId = window.setInterval(loadAlerts, 15000);
}

function formatDate(value) {
	return new Date(value).toLocaleString();
}

function escapeHtml(value) {
	const div = document.createElement('div');
	div.textContent = value == null ? '' : String(value);
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
