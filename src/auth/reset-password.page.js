// src/auth/reset-password.page.js
import { apiFetch } from '../shared/api.js';
import { logoSvg } from '../shared/logo.js';
import { toast } from '../shared/toast.js';

const byteLength = s => new TextEncoder().encode(String(s)).length;

export function renderResetPassword(root) {
  const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const token = params.get('token');

  root.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="mark">${logoSvg({ size: 52 })}</div>
        <h1 class="serif">Choose a new password</h1>
        ${!token ? `
          <p class="sub">This reset link is invalid.</p>
          <a href="#/login" class="btn brass block">Back to login</a>
        ` : `
          <div id="reset-error" class="auth-error" style="display:none;"></div>
          <form id="reset-form">
            <div class="form-group">
              <label for="password" class="field-label">New password</label>
              <input type="password" id="password" name="password" class="field" required maxlength="72" />
              <span class="auth-hint">At least 10 characters</span>
            </div>
            <div class="form-group">
              <label for="confirm-password" class="field-label">Confirm password</label>
              <input type="password" id="confirm-password" name="confirm-password" class="field" required maxlength="72" />
            </div>
            <button class="btn brass block" type="submit" id="reset-submit">Save new password</button>
          </form>
        `}
      </div>
    </div>
  `;

  if (!token) return;

  const form = root.querySelector('#reset-form');
  const submitBtn = root.querySelector('#reset-submit');
  const errorBox = root.querySelector('#reset-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
      const password = form.password.value;
      const confirmPassword = form['confirm-password'].value;

      const passwordBytes = byteLength(password);
      if (passwordBytes < 10 || passwordBytes > 72) {
        errorBox.textContent = 'Password must be between 10 and 72 bytes.';
        errorBox.style.display = 'block';
        return;
      }

      if (password !== confirmPassword) {
        errorBox.textContent = 'Passwords do not match.';
        errorBox.style.display = 'block';
        return;
      }

      await apiFetch('/auth/reset-password', {
        method: 'POST',
        auth: false,
        body: { token, password },
      });

      toast('Password updated. Please sign in.');
      window.location.hash = '#/login';
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    } finally {
      if (submitBtn.isConnected) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save new password';
      }
    }
  });
}
