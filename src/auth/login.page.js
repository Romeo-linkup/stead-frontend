// src/auth/login.page.js
import { apiFetch } from '../shared/api.js';
import { logoSvg } from '../shared/logo.js';
import { getThemePreference, setThemePreference } from '../shared/theme.js';
import { setToken, setPreToken } from './session.js';
import { renderRegisterName } from './register-name.page.js';

function getThemeLabel(pref) {
  if (pref === 'light') return 'Light';
  if (pref === 'dark') return 'Dark';
  return 'System';
}

function getNextTheme(pref) {
  if (pref === 'system') return 'light';
  if (pref === 'light') return 'dark';
  return 'system';
}

export function renderLogin(root) {
  const currentTheme = getThemePreference();
  const themeLabel = getThemeLabel(currentTheme);

  root.innerHTML = `
    <div class="login-screen">
      <div class="login-theme-toggle">
        <button class="btn secondary sm" type="button" id="login-theme-toggle" aria-label="Change theme">${themeLabel}</button>
      </div>
      <div class="login-card">
        <div class="mark">${logoSvg({ size: 52 })}</div>
        <h1 class="serif">Welcome to <span id="brand-name">Stead</span></h1>
        <div id="login-toggle" style="margin-bottom: 1rem;">
          <button class="btn secondary sm" type="button" id="toggle-code" style="margin-right: 0.5rem;">Use access code</button>
          <button class="btn secondary sm" type="button" id="toggle-password">Owner sign in</button>
        </div>
        <div id="login-error" class="error-text" style="display:none;"></div>
        <div id="code-login">
          <p class="sub">Enter the code you were given. It knows your district and your role — you'll land exactly where you need to be.</p>
          <form id="code-form">
            <input class="code-input" id="code" name="code" placeholder="e.g. PTN-TEN-2201" autocomplete="off" autocapitalize="characters" spellcheck="false" required />
            <button class="btn brass block" type="submit" id="code-submit">Continue</button>
          </form>
        </div>
        <div id="password-login" style="display:none;">
          <p class="sub">Sign in with your owner account email and password.</p>
          <form id="password-form">
            <div class="form-group">
              <label for="email">Email</label>
              <input type="email" id="email" name="email" required maxlength="254" />
            </div>
            <div class="form-group">
              <label for="password">Password</label>
              <input type="password" id="password" name="password" required maxlength="200" />
            </div>
            <button class="btn brass block" type="submit" id="password-submit">Sign in</button>
          </form>
          <p class="muted" style="margin-top: 0.5rem; font-size: 0.875rem;">Forgot your password? Password recovery by email is coming soon.</p>
        </div>
        <div id="signup-link" style="margin-top: 1rem; display:none;">
          <a href="#/signup" class="btn-link">Create an owner account</a>
        </div>
        <div class="login-foot">No app store install needed — this runs as a web app you can add to your home screen.</div>
      </div>
    </div>
  `;

  const errorBox = root.querySelector('#login-error');
  const themeToggle = root.querySelector('#login-theme-toggle');
  const toggleCodeBtn = root.querySelector('#toggle-code');
  const togglePasswordBtn = root.querySelector('#toggle-password');
  const codeLoginDiv = root.querySelector('#code-login');
  const passwordLoginDiv = root.querySelector('#password-login');
  const signupLinkDiv = root.querySelector('#signup-link');

  const syncThemeButton = () => {
    const pref = getThemePreference();
    themeToggle.textContent = getThemeLabel(pref);
  };

  themeToggle.addEventListener('click', () => {
    const next = getNextTheme(getThemePreference());
    setThemePreference(next);
    syncThemeButton();
  });

  window.addEventListener('stead-theme-change', syncThemeButton);

  toggleCodeBtn.addEventListener('click', () => {
    codeLoginDiv.style.display = 'block';
    passwordLoginDiv.style.display = 'none';
    errorBox.style.display = 'none';
  });

  togglePasswordBtn.addEventListener('click', () => {
    codeLoginDiv.style.display = 'none';
    passwordLoginDiv.style.display = 'block';
    errorBox.style.display = 'none';
  });

  // Code login form
  const codeForm = root.querySelector('#code-form');
  const codeSubmitBtn = root.querySelector('#code-submit');

  codeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.style.display = 'none';
    codeSubmitBtn.disabled = true;
    codeSubmitBtn.textContent = 'Checking...';

    const code = codeForm.code.value.trim().toUpperCase();
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
      codeSubmitBtn.disabled = false;
      codeSubmitBtn.textContent = 'Continue';
    }
  });

  // Password login form
  const passwordForm = root.querySelector('#password-form');
  const passwordSubmitBtn = root.querySelector('#password-submit');

  passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.style.display = 'none';
    passwordSubmitBtn.disabled = true;
    passwordSubmitBtn.textContent = 'Signing in...';

    const email = passwordForm.email.value;
    const password = passwordForm.password.value;

    try {
      const data = await apiFetch('/auth/login-password', {
        method: 'POST',
        auth: false,
        body: { email, password },
      });

      setToken(data.token);
      routeToDashboard(data.role);
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    } finally {
      passwordSubmitBtn.disabled = false;
      passwordSubmitBtn.textContent = 'Sign in';
    }
  });

  // Check config to show signup link
  apiFetch('/auth/config', { auth: false })
    .then(config => {
      if (config.signup_open) {
        signupLinkDiv.style.display = 'block';
      }
    })
    .catch(err => {
      // Silently fail, signup link just won't show
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
