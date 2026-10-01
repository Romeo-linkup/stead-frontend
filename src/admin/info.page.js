import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { getCurrentUser } from '../auth/session.js';
import { toast } from '../shared/toast.js';

const SECTIONS = [
	{ key: 'building_rules', title: 'Building rules', hint: 'One rule per line' },
	{ key: 'utilities', title: 'Utilities' },
	{ key: 'leaving_property', title: 'Leaving the property' },
	{ key: 'contacts', title: 'Contacts' },
	{ key: 'access', title: 'Access', hint: 'Shown to service providers' },
];

export function renderInfo(root) {
	const content = renderShell(root, { activeHref: '#/admin/info', title: 'Property info' });
	const user = getCurrentUser();
	const isOwner = user.role === 'owner';

	content.innerHTML = `
		<div class="pagehead">
			<h2>Property info</h2>
			<p>What tenants and service providers see on their information pages</p>
		</div>
		${isOwner ? '<div class="field"><label class="field-label" for="info-district">District</label><select class="field" id="info-district"></select></div>' : ''}
		<div id="info-sections">
			${SECTIONS.map((section) => `
				<div class="card" data-section="${section.key}">
					<b class="small">${section.title}</b>
					${section.hint ? `<p class="small muted" style="margin:4px 0 8px;">${section.hint}</p>` : ''}
					<label class="field-label" for="section-${section.key}">${section.title}</label>
					<textarea class="field" id="section-${section.key}" rows="5"></textarea>
					<div class="row" style="gap:8px; margin-top:8px;">
						<button class="btn brass sm" type="button" data-save="${section.key}">Save</button>
						<button class="btn secondary sm" type="button" data-reset="${section.key}">Reset to default</button>
					</div>
				</div>
			`).join('')}
		</div>
	`;

	const districtSelect = content.querySelector('#info-district');
	if (isOwner) {
		districtSelect.addEventListener('change', () => loadSections(content, districtSelect.value, true));
	}
	content.querySelectorAll('[data-save], [data-reset]').forEach((button) => {
		button.addEventListener('click', () => saveSection(content, button, isOwner));
	});

	if (isOwner) {
		loadOwnerDistricts(content);
	} else {
		loadSections(content, null, false);
	}
}

async function loadOwnerDistricts(content) {
	const select = content.querySelector('#info-district');
	try {
		const districts = await apiFetch('/districts');
		select.innerHTML = districts.map((district) =>
			`<option value="${escapeAttr(district.id)}">${escapeHtml(district.name)}</option>`
		).join('');
		if (!districts.length) {
			toast('No districts available.');
			return;
		}
		select.value = String(districts[0].id);
		await loadSections(content, select.value, true);
	} catch (err) {
		toast(err.message || 'Could not load districts.');
	}
}

async function loadSections(content, districtId, isOwner) {
	const query = isOwner ? `?district_id=${encodeURIComponent(districtId)}` : '';
	try {
		const data = await apiFetch(`/district-info${query}`);
		for (const section of SECTIONS) {
			const textarea = content.querySelector(`#section-${section.key}`);
			textarea.value = data.sections[section.key] || '';
		}
	} catch (err) {
		toast(err.message || 'Could not load property information.');
	}
}

async function saveSection(content, button, isOwner) {
	const key = button.dataset.save || button.dataset.reset;
	const textarea = content.querySelector(`#section-${key}`);
	const body = button.hasAttribute('data-reset') ? '' : textarea.value;
	const districtId = content.querySelector('#info-district')?.value;
	button.disabled = true;
	try {
		await apiFetch(`/district-info/${key}`, {
			method: 'PUT',
			body: { body, ...(isOwner ? { district_id: Number(districtId) } : {}) },
		});
		toast('Saved.');
		if (button.hasAttribute('data-reset')) {
			await loadSections(content, districtId, isOwner);
		}
	} catch (err) {
		toast(err.message || 'Could not save this section.');
	} finally {
		button.disabled = false;
	}
}

function escapeHtml(value) {
	const div = document.createElement('div');
	div.textContent = value == null ? '' : String(value);
	return div.innerHTML;
}

function escapeAttr(value) {
	return escapeHtml(value).replace(/'/g, '&#39;');
}