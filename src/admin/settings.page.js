import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { toast } from '../shared/toast.js';
import { getCurrentUser, clearSession } from '../auth/session.js';

export function renderSettings(root) {
	const content = renderShell(root, { activeHref: '#/admin/settings', title: 'Settings' });
	const user = getCurrentUser();
	const isOwner = user?.role === 'owner';

	content.innerHTML = `
		<div class="pagehead"><h2>Settings</h2><p>Rules that apply across the portfolio</p></div>
		<div class="card">
			<label class="field-label" for="notice-period">Tenant notice period before vacating (months)</label>
			<input class="field" type="number" min="1" max="12" id="notice-period" ${isOwner ? '' : 'disabled'}>
			${isOwner ? '<button class="btn secondary" id="save-settings" type="button">Save</button>' : '<p class="small muted" style="margin:6px 0 0;">Only the owner can change this.</p>'}
			<p class="small muted" style="margin-top:8px;">Tenants see this on their Notices page and it is enforced when they submit a move-out notice. New leases start with this value; existing leases are not changed.</p>
		</div>
		${isOwner ? `
		<div class="card">
			<h3 class="serif" style="margin-top:0;">Email notifications</h3>
			<p class="small muted" style="margin:0 0 12px;">Send a test email to verify your email configuration works correctly.</p>
			<button class="btn secondary" id="send-test-email" type="button">Send test email</button>
			<div class="error-text" id="test-email-error" hidden></div>
		</div>
		<div class="card" style="border-color: var(--rust);">
			<div class="pagehead" style="margin:0 0 12px;"><h3 style="color:var(--rust);margin:0;">Delete account</h3></div>
			<p class="small muted" style="margin:0 0 12px;">Permanently deletes your business and ALL its districts, properties, units, leases, payments and records. This cannot be undone.</p>
			<div id="delete-account-card"></div>
		</div>` : ''}
	`;

	const input = content.querySelector('#notice-period');
	const button = content.querySelector('#save-settings');

	apiFetch('/settings')
		.then((settings) => {
			const value = Number(settings.notice_period_months);
			input.value = Number.isInteger(value) && value >= 1 && value <= 12 ? value : 3;
		})
		.catch((error) => toast(error.message || 'Could not load settings.'));

	if (button) {
		button.addEventListener('click', async () => {
			const noticePeriodMonths = Number(input.value);
			if (!Number.isInteger(noticePeriodMonths) || noticePeriodMonths < 1 || noticePeriodMonths > 12) {
				toast('Enter a whole number between 1 and 12.');
				return;
			}

			button.disabled = true;
			try {
				const result = await apiFetch('/app-settings/notice-period', {
					method: 'PATCH',
					body: { notice_period_months: noticePeriodMonths },
				});
				const savedValue = Number(result.notice_period_months);
				input.value = Number.isInteger(savedValue) ? savedValue : noticePeriodMonths;
				toast('Settings saved.');
			} catch (error) {
				toast(error.message || 'Could not save settings.');
			} finally {
				button.disabled = false;
			}
		});
	}

	if (isOwner) {
		setupTestEmailHandler();
		renderDeleteAccountCard(content);
	}
}

function escapeHtml(s) {
	return String(s)
		.replace(/&/g, "&")
		.replace(/</g, "<")
		.replace(/>/g, ">")
		.replace(/"/g, '"')
		.replace(/'/g, "'");
}

function setupTestEmailHandler() {
	const button = document.getElementById('send-test-email');
	const errorDiv = document.getElementById('test-email-error');

	button.addEventListener('click', async () => {
		const originalLabel = button.textContent;
		errorDiv.hidden = true;
		button.disabled = true;
		button.textContent = 'Sending...';

		try {
			const result = await apiFetch('/notifications/test', {
				method: 'POST',
			});
			toast(result.sent ? 'Test email sent.' : 'Test email could not be sent.');
		} catch (error) {
			errorDiv.textContent = error.message || 'Failed to send test email';
			errorDiv.hidden = false;
		} finally {
			button.disabled = false;
			button.textContent = originalLabel;
		}
	});
}

async function renderDeleteAccountCard(content) {
	const card = content.querySelector('#delete-account-card');
	if (!card) return;

	card.innerHTML = '<p class="small muted">Loading…</p>';

	try {
		const check = await apiFetch('/account/deletion-check');
		if (check.blockers && (check.blockers.tenants > 0 || check.blockers.service_providers > 0 || check.blockers.property_managers > 0)) {
			card.innerHTML = `
				<p class="small" style="color:var(--rust);margin:0 0 12px;">
					You can't delete your account while these people still have access:
					${check.blockers.tenants} tenant${check.blockers.tenants !== 1 ? 's' : ''},
					${check.blockers.service_providers} service provider${check.blockers.service_providers !== 1 ? 's' : ''},
					${check.blockers.property_managers} property manager${check.blockers.property_managers !== 1 ? 's' : ''}.
				</p>
				<p class="small muted" style="margin:0 0 12px;">Revoke their codes on the <a href="#/admin/codes" class="auth-link">Codes page</a> first.</p>
				<button class="btn rust" disabled style="opacity:0.6;">Delete my account</button>
			`;
			return;
		}

		card.innerHTML = `
			<button class="btn rust" id="show-delete-form" type="button">Delete my account</button>
			<div id="delete-form" style="display:none;margin-top:12px;"></div>
		`;

		const showBtn = card.querySelector('#show-delete-form');
		const formDiv = card.querySelector('#delete-form');

		showBtn.addEventListener('click', () => {
			showBtn.style.display = 'none';
			formDiv.style.display = 'block';
			formDiv.innerHTML = `
				<div class="field" style="margin-bottom:12px;">
					<label class="field-label" for="delete-password">Password</label>
					<input class="field" type="password" id="delete-password" autocomplete="current-password" required />
				</div>
				<div class="field" style="margin-bottom:12px;">
					<label class="field-label" for="delete-confirm-name">Type your business name to confirm</label>
					<input class="field" type="text" id="delete-confirm-name" required />
				</div>
				<button class="btn rust" id="confirm-delete" type="button">Permanently delete</button>
			`;

			const confirmBtn = formDiv.querySelector('#confirm-delete');
			const passwordInput = formDiv.querySelector('#delete-password');
			const confirmNameInput = formDiv.querySelector('#delete-confirm-name');

			confirmBtn.addEventListener('click', async () => {
				const password = passwordInput.value;
				const confirmName = confirmNameInput.value;

				if (!password || !confirmName) {
					toast('Both fields are required.');
					return;
				}

				confirmBtn.disabled = true;
				const originalLabel = confirmBtn.textContent;
				confirmBtn.textContent = 'Deleting…';

				try {
					await apiFetch('/account', {
						method: 'DELETE',
						body: { password, confirm_name: confirmName },
					});
					clearSession();
					toast('Your account has been deleted.');
					window.location.hash = '#/login';
				} catch (error) {
					if (error.message?.includes('409')) {
						// Re-fetch check and refresh card
						renderDeleteAccountCard(content);
					} else {
						toast(error.message || 'Could not delete account.');
					}
					confirmBtn.disabled = false;
					confirmBtn.textContent = originalLabel;
				}
			});
		});
	} catch (error) {
		card.innerHTML = `<p class="small" style="color:var(--rust);">Could not load deletion check: ${escapeHtml(error.message || 'Unknown error')}</p>`;
	}
}