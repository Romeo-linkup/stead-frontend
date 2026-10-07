// src/auth/forgot-password.page.js
import { apiFetch } from '../shared/api.js';
import { logoSvg } from '../shared/logo.js';

export function renderForgotPassword(root) {
  root.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="mark">${logoSvg({ size: 52 })}</div>
        <h1 class="serif">Reset your password</h1>
        <div id="forgot-message" class="sub" style="display:none;"></div>
        <form id="forgot-form">
          <div class="form-group">
            <label for="email" class="field-label">Email</label>
            <input type="email" id="email" name="email" class="field" required maxlength="254" />
          </div>
          <button class="btn brass block" type="submit" id="forgot-submit">Send reset link</button>
        </form>
        <a href="#/login" class="auth-link">Back to login</a>
      </div>
    </div>
  `;

  const form = root.querySelector('#forgot-form');
  const submitBtn = root.querySelector('#forgot-submit');
  const messageBox = root.querySelector('#forgot-message');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    messageBox.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    const email = form.email.value.trim();

    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        auth: false,
        body: { email },
      });

      messageBox.textContent = "If an owner account exists for that email, we've sent a reset link. It expires in one hour.";
      messageBox.style.display = 'block';
      form.reset();
    } catch (err) {
      messageBox.textContent = err.message;
      messageBox.style.display = 'block';
    } finally {
      if (submitBtn.isConnected) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send reset link';
      }
    }
  });
}
