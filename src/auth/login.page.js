// src/auth/login.page.js
import { apiFetch } from '../shared/api.js';
import { icon } from '../shared/icons.js';
import { setToken, setPreToken } from './session.js';
import { renderRegisterName } from './register-name.page.js';

export function renderLogin(root) {
  root.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="mark">${icon('key')}</div>
        <h1 class="serif">Welcome to <span id="brand-name">Stead</span></h1>
        <p class="sub">Enter the code you were given. It knows your district and your role — you'll land exactly where you need to be.</p>
        <form id="login-form">
          <input class="code-input" id="code" name="code" placeholder="e.g. PTN-TEN-2201" autocomplete="off" autocapitalize="characters" spellcheck="false" required />
          <div id="login-error" class="error-text" style="display:none;"></div>
          <button class="btn brass block" type="submit" id="login-submit">Continue</button>
        </form>
        <div class="login-foot">No app store install needed — this runs as a web app you can add to your home screen.</div>
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

    const code = form.code.value.trim().toUpperCase();
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
    window.location.hash = '#/admin/overview';
  } else if (role === 'service_provider') {
    window.location.hash = '#/provider/tasks';
  } else {
    window.location.hash = '#/tenant/home';
  }
}
