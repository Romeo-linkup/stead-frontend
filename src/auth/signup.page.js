// src/auth/signup.page.js
import { apiFetch } from '../shared/api.js';
import { logoSvg } from '../shared/logo.js';
import { setToken } from './session.js';
import { routeToDashboard } from './login.page.js';
import { parseUnitNumbers } from '../shared/units.js';

const byteLength = s => new TextEncoder().encode(String(s)).length;

export function renderSignup(root) {
  root.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="mark">${logoSvg({ size: 52 })}</div>
        <h1 class="serif">Create your account</h1>
        <div id="signup-error" class="auth-error" style="display:none;"></div>
        <div id="signup-steps"></div>
      </div>
    </div>
  `;

  const errorBox = root.querySelector('#signup-error');
  const stepsContainer = root.querySelector('#signup-steps');

  let step = 1;
  let formData = {};

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = 'block';
  }

  function hideError() {
    errorBox.style.display = 'none';
  }

  function renderStep1() {
    const card = root.querySelector('.login-card');
    if (card) card.classList.remove('wide');
    stepsContainer.innerHTML = `
      <div class="auth-steps">
        <span class="done"></span>
        <span></span>
        <span></span>
      </div>
      <p class="sub">Step 1 of 3: Your details</p>
      <form id="step1-form">
        <div class="form-group">
          <label for="name" class="field-label">Full name</label>
          <input type="text" id="name" name="name" class="field" required maxlength="100" />
        </div>
        <div class="form-group">
          <label for="email" class="field-label">Email</label>
          <input type="email" id="email" name="email" class="field" required maxlength="254" />
        </div>
        <div class="form-group">
          <label for="password" class="field-label">Password</label>
          <input type="password" id="password" name="password" class="field" required maxlength="72" />
          <span class="auth-hint">At least 10 characters</span>
        </div>
        <div class="form-group">
          <label for="confirm-password" class="field-label">Confirm password</label>
          <input type="password" id="confirm-password" name="confirm-password" class="field" required maxlength="72" />
        </div>
        <div class="auth-actions">
          <button class="btn brass" type="submit" id="step1-submit">Next</button>
        </div>
        <a href="#/login" class="auth-link">Back to login</a>
      </form>
    `;

    const form = root.querySelector('#step1-form');
    const submitBtn = root.querySelector('#step1-submit');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideError();
      submitBtn.disabled = true;
      submitBtn.textContent = 'Validating...';

      try {
        const name = form.name.value.trim();
        const email = form.email.value.trim();
        const password = form.password.value;
        const confirmPassword = form['confirm-password'].value;

        if (name.length < 1 || name.length > 100) {
          showError('Name must be between 1 and 100 characters.');
          return;
        }

        if (email.length < 1 || email.length > 254) {
          showError('Email must be between 1 and 254 characters.');
          return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          showError('Invalid email format.');
          return;
        }

        const passwordBytes = byteLength(password);
        if (passwordBytes < 10 || passwordBytes > 72) {
          showError('Password must be between 10 and 72 bytes.');
          return;
        }

        if (password === email.toLowerCase()) {
          showError('Password cannot be the same as your email.');
          return;
        }

        if (password !== confirmPassword) {
          showError('Passwords do not match.');
          return;
        }

        formData = { ...formData, name, email: email.toLowerCase(), password };
        step = 2;
        renderStep2();
      } catch (err) {
        showError(err.message);
      } finally {
        if (submitBtn.isConnected) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Next';
        }
      }
    });
  }

  function renderStep2() {
    const card = root.querySelector('.login-card');
    if (card) card.classList.remove('wide');
    stepsContainer.innerHTML = `
      <div class="auth-steps">
        <span class="done"></span>
        <span class="done"></span>
        <span></span>
      </div>
      <p class="sub">Step 2 of 3: Your business</p>
      <form id="step2-form">
        <div class="form-group">
          <label for="business-name" class="field-label">Business name</label>
          <input type="text" id="business-name" name="business_name" class="field" required maxlength="120" />
        </div>
        <div class="auth-actions">
          <button class="btn brass" type="submit" id="step2-submit">Next</button>
          <button class="btn secondary" type="button" id="step2-back">Back</button>
        </div>
      </form>
    `;

    const form = root.querySelector('#step2-form');
    const submitBtn = root.querySelector('#step2-submit');
    const backBtn = root.querySelector('#step2-back');

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      hideError();
      submitBtn.disabled = true;
      submitBtn.textContent = 'Validating...';

      try {
        const businessName = form['business-name'].value.trim();

        if (businessName.length < 1 || businessName.length > 120) {
          showError('Business name must be between 1 and 120 characters.');
          return;
        }

        formData = { ...formData, business_name: businessName };
        step = 3;
        renderStep3();
      } catch (err) {
        showError(err.message);
      } finally {
        if (submitBtn.isConnected) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Next';
        }
      }
    });

    backBtn.addEventListener('click', () => {
      step = 1;
      renderStep1();
    });
  }

  function renderStep3() {
    const card = root.querySelector('.login-card');
    if (card) card.classList.add('wide');
    stepsContainer.innerHTML = `
      <div class="auth-steps">
        <span class="done"></span>
        <span class="done"></span>
        <span class="done"></span>
      </div>
      <p class="sub">Step 3 of 3: Your properties (optional)</p>
      <div id="districts-container"></div>
      <button class="btn secondary block" type="button" id="add-district">Add district</button>
      <div class="auth-actions">
        <button class="btn brass" type="button" id="step3-submit">Create account</button>
        <button class="btn secondary" type="button" id="step3-skip">Skip, I'll add these later</button>
        <button class="btn secondary" type="button" id="step3-back">Back</button>
      </div>
    `;

    const districtsContainer = root.querySelector('#districts-container');
    const addDistrictBtn = root.querySelector('#add-district');
    const submitBtn = root.querySelector('#step3-submit');
    const skipBtn = root.querySelector('#step3-skip');
    const backBtn = root.querySelector('#step3-back');

    let districts = [];

    function renderDistricts() {
      districtsContainer.innerHTML = districts.map((d, dIdx) => `
        <div class="signup-block">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <strong>District ${dIdx + 1}</strong>
            <button class="btn sm danger" type="button" data-remove-district="${dIdx}">Remove</button>
          </div>
          <div class="form-group">
            <label class="field-label">District name</label>
            <input type="text" class="district-name field" value="${d.name}" maxlength="100" data-district-idx="${dIdx}" />
          </div>
          <div id="properties-${dIdx}"></div>
          <button class="btn sm secondary" type="button" data-add-property="${dIdx}">Add property</button>
        </div>
      `).join('');

      // Render properties for each district
      districts.forEach((d, dIdx) => {
        const propsContainer = root.querySelector(`#properties-${dIdx}`);
        if (propsContainer) {
          propsContainer.innerHTML = d.properties.map((p, pIdx) => `
            <div class="signup-block inner">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                <strong>Property ${pIdx + 1}</strong>
                <button class="btn sm danger" type="button" data-remove-property="${dIdx}-${pIdx}">Remove</button>
              </div>
              <div class="form-group">
                <label class="field-label">Property name</label>
                <input type="text" class="property-name field" value="${p.name}" maxlength="100" data-district-idx="${dIdx}" data-property-idx="${pIdx}" />
              </div>
              <div class="form-group">
                <label class="field-label">Address (optional)</label>
                <input type="text" class="property-address field" value="${p.address || ''}" maxlength="200" data-district-idx="${dIdx}" data-property-idx="${pIdx}" />
              </div>
              <div class="form-group">
                <label class="field-label">Unit numbers</label>
                <textarea class="property-units field" rows="3" data-district-idx="${dIdx}" data-property-idx="${pIdx}">${p.units.join(', ')}</textarea>
                <div class="unit-count" id="unit-count-${dIdx}-${pIdx}">${p.units.length} units</div>
                <span class="auth-hint">Separate with commas, spaces or new lines. Ranges like 101-110 work.</span>
              </div>
            </div>
          `).join('');
        }
      });

      // Add event listeners
      root.querySelectorAll('[data-remove-district]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.removeDistrict, 10);
          districts.splice(idx, 1);
          renderDistricts();
        });
      });

      root.querySelectorAll('[data-add-property]').forEach(btn => {
        btn.addEventListener('click', () => {
          const dIdx = parseInt(btn.dataset.addProperty, 10);
          districts[dIdx].properties.push({ name: '', address: '', units: [] });
          renderDistricts();
        });
      });

      root.querySelectorAll('[data-remove-property]').forEach(btn => {
        btn.addEventListener('click', () => {
          const [dIdx, pIdx] = btn.dataset.removeProperty.split('-').map(Number);
          districts[dIdx].properties.splice(pIdx, 1);
          renderDistricts();
        });
      });

      root.querySelectorAll('.district-name').forEach(input => {
        input.addEventListener('input', () => {
          const dIdx = parseInt(input.dataset.districtIdx, 10);
          districts[dIdx].name = input.value;
        });
      });

      root.querySelectorAll('.property-name').forEach(input => {
        input.addEventListener('input', () => {
          const dIdx = parseInt(input.dataset.districtIdx, 10);
          const pIdx = parseInt(input.dataset.propertyIdx, 10);
          districts[dIdx].properties[pIdx].name = input.value;
        });
      });

      root.querySelectorAll('.property-address').forEach(input => {
        input.addEventListener('input', () => {
          const dIdx = parseInt(input.dataset.districtIdx, 10);
          const pIdx = parseInt(input.dataset.propertyIdx, 10);
          districts[dIdx].properties[pIdx].address = input.value;
        });
      });

      root.querySelectorAll('.property-units').forEach(textarea => {
        textarea.addEventListener('input', () => {
          const dIdx = parseInt(textarea.dataset.districtIdx, 10);
          const pIdx = parseInt(textarea.dataset.propertyIdx, 10);
          const text = textarea.value;
          try {
            const units = parseUnitNumbers(text);
            districts[dIdx].properties[pIdx].units = units;
            const countEl = root.querySelector(`#unit-count-${dIdx}-${pIdx}`);
            if (countEl) countEl.textContent = `${units.length} units`;
          } catch (err) {
            // Don't update on error, let user see what they typed
          }
        });
      });
    }

    addDistrictBtn.addEventListener('click', () => {
      if (districts.length >= 10) {
        showError('You can have at most 10 districts.');
        return;
      }
      districts.push({ name: '', properties: [] });
      renderDistricts();
    });

    backBtn.addEventListener('click', () => {
      step = 2;
      renderStep2();
    });

    skipBtn.addEventListener('click', async () => {
      try {
        formData = { ...formData, districts: [] };
        await submitSignup();
      } catch (err) {
        showError(err.message);
      } finally {
        if (skipBtn.isConnected) {
          skipBtn.disabled = false;
          skipBtn.textContent = 'Skip, I\'ll add these later';
        }
      }
    });

    submitBtn.addEventListener('click', async () => {
      hideError();
      submitBtn.disabled = true;
      submitBtn.textContent = 'Validating...';

      try {
        // Validate districts
        if (districts.length > 10) {
          showError('You can have at most 10 districts.');
          return;
        }

        const districtNames = new Set();
        let totalUnits = 0;

        for (const district of districts) {
          if (district.name.trim().length < 1 || district.name.trim().length > 100) {
            showError('District name must be between 1 and 100 characters.');
            return;
          }
          const dNameLower = district.name.trim().toLowerCase();
          if (districtNames.has(dNameLower)) {
            showError('District names must be unique.');
            return;
          }
          districtNames.add(dNameLower);

          if (!Array.isArray(district.properties) || district.properties.length > 30) {
            showError('Each district can have at most 30 properties.');
            return;
          }

          const propertyNames = new Set();
          for (const property of district.properties) {
            if (property.name.trim().length < 1 || property.name.trim().length > 100) {
              showError('Property name must be between 1 and 100 characters.');
              return;
            }
            const pNameLower = property.name.trim().toLowerCase();
            if (propertyNames.has(pNameLower)) {
              showError('Property names must be unique within a district.');
              return;
            }
            propertyNames.add(pNameLower);

            if (property.address && property.address.length > 200) {
              showError('Property address must be at most 200 characters.');
              return;
            }

            if (!Array.isArray(property.units)) {
              showError('Units must be an array.');
              return;
            }

            const unitNumbers = new Set();
            for (const unit of property.units) {
              if (unit.trim().length < 1 || unit.trim().length > 20) {
                showError('Unit number must be between 1 and 20 characters.');
                return;
              }
              const unitRegex = /^[A-Za-z0-9][A-Za-z0-9 ._\/-]*$/;
              if (!unitRegex.test(unit.trim())) {
                showError('Unit number contains invalid characters.');
                return;
              }
              const unitLower = unit.trim().toLowerCase();
              if (unitNumbers.has(unitLower)) {
                showError('Unit numbers must be unique within a property.');
                return;
              }
              unitNumbers.add(unitLower);
              totalUnits++;
            }
          }
        }

        if (totalUnits > 500) {
          showError('You can have at most 500 units total.');
          return;
        }

        formData = { ...formData, districts };
        await submitSignup();
      } catch (err) {
        showError(err.message);
      } finally {
        if (submitBtn.isConnected) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Create account';
        }
      }
    });

    renderDistricts();
  }

  async function submitSignup() {
    try {
      const data = await apiFetch('/auth/signup', {
        method: 'POST',
        auth: false,
        body: formData,
      });

      setToken(data.token);
      routeToDashboard('owner');
    } catch (err) {
      throw err;
    }
  }

  async function loadConfig() {
    try {
      const config = await apiFetch('/auth/config', { auth: false });
      if (!config.signup_open) {
        stepsContainer.innerHTML = `
          <p class="sub">Sign-up isn't open yet.</p>
          <a href="#/login" class="btn brass block">Back to login</a>
        `;
      } else {
        renderStep1();
      }
    } catch (err) {
      stepsContainer.innerHTML = `
        <div class="auth-error">Can't reach the server. It may be waking up, try again in a minute.</div>
        <button class="btn brass block" type="button" id="config-retry">Try again</button>
      `;
      root.querySelector('#config-retry').addEventListener('click', loadConfig);
    }
  }

  loadConfig();
}
