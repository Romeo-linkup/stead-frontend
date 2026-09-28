// src/admin/maintenance.page.js
import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { getCurrentUser } from '../auth/session.js';
import { toast } from '../shared/toast.js';
import { capitalise } from '../shared/format.js';

// outstanding first, then pending, then finished.
const STATUS_ORDER = { outstanding: 0, pending: 1, finished: 2 };
const KNOWN_STATUS = { outstanding: 'outstanding', pending: 'pending', finished: 'finished' };

// Survives a re-render so the inline assign panel can close itself.
let currentTasks = [];
let providers = [];
let providersLoaded = false;
let openAssignId = null;

export function renderMaintenance(root) {
	const content = renderShell(root, { activeHref: '#/admin/maintenance', title: 'Maintenance' });
	currentTasks = [];
	providers = [];
	providersLoaded = false;
	openAssignId = null;

	content.innerHTML = `
		<div class="pagehead">
			<h2>Maintenance</h2>
			<p id="maintenance-scope">Across all districts</p>
		</div>
		<div id="maintenance-cards">
			<div class="card"><p style="color:var(--slate);">Loading maintenance requests...</p></div>
		</div>
	`;

	loadMaintenanceData();
}

async function loadMaintenanceData() {
	try {
		// apiFetch already returns parsed JSON (or throws) — no .ok/.json() needed.
		const [maintenance, providerList] = await Promise.all([
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
		]);
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
