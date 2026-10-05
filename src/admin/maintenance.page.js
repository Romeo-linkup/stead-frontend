// src/admin/maintenance.page.js
import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { getCurrentUser } from '../auth/session.js';
import { toast } from '../shared/toast.js';
import { capitalise } from '../shared/format.js';
import {
  getHashQuery,
  renderTabBar,
  wireTabBar,
  groupByArea,
  renderAssetReport,
  ASSET_CONDITIONS,
  CONDITION_LABELS,
  escapeHtml,
  escapeAttr,
} from '../shared/assets.js';

// outstanding first, then pending, then finished.
const STATUS_ORDER = { outstanding: 0, pending: 1, finished: 2 };
const KNOWN_STATUS = { outstanding: 'outstanding', pending: 'pending', finished: 'finished' };

// Survives a re-render so the inline assign panel can close itself.
let currentTasks = [];
let providers = [];
let providersLoaded = false;
let openAssignId = null;
let invoicesByTask = new Map();

export async function renderMaintenance(root) {
	const content = renderShell(root, { activeHref: '#/admin/maintenance', title: 'Maintenance' });
	currentTasks = [];
	providers = [];
	providersLoaded = false;
	openAssignId = null;

	const query = getHashQuery();
	const tab = query.tab || 'requests';

	// Printable "Building & Assets List" report mode.
	if (query.print === '1' && tab === 'assets') {
		await renderAssetReport(content, query.unit_id, '#/admin/maintenance');
		return;
	}

	content.innerHTML = `
		<div class="pagehead">
			<h2>Maintenance</h2>
			<p id="maintenance-scope">Across all districts</p>
		</div>
		${renderTabBar(tab, '#/admin/maintenance')}
		<div id="requests-pane"${tab === 'assets' ? ' hidden' : ''}>
			<div id="maintenance-cards">
				<div class="card"><p style="color:var(--slate);">Loading maintenance requests...</p></div>
			</div>
		</div>
		<div id="assets-pane"${tab === 'assets' ? '' : ' hidden'}>
			<div id="assets-content"><p class="small muted">Loading...</p></div>
		</div>
	`;

	wireTabBar(content);

	loadMaintenanceData();

	if (tab === 'assets') {
		await loadAssetsPane(content);
	}
}

// ===== Assets register (editable) =====

function conditionOptions(selected) {
	const options = [['', 'Not assessed']].concat(
		ASSET_CONDITIONS.map((c) => [c, CONDITION_LABELS[c]])
	);
	return options
		.map(
			([value, label]) =>
				`<option value="${escapeAttr(value)}"${value === selected ? ' selected' : ''}>${escapeHtml(label)}</option>`
		)
		.join('');
}

function unitOptionLabel(unit) {
	return `${unit.property_name || 'Property'} - Unit ${unit.unit_number || '?'}`;
}

function buildUnitOptions(units) {
	const groups = [];
	const index = new Map();
	for (const unit of units) {
		const name = unit.property_name || 'Property';
		let group = index.get(name);
		if (!group) {
			group = { name, units: [] };
			index.set(name, group);
			groups.push(group);
		}
		group.units.push(unit);
	}
	return groups
		.map(
			(group) =>
				`<optgroup label="${escapeAttr(group.name)}">${group.units
					.map((u) => `<option value="${escapeAttr(u.id)}">${escapeHtml(unitOptionLabel(u))}</option>`)
					.join('')}</optgroup>`
		)
		.join('');
}

