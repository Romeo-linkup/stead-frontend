import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { toast } from '../shared/toast.js';

const scoreOf = p => p.current_score ?? p.score_percent;

export async function renderProperties(root) {
	const content = renderShell(root, { activeHref: '#/admin/properties', title: 'Properties' });
	content.innerHTML = `
		<div class="pagehead"><h2>Properties</h2><p>Evaluate every property. District and overall scores are calculated automatically once all of their properties have been evaluated.</p></div>
		<div id="properties-content">Loading...</div>
	`;

	await loadPropertiesData(content);
}

async function loadPropertiesData(content) {
	const container = content.querySelector('#properties-content');
	try {
		const [properties, summary] = await Promise.all([
			apiFetch('/properties'),
			apiFetch('/evaluations/summary'),
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
	} catch (err) {
		container.innerHTML = `<div class="card"><p class="error-text">${escapeHtml(err.message)}</p></div>`;
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