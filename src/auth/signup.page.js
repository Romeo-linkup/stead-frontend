// src/auth/signup.page.js
import { apiFetch } from '../shared/api.js';
import { logoSvg } from '../shared/logo.js';
import { setToken } from './session.js';
import { routeToDashboard } from './login.page.js';
import { parseUnitNumbers } from '../shared/units.js';

export function renderSignup(root) {
  root.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="mark">${logoSvg({ size: 52 })}</div>
        <h1 class="serif">Create your account</h1>
        <div id="signup-error" class="error-text" style="display:none;"></div>
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
    stepsContainer.innerHTML = `
      <p class="sub">Step 1 of 3: Your details</p>
      <form id="step1-form">
        <div class="form-group">
          <label for="name">Full name</label>
          <input type="text" id="name" name="name" required maxlength="100" />
        </div>
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" required maxlength="254" />
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" required maxlength="72" />
          <small class="muted">At least 10 characters</small>
        </div>
        <div class="form-group">
          <label for="confirm-password">Confirm password</label>
          <input type="password" id="confirm-password" name="confirm-password" required maxlength="72" />
        </div>
        <button class="btn brass block" type="submit" id="step1-submit">Next</button>
        <a href="#/login" class="btn-link block">Back to login</a>
      </form>
    `;

    const form = root.querySelector('#step1-form');
    const submitBtn = root.querySelector('#step1-submit');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideError();
      submitBtn.disabled = true;
      submitBtn.textContent = 'Validating...';

      const name = form.name.value.trim();
      const email = form.email.value.trim();
      const password = form.password.value;
      const confirmPassword = form['confirm-password'].value;

      if (name.length < 1 || name.length > 100) {
        showError('Name must be between 1 and 100 characters.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Next';
        return;
      }

      if (email.length < 1 || email.length > 254) {
        showError('Email must be between 1 and 254 characters.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Next';
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showError('Invalid email format.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Next';
        return;
      }

      const passwordBytes = Buffer.byteLength(password, 'utf8');
      if (passwordBytes < 10 || passwordBytes > 72) {
        showError('Password must be between 10 and 72 bytes.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Next';
        return;
      }

      if (password === email.toLowerCase()) {
        showError('Password cannot be the same as your email.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Next';
        return;
      }

      if (password !== confirmPassword) {
        showError('Passwords do not match.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Next';
        return;
      }

      formData = { ...formData, name, email: email.toLowerCase(), password };
      step = 2;
      renderStep2();
    });
  }

  function renderStep2() {
    stepsContainer.innerHTML = `
      <p class="sub">Step 2 of 3: Your business</p>
      <form id="step2-form">
        <div class="form-group">
          <label for="business-name">Business name</label>
          <input type="text" id="business-name" name="business_name" required maxlength="120" />
        </div>
        <button class="btn brass block" type="submit" id="step2-submit">Next</button>
        <button class="btn secondary block" type="button" id="step2-back">Back</button>
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

      const businessName = form['business-name'].value.trim();

      if (businessName.length < 1 || businessName.length > 120) {
        showError('Business name must be between 1 and 120 characters.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Next';
        return;
      }

      formData = { ...formData, business_name: businessName };
      step = 3;
      renderStep3();
    });

    backBtn.addEventListener('click', () => {
      step = 1;
      renderStep1();
    });
  }

  function renderStep3() {
    stepsContainer.innerHTML = `
      <p class="sub">Step 3 of 3: Your properties (optional)</p>
      <div id="districts-container"></div>
      <button class="btn secondary block" type="button" id="add-district">Add district</button>
      <div style="margin-top: 1rem;">
        <button class="btn brass block" type="button" id="step3-submit">Create account</button>
        <button class="btn secondary block" type="button" id="step3-skip">Skip, I'll add these later</button>
        <button class="btn secondary block" type="button" id="step3-back">Back</button>
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
        <div class="district-card" style="margin-bottom: 1rem; padding: 1rem; border: 1px solid #ddd; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <strong>District ${dIdx + 1}</strong>
            <button class="btn sm danger" type="button" data-remove-district="${dIdx}">Remove</button>
          </div>
          <div class="form-group">
            <label>District name</label>
            <input type="text" class="district-name" value="${d.name}" maxlength="100" data-district-idx="${dIdx}" />
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
            <div class="property-card" style="margin-bottom: 0.5rem; padding: 0.5rem; border: 1px solid #eee; border-radius: 4px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                <strong>Property ${pIdx + 1}</strong>
                <button class="btn sm danger" type="button" data-remove-property="${dIdx}-${pIdx}">Remove</button>
              </div>
              <div class="form-group">
                <label>Property name</label>
                <input type="text" class="property-name" value="${p.name}" maxlength="100" data-district-idx="${dIdx}" data-property-idx="${pIdx}" />
              </div>
              <div class="form-group">
                <label>Address (optional)</label>
                <input type="text" class="property-address" value="${p.address || ''}" maxlength="200" data-district-idx="${dIdx}" data-property-idx="${pIdx}" />
              </div>
              <div class="form-group">
                <label>Unit numbers</label>
                <textarea class="property-units" rows="3" data-district-idx="${dIdx}" data-property-idx="${pIdx}">${p.units.join(', ')} (N units)</textarea>
                <small class="muted">Separate with commas, spaces or new lines. Ranges like 101-110 work.</small>
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
            textarea.value = text.split(' (N units)')[0] + ` (${units.length} units)`;
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
      formData = { ...formData, districts: [] };
      await submitSignup();
    });

    submitBtn.addEventListener('click', async () => {
      hideError();
      submitBtn.disabled = true;
      submitBtn.textContent = 'Validating...';

      // Validate districts
      if (districts.length > 10) {
        showError('You can have at most 10 districts.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create account';
        return;
      }

      const districtNames = new Set();
      let totalUnits = 0;

      for (const district of districts) {
        if (district.name.trim().length < 1 || district.name.trim().length > 100) {
          showError('District name must be between 1 and 100 characters.');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Create account';
          return;
        }
        const dNameLower = district.name.trim().toLowerCase();
        if (districtNames.has(dNameLower)) {
          showError('District names must be unique.');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Create account';
          return;
        }
        districtNames.add(dNameLower);

        if (!Array.isArray(district.properties) || district.properties.length > 30) {
          showError('Each district can have at most 30 properties.');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Create account';
          return;
        }

        const propertyNames = new Set();
        for (const property of district.properties) {
          if (property.name.trim().length < 1 || property.name.trim().length > 100) {
            showError('Property name must be between 1 and 100 characters.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create account';
            return;
          }
          const pNameLower = property.name.trim().toLowerCase();
          if (propertyNames.has(pNameLower)) {
            showError('Property names must be unique within a district.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create account';
            return;
          }
          propertyNames.add(pNameLower);

          if (property.address && property.address.length > 200) {
            showError('Property address must be at most 200 characters.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create account';
            return;
          }

          if (!Array.isArray(property.units)) {
            showError('Units must be an array.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create account';
            return;
          }

          const unitNumbers = new Set();
          for (const unit of property.units) {
            if (unit.trim().length < 1 || unit.trim().length > 20) {
              showError('Unit number must be between 1 and 20 characters.');
              submitBtn.disabled = false;
              submitBtn.textContent = 'Create account';
              return;
            }
            const unitRegex = /^[A-Za-z0-9][A-Za-z0-9 ._\/-]*$/;
            if (!unitRegex.test(unit.trim())) {
              showError('Unit number contains invalid characters.');
              submitBtn.disabled = false;
              submitBtn.textContent = 'Create account';
              return;
            }
            const unitLower = unit.trim().toLowerCase();
            if (unitNumbers.has(unitLower)) {
              showError('Unit numbers must be unique within a property.');
              submitBtn.disabled = false;
              submitBtn.textContent = 'Create account';
              return;
            }
            unitNumbers.add(unitLower);
            totalUnits++;
          }
        }
      }

      if (totalUnits > 500) {
        showError('You can have at most 500 units total.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create account';
        return;
      }

      formData = { ...formData, districts };
      await submitSignup();
    });

    renderDistricts();
  }

  async function submitSignup() {
    const submitBtn = root.querySelector('#step3-submit') || root.querySelector('#step3-skip');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating account...';
    }

    try {
      const data = await apiFetch('/auth/signup', {
        method: 'POST',
        auth: false,
        body: formData,
      });

      setToken(data.token);
      routeToDashboard('owner');
    } catch (err) {
      showError(err.message);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = step === 3 ? 'Create account' : 'Skip, I\'ll add these later';
      }
    }
  }

  // Check if signup is open
  apiFetch('/auth/config', { auth: false })
    .then(config => {
      if (!config.signup_open) {
        stepsContainer.innerHTML = `
          <p class="sub">Sign-up isn't open yet.</p>
          <a href="#/login" class="btn brass block">Back to login</a>
        `;
      } else {
        renderStep1();
      }
    })
    .catch(err => {
      showError(err.message);
    });
}
