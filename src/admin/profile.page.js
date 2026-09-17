import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';

export function renderProfile(root) {
	const content = renderShell(root, { activeHref: '#/admin/profile', title: 'My profile' });

	content.innerHTML = `
		<div class="pagehead">
			<h2>My profile</h2>
		</div>
		<div class="card">
			<label class="field-label">Name</label>
			<input class="field" id="profile-name" placeholder="Your name">
			<label class="field-label">Role</label>
			<input class="field" id="profile-role" placeholder="Your role" disabled>
			<button class="btn secondary" id="save-profile">Save changes</button>
			<div class="error-text" id="profile-error" hidden></div>
		</div>
	`;

	loadProfile();
	setupSaveHandler();
}

async function loadProfile() {
	try {
		// apiFetch already returns parsed JSON (or throws) — no .ok/.json() needed.
		const user = await apiFetch('/users/me');
		document.getElementById('profile-name').value = user.name || '';

		const roleDisplay =
			user.role === 'owner'
				? 'Owner / Admin'
				: user.role === 'admin'
				? 'Admin'
				: user.role === 'property_manager'
				? 'Property Manager'
				: user.role;
		document.getElementById('profile-role').value = roleDisplay;
	} catch (err) {
		console.error('Failed to load profile:', err);
	}
}

function setupSaveHandler() {
	const saveButton = document.getElementById('save-profile');
	const errorDiv = document.getElementById('profile-error');

	saveButton.addEventListener('click', async () => {
		const name = document.getElementById('profile-name').value.trim();

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
				body: { name },
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