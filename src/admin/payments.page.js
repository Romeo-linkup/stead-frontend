// src/admin/payments.page.js
import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { toast } from '../shared/toast.js';
import { formatMoney, formatDueDate, capitalise } from '../shared/format.js';

const STATUS_BADGE = {
	paid: { cls: 'finished', label: 'Paid' },
	pending: { cls: 'pending', label: 'Pending' },
	outstanding: { cls: 'outstanding', label: 'Outstanding' },
};

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
				<thead><tr><th>Unit</th><th>Tenant</th><th>Payment</th><th>Status</th><th></th></tr></thead>
				<tbody id="payments-table-body">
					<tr><td colspan="5">Loading...</td></tr>
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
		document.getElementById('payments-table-body').innerHTML = '<tr><td colspan="5">Failed to load data</td></tr>';
	}
}

// Unpaid first (earliest due date), then paid (most recently paid first).
function sortPayments(payments) {
	const byTime = (field) => (a, b) => {
		const left = new Date(a[field]).getTime();
		const right = new Date(b[field]).getTime();
		if (Number.isNaN(left) && Number.isNaN(right)) return 0;
		if (Number.isNaN(left)) return 1;
		if (Number.isNaN(right)) return -1;
		return left - right;
	};

	const unpaid = payments.filter((p) => p.status !== 'paid').sort(byTime('due_date'));
	const paid = payments.filter((p) => p.status === 'paid').sort((a, b) => byTime('paid_at')(b, a));
	return [...unpaid, ...paid];
}

function renderPaymentsTable(payments, units) {
	const tbody = document.getElementById('payments-table-body');
	if (!tbody) return;

	if (payments.length === 0) {
		tbody.innerHTML = '<tr><td colspan="5">No payment records found</td></tr>';
		return;
	}

	const unitMap = {};
	units.forEach((unit) => {
		unitMap[unit.id] = unit;
	});

	const byId = {};
	payments.forEach((payment) => {
		byId[payment.id] = payment;
	});

	tbody.innerHTML = sortPayments(payments)
		.map((payment) => {
			const unit = unitMap[payment.unit_id];
			const unitNumber = unit ? unit.unit_number : 'Unknown';
			// /units exposes no tenant name yet — fall back to occupancy.
			const tenantName = unit ? unit.tenant_name || unit.tenantName || '' : '';
			const tenant = tenantName || (unit && unit.tenant_user_id ? 'Tenant' : 'Vacant');

			const badge = STATUS_BADGE[payment.status] || { cls: payment.status, label: String(payment.status || '') };

			// Proof-of-payment receipts the tenant has uploaded.
			const receipts = Array.isArray(payment.receipts) ? payment.receipts : [];
			const receiptCount = Number(payment.receipt_count) || receipts.length;
			const proofBlock = receiptCount > 0
				? `<div style="margin-top:6px;"><span class="badge finished">Proof uploaded (${receiptCount})</span></div>`
					+ `<div class="small" style="margin-top:4px;">${receipts.map((r) => `<a href="${escapeAttr(r.url)}" target="_blank" rel="noopener" style="color:var(--brass-dark); overflow-wrap:anywhere;">View receipt</a>`).join('<br>')}</div>`
				: '<div class="small muted" style="margin-top:6px;">No proof uploaded</div>';

			// No undo endpoint exists on the backend, so a paid row is a status,
			// not a button. Every unpaid row — outstanding or pending — keeps
			// the manual button, because cash/EFT is confirmed by hand.
			const actionCell =
				payment.status === 'paid'
					? payment.paid_at
						? `<span class="small muted">Paid ${escapeHtml(formatDueDate(payment.paid_at, 'short'))}</span>`
						: '<span class="small muted">—</span>'
					: `<button class="btn brass sm mark-paid-btn" data-id="${escapeHtml(payment.id)}">Mark paid</button>`;

			return `
				<tr>
					<td>${escapeHtml(unitNumber)}</td>
					<td>${escapeHtml(tenant)}</td>
					<td>${escapeHtml(`${capitalise(payment.type)} · ${formatMoney(payment.amount)}`)}<div class="small muted">Due ${escapeHtml(formatDueDate(payment.due_date, 'short'))}</div>${proofBlock}</td>
					<td><span class="badge ${badge.cls}">${escapeHtml(badge.label)}</span></td>
					<td>${actionCell}</td>
				</tr>
			`;
		})
		.join('');

	tbody.querySelectorAll('.mark-paid-btn').forEach((btn) => {
		btn.addEventListener('click', async () => {
			const payment = byId[btn.dataset.id];
			if (!payment) return;

			const unit = unitMap[payment.unit_id];
			const unitNumber = unit ? unit.unit_number : 'Unknown';
			const question = `Mark ${capitalise(payment.type)} of ${formatMoney(payment.amount)} for Unit ${unitNumber} as paid? This can't be undone from here.`;
			if (!window.confirm(question)) return;

			btn.disabled = true;
			btn.textContent = 'Marking...';
			try {
				await apiFetch(`/payments/${payment.id}/mark-paid`, { method: 'PATCH' });
				toast('Marked as paid.');
				loadPaymentsData();
			} catch (err) {
				toast(err.message || 'Failed to update payment status');
				btn.disabled = false;
				btn.textContent = 'Mark paid';
			}
		});
	});
}

function updateKPIs(payments) {
	const now = new Date();

	const dueThisMonth = payments.filter((p) => {
		const due = new Date(p.due_date);
		return !Number.isNaN(due.getTime()) && due.getFullYear() === now.getFullYear() && due.getMonth() === now.getMonth();
	});
	const paidThisMonth = dueThisMonth.filter((p) => p.status === 'paid').length;

	const unpaidTotal = payments
		.filter((p) => p.status === 'outstanding' || p.status === 'pending')
		.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

	updateKPI(0, `${paidThisMonth}/${dueThisMonth.length}`);
	setKpiLabel(0, `Marked paid, ${now.toLocaleDateString('en-ZA', { month: 'short' })}`);
	updateKPI(1, formatMoney(unpaidTotal));
	setKpiLabel(1, 'Outstanding');
}

function updateKPI(index, value) {
	const cell = document.getElementById('kpi-grid')?.children[index]?.querySelector('.num');
	if (cell) cell.textContent = value;
}

function setKpiLabel(index, text) {
	const cell = document.getElementById('kpi-grid')?.children[index]?.querySelector('.lbl');
	if (cell) cell.textContent = text;
}

function escapeAttr(value) {
	return String(value == null ? '' : value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = text == null ? '' : String(text);
	return div.innerHTML;
}
