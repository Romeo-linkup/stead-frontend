import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';

export function renderPayments(root) {
	const content = renderShell(root, { activeHref: '#/admin/payments', title: 'Payments & accounts' });

	content.innerHTML = `
		<div class="pagehead">
			<h2>Payments & accounts</h2>
			<p>Rent is paid by EFT — mark each tenant as paid once you've confirmed receipt</p>
		</div>
		<div class="kpi-grid" id="kpi-grid">
			<div class="kpi"><div class="num">-</div><div class="lbl">Marked paid</div></div>
			<div class="kpi"><div class="num">-</div><div class="lbl">Outstanding</div></div>
		</div>
		<div class="table-wrap">
			<table class="simple">
				<tr><th>Unit</th><th>Tenant</th><th>Status</th><th></th></tr>
				<tbody id="payments-table-body">
					<tr><td colspan="4">Loading...</td></tr>
				</tbody>
			</table>
		</div>
	`;

	loadPaymentsData();
}

async function loadPaymentsData() {
	try {
		// apiFetch already returns parsed JSON (or throws) — no .ok/.json() needed.
		const [payments, units] = await Promise.all([apiFetch('/payments'), apiFetch('/units')]);
		renderPaymentsTable(payments, units);
		updateKPIs(payments);
	} catch (err) {
		console.error('Failed to load payments data:', err);
		document.getElementById('payments-table-body').innerHTML = '<tr><td colspan="4">Failed to load data</td></tr>';
	}
}

function renderPaymentsTable(payments, units) {
	const tbody = document.getElementById('payments-table-body');
	if (!tbody) return;

	if (payments.length === 0) {
		tbody.innerHTML = '<tr><td colspan="4">No payment records found</td></tr>';
		return;
	}

	const unitMap = {};
	units.forEach((unit) => {
		unitMap[unit.id] = unit;
	});

	tbody.innerHTML = payments
		.map((payment) => {
			const unit = unitMap[payment.unit_id];
			const unitNumber = unit ? unit.unit_number : 'Unknown';
			const tenantName = unit && unit.tenant_user_id ? 'Tenant' : 'Vacant';

			const isPaid = payment.status === 'paid';
			const statusBadge = isPaid
				? '<span class="badge finished">Paid</span>'
				: '<span class="badge outstanding">Outstanding</span>';

			// Only "Mark paid" — there is no mark-outstanding/undo endpoint on
			// the backend, so once paid, this becomes a plain status, not a button.
			const actionCell = isPaid
				? '<span class="small muted">Paid</span>'
				: `<button class="btn brass btn-sm mark-paid-btn" data-id="${payment.id}">Mark paid</button>`;

			return `
				<tr>
					<td>${escapeHtml(unitNumber)}</td>
					<td>${tenantName}</td>
					<td>${statusBadge}</td>
					<td>${actionCell}</td>
				</tr>
			`;
		})
		.join('');

	tbody.querySelectorAll('.mark-paid-btn').forEach((btn) => {
		btn.addEventListener('click', async () => {
			btn.disabled = true;
			btn.textContent = 'Marking...';
			try {
				await apiFetch(`/payments/${btn.dataset.id}/mark-paid`, { method: 'PATCH' });
				loadPaymentsData();
			} catch (err) {
				alert(err.message || 'Failed to update payment status');
				btn.disabled = false;
				btn.textContent = 'Mark paid';
			}
		});
	});
}

function updateKPIs(payments) {
	const paidCount = payments.filter((p) => p.status === 'paid').length;
	const totalCount = payments.length;
	const outstandingAmount = payments
		.filter((p) => p.status === 'outstanding')
		.reduce((sum, p) => sum + Number(p.amount), 0);

	updateKPI(0, `${paidCount}/${totalCount}`);
	updateKPI(1, `R${outstandingAmount.toLocaleString()}`);
}

function updateKPI(index, value) {
	const kpiGrid = document.getElementById('kpi-grid');
	if (kpiGrid && kpiGrid.children[index]) {
		kpiGrid.children[index].querySelector('.num').textContent = value;
	}
}

function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = text || '';
	return div.innerHTML;
}