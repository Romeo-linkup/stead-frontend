import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { icon } from '../shared/icons.js';

export function renderTenants(root) {
	const content = renderShell(root, { activeHref: '#/admin/tenants', title: 'Tenants & leases' });

	content.innerHTML = `
		<div class="pagehead">
			<h2>Tenants & leases</h2>
			<p id="district-subtitle">Loading...</p>
		</div>
		<div class="table-wrap">
			<table class="simple">
				<tr><th>Unit</th><th>Tenant</th><th>Lease</th><th>Rent</th><th></th></tr>
				<tbody id="tenants-table-body">
					<tr><td colspan="5">Loading...</td></tr>
				</tbody>
			</table>
		</div>
		<div class="error-text" id="lease-error" hidden></div>
	`;

	loadTenantsData();
}

async function loadTenantsData() {
	const tbody = document.getElementById('tenants-table-body');
	try {
		// apiFetch already returns parsed JSON (or throws) — no .ok/.json() needed.
		const [units, leases, tenants] = await Promise.all([
			apiFetch('/units'),
			apiFetch('/leases'),
			apiFetch('/users?role=tenant').catch(() => []),
		]);

		document.getElementById('district-subtitle').textContent = `${units.length} unit${units.length === 1 ? '' : 's'}`;
		renderTenantsTable(units, leases, tenants);
	} catch (err) {
		console.error('Failed to load tenants data:', err);
		tbody.innerHTML = '<tr><td colspan="5">Failed to load data</td></tr>';
	}
}

function renderTenantsTable(units, leases, tenants) {
	const tbody = document.getElementById('tenants-table-body');
	if (!tbody) return;

	if (units.length === 0) {
		tbody.innerHTML = '<tr><td colspan="5">No units found</td></tr>';
		return;
	}

	const unitLeases = {};
	leases.forEach((lease) => {
		unitLeases[lease.unit_id] = lease;
	});
	const tenantsById = {};
	tenants.forEach((t) => {
		tenantsById[t.id] = t;
	});

	tbody.innerHTML = units
		.map((unit) => {
			const lease = unitLeases[unit.id];
			const tenant = unit.tenant_user_id ? tenantsById[unit.tenant_user_id] : null;
			const tenantName = tenant ? escapeHtml(tenant.name) : unit.tenant_user_id ? 'Assigned' : 'Vacant';
			const rentAmount = unit.rent_amount ? `R${Number(unit.rent_amount).toLocaleString()}` : '-';

			let leaseStatus = '';
			let action = '';
			if (lease) {
				if (lease.status === 'draft') {
					leaseStatus = '<span class="badge new">Draft</span>';
					action = `<button class="btn brass btn-sm send-lease-btn" data-lease-id="${lease.id}">Send for signature</button>`;
				} else if (lease.status === 'sent') {
					leaseStatus = '<span class="badge pending">Awaiting sig.</span>';
				} else if (lease.status === 'signed') {
					leaseStatus = '<span class="badge finished">Signed</span>';
				} else {
					leaseStatus = `<span class="badge outstanding">${escapeHtml(lease.status)}</span>`;
				}
			} else {
				leaseStatus = '<span class="small muted">No lease</span>';
				action = unit.tenant_user_id
					? `<a class="btn btn-primary btn-sm" href="#/admin/leases">${icon('doc')} Create lease</a>`
					: '';
			}

			return `
				<tr>
					<td>${escapeHtml(unit.unit_number || '')}</td>
					<td>${tenantName}</td>
					<td>${leaseStatus}</td>
					<td>${rentAmount}</td>
					<td>${action}</td>
				</tr>
			`;
		})
		.join('');

	tbody.querySelectorAll('.send-lease-btn').forEach((btn) => {
		btn.addEventListener('click', async () => {
			const errorDiv = document.getElementById('lease-error');
			errorDiv.hidden = true;
			btn.disabled = true;
			btn.textContent = 'Sending...';
			try {
				await apiFetch(`/leases/${btn.dataset.leaseId}/send`, { method: 'PATCH' });
				await loadTenantsData();
			} catch (err) {
				errorDiv.textContent = err.message || 'Failed to send lease';
				errorDiv.hidden = false;
				btn.disabled = false;
				btn.textContent = 'Send for signature';
			}
		});
	});
}

function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = text || '';
	return div.innerHTML;
}