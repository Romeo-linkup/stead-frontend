import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';

export async function renderAudit(root) {
	const content = renderShell(root, { activeHref: '#/admin/audit', title: 'Audit log' });
	content.innerHTML = `
		<div class="pagehead"><h2>Audit log</h2><p>Review state-changing actions across the system.</p></div>
		<div class="card">
			<form id="audit-filters" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;align-items:end;">
				<div class="field" style="margin:0;"><label for="audit-district">District</label><select id="audit-district" name="district_id"><option value="">All districts</option></select></div>
				<div class="field" style="margin:0;"><label for="audit-actor">Actor ID</label><input id="audit-actor" name="actor_id" type="number" min="1" placeholder="Any actor"></div>
				<div class="field" style="margin:0;"><label for="audit-from">From</label><input id="audit-from" name="date_from" type="date"></div>
				<div class="field" style="margin:0;"><label for="audit-to">To</label><input id="audit-to" name="date_to" type="date"></div>
				<button class="btn btn-primary" type="submit">Apply filters</button>
			</form>
		</div>
		<div class="card"><div id="audit-list">Loading...</div></div>
	`;

	const districtSelect = content.querySelector('#audit-district');
	try {
		const districts = await apiFetch('/districts');
		districtSelect.innerHTML += districts.map(district => `<option value="${district.id}">${escapeHtml(district.name)}</option>`).join('');
	} catch (err) {
		districtSelect.insertAdjacentHTML('afterend', `<div class="error-text">${escapeHtml(err.message)}</div>`);
	}

	async function loadAudit() {
		const form = content.querySelector('#audit-filters');
		const params = new URLSearchParams();
		for (const [key, value] of new FormData(form).entries()) {
			if (value) params.set(key, value);
		}

		const list = content.querySelector('#audit-list');
		try {
			const rows = await apiFetch(`/audit${params.toString() ? `?${params}` : ''}`);
			if (!rows.length) {
				list.innerHTML = '<p style="color:var(--slate);">No audit entries match these filters.</p>';
				return;
			}
			list.innerHTML = `<div style="overflow-x:auto;"><table class="list"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>District</th></tr></thead><tbody>${rows.map(row => `<tr><td>${escapeHtml(formatDate(row.created_at))}</td><td>${escapeHtml(row.actor_name || row.actor_role || 'System')}</td><td>${escapeHtml(row.action)}</td><td>${escapeHtml(`${row.entity_type || '-'}${row.entity_id ? ` #${row.entity_id}` : ''}`)}</td><td>${escapeHtml(row.district_id == null ? '-' : row.district_id)}</td></tr>`).join('')}</tbody></table></div>`;
		} catch (err) {
			list.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
		}
	}

	content.querySelector('#audit-filters').addEventListener('submit', event => {
		event.preventDefault();
		loadAudit();
	});

	await loadAudit();
}

function formatDate(value) {
	return new Date(value).toLocaleString();
}

function escapeHtml(value) {
	const div = document.createElement('div');
	div.textContent = value == null ? '' : String(value);
	return div.innerHTML;
}
