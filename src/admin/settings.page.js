import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { toast } from '../shared/toast.js';
import { getCurrentUser } from '../auth/session.js';

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
}