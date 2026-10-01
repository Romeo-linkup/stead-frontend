import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';

export async function renderAudit(root) {
	const content = renderShell(root, { activeHref: '#/admin/audit', title: 'Audit log' });
	content.innerHTML = `
		<div class="pagehead"><h2>Audit log</h2><p>Review state-changing actions across the system.</p></div>
		<div class="card">
			<form id="audit-filters">
				<div class="grid2">
					<div><label class="field-label" for="audit-district">District</label><select class="field" id="audit-district" name="district_id"><option value="">All districts</option></select></div>
					<div><label class="field-label" for="audit-actor">Actor ID</label><input class="field" id="audit-actor" name="actor_id" type="number" min="1" placeholder="Any actor"></div>
					<div><label class="field-label" for="audit-from">From</label><input class="field" id="audit-from" name="date_from" type="date"></div>
					<div><label class="field-label" for="audit-to">To</label><input class="field" id="audit-to" name="date_to" type="date"></div>
				</div>
				<button class="btn brass" type="submit">Apply filters</button>
			</form>
		</div>
		<div class="card"><div id="audit-list">Loading...</div></div>
	`;

	const districtSelect = content.querySelector('#audit-district');
	const districtNames = new Map();
	try {
		const districts = await apiFetch('/districts');
		for (const district of districts) {
			districtNames.set(String(district.id), district.name);
		}
		districtSelect.innerHTML += districts.map(district => `<option value="${escapeHtml(district.id)}">${escapeHtml(district.name)}</option>`).join('');
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
			list.innerHTML = `<div class="table-wrap"><table class="simple"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>District</th></tr></thead><tbody>${rows.map(row => `<tr><td>${escapeHtml(formatDate(row.created_at))}</td><td>${escapeHtml(row.actor_name || row.actor_role || 'System')}</td><td>${escapeHtml(row.action)}</td><td>${escapeHtml(`${row.entity_type || '-'}${row.entity_id ? ` #${row.entity_id}` : ''}`)}</td><td>${escapeHtml(row.district_id == null ? '-' : districtNames.get(String(row.district_id)) || '-')}</td></tr>`).join('')}</tbody></table></div>`;
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
