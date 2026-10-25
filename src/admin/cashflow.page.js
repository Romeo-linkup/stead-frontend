// src/admin/cashflow.page.js — owner-only monthly cashflow, one set of books per property
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
const STATUS_LABELS = { profit: 'PROFIT', loss: 'LOSS', break_even: 'BREAK EVEN' };

const zar = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' });
const rand = (value) => zar.format(Number(value) || 0);
const netLabel = (net) => (Number(net) < 0 ? `−${rand(Math.abs(Number(net)))}` : rand(net));
const netClass = (status) => (status === 'profit' ? 'cf-in' : status === 'loss' ? 'cf-out' : '');
const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Johannesburg' });
const dayLabel = (ymd) => (ymd ? new Date(`${ymd}T00:00:00`).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

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
	if (h.change_type === 'create') return n.kind === 'one_off' ? `Paid ${rand(n.amount)} on ${dayLabel(n.paid_on)}` : `Added ${rand(n.amount)} on day ${n.day_of_month}`;
	if (h.change_type === 'archive') return `Removed (was ${rand(o.amount)} on day ${o.day_of_month})`;
	const parts = [];
	if ((o.property_id ?? null) !== (n.property_id ?? null)) parts.push('Assigned to a property');
	if (o.amount !== n.amount) parts.push(`Amount ${rand(o.amount)} → ${rand(n.amount)}`);
	if (o.day_of_month !== n.day_of_month) parts.push(`Day ${o.day_of_month} → ${n.day_of_month}`);
	if (o.label !== n.label) parts.push(`Name "${o.label}" → "${n.label}"`);
	if (o.category !== n.category) parts.push(`Category ${CATEGORY_LABELS[o.category] || o.category} → ${CATEGORY_LABELS[n.category] || n.category}`);
	if ((o.note || '') !== (n.note || '')) parts.push('Note changed');
	if ((o.bond_months_remaining ?? null) !== (n.bond_months_remaining ?? null)) parts.push(`Bond months left ${o.bond_months_remaining ?? '—'} → ${n.bond_months_remaining ?? '—'}`);
	if ((o.paid_on ?? null) !== (n.paid_on ?? null)) parts.push(`Date paid ${dayLabel(o.paid_on)} → ${dayLabel(n.paid_on)}`);
	return parts.join('; ') || 'No visible change';
}

