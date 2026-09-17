import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';

export function renderProfile(root) {
	const content = renderShell(root, { activeHref: '#/provider/profile', title: 'My profile' });
	
	content.innerHTML = `
		<div class="pagehead">
			<h2>My profile</h2>
		</div>
		<div class="card">
			<label class="field-label">Name</label>
			<input class="field" id="profile-name" placeholder="Your name">
			<label class="field-label">Service</label>
			<input class="field" id="profile-service" placeholder="Your service specialty">
			<button class="btn secondary" id="save-profile">Save changes</button>
			<div class="error-text" id="profile-error" hidden></div>
		</div>
	`;

	loadProfile();
	setupSaveHandler();
}

async function loadProfile() {
	try {
		const response = await apiFetch('/users/me');
		if (response.ok) {
			const user = await response.json();
			document.getElementById('profile-name').value = user.name || '';
			document.getElementById('profile-service').value = user.service_specialty || '';
		}
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

		if (!name) {
			errorDiv.textContent = 'Name is required';
			errorDiv.hidden = false;
			return;
		}

		errorDiv.hidden = true;
		saveButton.disabled = true;
		saveButton.textContent = 'Saving...';

		try {
			const response = await apiFetch('/users/me', {
				method: 'PATCH',
				body: { name, service_specialty: serviceSpecialty }
			});

			if (response.ok) {
				saveButton.textContent = 'Saved!';
				setTimeout(() => {
					saveButton.textContent = 'Save changes';
					saveButton.disabled = false;
				}, 1500);
			} else {
				const error = await response.json();
				errorDiv.textContent = error.error || 'Failed to save profile';
				errorDiv.hidden = false;
				saveButton.textContent = 'Save changes';
				saveButton.disabled = false;
			}
		} catch (err) {
			errorDiv.textContent = 'Failed to save profile';
			errorDiv.hidden = false;
			saveButton.textContent = 'Save changes';
			saveButton.disabled = false;
		}
	});
}