async function loadAssetsPane(content) {
	const container = content.querySelector('#assets-content');
	if (!container) return;

	let units = [];
	try {
		units = await apiFetch('/units');
	} catch (err) {
		container.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
		return;
	}

	container.innerHTML = `
		<div class="card">
			<label class="field-label" for="asset-unit-select">Unit</label>
			<select class="field" id="asset-unit-select">
				<option value="">Choose a unit…</option>
				${buildUnitOptions(units)}
			</select>
			<div id="assets-unit-view"><p class="small muted">Select a unit to view its assets.</p></div>
		</div>
	`;

	const select = container.querySelector('#asset-unit-select');
	const view = container.querySelector('#assets-unit-view');
	select.addEventListener('change', () => {
		const unitId = select.value;
		if (!unitId) {
			view.innerHTML = '<p class="small muted">Select a unit to view its assets.</p>';
			return;
		}
		renderAssetsForUnit(view, unitId, units);
	});
}

async function renderAssetsForUnit(container, unitId, allUnits) {
	container.innerHTML = '<p class="small muted">Loading...</p>';

	let data;
	try {
		data = await apiFetch(`/assets?unit_id=${encodeURIComponent(unitId)}`);
	} catch (err) {
		container.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
		return;
	}

	const assets = Array.isArray(data.assets) ? data.assets : [];
	const unit = data.unit || {};

	if (assets.length === 0) {
		renderEmptyState(container, unitId, allUnits);
		return;
	}

	const groups = groupByArea(assets);
	const areas = assets.map((a) => a.area).filter(Boolean);
	const datalistOptions = [...new Set(areas)]
		.map((a) => `<option value="${escapeAttr(a)}">`)
		.join('');

	const rowsHtml = groups
		.map((group) => {
			const areaRow = `<tr class="area-row"><td colspan="5"><b>${escapeHtml(group.area)}</b></td></tr>`;
			const assetRows = group.assets
				.map(
					(a) => `
					<tr data-asset-id="${escapeAttr(a.id)}">
						<td><input class="field asset-item" style="margin-bottom:0;" value="${escapeAttr(a.item)}"></td>
						<td><select class="field asset-condition" style="margin-bottom:0;">${conditionOptions(a.condition)}</select></td>
						<td><input class="field asset-comments" style="margin-bottom:0;" value="${escapeAttr(a.comments)}"></td>
						<td><button class="btn brass sm asset-save" type="button">Save</button></td>
						<td><button class="btn danger sm asset-delete" type="button">Delete</button></td>
					</tr>
				`
				)
				.join('');
			return areaRow + assetRows;
		})
		.join('');

	container.innerHTML = `
		<div class="row" style="margin-bottom:10px;">
			<b class="small">${escapeHtml(unit.unit_number || '')} · ${escapeHtml(unit.property_name || '')}</b>
			<button class="btn secondary sm" id="print-report-btn" type="button">Print report</button>
		</div>
		<div class="table-wrap">
			<table class="simple">
				<thead>
					<tr><th>Asset</th><th>Condition</th><th>Comments</th><th></th><th></th></tr>
				</thead>
				<tbody>${rowsHtml}</tbody>
			</table>
		</div>
		<datalist id="asset-area-list">${datalistOptions}</datalist>
		<div class="card" style="margin-top:12px;">
			<b class="small">Add asset</b>
			<div class="grid2" style="margin-top:8px;">
				<div>
					<label class="field-label" for="new-area">Area</label>
					<input class="field" id="new-area" list="asset-area-list" placeholder="e.g. Kitchen">
				</div>
				<div>
					<label class="field-label" for="new-item">Asset</label>
					<input class="field" id="new-item" placeholder="e.g. Sink + tap">
				</div>
				<div>
					<label class="field-label" for="new-condition">Condition</label>
					<select class="field" id="new-condition">${conditionOptions(null)}</select>
				</div>
				<div>
					<label class="field-label" for="new-comments">Comments</label>
					<input class="field" id="new-comments">
				</div>
			</div>
			<button class="btn brass sm" id="add-asset-btn" type="button">Add asset</button>
		</div>
	`;

	wireEditableTable(container, unitId, allUnits);
}

