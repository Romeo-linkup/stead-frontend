import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { icon } from '../shared/icons.js';
import { toast } from '../shared/toast.js';

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
		toast(err?.message || 'Failed to load tenants data.');
		if (tbody) tbody.innerHTML = '<tr><td colspan="5">Failed to load data</td></tr>';
	}
}

function renderTenantsTable(units, leases, tenants) {
	const tbody = document.getElementById('tenants-table-body');
	if (!tbody) return;

	if (units.length === 0) {
		tbody.innerHTML = '<tr><td colspan="5">No units found</td></tr>';
		return;
	}

	const unitLeases = new Map();
	const priority = { signed: 3, sent: 2, draft: 1 };
	for (const lease of leases) {
		const current = unitLeases.get(String(lease.unit_id)) || { current: null, open: null };
		const leasePriority = priority[lease.status] || 0;
		const currentPriority = priority[current.current?.status] || 0;
		if (!current.current || leasePriority > currentPriority) current.current = lease;
		if (lease.status === 'draft' || lease.status === 'sent') {
			const openPriority = priority[lease.status];
			const existingOpenPriority = priority[current.open?.status] || 0;
			if (!current.open || openPriority > existingOpenPriority) current.open = lease;
		}
		unitLeases.set(String(lease.unit_id), current);
	}
	const tenantsById = {};
	tenants.forEach((t) => {
		tenantsById[t.id] = t;
	});

	tbody.innerHTML = units
		.map((unit) => {
			const leaseGroup = unitLeases.get(String(unit.id)) || { current: null, open: null };
			const lease = leaseGroup.current;
			const openLease = leaseGroup.open;
			const tenant = unit.tenant_user_id ? tenantsById[unit.tenant_user_id] : null;
			const tenantName = tenant ? escapeHtml(tenant.name) : unit.tenant_user_id ? 'Assigned' : 'Vacant';
			const rentAmount = unit.rent_amount == null ? '-' : `R${escapeHtml(Number(unit.rent_amount).toLocaleString())}`;

			let leaseStatus = '';
			let action = '';
			if (lease) {
				leaseStatus = leaseStatusBadge(lease.status);
				if (lease.status === 'signed' && openLease && String(openLease.id) !== String(lease.id)) {
					leaseStatus += `<div class="small muted">${openLease.status === 'draft' ? 'Renewal draft' : 'Renewal awaiting signature'}</div>`;
				}
				if ((lease.status === 'sent' || lease.status === 'signed') && !lease.lessor_signature_url) {
					leaseStatus += '<div class="small muted">Lessor not signed</div>';
				}
				if (lease.status === 'signed') {
					action = `<a class="btn secondary sm" href="#/admin/leases?view=${encodeURIComponent(lease.id)}">View</a>`;
					if (!openLease || String(openLease.id) === String(lease.id)) {
						if (!lease.lessor_signature_url) action += lessorSignLink(lease, 'Add lessor signature');
						action += `<button class="btn brass sm lease-action" type="button" data-action="renew" data-lease-id="${escapeHtml(lease.id)}">Renew / amend</button>`;
					} else if (openLease.status === 'draft') {
						action += openLease.lessor_signature_url
							? `<button class="btn brass sm lease-action" type="button" data-action="send" data-lease-id="${escapeHtml(openLease.id)}">Send for signature</button>`
							: lessorSignLink(openLease, 'Sign as lessor');
					} else if (openLease.status === 'sent' && !openLease.lessor_signature_url) {
						action += lessorSignLink(openLease, 'Sign as lessor');
					}
				} else if (openLease?.status === 'draft') {
					action = `<a class="btn secondary sm" href="#/admin/leases?edit=${encodeURIComponent(openLease.id)}">Edit</a>
						${openLease.lessor_signature_url
							? `<button class="btn brass sm lease-action" type="button" data-action="send" data-lease-id="${escapeHtml(openLease.id)}">Send for signature</button>`
							: lessorSignLink(openLease, 'Sign as lessor')}
						<button class="btn secondary sm lease-action" type="button" data-action="delete" data-lease-id="${escapeHtml(openLease.id)}">Delete</button>`;
				} else if (openLease?.status === 'sent') {
					action = `<button class="btn secondary sm lease-action" type="button" data-action="edit-sent" data-lease-id="${escapeHtml(openLease.id)}">Edit</button>
						<a class="btn secondary sm" href="#/admin/leases?view=${encodeURIComponent(openLease.id)}">View</a>
						${openLease.lessor_signature_url ? '' : lessorSignLink(openLease, 'Sign as lessor')}`;
				} else {
					action = `<a class="btn secondary sm" href="#/admin/leases?view=${encodeURIComponent(lease.id)}">View</a>`;
				}
			} else {
				leaseStatus = '<span class="small muted">No lease</span>';
				action = unit.tenant_user_id
					? `<a class="btn brass sm" href="#/admin/leases?unit=${encodeURIComponent(unit.id)}">${icon('doc')} Create lease</a>`
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

	tbody.querySelectorAll('.lease-action').forEach((button) => {
		button.addEventListener('click', () => handleLeaseAction(button));
	});
}

function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = String(text == null ? '' : text);
	return div.innerHTML;
}

function leaseStatusBadge(status) {
	const badges = {
		draft: ['new', 'Draft'],
		sent: ['pending', 'Awaiting signature'],
		signed: ['finished', 'Signed'],
		superseded: ['outstanding', 'Superseded'],
		expired: ['outstanding', 'Expired'],
	};
	const [kind, label] = badges[status] || ['outstanding', String(status || 'Unknown')];
	return `<span class="badge ${kind}">${escapeHtml(label)}</span>`;
}

async function handleLeaseAction(button) {
	const { action, leaseId } = button.dataset;
	if (action === 'delete' && !confirm('Delete this draft lease? This cannot be undone.')) return;
	if (action === 'edit-sent' && !confirm('Editing this sent lease will withdraw it back to draft. Continue?')) return;
	if (action === 'renew' && !confirm('Create a new lease version that replaces this one after the tenant signs?')) return;

	button.disabled = true;
	try {
		if (action === 'send') {
			await apiFetch(`/leases/${encodeURIComponent(leaseId)}/send`, { method: 'PATCH' });
			toast('Lease sent for signature.');
		} else if (action === 'delete') {
			await apiFetch(`/leases/${encodeURIComponent(leaseId)}`, { method: 'DELETE' });
			toast('Draft lease deleted.');
		} else if (action === 'edit-sent') {
			window.location.hash = `#/admin/leases?edit=${encodeURIComponent(leaseId)}`;
			return;
		} else if (action === 'renew') {
			const renewed = await apiFetch(`/leases/${encodeURIComponent(leaseId)}/supersede`, { method: 'POST' });
			window.location.hash = `#/admin/leases?edit=${encodeURIComponent(renewed.id)}`;
			return;
		}
		await loadTenantsData();
	} catch (err) {
		toast(err?.message || 'Unable to update lease.');
	} finally {
		button.disabled = false;
	}
}

function lessorSignLink(lease, label) {
	return `<a class="btn brass sm" href="#/admin/leases?view=${encodeURIComponent(lease.id)}">${escapeHtml(label)}</a>`;
}