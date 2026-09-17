import { apiFetch } from './api.js';
import { icon } from './icons.js';

export function renderSosButton(container) {
	container.innerHTML = `
		<button class="sos-btn" type="button" aria-label="Send emergency alert">${icon('siren')} SOS</button>
	`;

	const button = container.querySelector('.sos-btn');
	let modal = document.getElementById('sos-modal-root');

	if (!modal) {
		modal = document.createElement('div');
		modal.id = 'sos-modal-root';
		modal.className = 'modal-overlay';
		modal.setAttribute('aria-hidden', 'true');
		modal.innerHTML = `
			<div class="modal-box" role="dialog" aria-labelledby="sos-modal-title">
				<div class="modal-icon">${icon('siren')}</div>
				<h3 id="sos-modal-title">Send emergency alert?</h3>
				<p>This notifies the owner immediately with your unit and location. Only use this for a genuine emergency.</p>
				<div class="modal-actions">
					<button class="btn btn-outline sos-cancel" type="button">Cancel</button>
					<button class="btn btn-danger sos-confirm" type="button">Yes, send</button>
				</div>
				<div class="sos-status error-text" hidden></div>
			</div>
		`;
		document.body.appendChild(modal);

		modal.addEventListener('click', event => {
			if (event.target === modal) closeModal();
		});
		modal.querySelector('.sos-cancel').addEventListener('click', closeModal);
		modal.querySelector('.sos-confirm').addEventListener('click', confirmSos);
	}

	function openModal() {
		modal.classList.add('open');
		modal.setAttribute('aria-hidden', 'false');
		const status = modal.querySelector('.sos-status');
		status.hidden = true;
		status.textContent = '';
		modal.querySelector('.sos-confirm').disabled = false;
	}

	function closeModal() {
		modal.classList.remove('open');
		modal.setAttribute('aria-hidden', 'true');
	}

	async function confirmSos() {
		const confirmButton = modal.querySelector('.sos-confirm');
		const status = modal.querySelector('.sos-status');
		confirmButton.disabled = true;
		try {
			await apiFetch('/emergency', { method: 'POST', body: {} });
			closeModal();
		} catch (err) {
			status.textContent = err.message;
			status.hidden = false;
			confirmButton.disabled = false;
		}
	}

	button.addEventListener('click', openModal);
}
