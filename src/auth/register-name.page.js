// src/auth/register-name.page.js — one-time "who are you?" screen,
// shown only the first time a given code is used on any device.
import { API_URL } from '../config.js';
import { setToken, getPreToken, clearPreToken } from './session.js';
import { routeToDashboard } from './login.page.js';

export function renderRegisterName(root, { role, district_name } = {}) {
  root.innerHTML = `
    <div class="auth-shell">
      <div class="auth-card">
        <h1 class="serif">Welcome</h1>
        <p class="sub">
          You're signing in as <strong>${escapeHtml(role || '')}</strong>${district_name ? ` &middot; ${escapeHtml(district_name)}` : ''}.
          First, tell us who you are.
        </p>
        <form id="register-form">
          <div class="field">
            <label for="name">Full name</label>
            <input id="name" name="name" required />
          </div>
          <div class="field">
            <label for="phone">Phone number (optional)</label>
            <input id="phone" name="phone" placeholder="+27 ..." />
          </div>
          <div id="register-error" class="error-text" style="display:none;"></div>
          <button class="btn btn-primary" type="submit" style="width:100%;" id="register-submit">Continue</button>
        </form>
      </div>
    </div>
  `;

  const form = root.querySelector('#register-form');
  const errorBox = root.querySelector('#register-error');
  const submitBtn = root.querySelector('#register-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.style.display = 'none';

    const preToken = getPreToken();
    if (!preToken) {
      errorBox.textContent = 'Your session expired — please enter your code again.';
      errorBox.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
      const res = await fetch(`${API_URL}/auth/register-name`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${preToken}`,
        },
        body: JSON.stringify({ name: form.name.value.trim(), phone: form.phone.value.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed.');

      clearPreToken();
      setToken(data.token);
      routeToDashboard(data.role);
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Continue';
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
