import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { getCurrentUser } from '../auth/session.js';
import { toast } from '../shared/toast.js';

export function renderInfo(root) {
	const content = renderShell(root, { activeHref: '#/provider/info', title: 'Site information' });

	content.innerHTML = `
		<div class="pagehead">
			<h2>Site information</h2>
			<p id="site-subtitle">Loading...</p>
		</div>
		<div class="card">
			<b class="small">Access</b>
			<div id="provider-access"></div>
		</div>
	`;

	loadSiteInfo();
}

async function loadSiteInfo() {
	const subtitle = document.getElementById('site-subtitle');
	try {
		const user = getCurrentUser();
		// The JWT payload only carries district_id, not a name — look it up.
		// (session.js's getCurrentUser() decodes the token client-side; it
		// never had a district_name field to read in the first place.)
		const districts = await apiFetch('/districts');
		const district = districts.find((d) => d.id === user.district_id);
		subtitle.textContent = district ? district.name : 'Your district';
	} catch (err) {
		console.error('Failed to load site info:', err);
		subtitle.textContent = '';
	}

	const access = document.getElementById('provider-access');
	try {
		const data = await apiFetch('/district-info');
		access.innerHTML = `<p class="small muted" style="margin:8px 0 0;">${escapeHtml(data.sections.access).replace(/\r?\n/g, '<br>')}</p>`;
	} catch (err) {
		toast(err.message || 'Could not load site information.');
		access.innerHTML = '<p class="small muted" style="margin:8px 0 0;">Could not load this section.</p>';
	}
}

function escapeHtml(value) {
	const div = document.createElement('div');
	div.textContent = value == null ? '' : String(value);
	return div.innerHTML;
}