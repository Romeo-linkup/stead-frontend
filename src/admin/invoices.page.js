import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { toast } from '../shared/toast.js';

const STATUSES = {
	submitted: { badge: 'new', label: 'Submitted' },
	approved: { badge: 'pending', label: 'Approved' },
	rejected: { badge: 'outstanding', label: 'Rejected' },
	paid: { badge: 'finished', label: 'Paid' },
};

export function renderInvoices(root) {
	const content = renderShell(root, { activeHref: '#/admin/invoices', title: 'Invoices' });
	let invoices = [];
	let rejectOpenId = null;

	content.innerHTML = `
		<div class="pagehead">
			<h2>Invoices</h2>
			<p>Quotes &amp; invoices submitted by service providers</p>
		</div>
		<label class="field-label" for="invoice-status-filter">Status</label>
		<select class="field invoice-filter" id="invoice-status-filter">
			<option value="">All</option>
			<option value="submitted">Awaiting review</option>
			<option value="approved">Approved</option>
			<option value="rejected">Rejected</option>
			<option value="paid">Paid</option>
		</select>
		<div id="invoice-list"><p class="small muted">Loading invoices...</p></div>
	`;

	content.querySelector('#invoice-status-filter').addEventListener('change', () => loadInvoices());
	loadInvoices();

	async function loadInvoices() {
		const list = content.querySelector('#invoice-list');
		const status = content.querySelector('#invoice-status-filter').value;
		list.innerHTML = '<p class="small muted">Loading invoices...</p>';
		try {
			const query = status ? `?status=${encodeURIComponent(status)}` : '';
			invoices = await apiFetch(`/invoices${query}`);
			renderInvoiceList();
		} catch (error) {
			list.innerHTML = `<p class="error-text">${escapeHtml(error.message || 'Failed to load invoices.')}</p>`;
		}
	}

	function renderInvoiceList() {
		const list = content.querySelector('#invoice-list');
		if (!invoices.length) {
			list.innerHTML = '<p class="small muted">No invoices submitted yet.</p>';
			return;
		}

		list.innerHTML = invoices.map((invoice) => {
			const status = STATUSES[invoice.status];
			if (!status) return '';
			const taskTitle = invoice.task_category || String(invoice.task_description || '').slice(0, 60);
			const items = Array.isArray(invoice.items) ? invoice.items : [];
			const receipts = Array.isArray(invoice.receipts) ? invoice.receipts : [];
			const receiptLinks = receipts.map((receipt, index) => {
				const label = `Receipt ${index + 1}`;
				const url = typeof receipt.image_url === 'string' && receipt.image_url.startsWith('https://')
					? `<a href="${escapeAttr(receipt.image_url)}" target="_blank" rel="noopener noreferrer">${label}</a>`
					: escapeHtml(label);
				return url;
			}).join(' · ');
			const actions = invoice.status === 'submitted'
				? `<div class="invoice-admin-actions">
					<button class="btn secondary sm" type="button" data-approve="${escapeAttr(invoice.id)}">Approve</button>
					<button class="btn secondary sm" type="button" data-open-reject="${escapeAttr(invoice.id)}">Reject</button>
					${String(rejectOpenId) === String(invoice.id) ? `
						<div class="invoice-reject-panel">
							<textarea class="field" rows="2" maxlength="300" placeholder="Reason for rejecting" data-reject-reason="${escapeAttr(invoice.id)}"></textarea>
							<button class="btn brass sm" type="button" data-confirm-reject="${escapeAttr(invoice.id)}">Confirm reject</button>
						</div>
					` : ''}
				</div>`
				: invoice.status === 'approved'
					? `<button class="btn brass sm" type="button" data-mark-paid="${escapeAttr(invoice.id)}">Mark as paid</button>`
					: invoice.status === 'paid'
						? `<span class="small muted">Paid on ${escapeHtml(formatDate(invoice.paid_at))}</span>`
						: '';

			return `
				<div class="card invoice-admin-card">
					<div class="row"><b class="small">${escapeHtml(taskTitle || 'Maintenance task')}</b><span class="badge ${status.badge}">${status.label}</span></div>
					<p class="small muted" style="margin:6px 0;">${escapeHtml(invoice.property_name || 'Property')} · Unit ${escapeHtml(invoice.unit_number || 'Unknown')} · To: ${escapeHtml(invoice.to_party)} · From: ${escapeHtml(invoice.provider_name)}</p>
					<div class="table-wrap"><table class="simple">
						<thead><tr><th>Description</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
						<tbody>${items.map((item) => `
							<tr>
								<td>${escapeHtml(item.description)}</td>
								<td>${escapeHtml(Number(item.qty).toFixed(2))}</td>
								<td>R ${escapeHtml(Number(item.unit_price).toFixed(2))}</td>
								<td>R ${escapeHtml(Number(item.line_total).toFixed(2))}</td>
							</tr>
						`).join('')}</tbody>
					</table></div>
					<p class="small muted invoice-detail">Account: ${escapeHtml(invoice.payout_account)}</p>
					<p class="small muted invoice-detail">Receipts: ${receipts.length} attached${receiptLinks ? ` · ${receiptLinks}` : ''}</p>
					${invoice.note ? `<p class="small muted invoice-detail">Note: &quot;${escapeHtml(invoice.note)}&quot;</p>` : ''}
					${invoice.status === 'rejected' ? `<p class="small muted invoice-detail">Rejected: ${escapeHtml(invoice.review_note || '')}</p>` : ''}
					<div class="grand-row"><span class="lbl">Total</span><span class="val">R ${escapeHtml(Number(invoice.total).toFixed(2))}</span></div>
					<div class="invoice-admin-action-row">${actions}</div>
				</div>
			`;
		}).join('');

		list.querySelectorAll('[data-approve]').forEach((button) => {
			button.addEventListener('click', () => {
				if (window.confirm('Approve this invoice?')) runAction(button, `/invoices/${encodeURIComponent(button.dataset.approve)}/approve`, 'Invoice approved.');
			});
		});
		list.querySelectorAll('[data-open-reject]').forEach((button) => {
			button.addEventListener('click', () => {
				rejectOpenId = button.dataset.openReject;
				renderInvoiceList();
				list.querySelector(`[data-reject-reason="${CSS.escape(rejectOpenId)}"]`)?.focus();
			});
		});
		list.querySelectorAll('[data-confirm-reject]').forEach((button) => {
			button.addEventListener('click', () => {
				const reason = list.querySelector(`[data-reject-reason="${CSS.escape(button.dataset.confirmReject)}"]`)?.value.trim() || '';
				if (!reason || reason.length > 300) return toast('Enter a rejection reason of 1 to 300 characters.');
				runAction(button, `/invoices/${encodeURIComponent(button.dataset.confirmReject)}/reject`, 'Invoice rejected.', { reason });
			});
		});
		list.querySelectorAll('[data-mark-paid]').forEach((button) => {
			button.addEventListener('click', () => {
				if (window.confirm('Mark this invoice as paid?')) runAction(button, `/invoices/${encodeURIComponent(button.dataset.markPaid)}/mark-paid`, 'Invoice marked as paid.');
			});
		});
	}

	async function runAction(button, path, successMessage, body) {
		button.disabled = true;
		try {
			await apiFetch(path, { method: 'PATCH', ...(body ? { body } : {}) });
			toast(successMessage);
			rejectOpenId = null;
			await loadInvoices();
		} catch (error) {
			toast(error.message || 'Could not update invoice.');
			button.disabled = false;
		}
	}
}

function formatDate(value) {
	if (!value) return '—';
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-ZA');
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