function renderEmptyState(container, unitId, allUnits) {
	const copyOptions = allUnits
		.filter((u) => String(u.id) !== String(unitId))
		.map((u) => `<option value="${escapeAttr(u.id)}">${escapeHtml(unitOptionLabel(u))}</option>`)
		.join('');

	container.innerHTML = `
		<div class="card">
			<div class="row" style="margin-bottom:10px;">
				<b class="small">No assets have been recorded for this unit yet.</b>
				<button class="btn secondary sm" id="print-report-btn" type="button">Print report</button>
			</div>
			<div class="row" style="flex-wrap:wrap; gap:8px; align-items:flex-end;">
				<button class="btn brass sm" id="apply-template-btn" type="button">Use standard list</button>
				<select class="field" id="copy-from-select" style="max-width:260px; margin-bottom:0;">
					<option value="">Copy from unit…</option>
					${copyOptions}
				</select>
				<button class="btn secondary sm" id="copy-btn" type="button" disabled>Copy</button>
			</div>
		</div>
	`;

	const applyBtn = container.querySelector('#apply-template-btn');
	const copySelect = container.querySelector('#copy-from-select');
	const copyBtn = container.querySelector('#copy-btn');
	const printBtn = container.querySelector('#print-report-btn');

	if (printBtn) {
		printBtn.addEventListener('click', () => {
			window.location.hash = `#/admin/maintenance?tab=assets&print=1&unit_id=${encodeURIComponent(unitId)}`;
		});
	}

	if (copySelect && copyBtn) {
		copySelect.addEventListener('change', () => {
			copyBtn.disabled = !copySelect.value;
		});
	}

	if (applyBtn) {
		applyBtn.addEventListener('click', async () => {
			applyBtn.disabled = true;
			const idle = applyBtn.textContent;
			applyBtn.textContent = 'Applying...';
			try {
				await apiFetch('/assets/apply-template', {
					method: 'POST',
					body: { unit_id: Number(unitId) },
				});
				toast('Standard list applied.');
				await renderAssetsForUnit(container, unitId, allUnits);
			} catch (err) {
				toast(err.message || 'Could not apply the standard list.');
				applyBtn.disabled = false;
				applyBtn.textContent = idle;
			}
		});
	}

	if (copyBtn) {
		copyBtn.addEventListener('click', async () => {
			if (!copySelect.value) return;
			copyBtn.disabled = true;
			const idle = copyBtn.textContent;
			copyBtn.textContent = 'Copying...';
			try {
				await apiFetch('/assets/copy', {
					method: 'POST',
					body: { from_unit_id: Number(copySelect.value), to_unit_id: Number(unitId) },
				});
				toast('Assets copied.');
				await renderAssetsForUnit(container, unitId, allUnits);
			} catch (err) {
				toast(err.message || 'Could not copy assets.');
				copyBtn.disabled = false;
				copyBtn.textContent = idle;
			}
		});
	}
}

