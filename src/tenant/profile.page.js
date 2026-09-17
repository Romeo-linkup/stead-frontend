import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';

export function renderProfile(root) {
	const content = renderShell(root, { activeHref: '#/tenant/profile', title: 'My profile' });

	content.innerHTML = `
		<div class="pagehead">
			<h2>My profile</h2>
		</div>
		<div class="card">
			<label class="field-label">Full name</label>
			<input class="field" id="profile-name" placeholder="Your name">
			<label class="field-label">Cellphone</label>
			<input class="field" id="profile-phone" placeholder="e.g. 082 123 4567">
			<label class="field-label">Next of kin</label>
			<input class="field" id="profile-kin" placeholder="Name and contact number">
			<button class="btn secondary" id="save-profile">Save changes</button>
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
		document.getElementById('profile-phone').value = user.phone || '';
		document.getElementById('profile-kin').value = user.next_of_kin || '';
	} catch (err) {
		console.error('Failed to load profile:', err);
	}
}

function setupSaveHandler() {
	const saveButton = document.getElementById('save-profile');
	const errorDiv = document.getElementById('profile-error');

	saveButton.addEventListener('click', async () => {
		const name = document.getElementById('profile-name').value.trim();
		const phone = document.getElementById('profile-phone').value.trim();
		const next_of_kin = document.getElementById('profile-kin').value.trim();

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
				body: { name, phone, next_of_kin },
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