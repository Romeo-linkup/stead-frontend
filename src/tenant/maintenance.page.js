// src/tenant/maintenance.page.js
import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { getCurrentUser } from '../auth/session.js';
import { toast } from '../shared/toast.js';
import { formatDueDate } from '../shared/format.js';

const CATEGORIES = ['Plumbing', 'Electrical', 'Appliance', 'Structural', 'Other'];

let tenantUnit = null;
let requests = [];

export async function renderMaintenance(root) {
	const content = renderShell(root, { activeHref: '#/tenant/maintenance', title: 'Maintenance' });
	const user = getCurrentUser();

	content.innerHTML = `
		<div class="pagehead">
			<h2>Maintenance</h2>
			<p>Report an issue or track a request</p>
		</div>
		<button class="btn secondary block" id="new-request-btn" style="margin-bottom:14px;">+ New maintenance request</button>
		<div class="card" id="request-form-card" hidden>
			<form id="maintenance-form">
				<label class="field-label">Category</label>
				<select class="field" id="category" name="category" required>
					${CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('')}
				</select>
				<label class="field-label">Description</label>
				<textarea class="field" id="description" name="description" rows="4" required placeholder="Describe the issue..."></textarea>
				<label class="field-label">Photo (optional)</label>
				<input class="field" id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp">
				<p class="small muted" style="margin:-4px 0 10px;">JPG, PNG or WEBP, max 5MB</p>
				<div id="form-error" class="error-text" style="display:none;"></div>
				<div class="row" style="gap:8px;">
					<button class="btn brass block" type="submit">Submit request</button>
					<button class="btn secondary block" type="button" id="cancel-request">Cancel</button>
				</div>
			</form>
		</div>
		<div id="requests-list"><p class="small muted">Loading...</p></div>
	`;

	try {
		const [unitData, maintenance] = await Promise.all([
			apiFetch('/units/me').catch((err) => {
				if (err.message.includes('404')) return null;
				throw err;
			}),
			apiFetch('/maintenance'),
		]);
		tenantUnit = unitData;
		requests = maintenance.filter((r) => r.unit_id === tenantUnit?.id);

		if (!tenantUnit) {
			document.getElementById('new-request-btn').hidden = true;
			document.getElementById('requests-list').innerHTML = '<p class="small muted">No unit assigned.</p>';
			return;
		}

		renderRequests();
		wireEvents();
	} catch (err) {
		console.error('Failed to load maintenance data:', err);
		document.getElementById('requests-list').innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
	}
}

function renderRequests() {
	const container = document.getElementById('requests-list');
	if (!container) return;

	if (requests.length === 0) {
		container.innerHTML = '<p class="small muted">No maintenance requests yet.</p>';
		return;
	}

	container.innerHTML = requests
		.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
		.map((r) => {
			const status = r.status || 'outstanding';
			const meta = renderMeta(r, status);
			const photos = renderPhotos(r);

			return `
				<div class="card">
					<div class="row">
						<b class="small">${escapeHtml(r.category || 'Maintenance')}</b>
						<span class="badge ${status}">${escapeHtml(capitalise(status))}</span>
					</div>
					<p class="small muted" style="margin:6px 0 2px;">${escapeHtml(truncate(r.description, 120))}</p>
					<p class="small muted" style="margin:0 0 6px;">${escapeHtml(meta)}</p>
					${photos}
				</div>
			`;
		})
		.join('');
}

function renderMeta(request, status) {
	const reportedDate = formatDueDate(request.created_at, 'short');

	if (status === 'outstanding') {
		if (request.assigned_to_name) {
			return `Reported ${reportedDate} · assigned to ${escapeHtml(request.assigned_to_name)}`;
		}
		return `Reported ${reportedDate} · not yet assigned`;
	}

	if (status === 'pending') {
		return `Reported ${reportedDate} · assigned to ${escapeHtml(request.assigned_to_name || 'a service provider')}`;
	}

	// finished
	let meta = `Reported ${reportedDate} · closed ${formatDueDate(request.updated_at, 'short')}`;
	if (request.assigned_to_name) {
		meta += ` by ${escapeHtml(request.assigned_to_name)}`;
	}
	return meta;
}

function renderPhotos(request) {
	if (request.status === 'finished' && request.before_photo_url && request.after_photo_url) {
		return `
			<div class="taskimg-row">
				<a class="taskimg filled" href="${escapeAttr(request.before_photo_url)}" target="_blank" rel="noopener">Before photo</a>
				<a class="taskimg filled" href="${escapeAttr(request.after_photo_url)}" target="_blank" rel="noopener">After photo</a>
			</div>
		`;
	}

	if (request.before_photo_url) {
		return `<a class="small" style="color:var(--brass-dark);" href="${escapeAttr(request.before_photo_url)}" target="_blank" rel="noopener">View your photo</a>`;
	}

	return '';
}

function wireEvents() {
	const newRequestBtn = document.getElementById('new-request-btn');
	const formCard = document.getElementById('request-form-card');
	const cancelBtn = document.getElementById('cancel-request');
	const form = document.getElementById('maintenance-form');

	newRequestBtn?.addEventListener('click', () => {
		formCard.hidden = false;
	});

	cancelBtn?.addEventListener('click', () => {
		formCard.hidden = true;
		form.reset();
		document.getElementById('form-error').style.display = 'none';
	});

	form?.addEventListener('submit', async (e) => {
		e.preventDefault();
		const errorBox = document.getElementById('form-error');
		const submitBtn = form.querySelector('button[type="submit"]');
		errorBox.style.display = 'none';

		if (!tenantUnit) {
			errorBox.textContent = 'No unit assigned.';
			errorBox.style.display = 'block';
			return;
		}

		const photoInput = form.querySelector('#photo');
		if (photoInput.files[0]) {
			const file = photoInput.files[0];
			const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
			if (!allowedTypes.includes(file.type)) {
				errorBox.textContent = 'Please upload a JPG, PNG, or WEBP image.';
				errorBox.style.display = 'block';
				return;
			}
			if (file.size > 5 * 1024 * 1024) {
				errorBox.textContent = 'File size must be 5MB or less.';
				errorBox.style.display = 'block';
				return;
			}
		}

		submitBtn.disabled = true;
		const idleLabel = submitBtn.textContent;
		submitBtn.textContent = 'Submitting...';

		try {
			const formData = new FormData();
			formData.append('unit_id', tenantUnit.id);
			formData.append('category', form.category.value);
			formData.append('description', form.description.value);
			if (photoInput.files[0]) {
				formData.append('photo', photoInput.files[0]);
			}

			await apiFetch('/maintenance', {
				method: 'POST',
				body: formData,
				isFormData: true,
			});

			form.reset();
			formCard.hidden = true;
			toast('Request submitted.');

			// Reload requests
			const maintenance = await apiFetch('/maintenance');
			requests = maintenance.filter((r) => r.unit_id === tenantUnit.id);
			renderRequests();
		} catch (err) {
			errorBox.textContent = err.message || 'Failed to submit request';
			errorBox.style.display = 'block';
		} finally {
			submitBtn.disabled = false;
			submitBtn.textContent = idleLabel;
		}
	});
}

function truncate(text, max = 120) {
	const value = text == null ? '' : String(text);
	return value.length > max ? `${value.slice(0, max).trimEnd()}…` : value;
}

function capitalise(value) {
	const text = String(value == null ? '' : value);
	return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

function escapeAttr(value) {
	return String(value == null ? '' : value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = text == null ? '' : String(text);
	return div.innerHTML;
}
