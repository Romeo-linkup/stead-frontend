// src/auth/login.page.js
import { apiFetch } from '../shared/api.js';
import { setToken, setPreToken } from './session.js';
import { renderRegisterName } from './register-name.page.js';

export function renderLogin(root) {
  root.innerHTML = `
    <div class="auth-shell">
      <div class="auth-card">
        <h1 class="serif">Stead</h1>
        <p class="sub">Enter the access code you were given.</p>
        <form id="login-form">
          <div class="field">
            <label for="code">Access code</label>
            <input id="code" name="code" placeholder="e.g. SDL-TEN-4821" autocomplete="off" autocapitalize="characters" required />
          </div>
          <div id="login-error" class="error-text" style="display:none;"></div>
          <button class="btn btn-primary" type="submit" style="width:100%;" id="login-submit">Continue</button>
        </form>
      </div>
    </div>
  `;

  const form = root.querySelector('#login-form');
  const errorBox = root.querySelector('#login-error');
  const submitBtn = root.querySelector('#login-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Checking...';

    const code = form.code.value.trim();
    try {
      const data = await apiFetch('/auth/validate-code', {
        method: 'POST',
        auth: false,
        body: { code },
      });

      if (data.needs_registration) {
        setPreToken(data.pre_token);
        renderRegisterName(root, { role: data.role, district_name: data.district_name });
      } else {
        setToken(data.token);
        routeToDashboard(data.role);
      }
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Continue';
    }
  });
}

export function routeToDashboard(role) {
  if (['owner', 'admin', 'property_manager'].includes(role)) {
    window.location.hash = '#/admin/districts';
  } else if (role === 'service_provider') {
    window.location.hash = '#/provider/tasks';
  } else {
    window.location.hash = '#/tenant'; // built in a later phase
  }
}
