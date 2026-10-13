import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { toast } from '../shared/toast.js';

function isCloudinaryUrl(url) {
  return typeof url === 'string' && url.startsWith('https://res.cloudinary.com/');
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value == null ? '' : String(value);
  return div.innerHTML;
}

export function renderInfo(root) {
  const content = renderShell(root, { activeHref: '#/tenant/info', title: 'Information' });

  content.innerHTML = `
    <div class="pagehead">
      <h2>Information</h2>
    </div>
    <div id="property-hero"></div>
    <div class="card">
      <b class="small">Building rules</b>
      <div id="info-building-rules"></div>
    </div>
    <div class="card">
      <b class="small">Utilities</b>
      <div id="info-utilities"></div>
    </div>
    <div class="card">
      <b class="small">Leaving the property</b>
      <div id="info-leaving-property"></div>
    </div>
    <div class="card">
      <b class="small">Contacts</b>
      <div id="info-contacts"></div>
    </div>
  `;

  loadTenantInfo(content);
}

async function loadTenantInfo(content) {
  try {
    const [districtInfo, unitInfo] = await Promise.all([
      apiFetch('/district-info'),
      apiFetch('/units/me').catch(() => null),
    ]);

    if (unitInfo && isCloudinaryUrl(unitInfo.property_image_url)) {
      renderPropertyHero(content, unitInfo);
    }

    renderTenantSection(content, 'building_rules', districtInfo.sections.building_rules);
    for (const key of ['utilities', 'leaving_property', 'contacts']) {
      renderTenantSection(content, key, districtInfo.sections[key]);
    }
  } catch (err) {
    toast(err.message || 'Could not load property information.');
    renderTenantSection(content, 'building_rules', 'Could not load this section.');
    for (const key of ['utilities', 'leaving_property', 'contacts']) {
      renderTenantSection(content, key, 'Could not load this section.');
    }
  }
}

function renderPropertyHero(content, unit) {
  const container = content.querySelector('#property-hero');
  container.innerHTML = `
    <img class="prop-hero" src="${escapeHtml(unit.property_image_url)}" alt="${escapeHtml(unit.property_name)}" loading="lazy">
    <div style="margin-bottom:12px;">
      <b class="serif">${escapeHtml(unit.property_name)}</b>
      <div class="small muted">${escapeHtml(unit.property_address || '')}</div>
    </div>
  `;
}

function renderTenantSection(content, key, value) {
  const target = content.querySelector(`#info-${key}`);
  if (key === 'building_rules') {
    const items = String(value ?? '').split(/\r?\n/).filter((line) => line.trim());
    target.innerHTML = `<ul class="small muted" style="margin:8px 0 0; padding-left:18px; line-height:1.8;">${items.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`;
    return;
  }

  target.innerHTML = `<p class="small muted" style="margin:8px 0 0;">${escapeHtml(value).replace(/\r?\n/g, '<br>')}</p>`;
}