function wireEditableTable(container, unitId, allUnits) {
	container.querySelectorAll('.asset-save').forEach((btn) => {
		btn.addEventListener('click', async () => {
			const row = btn.closest('tr');
			const assetId = row.dataset.assetId;
			const item = row.querySelector('.asset-item').value;
			const condition = row.querySelector('.asset-condition').value;
			const comments = row.querySelector('.asset-comments').value;

			if (!item.trim()) {
				toast('Asset is required.');
				return;
			}

			btn.disabled = true;
			const idle = btn.textContent;
			btn.textContent = 'Saving...';
			try {
				await apiFetch(`/assets/${encodeURIComponent(assetId)}`, {
					method: 'PATCH',
					body: { item: item.trim(), condition: condition || null, comments: comments.trim() },
				});
				toast('Asset saved.');
				await renderAssetsForUnit(container, unitId, allUnits);
			} catch (err) {
				toast(err.message || 'Could not save asset.');
				btn.disabled = false;
				btn.textContent = idle;
			}
		});
	});

	container.querySelectorAll('.asset-delete').forEach((btn) => {
		btn.addEventListener('click', async () => {
			const row = btn.closest('tr');
			const assetId = row.dataset.assetId;
			if (!confirm('Delete this asset?')) return;
			btn.disabled = true;
			try {
				await apiFetch(`/assets/${encodeURIComponent(assetId)}`, { method: 'DELETE' });
				toast('Asset deleted.');
				await renderAssetsForUnit(container, unitId, allUnits);
			} catch (err) {
				toast(err.message || 'Could not delete asset.');
				btn.disabled = false;
			}
		});
	});

	const addBtn = container.querySelector('#add-asset-btn');
	if (addBtn) {
		addBtn.addEventListener('click', async () => {
			const area = container.querySelector('#new-area').value;
			const item = container.querySelector('#new-item').value;
			const condition = container.querySelector('#new-condition').value;
			const comments = container.querySelector('#new-comments').value;

			if (!item.trim()) {
				toast('Asset is required.');
				return;
			}

			addBtn.disabled = true;
			const idle = addBtn.textContent;
			addBtn.textContent = 'Adding...';
			try {
				await apiFetch('/assets', {
					method: 'POST',
					body: {
						unit_id: Number(unitId),
						area: area.trim() || null,
						item: item.trim(),
						condition: condition || null,
						comments: comments.trim() || null,
					},
				});
				toast('Asset added.');
				await renderAssetsForUnit(container, unitId, allUnits);
			} catch (err) {
				toast(err.message || 'Could not add asset.');
				addBtn.disabled = false;
				addBtn.textContent = idle;
			}
		});
	}

	const printBtn = container.querySelector('#print-report-btn');
	if (printBtn) {
		printBtn.addEventListener('click', () => {
			window.location.hash = `#/admin/maintenance?tab=assets&print=1&unit_id=${encodeURIComponent(unitId)}`;
		});
	}
}

// ===== Maintenance requests (unchanged) =====

async function loadMaintenanceData() {
	try {
		// apiFetch already returns parsed JSON (or throws) — no .ok/.json() needed.
		const [maintenance, providerList, invoices] = await Promise.all([
			apiFetch('/maintenance'),
			// A failure here must not sink the task list, so it is caught on its
			// own and surfaced later, when someone actually tries to assign.
			apiFetch('/users?role=service_provider')
				.then((rows) => {
					providers = Array.isArray(rows) ? rows : [];
					providersLoaded = true;
					return rows;
				})
				.catch((err) => {
					console.error('Failed to load service providers:', err);
					providers = [];
					providersLoaded = false;
					return [];
				}),
			apiFetch('/invoices').catch(() => []),
		]);
		invoicesByTask = new Map();
		[...invoices].sort((a, b) => timeOf(b.created_at) - timeOf(a.created_at)).forEach((invoice) => {
			const key = String(invoice.maintenance_request_id);
			if (!invoicesByTask.has(key)) invoicesByTask.set(key, invoice);
		});
		renderMaintenanceCards(maintenance);
	} catch (err) {
		console.error('Failed to load maintenance data:', err);
		const container = document.getElementById('maintenance-cards');
		if (container) {
			container.innerHTML =
				'<div class="card"><p style="color:var(--slate);">Failed to load maintenance requests</p></div>';
		}
	}
}

function timeOf(value) {
	const t = new Date(value).getTime();
	return Number.isNaN(t) ? 0 : t;
}

function sortTasks(tasks) {
	return [...tasks].sort((a, b) => {
		const rankA = STATUS_ORDER[a.status] ?? 3;
		const rankB = STATUS_ORDER[b.status] ?? 3;
		if (rankA !== rankB) return rankA - rankB;
		return timeOf(b.created_at) - timeOf(a.created_at);
	});
}

function truncate(text, max = 120) {
	const value = text == null ? '' : String(text);
	return value.length > max ? `${value.slice(0, max).trimEnd()}…` : value;
}

