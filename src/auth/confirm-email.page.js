// src/auth/confirm-email.page.js — works whether or not the person is signed in
import { apiFetch } from '../shared/api.js';
import { logoSvg } from '../shared/logo.js';

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value == null ? '' : String(value);
  return div.innerHTML;
}

export function renderConfirmEmail(root) {
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const token = params.get('token') || '';

  root.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="mark">${logoSvg({ size: 52 })}</div>
        <h1 class="serif">Confirm your email</h1>
        <div id="confirm-error" class="auth-error" style="display:none;"></div>
        <div id="confirm-body">
          ${token
            ? `<p class="sub">Press the button to confirm that you want to receive updates from Stead.</p>
               <button class="btn brass block" type="button" id="confirm-btn">Confirm my email</button>`
            : `<p class="sub">This confirmation link is incomplete. Open the link from your email again.</p>
               <a class="btn secondary block" href="#/">Back to Stead</a>`}
        </div>
      </div>
    </div>
  `;

  const button = root.querySelector('#confirm-btn');
  if (!button) return;
  const errorBox = root.querySelector('#confirm-error');
  const bodyEl = root.querySelector('#confirm-body');

  button.addEventListener('click', async () => {
    errorBox.style.display = 'none';
    button.disabled = true;
    button.textContent = 'Confirming...';
    try {
      const result = await apiFetch('/notifications/verify', { method: 'POST', auth: false, body: { token } });
      bodyEl.innerHTML = `
        <p class="sub">${result.already ? 'Your email was already confirmed.' : 'Your email is confirmed. You will now receive Stead notifications.'}</p>
        <a class="btn brass block" href="#/">Continue</a>
      `;
    } catch (err) {
      errorBox.textContent = err.message || 'We could not confirm your email.';
      errorBox.style.display = 'block';
      bodyEl.innerHTML = '<a class="btn secondary block" href="#/">Back to Stead</a>';
    }
  });
}