export async function renderCashflow(root) {
	const content = renderShell(root, { activeHref: '#/admin/cashflow', title: 'Cashflow' });
	let items = [];
	let properties = [];
	let unassigned = { count: 0, totals: null };
	let totals = null;
	let view = 'all'; // 'all' or a property id as a string
	let editing = null; // { mode: 'add', direction } or { mode: 'edit', item }
	let tab = 'overview';
	let rentPanel = null; // { includeVacant, data, loading, error }
	let oneOffs = [];
	let actual = { this_month: '0.00', all_time: '0.00' };
	let canEdit = true;

	content.innerHTML = `
		<div class="cashflow">
			<div class="pagehead">
				<h2>Cashflow</h2>
				<p>Monthly money in and out, kept separately for each property.</p>
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
		rentPanel = null;
		draw();
	});

	async function load() {
		try {
			const data = await apiFetch('/cashflow');
			items = data.items;
			properties = data.properties;
			unassigned = data.unassigned;
			totals = data.totals;
			oneOffs = data.one_offs || [];
			actual = data.actual || actual;
			canEdit = data.can_edit !== false;
			if (view !== 'all' && !properties.some((p) => String(p.id) === view)) view = 'all';
			draw();
		} catch (err) {
			body.innerHTML = `<div class="card"><p class="error-text">${escapeHtml(err.message)}</p></div>`;
		}
	}

	function draw() {
		drawTabs();
		if (tab === 'history') drawHistory();
		else drawOverview();
		const intro = content.querySelector('.pagehead p');
		if (intro) intro.textContent = canEdit
			? 'Monthly money in and out, kept separately for each property. Only the owner can change it.'
			: 'Monthly money in and out, kept separately for each property. You have view-only access.';
	}

	function kpiHtml(t) {
		return `
			<div class="kpi-grid">
				<div class="kpi"><div class="num cf-in">${escapeHtml(rand(t.in))}</div><div class="lbl">Money in / month</div></div>
				<div class="kpi"><div class="num cf-out">${escapeHtml(rand(t.out))}</div><div class="lbl">Money out / month</div></div>
				<div class="kpi"><div class="num ${netClass(t.status)}">${escapeHtml(netLabel(t.net))}</div><div class="lbl">Net per month <span class="cf-status ${t.status}">${STATUS_LABELS[t.status]}</span></div></div>
			</div>
		`;
	}

	function propertySelectHtml() {
		const districts = new Set(properties.map((p) => p.district_name));
		const label = (p) => (districts.size > 1 ? `${p.name} · ${p.district_name}` : p.name);
		return `
			<div class="cf-property-pick">
				<label class="field-label" for="cf-property">Property</label>
				<select class="field" id="cf-property">
					<option value="all"${view === 'all' ? ' selected' : ''}>All properties (portfolio)</option>
					${properties.map((p) => `<option value="${escapeAttr(p.id)}"${String(p.id) === view ? ' selected' : ''}>${escapeHtml(label(p))}</option>`).join('')}
				</select>
			</div>
		`;
	}

	function bondLine(item) {
		if (item.category !== 'bond_payment' || item.kind === 'one_off') return '';
		if (!item.bond) return '<div class="small muted">Months left not set. Edit this item to add them.</div>';
		const b = item.bond;
		if (b.completed) return '<div class="small cf-in">Bond fully paid off. No longer counted in the monthly total.</div>';
		return `<div class="small muted">${b.months_remaining} month${b.months_remaining === 1 ? '' : 's'} left · Paid so far ${escapeHtml(rand(b.paid))} · Still to pay ${escapeHtml(rand(b.remaining))}</div>`;
	}

	function oneOffRow(item) {
		return `
			<tr>
				<td>${escapeHtml(item.label)}<div class="small muted">${escapeHtml(CATEGORY_LABELS[item.category] || item.category)}${item.source === 'maintenance' ? ' · Auto-recorded' : ''}${item.note ? ' · ' + escapeHtml(item.note) : ''}</div></td>
				<td>${escapeHtml(dayLabel(item.paid_on))}</td>
				<td class="cf-amount cf-out">${escapeHtml(rand(item.amount))}</td>
				<td class="small">${escapeHtml(when(item.amount_updated_at))}<div class="small muted">by ${escapeHtml(item.amount_updated_by_name || 'unknown')}</div></td>
				<td>${canEdit ? `<button class="btn secondary sm" type="button" data-edit="${escapeAttr(item.id)}">Edit</button>` : ''}</td>
			</tr>
		`;
	}

	function oneOffCard(property) {
		const rows = oneOffs.filter((i) => String(i.property_id) === view);
		const a = property.actual || { this_month: '0.00', all_time: '0.00' };
		return `
			<div class="card">
				<div class="row" style="margin-bottom:10px;">
					<b class="cf-out">Payments actually made</b>
					${canEdit ? '<button class="btn secondary sm" type="button" data-add="out" data-kind="one_off">+ Add payment</button>' : ''}
				</div>
				<p class="small muted" style="margin:0 0 10px;">One-off money out, such as repairs and maintenance. Maintenance paid through the app is added here automatically. This month: <b>${escapeHtml(rand(a.this_month))}</b> · All time: <b>${escapeHtml(rand(a.all_time))}</b></p>
				${rows.length === 0 ? '<p class="small muted">No one-off payments recorded yet.</p>' : `
					<div class="table-wrap">
						<table class="simple">
							<thead><tr><th>Payment</th><th>Date paid</th><th class="cf-amount">Amount</th><th>Amount last updated</th><th></th></tr></thead>
							<tbody>${rows.map(oneOffRow).join('')}</tbody>
						</table>
					</div>`}
			</div>
		`;
	}

	function itemRow(item, showDirection) {
		const cls = item.direction === 'in' ? 'cf-in' : 'cf-out';
		return `
			<tr>
				<td>${escapeHtml(item.label)}<div class="small muted">${showDirection ? `<span class="${cls}">${item.direction === 'in' ? 'Money in' : 'Money out'}</span> · ` : ''}${escapeHtml(CATEGORY_LABELS[item.category] || item.category)}${item.note ? ' · ' + escapeHtml(item.note) : ''}</div>${bondLine(item)}</td>
				<td>${item.day_of_month}<div class="small muted">Next ${escapeHtml(nextOccurrence(item.day_of_month))}</div></td>
				<td class="cf-amount ${cls}">${escapeHtml(rand(item.amount))}</td>
				<td class="small">${escapeHtml(when(item.amount_updated_at))}<div class="small muted">by ${escapeHtml(item.amount_updated_by_name || 'unknown')}</div></td>
				<td>${canEdit ? `<button class="btn secondary sm" type="button" data-edit="${escapeAttr(item.id)}">Edit</button>` : ''}</td>
			</tr>
		`;
	}

	function listCard(direction, title, rows) {
		const cls = direction === 'in' ? 'cf-in' : 'cf-out';
		const total = rows.reduce((sum, r) => sum + cents(r.amount), 0);
		return `
			<div class="card">
				<div class="row" style="margin-bottom:10px;">
					<b class="${cls}">${escapeHtml(title)}</b>
					${canEdit ? `<span class="cf-head-actions">
						${direction === 'in' ? '<button class="btn secondary sm" type="button" data-rent>Fill from unit rents</button>' : ''}
						<button class="btn secondary sm" type="button" data-add="${direction}">+ Add</button>
					</span>` : ''}
				</div>
				${rows.length === 0 ? '<p class="small muted">Nothing added yet.</p>' : `
					<div class="table-wrap">
						<table class="simple">
							<thead><tr><th>Item</th><th>Day</th><th class="cf-amount">Amount</th><th>Amount last updated</th><th></th></tr></thead>
							<tbody>${rows.map((r) => itemRow(r, false)).join('')}
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
		const isOneOff = (isEdit ? item.kind : editing.kind) === 'one_off';
		const needsProperty = isEdit && item.property_id == null;
		const selected = properties.find((p) => String(p.id) === view);
		const startCategory = item.category || (isOneOff ? 'maintenance' : CATEGORIES[direction][0]);
		const showBond = !isOneOff && startCategory === 'bond_payment';
		const bondMonthsValue = item.bond && !item.bond.completed ? item.bond.months_remaining : '';
		const where = selected ? ' — ' + selected.name : '';
		const heading = isEdit
			? (isOneOff ? 'Edit payment' : 'Edit item')
			: isOneOff ? `Add a payment made${where}` : `${direction === 'in' ? 'Add money in' : 'Add money out'}${where}`;
		return `
			<div class="card" id="cf-editor">
				<b>${escapeHtml(heading)}</b>
				<form id="cf-form" novalidate style="margin-top:10px;">
					${needsProperty ? `
						<label class="field-label" for="cf-assign">Property</label>
						<select class="field" id="cf-assign">
							<option value="">Choose a property…</option>
							${properties.map((p) => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.name)} · ${escapeHtml(p.district_name)}</option>`).join('')}
						</select>
						<p class="small muted" style="margin:-4px 0 10px;">This item was entered before properties were required. Once it is assigned it can't be moved to another property.</p>
					` : ''}
					<label class="field-label" for="cf-category">Category</label>
					<select class="field" id="cf-category">${categoryOptions(direction, startCategory)}</select>
					${isOneOff ? '' : `
						<div id="cf-bond-wrap" ${showBond ? '' : 'hidden'}>
							<label class="field-label" for="cf-bond-months">Months left on the bond</label>
							<input class="field" id="cf-bond-months" type="number" min="1" max="600" inputmode="numeric" value="${escapeAttr(bondMonthsValue)}">
							<p class="small muted" style="margin:-4px 0 10px;">The amount still to pay is worked out automatically: months left × the monthly amount. Each due date that passes counts as one month paid.</p>
						</div>`}
					<label class="field-label" for="cf-label">Name</label>
					<input class="field" id="cf-label" maxlength="100" placeholder="${isOneOff ? 'e.g. Geyser replacement' : 'e.g. Standard Bank bond'}" value="${escapeAttr(item.label || '')}">
					<div class="grid2">
						<div>
							<label class="field-label" for="cf-amount">Amount (R)</label>
							<input class="field" id="cf-amount" inputmode="decimal" placeholder="0.00" value="${escapeAttr(item.amount || '')}">
						</div>
						<div>
							${isOneOff ? `
								<label class="field-label" for="cf-paid-on">Date paid</label>
								<input class="field" id="cf-paid-on" type="date" max="${todayIso()}" value="${escapeAttr(item.paid_on || todayIso())}">
							`:`
								<label class="field-label" for="cf-day">Day of the month</label>
								<input class="field" id="cf-day" type="number" min="1" max="31" inputmode="numeric" value="${escapeAttr(item.day_of_month || '')}">
							`}
						</div>
					</div>
					<label class="field-label" for="cf-note">Note (optional)</label>
					<input class="field" id="cf-note" maxlength="300" value="${escapeAttr(item.note || '')}">
					${isEdit ? `
						<label class="field-label" for="cf-reason">Reason for change</label>
						<textarea class="field" id="cf-reason" rows="2" maxlength="300" placeholder="Required when the amount, the date, the months left or the property changes, or to remove the item"></textarea>
					` : ''}
					<div class="row" style="gap:8px; flex-wrap:wrap; margin-top:10px;">
						<button class="btn brass" type="submit" id="cf-save">${isEdit ? 'Save changes' : isOneOff ? 'Add payment' : 'Add item'}</button>
						<button class="btn secondary" type="button" data-cancel>Cancel</button>
						${isEdit ? '<button class="btn danger" type="button" data-archive>Remove item</button>' : ''}
					</div>
				</form>
			</div>
		`;
	}

	function drawAll() {
		const rows = properties.map((p) => `
			<tr>
				<td>${escapeHtml(p.name)}<div class="small muted">${escapeHtml(p.district_name)}${p.item_count ? '' : ' · nothing added yet'}</div></td>
				<td class="cf-amount cf-in">${escapeHtml(rand(p.totals.in))}</td>
				<td class="cf-amount cf-out">${escapeHtml(rand(p.totals.out))}</td>
				<td class="cf-amount ${netClass(p.totals.status)}">${escapeHtml(netLabel(p.totals.net))}</td>
				<td>${p.item_count ? `<span class="cf-status ${p.totals.status}">${STATUS_LABELS[p.totals.status]}</span>` : '<span class="small muted">—</span>'}</td>
				<td><button class="btn secondary sm" type="button" data-open="${escapeAttr(p.id)}">Open</button></td>
			</tr>
		`).join('');

		const unassignedRows = items.filter((i) => i.property_id == null);

		body.innerHTML = `
			${propertySelectHtml()}
			<p class="small muted" style="margin:0 0 6px;">Whole portfolio, all properties added together.</p>
			${kpiHtml(totals)}
			<p class="small muted" style="margin:-4px 0 12px;">Payments actually made (one-off, including maintenance): this month <b>${escapeHtml(rand(actual.this_month))}</b> · all time <b>${escapeHtml(rand(actual.all_time))}</b></p>
			<div id="cf-editor-slot">${editing ? editorHtml() : ''}</div>
			<div id="cf-rent-slot"></div>
			${unassignedRows.length ? `
				<div class="card cf-unassigned">
					<b>Unassigned items (${unassignedRows.length})</b>
					<p class="small muted" style="margin:4px 0 10px;">These were entered before each item had to belong to a property. Edit each one to assign it. They still count in the portfolio total above.</p>
					<div class="table-wrap">
						<table class="simple">
							<thead><tr><th>Item</th><th>Day</th><th class="cf-amount">Amount</th><th>Amount last updated</th><th></th></tr></thead>
							<tbody>${unassignedRows.map((r) => itemRow(r, true)).join('')}</tbody>
						</table>
					</div>
				</div>
			` : ''}
			<div class="card">
				<b>Properties</b>
				${properties.length === 0 ? '<p class="small muted" style="margin-top:8px;">Add a property on the Properties page first. Cashflow is recorded per property.</p>' : `
					<div class="table-wrap" style="margin-top:10px;">
						<table class="simple">
							<thead><tr><th>Property</th><th class="cf-amount">In</th><th class="cf-amount">Out</th><th class="cf-amount">Net</th><th>Result</th><th></th></tr></thead>
							<tbody>${rows}</tbody>
						</table>
					</div>`}
			</div>
		`;
		if (editing) body.querySelector('#cf-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function drawProperty() {
		const property = properties.find((p) => String(p.id) === view);
		const rows = items.filter((i) => String(i.property_id) === view);
		body.innerHTML = `
			${propertySelectHtml()}
			<div class="row" style="margin-bottom:10px;">
				<b class="serif">${escapeHtml(property.name)}</b>
				<button class="btn secondary sm" type="button" data-back>← All properties</button>
			</div>
			<p class="small muted" style="margin:0 0 6px;">Every amount is a monthly figure for this property. An item set to the 29th–31st falls on the last day of shorter months. Changes to amounts and dates need a reason and are recorded in History.</p>
			${kpiHtml(property.totals)}
			<div id="cf-editor-slot">${editing ? editorHtml() : ''}</div>
			<div id="cf-rent-slot">${rentPanel ? rentPanelHtml() : ''}</div>
			${listCard('in', 'Money in', rows.filter((r) => r.direction === 'in'))}
			${listCard('out', 'Money out', rows.filter((r) => r.direction === 'out'))}
			${oneOffCard(property)}
		`;
		if (editing) body.querySelector('#cf-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	function drawOverview() {
		if (view === 'all') drawAll();
		else drawProperty();
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
								<td>${escapeHtml(h.item_label)}<div class="small muted">${h.property_name ? escapeHtml(h.property_name) + ' · ' : ''}<span class="${h.direction === 'in' ? 'cf-in' : 'cf-out'}">${h.direction === 'in' ? 'Money in' : 'Money out'}</span></div></td>
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
		const isOneOff = (isEdit ? item.kind : editing.kind) === 'one_off';
		const assigning = isEdit && item.property_id == null;
		const category = body.querySelector('#cf-category').value;
		const label = body.querySelector('#cf-label').value.trim();
		const dayRaw = isOneOff ? '' : body.querySelector('#cf-day').value.trim();
		const paidOn = isOneOff ? body.querySelector('#cf-paid-on').value : '';
		const amountRaw = normaliseAmount(body.querySelector('#cf-amount').value);
		const note = body.querySelector('#cf-note').value.trim();
		const reason = isEdit ? body.querySelector('#cf-reason').value.trim() : '';
		const isBond = !isOneOff && category === 'bond_payment';
		const monthsRaw = isBond ? body.querySelector('#cf-bond-months').value.trim() : '';
		const propertyId = assigning ? Number(body.querySelector('#cf-assign').value) : Number(view);

		if (!isEdit && !propertyId) return toast('Choose a property first.');
		if (assigning && !propertyId) return toast('Choose which property this item belongs to.');
		if (!label) return toast('Enter a name for this item.');
		if (isOneOff) {
			if (!paidOn || paidOn > todayIso()) return toast('Enter the date the payment was made (today or earlier).');
		} else if (!/^\d{1,2}$/.test(dayRaw) || Number(dayRaw) < 1 || Number(dayRaw) > 31) {
			return toast('Enter a day of the month between 1 and 31.');
		}
		if (!AMOUNT_PATTERN.test(amountRaw) || Number(amountRaw) <= 0) return toast('Enter an amount above zero with at most 2 decimals.');
		if (isBond) {
			const settled = isEdit && item.bond && item.bond.completed && !monthsRaw;
			if (!settled && (!/^\d{1,3}$/.test(monthsRaw) || Number(monthsRaw) < 1 || Number(monthsRaw) > 600)) {
				return toast('Enter how many months are left on the bond (1 to 600).');
			}
		}

		const saveBtn = body.querySelector('#cf-save');
		const idle = saveBtn.textContent;
		const dateFields = isOneOff ? { paid_on: paidOn } : { day_of_month: Number(dayRaw) };
		const bondFields = isBond && monthsRaw ? { bond_months_remaining: Number(monthsRaw) } : {};

		try {
			if (!isEdit) {
				saveBtn.disabled = true;
				saveBtn.textContent = 'Saving...';
				await apiFetch('/cashflow', {
					method: 'POST',
					body: { property_id: propertyId, direction, category, label, amount: amountRaw, note, kind: isOneOff ? 'one_off' : 'monthly', ...dateFields, ...bondFields },
				});
				toast(isOneOff ? 'Payment added.' : 'Item added.');
			} else {
				const amountChanged = cents(amountRaw) !== cents(item.amount);
				const dateChanged = isOneOff ? paidOn !== item.paid_on : Number(dayRaw) !== item.day_of_month;
				const monthsChanged = Boolean(bondFields.bond_months_remaining) && (!item.bond || bondFields.bond_months_remaining !== item.bond.months_remaining);
				if ((amountChanged || dateChanged || monthsChanged || assigning) && reason.length < 5) {
					return toast('Please give a reason (at least 5 characters) for changing the amount, the date, the months left or the property.');
				}
				if (amountChanged || dateChanged || monthsChanged || assigning) {
					const lines = [];
					if (assigning) lines.push(`Property: ${properties.find((p) => p.id === propertyId)?.name || 'selected property'}`);
					if (amountChanged) lines.push(`Amount: ${rand(item.amount)} → ${rand(amountRaw)}`);
					if (dateChanged) lines.push(isOneOff ? `Date paid: ${dayLabel(item.paid_on)} → ${dayLabel(paidOn)}` : `Day: ${item.day_of_month} → ${Number(dayRaw)}`);
					if (monthsChanged) lines.push(`Bond months left: ${item.bond ? item.bond.months_remaining : 'not set'} → ${bondFields.bond_months_remaining}`);
					if (!window.confirm(`Change "${item.label}"?\n\n${lines.join('\n')}\n\nThis will be recorded in History.`)) return;
				}
				saveBtn.disabled = true;
				saveBtn.textContent = 'Saving...';
				await apiFetch(`/cashflow/${encodeURIComponent(item.id)}`, {
					method: 'PATCH',
					body: {
						category, label, amount: amountRaw, note, reason, expected_version: item.version,
						...dateFields, ...bondFields,
						...(assigning ? { property_id: propertyId } : {}),
					},
				});
				toast('Changes saved.');
			}
			editing = null;
			rentPanel = null;
			await load();
		} catch (err) {
			toast(err.message || 'Could not save.');
			if (String(err.message).includes('changed by someone else')) {
				editing = null;
				rentPanel = null;
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
			rentPanel = null;
			await load();
		} catch (err) {
			toast(err.message || 'Could not remove the item.');
			if (String(err.message).includes('changed by someone else')) {
				editing = null;
				rentPanel = null;
				await load();
			}
		}
	}

	function rentPanelHtml() {
		const p = rentPanel;
		const d = p.data;
		let inner;
		if (p.loading) {
			inner = '<p class="small muted">Loading unit rents...</p>';
		} else if (p.error) {
			inner = `<p class="error-text">${escapeHtml(p.error)}</p>`;
		} else {
			inner = `
				<label class="cf-check"><input type="checkbox" id="cf-rent-vacant" ${p.includeVacant ? 'checked' : ''}> <span class="small">Include vacant units</span></label>
				<p class="small muted" style="margin:6px 0 10px;">${d.units_counted} of ${d.units_total} units counted${d.units_without_rent ? ` · ${d.units_without_rent} with no rent set are skipped` : ''}.</p>
				${d.groups.length ? `
					<div class="table-wrap">
						<table class="simple">
							<thead><tr><th>Rent due on day</th><th class="cf-amount">Units</th><th class="cf-amount">Monthly rent</th></tr></thead>
							<tbody>
								${d.groups.map((g) => `<tr><td>${g.day}</td><td class="cf-amount">${g.units}</td><td class="cf-amount cf-in">${escapeHtml(rand(g.total))}</td></tr>`).join('')}
								<tr class="cf-total-row"><td colspan="2">Total per month</td><td class="cf-amount cf-in">${escapeHtml(rand(d.total))}</td></tr>
							</tbody>
						</table>
					</div>
				` : '<p class="small muted">No unit rents to add. Set the rent on each unit first (Properties page).</p>'}
				${d.already_added ? '<p class="error-text">Rent from units was already added for this property. Edit or remove those items first.</p>' : ''}
			`;
		}
		const canConfirm = !p.loading && !p.error && d && d.groups.length > 0 && !d.already_added;
		return `
			<div class="card" id="cf-rent">
				<b>Fill from unit rents</b>
				<p class="small muted" style="margin:4px 0 10px;">Creates ordinary money-in items from the rent set on this property's units. You can edit or remove them afterwards. They are not kept in sync, so update them by hand if a unit's rent changes.</p>
				${inner}
				<div class="row" style="gap:8px; flex-wrap:wrap; margin-top:10px;">
					<button class="btn brass" type="button" data-rent-confirm ${canConfirm ? '' : 'disabled'}>Add these rent items</button>
					<button class="btn secondary" type="button" data-rent-cancel>Cancel</button>
				</div>
			</div>
		`;
	}

	async function loadRentPreview() {
		rentPanel.loading = true;
		rentPanel.error = '';
		drawOverview();
		try {
			rentPanel.data = await apiFetch(`/cashflow/rent-preview?property_id=${encodeURIComponent(view)}&include_vacant=${rentPanel.includeVacant}`);
		} catch (err) {
			rentPanel.data = null;
			rentPanel.error = err.message || 'Could not load unit rents.';
		}
		rentPanel.loading = false;
		drawOverview();
	}

	function openRentPanel() {
		editing = null;
		rentPanel = { includeVacant: false, data: null, loading: true, error: '' };
		loadRentPreview();
		body.querySelector('#cf-rent')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	async function confirmRentPanel() {
		const d = rentPanel?.data;
		if (!d || !d.groups.length) return;
		if (!window.confirm(`Add ${d.groups.length} rent item${d.groups.length === 1 ? '' : 's'} totalling ${rand(d.total)} per month?`)) return;
		try {
			await apiFetch('/cashflow/rent-from-units', {
				method: 'POST',
				body: { property_id: Number(view), include_vacant: rentPanel.includeVacant, expected_total: d.total },
			});
			toast('Rent items added.');
			rentPanel = null;
			await load();
		} catch (err) {
			toast(err.message || 'Could not add the rent items.');
			if (String(err.message).includes('changed since')) await loadRentPreview();
		}
	}

	body.addEventListener('click', (event) => {
		const add = event.target.closest('[data-add]');
		const edit = event.target.closest('[data-edit]');
		const open = event.target.closest('[data-open]');
		if (!canEdit && (add || edit || event.target.closest('[data-rent]') || event.target.closest('[data-archive]') || event.target.closest('[data-rent-confirm]'))) return;
		if (add) {
			editing = { mode: 'add', direction: add.dataset.add, kind: add.dataset.kind || 'monthly' };
			rentPanel = null;
			drawOverview();
		} else if (edit) {
			const item = items.concat(oneOffs).find((i) => String(i.id) === edit.dataset.edit);
			if (item) {
				editing = { mode: 'edit', item };
				rentPanel = null;
				drawOverview();
			}
		} else if (open) {
			view = open.dataset.open;
			editing = null;
			rentPanel = null;
			drawOverview();
		} else if (event.target.closest('[data-back]')) {
			view = 'all';
			editing = null;
			rentPanel = null;
			drawOverview();
		} else if (event.target.closest('[data-cancel]')) {
			editing = null;
			rentPanel = null;
			drawOverview();
		} else if (event.target.closest('[data-archive]')) {
			archiveCurrent();
		} else if (event.target.closest('[data-rent]')) {
			openRentPanel();
		} else if (event.target.closest('[data-rent-cancel]')) {
			rentPanel = null;
			drawOverview();
		} else if (event.target.closest('[data-rent-confirm]')) {
			confirmRentPanel();
		}
	});

	body.addEventListener('change', (event) => {
		if (event.target.id === 'cf-category') {
			const wrap = body.querySelector('#cf-bond-wrap');
			if (wrap) wrap.hidden = event.target.value !== 'bond_payment';
			return;
		}
		if (event.target.id === 'cf-rent-vacant' && rentPanel) {
			rentPanel.includeVacant = event.target.checked;
			loadRentPreview();
			return;
		}
		if (event.target.id !== 'cf-property') return;
		view = event.target.value;
		editing = null;
		rentPanel = null;
		drawOverview();
	});

	body.addEventListener('submit', (event) => {
		if (event.target.id !== 'cf-form') return;
		event.preventDefault();
		submitForm();
	});

	await load();
}
