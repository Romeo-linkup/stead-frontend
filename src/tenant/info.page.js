import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { toast } from '../shared/toast.js';

export function renderInfo(root) {
	const content = renderShell(root, { activeHref: '#/tenant/info', title: 'Information' });

	content.innerHTML = `
		<div class="pagehead">
			<h2>Information</h2>
		</div>
		<div class="card">
			<b class="small">Building rules</b>
			<div id="info-building-rules"></div>
		</div>
		<div class="card">
			<b class="small">Utilities</b>
			<div id="info-utilities"></div>
		</div>
		<div class="card">
			<b class="small">Leaving the property</b>
			<div id="info-leaving-property"></div>
		</div>
		<div class="card">
			<b class="small">Contacts</b>
			<div id="info-contacts"></div>
		</div>
	`;

	loadTenantInfo(content);
}

async function loadTenantInfo(content) {
	try {
		const data = await apiFetch('/district-info');
		renderTenantSection(content, 'building_rules', data.sections.building_rules);
		for (const key of ['utilities', 'leaving_property', 'contacts']) {
			renderTenantSection(content, key, data.sections[key]);
		}
	} catch (err) {
		toast(err.message || 'Could not load property information.');
		renderTenantSection(content, 'building_rules', 'Could not load this section.');
		for (const key of ['utilities', 'leaving_property', 'contacts']) {
			renderTenantSection(content, key, 'Could not load this section.');
		}
	}
}

function renderTenantSection(content, key, value) {
	const target = content.querySelector(`#info-${key}`);
	if (key === 'building_rules') {
		const items = String(value ?? '').split(/\r?\n/).filter((line) => line.trim());
		target.innerHTML = `<ul class="small muted" style="margin:8px 0 0; padding-left:18px; line-height:1.8;">${items.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`;
		return;
	}

	target.innerHTML = `<p class="small muted" style="margin:8px 0 0;">${escapeHtml(value).replace(/\r?\n/g, '<br>')}</p>`;
}

function escapeHtml(value) {
	const div = document.createElement('div');
	div.textContent = value == null ? '' : String(value);
	return div.innerHTML;
}
