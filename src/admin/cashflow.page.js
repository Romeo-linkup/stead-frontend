// src/admin/cashflow.page.js — owner-only monthly cashflow
import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { toast } from '../shared/toast.js';

const CATEGORY_LABELS = {
	rent_income: 'Rent income',
	other_income: 'Other income',
	bond_payment: 'Bond payment',
	municipal: 'Municipal / city council',
	water: 'Water',
	electricity: 'Electricity',
	insurance: 'Insurance',
	levies: 'Levies',
	salaries: 'Salaries & wages',
	maintenance: 'Maintenance & repairs',
	other_expense: 'Other expense',
};
const CATEGORIES = {
	in: ['rent_income', 'other_income'],
	out: ['bond_payment', 'municipal', 'water', 'electricity', 'insurance', 'levies', 'salaries', 'maintenance', 'other_expense'],
};
const AMOUNT_PATTERN = /^\d{1,9}(\.\d{1,2})?$/;

const zar = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' });
const rand = (value) => zar.format(Number(value) || 0);

function escapeHtml(value) {
	const div = document.createElement('div');
	div.textContent = value == null ? '' : String(value);
	return div.innerHTML;
}

function escapeAttr(value) {
	return String(value == null ? '' : value)
		.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function cents(text) {
	const [whole, fraction = ''] = String(text).split('.');
	return Number(whole) * 100 + Number((fraction + '00').slice(0, 2));
}

function normaliseAmount(raw) {
	return String(raw || '').replace(/\s/g, '').replace(',', '.');
}

function when(iso) {
	return new Date(iso).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' });
}

// Items on the 29th-31st fall on the last day of shorter months.
function nextOccurrence(day) {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const pick = (y, m) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
	let date = pick(today.getFullYear(), today.getMonth());
	if (date < today) date = pick(today.getFullYear(), today.getMonth() + 1);
	return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

function categoryOptions(direction, selected) {
	return CATEGORIES[direction]
		.map((c) => `<option value="${c}"${c === selected ? ' selected' : ''}>${escapeHtml(CATEGORY_LABELS[c])}</option>`)
		.join('');
}

function describeChange(h) {
	const o = h.old_values || {};
	const n = h.new_values || {};
	if (h.change_type === 'create') return `Added ${rand(n.amount)} on day ${n.day_of_month}`;
	if (h.change_type === 'archive') return `Removed (was ${rand(o.amount)} on day ${o.day_of_month})`;
	const parts = [];
	if (o.amount !== n.amount) parts.push(`Amount ${rand(o.amount)} → ${rand(n.amount)}`);
	if (o.day_of_month !== n.day_of_month) parts.push(`Day ${o.day_of_month} → ${n.day_of_month}`);
	if (o.label !== n.label) parts.push(`Name "${o.label}" → "${n.label}"`);
	if (o.category !== n.category) parts.push(`Category ${CATEGORY_LABELS[o.category] || o.category} → ${CATEGORY_LABELS[n.category] || n.category}`);
	if ((o.note || '') !== (n.note || '')) parts.push('Note changed');
	return parts.join('; ') || 'No visible change';
}

export async function renderCashflow(root) {
	const content = renderShell(root, { activeHref: '#/admin/cashflow', title: 'Cashflow' });
	let items = [];
	let totals = null;
	let editing = null; // { mode: 'add', direction } or { mode: 'edit', item }
	let tab = 'overview';

	content.innerHTML = `
		<div class="cashflow">
			<div class="pagehead">
				<h2>Cashflow</h2>
				<p>Monthly money in and out. Only the owner can see this page.</p>
			</div>
			<div class="cf-tabs" id="cf-tabs"></div>
			<div id="cf-body"><p class="small muted">Loading...</p></div>
		</div>
	`;
	const tabsEl = content.querySelector('#cf-tabs');
	const body = content.querySelector('#cf-body');

	function drawTabs() {
		tabsEl.innerHTML = `
			<button type="button" class="btn ${tab === 'overview' ? 'brass' : 'secondary'} sm" data-tab="overview">Overview</button>
			<button type="button" class="btn ${tab === 'history' ? 'brass' : 'secondary'} sm" data-tab="history">History</button>
		`;
	}

	tabsEl.addEventListener('click', (event) => {
		const button = event.target.closest('[data-tab]');
		if (!button || button.dataset.tab === tab) return;
		tab = button.dataset.tab;
		editing = null;
		draw();
	});

	async function load() {
		try {
			const data = await apiFetch('/cashflow');
			items = data.items;
			totals = data.totals;
			draw();
		} catch (err) {
			body.innerHTML = `<div class="card"><p class="error-text">${escapeHtml(err.message)}</p></div>`;
		}
	}

	function draw() {
		drawTabs();
		if (tab === 'history') drawHistory();
		else drawOverview();
	}

	function summaryHtml() {
		const net = Number(totals.net);
		const status = totals.status;
		const netClass = status === 'profit' ? 'cf-in' : status === 'loss' ? 'cf-out' : '';
		const statusLabel = { profit: 'PROFIT', loss: 'LOSS', break_even: 'BREAK EVEN' }[status];
		const netText = net < 0 ? `−${rand(Math.abs(net))}` : rand(net);
		return `
			<div class="kpi-grid">
				<div class="kpi"><div class="num cf-in">${escapeHtml(rand(totals.in))}</div><div class="lbl">Money in / month</div></div>
				<div class="kpi"><div class="num cf-out">${escapeHtml(rand(totals.out))}</div><div class="lbl">Money out / month</div></div>
				<div class="kpi"><div class="num ${netClass}">${escapeHtml(netText)}</div><div class="lbl">Net per month <span class="cf-status ${status}">${statusLabel}</span></div></div>
			</div>
		`;
	}

	function listCard(direction, title) {
		const rows = items.filter((i) => i.direction === direction);
		const cls = direction === 'in' ? 'cf-in' : 'cf-out';
		const total = rows.reduce((sum, r) => sum + cents(r.amount), 0);
		const tableRows = rows.map((item) => `
			<tr>
				<td>${escapeHtml(item.label)}<div class="small muted">${escapeHtml(CATEGORY_LABELS[item.category] || item.category)}${item.note ? ' · ' + escapeHtml(item.note) : ''}</div></td>
				<td>${item.day_of_month}<div class="small muted">Next ${escapeHtml(nextOccurrence(item.day_of_month))}</div></td>
				<td class="cf-amount ${cls}">${escapeHtml(rand(item.amount))}</td>
				<td class="small">${escapeHtml(when(item.amount_updated_at))}<div class="small muted">by ${escapeHtml(item.amount_updated_by_name || 'unknown')}</div></td>
				<td><button class="btn secondary sm" type="button" data-edit="${escapeAttr(item.id)}">Edit</button></td>
			</tr>
		`).join('');

		return `
			<div class="card">
				<div class="row" style="margin-bottom:10px;">
					<b class="${cls}">${escapeHtml(title)}</b>
					<button class="btn secondary sm" type="button" data-add="${direction}">+ Add</button>
				</div>
				${rows.length === 0 ? '<p class="small muted">Nothing added yet.</p>' : `
					<div class="table-wrap">
						<table class="simple">
							<thead><tr><th>Item</th><th>Day</th><th class="cf-amount">Amount</th><th>Amount last updated</th><th></th></tr></thead>
							<tbody>${tableRows}
								<tr class="cf-total-row"><td colspan="2">Total</td><td class="cf-amount ${cls}">${escapeHtml(rand(total / 100))}</td><td colspan="2"></td></tr>
							</tbody>
						</table>
					</div>`}
			</div>
		`;
	}

	function editorHtml() {
		const isEdit = editing.mode === 'edit';
		const item = editing.item || {};
		const direction = isEdit ? item.direction : editing.direction;
		return `
			<div class="card" id="cf-editor">
				<b>${isEdit ? 'Edit item' : direction === 'in' ? 'Add money in' : 'Add money out'}</b>
				<form id="cf-form" novalidate style="margin-top:10px;">
					<input type="hidden" id="cf-direction" value="${direction}">
					<label class="field-label" for="cf-category">Category</label>
					<select class="field" id="cf-category">${categoryOptions(direction, item.category)}</select>
					<label class="field-label" for="cf-label">Name</label>
					<input class="field" id="cf-label" maxlength="100" placeholder="e.g. Standard Bank bond" value="${escapeAttr(item.label || '')}">
					<div class="grid2">
						<div>
							<label class="field-label" for="cf-amount">Amount (R)</label>
							<input class="field" id="cf-amount" inputmode="decimal" placeholder="0.00" value="${escapeAttr(item.amount || '')}">
						</div>
						<div>
							<label class="field-label" for="cf-day">Day of the month</label>
							<input class="field" id="cf-day" type="number" min="1" max="31" inputmode="numeric" value="${escapeAttr(item.day_of_month || '')}">
						</div>
					</div>
					<label class="field-label" for="cf-note">Note (optional)</label>
					<input class="field" id="cf-note" maxlength="300" value="${escapeAttr(item.note || '')}">
					${isEdit ? `
						<label class="field-label" for="cf-reason">Reason for change</label>
						<textarea class="field" id="cf-reason" rows="2" maxlength="300" placeholder="Required when the amount or the day changes, or to remove the item"></textarea>
					` : ''}
					<div class="row" style="gap:8px; flex-wrap:wrap; margin-top:10px;">
						<button class="btn brass" type="submit" id="cf-save">${isEdit ? 'Save changes' : 'Add item'}</button>
						<button class="btn secondary" type="button" data-cancel>Cancel</button>
						${isEdit ? '<button class="btn danger" type="button" data-archive>Remove item</button>' : ''}
					</div>
				</form>
			</div>
		`;
	}

	function drawOverview() {
		body.innerHTML = `
			${summaryHtml()}
			<p class="small muted" style="margin:6px 0 14px;">Every amount is a monthly figure. An item set to the 29th–31st falls on the last day of shorter months. Changes to amounts and dates need a reason and are recorded in History.</p>
			<div id="cf-editor-slot">${editing ? editorHtml() : ''}</div>
			${listCard('in', 'Money in')}
			${listCard('out', 'Money out')}
		`;
		if (editing) body.querySelector('#cf-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	async function drawHistory() {
		body.innerHTML = '<p class="small muted">Loading...</p>';
		try {
			const data = await apiFetch('/cashflow/history');
			if (!data.history.length) {
				body.innerHTML = '<div class="card"><p class="small muted">No changes recorded yet.</p></div>';
				return;
			}
			body.innerHTML = `
				<div class="table-wrap">
					<table class="simple">
						<thead><tr><th>When</th><th>Item</th><th>Change</th><th>Reason</th><th>By</th></tr></thead>
						<tbody>${data.history.map((h) => `
							<tr>
								<td class="small">${escapeHtml(when(h.changed_at))}</td>
								<td>${escapeHtml(h.item_label)}<div class="small ${h.direction === 'in' ? 'cf-in' : 'cf-out'}">${h.direction === 'in' ? 'Money in' : 'Money out'}</div></td>
								<td class="small">${escapeHtml(describeChange(h))}</td>
								<td class="small">${escapeHtml(h.reason || '')}</td>
								<td class="small">${escapeHtml(h.changed_by_name)}</td>
							</tr>`).join('')}
						</tbody>
					</table>
				</div>
			`;
		} catch (err) {
			body.innerHTML = `<div class="card"><p class="error-text">${escapeHtml(err.message)}</p></div>`;
		}
	}

	async function submitForm() {
		const isEdit = editing.mode === 'edit';
		const item = editing.item;
		const direction = isEdit ? item.direction : editing.direction;
		const category = body.querySelector('#cf-category').value;
		const label = body.querySelector('#cf-label').value.trim();
		const dayRaw = body.querySelector('#cf-day').value.trim();
		const amountRaw = normaliseAmount(body.querySelector('#cf-amount').value);
		const note = body.querySelector('#cf-note').value.trim();
		const reason = isEdit ? body.querySelector('#cf-reason').value.trim() : '';

		if (!label) return toast('Enter a name for this item.');
		if (!/^\d{1,2}$/.test(dayRaw) || Number(dayRaw) < 1 || Number(dayRaw) > 31) return toast('Enter a day of the month between 1 and 31.');
		if (!AMOUNT_PATTERN.test(amountRaw) || Number(amountRaw) <= 0) return toast('Enter an amount above zero with at most 2 decimals.');

		const saveBtn = body.querySelector('#cf-save');
		const idle = saveBtn.textContent;

		try {
			if (!isEdit) {
				saveBtn.disabled = true;
				saveBtn.textContent = 'Saving...';
				await apiFetch('/cashflow', {
					method: 'POST',
					body: { direction, category, label, day_of_month: Number(dayRaw), amount: amountRaw, note },
				});
				toast('Item added.');
			} else {
				const amountChanged = cents(amountRaw) !== cents(item.amount);
				const dayChanged = Number(dayRaw) !== item.day_of_month;
				if ((amountChanged || dayChanged) && reason.length < 5) {
					return toast('Please give a reason (at least 5 characters) for changing the amount or date.');
				}
				if (amountChanged || dayChanged) {
					const lines = [];
					if (amountChanged) lines.push(`Amount: ${rand(item.amount)} → ${rand(amountRaw)}`);
					if (dayChanged) lines.push(`Day: ${item.day_of_month} → ${Number(dayRaw)}`);
					if (!window.confirm(`Change "${item.label}"?\n\n${lines.join('\n')}\n\nThis will be recorded in History.`)) return;
				}
				saveBtn.disabled = true;
				saveBtn.textContent = 'Saving...';
				await apiFetch(`/cashflow/${encodeURIComponent(item.id)}`, {
					method: 'PATCH',
					body: { category, label, day_of_month: Number(dayRaw), amount: amountRaw, note, reason, expected_version: item.version },
				});
				toast('Changes saved.');
			}
			editing = null;
			await load();
		} catch (err) {
			toast(err.message || 'Could not save.');
			if (String(err.message).includes('changed by someone else')) {
				editing = null;
				await load();
				return;
			}
			saveBtn.disabled = false;
			saveBtn.textContent = idle;
		}
	}

	async function archiveCurrent() {
		const item = editing.item;
		const reason = body.querySelector('#cf-reason').value.trim();
		if (reason.length < 5) return toast('Please give a reason (at least 5 characters) for removing this item.');
		if (!window.confirm(`Remove "${item.label}" (${rand(item.amount)})? It will disappear from the totals but stay in History.`)) return;
		try {
			await apiFetch(`/cashflow/${encodeURIComponent(item.id)}/archive`, {
				method: 'POST',
				body: { reason, expected_version: item.version },
			});
			toast('Item removed.');
			editing = null;
			await load();
		} catch (err) {
			toast(err.message || 'Could not remove the item.');
			if (String(err.message).includes('changed by someone else')) {
				editing = null;
				await load();
			}
		}
	}

	body.addEventListener('click', (event) => {
		const add = event.target.closest('[data-add]');
		const edit = event.target.closest('[data-edit]');
		if (add) {
			editing = { mode: 'add', direction: add.dataset.add };
			drawOverview();
		} else if (edit) {
			const item = items.find((i) => String(i.id) === edit.dataset.edit);
			if (item) {
				editing = { mode: 'edit', item };
				drawOverview();
			}
		} else if (event.target.closest('[data-cancel]')) {
			editing = null;
			drawOverview();
		} else if (event.target.closest('[data-archive]')) {
			archiveCurrent();
		}
	});

	body.addEventListener('submit', (event) => {
		if (event.target.id !== 'cf-form') return;
		event.preventDefault();
		submitForm();
	});

	await load();
}
