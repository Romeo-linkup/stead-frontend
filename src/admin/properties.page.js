import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { toast } from '../shared/toast.js';
import { parseUnitNumbers } from '../shared/units.js';
import { getCurrentUser } from '../auth/session.js';

const scoreOf = p => p.current_score ?? p.score_percent;

export async function renderProperties(root) {
	const content = renderShell(root, { activeHref: '#/admin/properties', title: 'Properties' });
	const user = getCurrentUser();
	const isOwner = user?.role === 'owner';

	content.innerHTML = `
		<div class="pagehead"><h2>Properties</h2><p>Evaluate every property. District and overall scores are calculated automatically once all of their properties have been evaluated.</p></div>
		<div id="add-property-card"></div>
		<div id="properties-content">Loading...</div>
	`;

	await renderAddProperty(content, isOwner);
	await loadPropertiesData(content);
}

async function renderAddProperty(content, isOwner) {
	const container = content.querySelector('#add-property-card');
	let districtOptions = '';
	if (isOwner) {
		try {
			const districts = await apiFetch('/districts');
			districtOptions = districts
				.map((d) => `<option value="${escapeAttr(d.id)}">${escapeHtml(d.name)}</option>`)
				.join('');
		} catch (err) {
			districtOptions = '';
		}
	}

	container.innerHTML = `
		<details class="card" open>
			<summary class="serif" style="cursor:pointer;">Add property</summary>
			<form id="add-property-form" style="margin-top:10px;">
				${isOwner ? `
				<div class="field">
					<label class="field-label" for="ap-district">District</label>
					<select class="field" id="ap-district" required>${districtOptions}</select>
				</div>
				` : ''}
				<div class="field">
					<label class="field-label" for="ap-name">Property name</label>
					<input class="field" id="ap-name" maxlength="100" required>
				</div>
				<div class="field">
					<label class="field-label" for="ap-address">Address</label>
					<input class="field" id="ap-address" maxlength="200">
				</div>
				<div class="field">
					<label class="field-label" for="ap-units">Unit numbers</label>
					<textarea class="field" id="ap-units" rows="3" placeholder="e.g. 101, 102, 103-110"></textarea>
					<small class="muted">Separate with commas, spaces or new lines. Ranges like 101-110 work. <span id="ap-unit-count">0 units</span></small>
				</div>
				<button class="btn brass" type="submit" id="ap-submit">Create property</button>
				<div id="ap-error" class="error-text" style="display:none;"></div>
			</form>
		</details>
	`;

	const unitsTextarea = container.querySelector('#ap-units');
	const countEl = container.querySelector('#ap-unit-count');
	unitsTextarea.addEventListener('input', () => {
		try {
			const units = parseUnitNumbers(unitsTextarea.value);
			countEl.textContent = `${units.length} units`;
		} catch (err) {
			countEl.textContent = '0 units';
		}
	});

	container.querySelector('#add-property-form').addEventListener('submit', async (e) => {
		e.preventDefault();
		const form = e.target;
		const button = form.querySelector('#ap-submit');
		const errorBox = form.querySelector('#ap-error');
		errorBox.style.display = 'none';

		const name = form.querySelector('#ap-name').value.trim();
		const address = form.querySelector('#ap-address').value.trim();
		let unitNumbers = [];
		try {
			unitNumbers = parseUnitNumbers(unitsTextarea.value);
		} catch (err) {
			errorBox.textContent = err.message;
			errorBox.style.display = 'block';
			return;
		}

		button.disabled = true;
		try {
			const districtId = isOwner ? Number(form.querySelector('#ap-district').value) : null;
			const property = await apiFetch('/properties', {
				method: 'POST',
				body: { district_id: districtId, name, address },
			});
			if (unitNumbers.length) {
				await apiFetch('/units/bulk', {
					method: 'POST',
					body: { property_id: property.id, units: unitNumbers },
				});
			}
			toast('Property created.');
			form.reset();
			countEl.textContent = '0 units';
			await loadPropertiesData(content);
		} catch (err) {
			errorBox.textContent = err.message || 'Could not create property.';
			errorBox.style.display = 'block';
			toast(err.message || 'Could not create property.');
		} finally {
			button.disabled = false;
		}
	});
}

