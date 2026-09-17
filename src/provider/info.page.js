import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { getCurrentUser } from '../auth/session.js';

export function renderInfo(root) {
	const content = renderShell(root, { activeHref: '#/provider/info', title: 'Site information' });

	content.innerHTML = `
		<div class="pagehead">
			<h2>Site information</h2>
			<p id="site-subtitle">Loading...</p>
		</div>
		<div class="card">
			<b class="small">Access</b>
			<p class="small muted">Gate code changes monthly — check Notices. Sign in at the office before entering any unit.</p>
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
}