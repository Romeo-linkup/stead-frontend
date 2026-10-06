import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';

export function renderProfile(root) {
	const content = renderShell(root, { activeHref: '#/provider/profile', title: 'My profile' });
	
	content.innerHTML = `
		<div class="pagehead">
			<h2>My profile</h2>
		</div>
		<div class="card">
			<div class="field">
				<label class="field-label">Name</label>
				<input class="field" id="profile-name" placeholder="Your name">
			</div>
			<div class="field">
				<label class="field-label">Service</label>
				<input class="field" id="profile-service" placeholder="Your service specialty">
			</div>
			<div class="field">
				<label class="field-label">Email (for notifications)</label>
				<input class="field" type="email" id="profile-email" placeholder="you@example.com">
				<p class="small muted" style="margin:4px 0 0;">Optional. Used only to send you updates from Stead.</p>
			</div>
			<div class="field" style="align-items:flex-start;">
				<input class="field" type="checkbox" id="profile-email-notifications" style="width:auto;margin-top:4px;">
				<label class="field-label" for="profile-email-notifications" style="flex:1;margin:0;">Email me about updates</label>
			</div>
			<button class="btn btn-primary" id="save-profile">Save changes</button>
			<div class="error-text" id="profile-error" hidden></div>
		</div>
	`;

	loadProfile();
	setupSaveHandler();
}

async function loadProfile() {
	try {
		const user = await apiFetch('/users/me');
		document.getElementById('profile-name').value = user.name || '';
		document.getElementById('profile-service').value = user.service_specialty || '';
		document.getElementById('profile-email').value = user.email || '';
		document.getElementById('profile-email-notifications').checked = user.email_notifications !== false;
	} catch (err) {
		console.error('Failed to load profile:', err);
	}
}

function setupSaveHandler() {
	const saveButton = document.getElementById('save-profile');
	const errorDiv = document.getElementById('profile-error');

	saveButton.addEventListener('click', async () => {
		const name = document.getElementById('profile-name').value.trim();
		const serviceSpecialty = document.getElementById('profile-service').value.trim();
		const email = document.getElementById('profile-email').value.trim();
		const email_notifications = document.getElementById('profile-email-notifications').checked;

		if (!name) {
			errorDiv.textContent = 'Name is required';
			errorDiv.hidden = false;
			return;
		}

		errorDiv.hidden = true;
		saveButton.disabled = true;
		saveButton.textContent = 'Saving...';

		try {
			await apiFetch('/users/me', {
				method: 'PATCH',
				body: { name, service_specialty: serviceSpecialty, email, email_notifications }
			});
			saveButton.textContent = 'Saved!';
			setTimeout(() => {
				saveButton.textContent = 'Save changes';
				saveButton.disabled = false;
			}, 1500);
		} catch (err) {
			errorDiv.textContent = err.message || 'Failed to save profile';
			errorDiv.hidden = false;
			saveButton.textContent = 'Save changes';
			saveButton.disabled = false;
		}
	});
}