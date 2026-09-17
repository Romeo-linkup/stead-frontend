import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';

export async function renderEmergency(root) {
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
				const urgent = alert.status === 'unacknowledged';
				return `
					<article class="card" style="border-color:${urgent ? 'var(--rust)' : 'var(--line)'};background:${urgent ? '#FFF4F0' : 'var(--white)'};">
						<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;">
							<div>
								<div style="font-weight:700;color:${urgent ? 'var(--rust)' : 'var(--ink)'};">${urgent ? 'UNACKNOWLEDGED' : escapeHtml(alert.status.toUpperCase())}</div>
								<div style="margin-top:5px;">${escapeHtml(alert.property_name || 'Property')} · Unit ${escapeHtml(alert.unit_number || '-')}</div>
								<div class="small" style="color:var(--slate);margin-top:4px;">Triggered by ${escapeHtml(alert.triggered_by_name || 'Tenant')} · ${formatDate(alert.created_at)}</div>
							</div>
							<div style="display:flex;gap:8px;flex-wrap:wrap;">
								${urgent ? `<button class="btn btn-primary" data-action="acknowledge" data-id="${alert.id}">Acknowledge</button>` : ''}
								${alert.status !== 'resolved' ? `<button class="btn btn-outline" data-action="resolve" data-id="${alert.id}">Resolve</button>` : ''}
							</div>
						</div>
					</article>
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
			await apiFetch(`/emergency/${button.dataset.id}/${button.dataset.action}`, { method: 'PATCH', body: {} });
			await loadAlerts();
		} catch (err) {
			button.disabled = false;
			window.alert(err.message);
		}
	});

	await loadAlerts();
	window.setInterval(loadAlerts, 15000);
}

function formatDate(value) {
	return new Date(value).toLocaleString();
}

function escapeHtml(value) {
	const div = document.createElement('div');
	div.textContent = value == null ? '' : String(value);
	return div.innerHTML;
}
