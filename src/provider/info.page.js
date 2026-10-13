import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { getCurrentUser } from '../auth/session.js';
import { toast } from '../shared/toast.js';

function isCloudinaryUrl(url) {
  return typeof url === 'string' && url.startsWith('https://res.cloudinary.com/');
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value == null ? '' : String(value);
  return div.innerHTML;
}

function renderPhotoPlaceholder() {
  return `<div class="prop-photo" style="display:flex;align-items:center;justify-content:center;color:var(--slate);font-size:10px;">No photo</div>`;
}

export function renderInfo(root) {
  const content = renderShell(root, { activeHref: '#/provider/info', title: 'Site information' });

  content.innerHTML = `
    <div class="pagehead">
      <h2>Site information</h2>
      <p id="site-subtitle">Loading...</p>
    </div>
    <div class="card">
      <b class="small">Access</b>
      <div id="provider-access"></div>
    </div>
    <div class="card">
      <b class="small">Properties</b>
      <div id="provider-properties">Loading...</div>
    </div>
  `;

  loadSiteInfo();
  loadProperties(content);
}

async function loadSiteInfo() {
  const subtitle = document.getElementById('site-subtitle');
  try {
    const user = getCurrentUser();
    const districts = await apiFetch('/districts');
    const district = districts.find((d) => d.id === user.district_id);
    subtitle.textContent = district ? district.name : 'Your district';
  } catch (err) {
    console.error('Failed to load site info:', err);
    subtitle.textContent = '';
  }

  const access = document.getElementById('provider-access');
  try {
    const data = await apiFetch('/district-info');
    access.innerHTML = `<p class="small muted" style="margin:8px 0 0;">${escapeHtml(data.sections.access).replace(/\r?\n/g, '<br>')}</p>`;
  } catch (err) {
    toast(err.message || 'Could not load site information.');
    access.innerHTML = '<p class="small muted" style="margin:8px 0 0;">Could not load this section.</p>';
  }
}

async function loadProperties(content) {
  const container = content.querySelector('#provider-properties');
  try {
    const properties = await apiFetch('/properties/mine');
    if (!properties.length) {
      container.innerHTML = '<p class="small muted">No properties in your district.</p>';
      return;
    }

    container.innerHTML = properties.map(prop => {
      const hasPhoto = isCloudinaryUrl(prop.image_thumb_url);
      const thumbSrc = hasPhoto ? prop.image_thumb_url : null;
      return `
        <div class="card" style="margin-bottom:12px;">
          <div class="row" style="align-items:flex-start;">
            ${thumbSrc ? `<img class="prop-photo" src="${escapeAttr(thumbSrc)}" alt="${escapeAttr(prop.name)}" loading="lazy">` : renderPhotoPlaceholder()}
            <div style="flex:1; min-width:0;">
              <b>${escapeHtml(prop.name)}</b>
              <div class="small muted">${escapeHtml(prop.address || 'No address recorded')}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    toast(err.message || 'Could not load properties.');
    container.innerHTML = '<p class="small muted">Could not load properties.</p>';
  }
}