async function loadPropertiesData(content) {
	const container = content.querySelector('#properties-content');
	try {
		const [properties, summary, units] = await Promise.all([
			apiFetch('/properties'),
			apiFetch('/evaluations/summary'),
			apiFetch('/units').catch(() => []),
		]);

		if (!properties.length) {
			container.innerHTML = '<div class="card"><p class="small muted">No properties yet.</p></div>';
			return;
		}

		const portfolio = summary.portfolio;
		const overallCard = `
			<div class="card">
				<div class="row">
					<b class="small">Overall condition</b>
					<span class="small" style="font-weight:700;">${portfolio.complete ? Math.round(portfolio.average_score) + '%' : 'Pending'}</span>
				</div>
				<div class="score-bar"><div style="width:${portfolio.complete ? portfolio.average_score : 0}%;"></div></div>
				<p class="small muted" style="margin:8px 0 0;">${portfolio.complete ? 'Average of all ' + portfolio.property_count + ' properties' : portfolio.evaluated_count + ' of ' + portfolio.property_count + ' properties evaluated'}</p>
			</div>
		`;

		const propertiesByDistrict = groupBy(properties, 'district_id');
		const unitsByProperty = groupBy(units, 'property_id');
		const districts = summary.districts;
		let html = overallCard;

		districts.sort((a, b) => a.district_name.localeCompare(b.district_name)).forEach(district => {
			const districtProps = propertiesByDistrict[district.district_id] || [];
			if (!districtProps.length) return;

			districtProps.sort((a, b) => {
				const aScore = scoreOf(a);
				const bScore = scoreOf(b);
				if (aScore === null && bScore !== null) return -1;
				if (aScore !== null && bScore === null) return 1;
				return a.name.localeCompare(b.name);
			});

			html += `
				<div class="row" style="margin:18px 0 8px;">
					<b>${escapeHtml(district.district_name)}</b>
					<span class="small muted">${district.evaluated_count} of ${district.property_count} evaluated</span>
				</div>
				<div class="card">
					<div class="row">
						<b class="small">District score</b>
						<span class="small" style="font-weight:700;">${district.complete ? Math.round(district.average_score) + '%' : 'Pending'}</span>
					</div>
					<div class="score-bar"><div style="width:${district.complete ? district.average_score : 0}%;"></div></div>
					<p class="small muted" style="margin:8px 0 0;">${district.complete ? 'Average of ' + district.property_count + ' properties' : 'Evaluate the remaining ' + (district.property_count - district.evaluated_count) + ' to see the district score'}</p>
				</div>
			`;

			districtProps.forEach(property => {
				const score = scoreOf(property) !== null ? Number(scoreOf(property)) : null;
				const scoreText = score !== null ? '<b>' + score.toFixed(1) + '%</b>' : '<span class="badge outstanding">Needs evaluation</span>';
				const scoreWidth = score !== null ? Math.max(0, Math.min(100, score)) : 0;
				const scoreDate = property.score_created_at ? new Date(property.score_created_at).toLocaleDateString('en-ZA') : '';
				const buttonText = score !== null ? 'Re-evaluate' : 'Evaluate';
				const propertyUnits = unitsByProperty[property.id] || [];

				html += `
					<div class="card">
						<div class="row">
							<div>
								<b class="serif">${escapeHtml(property.name)}</b>
								<div class="small muted">${escapeHtml(property.address || 'No address recorded')} · ${property.unit_count} unit(s)</div>
							</div>
							<span>${scoreText}</span>
						</div>
						<div class="score-bar" style="background:var(--brass);"><div style="width:${scoreWidth}%;"></div></div>
						${scoreDate ? '<p class="small muted">Last evaluated ' + escapeHtml(scoreDate) + '</p>' : ''}
						<form class="evaluation-form" data-property-id="${property.id}">
							<div class="grid2">
								<div>
									<label class="field-label">Score (%)</label>
									<input class="field" type="number" min="0" max="100" step="0.01" required value="${score !== null ? score : ''}">
								</div>
								<div>
									<label class="field-label">Notes</label>
									<input class="field" type="text" maxlength="500">
								</div>
							</div>
							<button class="btn brass" type="submit">${buttonText}</button>
						</form>
						${renderUnitsDisclosure(property, propertyUnits)}
					</div>
				`;
			});
		});

		container.innerHTML = html;

		container.querySelectorAll('.evaluation-form').forEach(form => {
			form.addEventListener('submit', async event => {
				event.preventDefault();
				const input = form.querySelector('input[type="number"]');
				const button = form.querySelector('button');
				const score = Number(input.value);

				if (!Number.isFinite(score) || score < 0 || score > 100) {
					toast('Enter a score between 0 and 100.');
					return;
				}

				button.disabled = true;
				const scrollY = window.scrollY;

				try {
					await apiFetch('/evaluations', {
						method: 'POST',
						body: {
							property_id: Number(form.dataset.propertyId),
							score_percent: score,
							notes: form.querySelector('input[type="text"]').value.trim(),
						},
					});
					toast('Evaluation saved.');
					await loadPropertiesData(content);
					window.scrollTo(0, scrollY);
				} catch (err) {
					toast(err.message || 'Could not save evaluation.');
					button.disabled = false;
				}
			});
		});

		wireUnitsEvents(content);
	} catch (err) {
		container.innerHTML = `<div class="card"><p class="error-text">${escapeHtml(err.message)}</p></div>`;
	}
}