// The JWT only carries district_id, so the name comes from the task rows
// themselves (GET /maintenance returns district_id + district_name per row).
function districtNameFor(tasks, districtId) {
	const match = tasks.find((t) => t.district_id === districtId && t.district_name);
	return match ? match.district_name : null;
}

// The owner is a global viewer even though the live owner row carries a
// district_id of its own, so scope is decided by role first.
function isGlobalViewer(user) {
	return !user || user.role === 'owner' || !user.district_id;
}

// District is only worth showing when it isn't implied by the page scope.
function canSeeSeveralDistricts(user, tasks) {
	if (isGlobalViewer(user)) return true;
	const ids = new Set(tasks.map((t) => t.district_id).filter((id) => id != null));
	return ids.size > 1;
}

function scopeLabel(user, tasks) {
	if (isGlobalViewer(user)) return 'Across all districts';
	return districtNameFor(tasks, user.district_id) || `District ${user.district_id}`;
}

function renderMaintenanceCards(tasks) {
	const container = document.getElementById('maintenance-cards');
	if (!container) return;

	currentTasks = Array.isArray(tasks) ? tasks : [];
	const user = getCurrentUser() || {};

	const scope = document.getElementById('maintenance-scope');
	if (scope) scope.textContent = scopeLabel(user, currentTasks);

	if (currentTasks.length === 0) {
		container.innerHTML = '<div class="card"><p style="color:var(--slate);">No maintenance requests</p></div>';
		return;
	}

	const showDistrict = canSeeSeveralDistricts(user, currentTasks);

	container.innerHTML = sortTasks(currentTasks)
		.map((task) => {
			const status = KNOWN_STATUS[task.status] ? task.status : 'outstanding';
			const statusBlock = renderStatusBlock(task, status);
			const invoice = invoicesByTask.get(String(task.id));
			const invoiceBlock = invoice
				? `<p class="small muted" style="margin-top:8px;">Invoice ${escapeHtml(capitalise(invoice.status))} — R ${escapeHtml((Number(invoice.total) || 0).toFixed(2))} · <a href="#/admin/invoices" style="color:var(--brass-dark); font-weight:600;">view in Invoices</a></p>`
				: '';
			// dataset hands back a string while task.id is a number.
			const panel = String(openAssignId) === String(task.id) ? renderAssignPanel(task) : '';

			const where = `${task.property_name || 'Unknown property'}, Unit ${task.unit_number || 'Unknown'}${
				showDistrict && task.district_name ? ` · ${task.district_name}` : ''
			}`;

			return `
				<div class="card">
					<div class="row">
						<b class="small">${escapeHtml(task.category || 'Maintenance')}</b>
						<span class="badge ${status}">${escapeHtml(capitalise(status))}</span>
					</div>
					<p class="small muted" style="margin:6px 0 2px;">${escapeHtml(truncate(task.description, 120))}</p>
					<p class="small muted" style="margin:0 0 6px;">${escapeHtml(where)}</p>
					${statusBlock}
					${invoiceBlock}
					${panel}
				</div>
			`;
		})
		.join('');

	wireEvents();
}

function renderStatusBlock(task, status) {
	if (status === 'outstanding') {
		if (task.assigned_to) {
			return `
				<p class="small muted" style="margin:0 0 8px;">Assigned to ${escapeHtml(task.assigned_to_name || 'a service provider')} · waiting for them to accept</p>
				<button class="btn secondary sm" data-assign-open="${escapeAttr(task.id)}">Reassign</button>
			`;
		}
		return `<button class="btn secondary sm" data-assign-open="${escapeAttr(task.id)}">Assign to service provider</button>`;
	}

	if (status === 'pending') {
		return `<p class="small muted" style="margin:0;">Assigned to ${escapeHtml(task.assigned_to_name || 'a service provider')} · in progress</p>`;
	}

	// finished
	let html = '';
	if (task.before_photo_url && task.after_photo_url) {
		html += `
			<div class="taskimg-row">
				<a class="taskimg filled" href="${escapeAttr(task.before_photo_url)}" target="_blank" rel="noopener">Before</a>
				<a class="taskimg filled" href="${escapeAttr(task.after_photo_url)}" target="_blank" rel="noopener">After</a>
			</div>
		`;
	}
	if (task.assigned_to_name) {
		html += `<p class="small muted" style="margin-top:8px;">Completed by ${escapeHtml(task.assigned_to_name)}</p>`;
	}
	return html;
}

