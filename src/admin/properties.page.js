import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';

export async function renderProperties(root) {
	const content = renderShell(root, { activeHref: '#/admin/properties', title: 'Properties' });
	content.innerHTML = `
		<div class="pagehead"><h2>Properties</h2><p>Review property condition and record the latest evaluation.</p></div>
		<div id="properties-list">Loading...</div>
		<div id="properties-average"></div>
	`;

	async function loadProperties() {
		const list = content.querySelector('#properties-list');
		const averageBox = content.querySelector('#properties-average');
		try {
			const properties = await apiFetch('/properties');
			if (!properties.length) {
				list.innerHTML = '<div class="card"><p style="color:var(--slate);margin:0;">No properties yet.</p></div>';
				averageBox.innerHTML = '';
				return;
			}

			list.innerHTML = properties.map(property => {
				const score = property.current_score === null || property.current_score === undefined
					? null
					: Number(property.current_score);
				const scoreLabel = score === null ? 'Not evaluated' : `${score.toFixed(1)}%`;
				const scoreWidth = score === null ? 0 : Math.max(0, Math.min(100, score));
				return `
					<article class="card">
						<div style="display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap;">
							<div>
								<h3 class="serif" style="margin:0 0 4px;">${escapeHtml(property.name)}</h3>
								<p style="margin:0;color:var(--slate);font-size:13px;">${escapeHtml(property.address || 'No address recorded')}</p>
							</div>
							<strong style="font-size:18px;color:${score === null ? 'var(--slate)' : 'var(--brass-dark)'};">${scoreLabel}</strong>
						</div>
						<div style="height:9px;background:var(--paper2);border-radius:999px;overflow:hidden;margin:14px 0 16px;">
							<div style="height:100%;width:${scoreWidth}%;background:var(--brass);transition:width .2s ease;"></div>
						</div>
						<form class="evaluation-form" data-property-id="${property.id}" style="border-top:1px solid var(--line);padding-top:14px;">
							<div style="display:grid;grid-template-columns:minmax(120px,160px) 1fr auto;gap:10px;align-items:end;">
								<div class="field" style="margin:0;"><label>Score (%)</label><input name="score_percent" type="number" min="0" max="100" step="0.01" required placeholder="0-100"></div>
								<div class="field" style="margin:0;"><label>Notes</label><input name="notes" type="text" placeholder="Optional evaluation notes"></div>
								<button class="btn btn-primary" type="submit">Evaluate</button>
							</div>
							<div class="error-text" data-error hidden></div>
						</form>
					</article>
				`;
			}).join('');

			const evaluated = properties
				.map(p => (p.current_score === null || p.current_score === undefined ? null : Number(p.current_score)))
				.filter(score => score !== null);

			if (evaluated.length) {
				const average = evaluated.reduce((sum, s) => sum + s, 0) / evaluated.length;
				const allEvaluated = evaluated.length === properties.length;
				averageBox.innerHTML = `
					<div class="card" style="margin-top:4px;">
						<div style="display:flex;justify-content:space-between;align-items:baseline;">
							<b class="small">${allEvaluated ? 'Overall average' : `Average (${evaluated.length} of ${properties.length} evaluated)`}</b>
							<strong style="font-size:20px;color:var(--brass-dark);">${average.toFixed(1)}%</strong>
						</div>
						<div style="height:9px;background:var(--paper2);border-radius:999px;overflow:hidden;margin-top:10px;">
							<div style="height:100%;width:${Math.max(0, Math.min(100, average))}%;background:var(--forest);"></div>
						</div>
					</div>
				`;
			} else {
				averageBox.innerHTML = '';
			}
		} catch (err) {
			list.innerHTML = `<div class="card"><p class="error-text">${escapeHtml(err.message)}</p></div>`;
			averageBox.innerHTML = '';
		}
	}

	content.addEventListener('submit', async event => {
		const form = event.target.closest('.evaluation-form');
		if (!form) return;
		event.preventDefault();
		const error = form.querySelector('[data-error]');
		const button = form.querySelector('button');
		error.hidden = true;
		button.disabled = true;
		try {
			await apiFetch('/evaluations', {
				method: 'POST',
				body: {
					property_id: Number(form.dataset.propertyId),
					score_percent: Number(form.score_percent.value),
					notes: form.notes.value.trim(),
				},
			});
			await loadProperties();
		} catch (err) {
			error.textContent = err.message;
			error.hidden = false;
			button.disabled = false;
		}
	});

	await loadProperties();
}

function escapeHtml(value) {
	const div = document.createElement('div');
	div.textContent = value == null ? '' : String(value);
	return div.innerHTML;
}