function renderUnitsDisclosure(property, units) {
	const unitRows = units.map(unit => {
		const tenant = unit.tenant_name ? escapeHtml(unit.tenant_name) : 'Vacant';
		return `
			<div class="unit-row" data-unit-id="${escapeAttr(unit.id)}" style="border-top:1px solid var(--line); padding:8px 0;">
				<div class="row" style="align-items:center;">
					<div style="flex:1; min-width:0;">
						<b class="small">${escapeHtml(unit.unit_number)}</b>
						<div class="small muted">${escapeHtml(tenant)}</div>
					</div>
					<div class="small muted" style="text-align:right;">
						<div>Rent: ${unit.rent_amount != null ? 'R ' + escapeHtml(Number(unit.rent_amount).toFixed(2)) : '—'}</div>
						<div>Due: ${escapeHtml(String(unit.rent_due_day ?? 1))}</div>
					</div>
					<div class="row" style="margin-left:8px;">
						<button class="btn secondary sm unit-edit-btn" type="button" data-id="${escapeAttr(unit.id)}">Edit</button>
						<button class="btn danger sm unit-delete-btn" type="button" data-id="${escapeAttr(unit.id)}" data-number="${escapeAttr(unit.unit_number)}">Delete</button>
					</div>
				</div>
				<div class="unit-edit-panel" style="display:none; margin-top:8px;">
					<div class="grid2">
						<div class="field">
							<label class="field-label">Unit number</label>
							<input class="field unit-number-input" maxlength="20" value="${escapeAttr(unit.unit_number)}">
						</div>
						<div class="field">
							<label class="field-label">Rent (R)</label>
							<input class="field unit-rent-input" type="number" min="0" step="0.01" value="${unit.rent_amount != null ? escapeAttr(Number(unit.rent_amount).toFixed(2)) : ''}">
						</div>
						<div class="field">
							<label class="field-label">Due day</label>
							<input class="field unit-due-input" type="number" min="1" max="31" value="${escapeAttr(String(unit.rent_due_day ?? 1))}">
						</div>
					</div>
					<div class="row">
						<button class="btn brass sm unit-save-btn" type="button" data-id="${escapeAttr(unit.id)}">Save</button>
						<button class="btn secondary sm unit-cancel-btn" type="button">Cancel</button>
					</div>
				</div>
			</div>
		`;
	}).join('');

	return `
		<details class="units-disclosure" style="margin-top:12px;">
			<summary class="small" style="cursor:pointer;">Units (${units.length})</summary>
			<div class="units-list" style="margin-top:8px;">
				${unitRows || '<p class="small muted">No units yet.</p>'}
				<div class="add-units" style="margin-top:10px;">
					<div class="field">
						<label class="field-label">Add units</label>
						<textarea class="field add-units-textarea" rows="2" placeholder="e.g. 201, 202, 203-210"></textarea>
						<small class="muted">Separate with commas, spaces or new lines. Ranges work.</small>
					</div>
					<button class="btn secondary sm add-units-btn" type="button" data-property-id="${escapeAttr(property.id)}">Add units</button>
				</div>
			</div>
		</details>
	`;
}

