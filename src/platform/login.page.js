// src/platform/login.page.js
import { platformFetch, setPlatformToken } from './api.js';
import { logoSvg } from '../shared/logo.js';

export function renderPlatformLogin(root) {
  root.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="mark">${logoSvg({ size: 52 })}</div>
        <h1 class="serif">Platform Admin</h1>
        <div id="login-error" class="auth-error" style="display:none;"></div>
        <form id="platform-login-form">
          <div class="form-group">
            <label for="email" class="field-label">Email</label>
            <input type="email" id="email" name="email" class="field" required maxlength="254" />
          </div>
          <div class="form-group">
            <label for="password" class="field-label">Password</label>
            <input type="password" id="password" name="password" class="field" required maxlength="200" />
          </div>
          <div class="form-group">
            <label for="code" class="field-label">Authenticator code (leave blank if not enabled)</label>
            <input type="text" id="code" name="code" class="field" maxlength="6" inputmode="numeric" pattern="[0-9]{6}" placeholder="123456" />
          </div>
          <button class="btn brass block" type="submit" id="submit-btn">Sign in</button>
        </form>
      </div>
    </div>
  `;

  const errorBox = root.querySelector('#login-error');
  const form = root.querySelector('#platform-login-form');
  const submitBtn = root.querySelector('#submit-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    const email = form.email.value;
    const password = form.password.value;
    const code = form.code.value.trim();

    const body = { email, password };
    if (code) {
      body.code = code;
    }

    try {
      const data = await platformFetch('/platform/auth/login', {
        method: 'POST',
        body,
      });

      setPlatformToken(data.token);
      window.location.hash = '#/platform';
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign in';
    }
  });
}