function renderAssignPanel(task) {
	const districtProviders = providers.filter((p) => p.district_id === task.district_id);

	const header = `
		<div class="row" style="margin-bottom:10px;">
			<b class="small">Assign to a service provider</b>
			<span class="small muted" style="cursor:pointer;" data-assign-cancel="1">Cancel</span>
		</div>
		<label class="field-label">Service provider</label>
	`;

	if (!providersLoaded) {
		return `<div class="invoice-box">${header}<p class="small muted" style="margin:0 0 8px;">Couldn't load service providers. Try again shortly.</p></div>`;
	}

	if (districtProviders.length === 0) {
		return `<div class="invoice-box">${header}<p class="small muted" style="margin:0 0 8px;">No service providers in this district yet. Generate a service provider code on the Codes page.</p></div>`;
	}

	const options = districtProviders
		.map((p) => `<option value="${escapeAttr(p.id)}">${escapeHtml(p.name)}</option>`)
		.join('');

	return `
		<div class="invoice-box">
			${header}
			<select class="field" data-assign-select="${escapeAttr(task.id)}">
				<option value="">Choose…</option>
				${options}
			</select>
			<button class="btn brass block" data-assign-confirm="${escapeAttr(task.id)}" disabled>Assign</button>
		</div>
	`;
}

function wireEvents() {
	const container = document.getElementById('maintenance-cards');
	if (!container) return;

	container.querySelectorAll('[data-assign-open]').forEach((btn) => {
		btn.addEventListener('click', () => {
			if (!providersLoaded) toast("Couldn't load service providers.");
			openAssignId = btn.dataset.assignOpen;
			renderMaintenanceCards(currentTasks);
		});
	});

	container.querySelectorAll('[data-assign-cancel]').forEach((el) => {
		el.addEventListener('click', () => {
			openAssignId = null;
			renderMaintenanceCards(currentTasks);
		});
	});

	container.querySelectorAll('[data-assign-select]').forEach((select) => {
		select.addEventListener('change', () => {
			const confirm = container.querySelector(`[data-assign-confirm="${select.dataset.assignSelect}"]`);
			if (confirm) confirm.disabled = !select.value;
		});
	});

	container.querySelectorAll('[data-assign-confirm]').forEach((btn) => {
		btn.addEventListener('click', () => submitAssignment(btn));
	});
}

async function submitAssignment(btn) {
	const taskId = btn.dataset.assignConfirm;
	const select = document.querySelector(`[data-assign-select="${taskId}"]`);
	if (!select || !select.value) return;

	const provider = providers.find((p) => String(p.id) === select.value);
	if (!providersLoaded) {
		toast("Couldn't load service providers.");
		return;
	}

	btn.disabled = true;
	const idleLabel = btn.textContent;
	btn.textContent = 'Assigning...';

	try {
		await apiFetch(`/maintenance/${taskId}/assign`, {
			method: 'PATCH',
			body: { assigned_to: Number(select.value) },
		});
		toast(`Assigned to ${provider ? provider.name : 'service provider'}.`);
		openAssignId = null;
		await loadMaintenanceData();
	} catch (err) {
		toast(err.message || 'Failed to assign maintenance request');
		btn.disabled = false;
		btn.textContent = idleLabel;
	}
}
