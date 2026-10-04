import { renderShell } from '../shared/shell.js';
import { renderQuickAccessGrid, QUICK_ACCESS } from '../shared/quick-access-grid.js';
import { apiFetch } from '../shared/api.js';

export function renderOverview(root) {
	const content = renderShell(root, { activeHref: '#/admin/overview', title: 'Overview' });

	content.innerHTML = `
		<div class="pagehead">
			<h2>Overview</h2>
			<p>All districts</p>
		</div>
		<div class="kpi-grid" id="kpi-grid">
			<div class="kpi"><div class="num">-</div><div class="lbl">Districts</div></div>
			<div class="kpi"><div class="num">-</div><div class="lbl">Units occupied</div></div>
			<div class="kpi" style="grid-column:1 / -1;"><div class="num">-</div><div class="lbl">Rent outstanding</div></div>
		</div>
		<div class="card">
			<div class="row">
				<b class="small">Average property condition</b>
				<span class="small" style="font-weight:700;" id="avg-condition">-</span>
			</div>
			<div class="score-bar"><div id="condition-bar" style="width:0%;"></div></div>
			<p class="small muted" id="condition-note" style="margin:8px 0 0;"></p>
		</div>
		<div id="emergency-alerts"></div>
		<div id="quick-access-slot"></div>
	`;

	renderQuickAccessGrid(content.querySelector('#quick-access-slot'), QUICK_ACCESS.admin);
	loadOverviewData();
}

async function loadOverviewData() {
	try {
		// apiFetch already returns parsed JSON (or throws on error) — no .ok/.json() needed.
		const [districts, units, payments, summary, alerts] = await Promise.all([
			apiFetch('/districts'),
			apiFetch('/units'),
			apiFetch('/payments'),
			apiFetch('/evaluations/summary'),
			apiFetch('/emergency'),
		]);

		updateKPI(0, districts.length);

		const occupied = units.filter((u) => u.tenant_user_id).length;
		updateKPI(1, occupied);

		const outstanding = payments
			.filter((p) => p.status === 'outstanding')
			.reduce((sum, p) => sum + Number(p.amount), 0);
		updateKPI(2, `R${outstanding.toLocaleString()}`);

		const portfolio = summary.portfolio;
		const avgScore = portfolio.average_score || 0;
		document.getElementById('avg-condition').textContent = portfolio.complete ? `${Math.round(avgScore)}%` : '—';
		document.getElementById('condition-bar').style.width = `${avgScore}%`;
		document.getElementById('condition-note').textContent = portfolio.complete
			? 'Average of all ' + portfolio.property_count + ' properties'
			: portfolio.evaluated_count + ' of ' + portfolio.property_count + ' properties evaluated';

		const unacknowledged = alerts.filter((a) => a.status === 'unacknowledged').slice(0, 1);
		renderEmergencyAlerts(unacknowledged);
	} catch (err) {
		console.error('Failed to load overview data:', err);
	}
}

function updateKPI(index, value) {
	const kpiGrid = document.getElementById('kpi-grid');
	if (kpiGrid && kpiGrid.children[index]) {
		kpiGrid.children[index].querySelector('.num').textContent = value;
	}
}

function renderEmergencyAlerts(alerts) {
	const container = document.getElementById('emergency-alerts');
	if (!container) return;

	if (alerts.length === 0) {
		container.innerHTML = '';
		return;
	}

	// Built with a real event listener instead of onclick="..." — this file is
	// an ES module, so a function isn't on `window` and inline onclick can't find it.
	container.innerHTML = alerts
		.map(
			(alert) => `
		<div class="card">
			<div class="row">
				<b class="small" style="color:var(--rust);">Emergency alert — ${formatTimeAgo(alert.created_at)}</b>
			</div>
			<p class="small muted" style="margin:6px 0;">Unit ${escapeHtml(alert.unit_number || 'Unknown')} — SOS pressed. Not yet acknowledged.</p>
			<button class="btn rust btn-sm ack-btn" data-id="${alert.id}">Acknowledge</button>
		</div>
	`
		)
		.join('');

	container.querySelectorAll('.ack-btn').forEach((btn) => {
		btn.addEventListener('click', async () => {
			btn.disabled = true;
			try {
				await apiFetch(`/emergency/${btn.dataset.id}/acknowledge`, { method: 'PATCH' });
				loadOverviewData();
			} catch (err) {
				console.error('Failed to acknowledge emergency:', err);
				btn.disabled = false;
			}
		});
	});
}

function formatTimeAgo(dateString) {
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now - date;
	const diffMins = Math.floor(diffMs / 60000);

	if (diffMins < 1) return 'Just now';
	if (diffMins < 60) return `${diffMins} min ago`;
	if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
	return `${Math.floor(diffMins / 1440)} days ago`;
}

function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = text || '';
	return div.innerHTML;
}