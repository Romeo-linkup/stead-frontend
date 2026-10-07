import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { toast } from '../shared/toast.js';

export function renderProfile(root) {
	const content = renderShell(root, { activeHref: '#/tenant/profile', title: 'My profile' });

	content.innerHTML = `
		<div class="pagehead">
			<h2>My profile</h2>
		</div>
		<div class="card">
			<div class="field">
				<label class="field-label">Full name</label>
				<input class="field" id="profile-name" placeholder="Your name">
			</div>
			<div class="field">
				<label class="field-label">Cellphone</label>
				<input class="field" id="profile-phone" placeholder="e.g. 082 123 4567">
			</div>
			<div class="field">
				<label class="field-label">Next of kin</label>
				<input class="field" id="profile-kin" placeholder="Name and contact number">
			</div>
			<div class="field">
				<label class="field-label">Email (for notifications)</label>
				<input class="field" type="email" id="profile-email" placeholder="you@example.com">
				<p class="small muted" style="margin:4px 0 0;">Optional. Used only to send you updates from Stead.</p>
				<div class="email-verified" id="email-verified" style="display:none;align-items:center;gap:0.5rem;margin-top:0.5rem;">
					<span class="badge" id="email-badge"></span>
					<button class="btn secondary sm" id="send-verification" type="button" style="display:none;">Send confirmation email</button>
				</div>
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
	setupVerificationHandler();
}

let loadedEmail = '';

function renderEmailBadge(user) {
	const row = document.getElementById('email-verified');
	const badge = document.getElementById('email-badge');
	const verifyButton = document.getElementById('send-verification');
	if (!row || !badge || !verifyButton) return;

	const hasEmail = Boolean(user.email);
	const verified = user.email_verified === true;

	row.style.display = 'flex';
	badge.className = verified ? 'badge finished' : 'badge pending';
	badge.textContent = verified ? 'Confirmed' : 'Not confirmed';
	verifyButton.style.display = hasEmail && !verified ? '' : 'none';
}

function setupVerificationHandler() {
	const verifyButton = document.getElementById('send-verification');
	if (!verifyButton) return;

	verifyButton.addEventListener('click', async () => {
		verifyButton.disabled = true;
		try {
			await apiFetch('/notifications/send-verification', { method: 'POST' });
			toast('Confirmation email sent. Check your inbox.');
		} catch (err) {
			toast(err.message);
		} finally {
			verifyButton.disabled = false;
		}
	});
}

async function loadProfile() {
	try {
		const user = await apiFetch('/users/me');
		document.getElementById('profile-name').value = user.name || '';
		document.getElementById('profile-phone').value = user.phone || '';
		document.getElementById('profile-kin').value = user.next_of_kin || '';
		document.getElementById('profile-email').value = user.email || '';
		document.getElementById('profile-email-notifications').checked = user.email_notifications !== false;
		loadedEmail = user.email || '';
		renderEmailBadge(user);
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
				body: { name, phone, next_of_kin, email, email_notifications },
			});
			if (email !== loadedEmail) {
				window.location.reload();
				return;
			}
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
