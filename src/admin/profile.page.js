import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { getCurrentUser } from '../auth/session.js';
import { invalidateBusinessNameCache } from '../shared/topbar.js';

export function renderProfile(root) {
	const content = renderShell(root, { activeHref: '#/admin/profile', title: 'My profile' });
	const user = getCurrentUser();
	const isOwner = user.role === 'owner';

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
				<label class="field-label">Role</label>
				<input class="field" id="profile-role" placeholder="Your role" disabled>
			</div>
			<div class="field">
				<label class="field-label">Email (for notifications)</label>
				<input class="field" type="email" id="profile-email" placeholder="you@example.com"${isOwner ? ' readonly' : ''}>
				<p class="small muted" style="margin:4px 0 0;">${isOwner ? 'This is your login email and cannot be changed here.' : 'Optional. Used only to send you updates from Stead.'}</p>
			</div>
			<div class="field" style="align-items:flex-start;">
				<input class="field" type="checkbox" id="profile-email-notifications" style="width:auto;margin-top:4px;">
				<label class="field-label" for="profile-email-notifications" style="flex:1;margin:0;">Email me about updates</label>
			</div>
			<button class="btn btn-primary" id="save-profile">Save changes</button>
			<div class="error-text" id="profile-error" hidden></div>
		</div>
		${
			isOwner
				? `
		<div class="card">
			<h3 class="serif" style="margin-top:0;">Property business name</h3>
			<p class="small muted" style="margin:0 0 12px;">
				Shown at the top of the app to everyone — tenants, providers, and any
				property managers you add.
			</p>
			<div class="field">
				<label class="field-label">Business name</label>
				<input class="field" id="business-name" placeholder="e.g. Redfern Properties">
			</div>
			<button class="btn btn-primary" id="save-business-name">Save name</button>
			<div class="error-text" id="business-name-error" hidden></div>
		</div>`
				: ''
		}
	`;

	loadProfile();
	setupSaveHandler();
	if (isOwner) {
		loadBusinessName();
		setupBusinessNameHandler();
	}
}

async function loadProfile() {
	try {
		const user = await apiFetch('/users/me');
		document.getElementById('profile-name').value = user.name || '';

		const roleDisplay =
			user.role === 'owner'
				? 'Owner / Admin'
				: user.role === 'property_manager'
					? 'Property Manager'
					: user.role;
		document.getElementById('profile-role').value = roleDisplay;
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
				body: { name, email, email_notifications },
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

async function loadBusinessName() {
	try {
		const settings = await apiFetch('/settings');
		document.getElementById('business-name').value = settings.business_name || '';
	} catch (err) {
		console.error('Failed to load business name:', err);
	}
}

function setupBusinessNameHandler() {
	const saveButton = document.getElementById('save-business-name');
	const errorDiv = document.getElementById('business-name-error');

	saveButton.addEventListener('click', async () => {
		const business_name = document.getElementById('business-name').value.trim();

		if (!business_name) {
			errorDiv.textContent = 'Business name is required';
			errorDiv.hidden = false;
			return;
		}

		errorDiv.hidden = true;
		saveButton.disabled = true;
		saveButton.textContent = 'Saving...';

		try {
			await apiFetch('/settings', {
				method: 'PATCH',
				body: { business_name },
			});
			invalidateBusinessNameCache();
			saveButton.textContent = 'Saved!';
			setTimeout(() => {
				saveButton.textContent = 'Save name';
				saveButton.disabled = false;
			}, 1500);
		} catch (err) {
			errorDiv.textContent = err.message || 'Failed to save business name';
			errorDiv.hidden = false;
			saveButton.textContent = 'Save name';
			saveButton.disabled = false;
		}
	});
}