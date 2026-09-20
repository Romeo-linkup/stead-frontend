import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';

export function renderMaintenance(root) {
	const content = renderShell(root, { activeHref: '#/admin/maintenance', title: 'Maintenance' });

	content.innerHTML = `
		<div class="pagehead">
			<h2>Maintenance</h2>
			<p>Across all districts</p>
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
		const [maintenance, providers] = await Promise.all([
			apiFetch('/maintenance'),
			apiFetch('/users?role=service_provider').catch(() => []),
		]);
		renderMaintenanceCards(maintenance, providers);
	} catch (err) {
		console.error('Failed to load maintenance data:', err);
		document.getElementById('maintenance-cards').innerHTML =
			'<div class="card"><p style="color:var(--slate);">Failed to load maintenance requests</p></div>';
	}
}

function renderMaintenanceCards(maintenance, providers) {
	const container = document.getElementById('maintenance-cards');
	if (!container) return;

	if (maintenance.length === 0) {
		container.innerHTML = '<div class="card"><p style="color:var(--slate);">No maintenance requests</p></div>';
		return;
	}

	container.innerHTML = maintenance
		.map((task) => {
			const statusClass =
				task.status === 'outstanding' ? 'outstanding' : task.status === 'pending' ? 'pending' : 'finished';
			const statusLabel = task.status.charAt(0).toUpperCase() + task.status.slice(1);

			// Real provider select instead of the placeholder "assign to provider #1".
			let actionHtml = '';
			if (task.status === 'outstanding') {
				actionHtml = `
					<div class="field" style="margin-top:8px;">
						<select class="assign-select" data-task-id="${task.id}">
							<option value="">Assign to service provider...</option>
							${providers
								.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}${p.service_specialty ? ` — ${escapeHtml(p.service_specialty)}` : ''}</option>`)
								.join('')}
						</select>
					</div>
				`;
			}

			let photoSection = '';
			if (task.status === 'finished' && task.before_photo_url && task.after_photo_url) {
				photoSection = `
					<div class="taskimg-row">
						<a href="${escapeAttr(task.before_photo_url)}" target="_blank" rel="noopener" class="taskimg filled">Before</a>
						<a href="${escapeAttr(task.after_photo_url)}" target="_blank" rel="noopener" class="taskimg filled">After</a>
					</div>
				`;
			}

			return `
				<div class="card">
					<div class="row">
						<b class="small">${escapeHtml(task.description || 'Untitled task')}</b>
						<span class="badge ${statusClass}">${statusLabel}</span>
					</div>
					<p class="small muted" style="margin:6px 0;">${escapeHtml(task.property_name || 'Unknown property')}, Unit ${escapeHtml(task.unit_number || 'Unknown')}</p>
					${actionHtml}
					${photoSection}
				</div>
			`;
		})
		.join('');

	container.querySelectorAll('.assign-select').forEach((select) => {
		select.addEventListener('change', async () => {
			const taskId = select.dataset.taskId;
			const assignedTo = select.value;
			if (!assignedTo) return;
			select.disabled = true;
			try {
				await apiFetch(`/maintenance/${taskId}/assign`, {
					method: 'PATCH',
					body: { assigned_to: Number(assignedTo) },
				});
				loadMaintenanceData();
			} catch (err) {
				alert(err.message || 'Failed to assign maintenance request');
				select.disabled = false;
			}
		});
	});
}

function escapeAttr(str) {
	return String(str || '').replace(/"/g, '&quot;');
}

function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = text || '';
	return div.innerHTML;
}