function wireUnitsEvents(content) {
	// Edit toggle
	content.querySelectorAll('.unit-edit-btn').forEach(btn => {
		btn.addEventListener('click', () => {
			const row = btn.closest('.unit-row');
			const panel = row.querySelector('.unit-edit-panel');
			panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
		});
	});

	// Cancel edit
	content.querySelectorAll('.unit-cancel-btn').forEach(btn => {
		btn.addEventListener('click', () => {
			const row = btn.closest('.unit-row');
			row.querySelector('.unit-edit-panel').style.display = 'none';
		});
	});

	// Save edit
	content.querySelectorAll('.unit-save-btn').forEach(btn => {
		btn.addEventListener('click', async () => {
			const row = btn.closest('.unit-row');
			const unitId = btn.dataset.id;
			const number = row.querySelector('.unit-number-input').value.trim();
			const rent = row.querySelector('.unit-rent-input').value;
			const due = row.querySelector('.unit-due-input').value;

			if (!number) {
				toast('Unit number is required.');
				return;
			}

			const body = {};
			if (number) body.unit_number = number;
			if (rent !== '' && rent != null) body.rent_amount = Number(rent);
			if (due !== '' && due != null) body.rent_due_day = Number(due);

			btn.disabled = true;
			try {
				await apiFetch(`/units/${encodeURIComponent(unitId)}`, { method: 'PATCH', body });
				toast('Unit updated.');
				const disclosure = btn.closest('.units-disclosure');
				const card = btn.closest('.card');
				const scrollY = window.scrollY;
				await refreshUnits(card);
				if (disclosure) disclosure.open = true;
				window.scrollTo(0, scrollY);
			} catch (err) {
				toast(err.message || 'Could not update unit.');
			} finally {
				btn.disabled = false;
			}
		});
	});

	// Delete unit
	content.querySelectorAll('.unit-delete-btn').forEach(btn => {
		btn.addEventListener('click', async () => {
			const number = btn.dataset.number || 'this unit';
			if (!confirm(`Delete unit ${number}?`)) return;
			btn.disabled = true;
			try {
				await apiFetch(`/units/${encodeURIComponent(btn.dataset.id)}`, { method: 'DELETE' });
				toast('Unit deleted.');
				const card = btn.closest('.card');
				await refreshUnits(card);
			} catch (err) {
				toast(err.message || 'Could not delete unit.');
			} finally {
				btn.disabled = false;
			}
		});
	});

	// Add units
	content.querySelectorAll('.add-units-btn').forEach(btn => {
		btn.addEventListener('click', async () => {
			const card = btn.closest('.card');
			const disclosure = btn.closest('.units-disclosure');
			const textarea = card.querySelector('.add-units-textarea');
			const propertyId = btn.dataset.propertyId;
			let units;
			try {
				units = parseUnitNumbers(textarea.value);
			} catch (err) {
				toast(err.message);
				return;
			}
			if (!units.length) {
				toast('Enter at least one unit number.');
				return;
			}

			btn.disabled = true;
			try {
				await apiFetch('/units/bulk', {
					method: 'POST',
					body: { property_id: Number(propertyId), units },
				});
				toast('Units added.');
				textarea.value = '';
				const scrollY = window.scrollY;
				await refreshUnits(card);
				if (disclosure) disclosure.open = true;
				window.scrollTo(0, scrollY);
			} catch (err) {
				toast(err.message || 'Could not add units.');
			} finally {
				btn.disabled = false;
			}
		});
	});
}

async function refreshUnits(card) {
	const propertyId = card.querySelector('.evaluation-form')?.dataset.propertyId;
	if (!propertyId) return;
	try {
		const units = await apiFetch('/units');
		const propertyUnits = units.filter((u) => String(u.property_id) === String(propertyId));
		const disclosure = card.querySelector('.units-disclosure');
		if (disclosure) {
			const open = disclosure.open;
			disclosure.outerHTML = renderUnitsDisclosure({ id: propertyId }, propertyUnits);
			const newDisclosure = card.querySelector('.units-disclosure');
			if (newDisclosure) newDisclosure.open = open;
			wireUnitsEvents(card.closest('#properties-content') || card);
		}
	} catch (err) {
		// leave the existing units list in place
	}
}

function groupBy(array, key) {
	return array.reduce((result, item) => {
		const group = item[key];
		if (!result[group]) result[group] = [];
		result[group].push(item);
		return result;
	}, {});
}

function escapeHtml(value) {
	const div = document.createElement('div');
	div.textContent = value == null ? '' : String(value);
	return div.innerHTML;
}

function escapeAttr(value) {
	return String(value == null ? '' : value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}
