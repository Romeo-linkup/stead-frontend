// src/shared/assets.js — shared helpers for the per-unit
// assets register (the client's "Building & Assets List").
import { apiFetch } from './api.js';

export const ASSET_CONDITIONS = ['good', 'fair', 'poor', 'damaged', 'missing'];

export const CONDITION_LABELS = {
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  damaged: 'Damaged',
  missing: 'Missing',
};

export function getHashQuery() {
  const hash = window.location.hash || '';
  const qIndex = hash.indexOf('?');
  if (qIndex === -1) return {};
  const params = new URLSearchParams(hash.slice(qIndex + 1));
  const out = {};
  for (const [key, value] of params.entries()) {
    out[key] = value;
  }
  return out;
}

// Badge CSS class per condition (tenant read-only view):
// good = finished (green), fair = pending (amber),
// poor/damaged/missing = outstanding (red).
export function conditionBadgeClass(condition) {
  if (condition === 'good') return 'finished';
  if (condition === 'fair') return 'pending';
  return 'outstanding';
}

export function conditionLabel(condition) {
  return CONDITION_LABELS[condition] || 'Not assessed';
}

// Read-only condition cell for the tenant view: a coloured badge,
// or plain muted "Not assessed" text when the condition is null.
export function conditionBadgeHtml(condition) {
  if (!condition) {
    return '<span class="muted">Not assessed</span>';
  }
  return `<span class="badge ${conditionBadgeClass(condition)}">${escapeHtml(conditionLabel(condition))}</span>`;
}

// Group assets by area, preserving the backend's sort_order.
// Assets without an area fall under "General".
export function groupByArea(assets) {
  const groups = [];
  const index = new Map();
  for (const asset of assets) {
    const area = asset.area && asset.area.trim() ? asset.area.trim() : 'General';
    let group = index.get(area);
    if (!group) {
      group = { area, assets: [] };
      index.set(area, group);
      groups.push(group);
    }
    group.assets.push(asset);
  }
  return groups;
}

// Two-tab switcher ("Requests | Assets") driven by the hash query.
export function renderTabBar(activeTab, basePath) {
  const requestsActive = activeTab !== 'assets';
  return `
    <div class="tabbar" role="tablist" style="margin-bottom:14px;">
      <button class="tab${requestsActive ? ' active' : ''}" type="button" role="tab" data-nav="${escapeAttr(basePath)}">Requests</button>
      <button class="tab${!requestsActive ? ' active' : ''}" type="button" role="tab" data-nav="${escapeAttr(basePath)}?tab=assets">Assets</button>
    </div>
  `;
}

export function wireTabBar(root) {
  root.querySelectorAll('.tab[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      window.location.hash = btn.dataset.nav;
    });
  });
}

// Render the printable "Building & Assets List" report that mirrors
// the paper form, then trigger the browser's print dialog.
export async function renderAssetReport(content, unitId, basePath) {
  content.innerHTML = `
    <div class="card"><p class="small muted">Loading asset report...</p></div>
  `;

  let settings;
  let data;
  try {
    const [s, d] = await Promise.all([
      apiFetch('/settings').catch(() => ({ business_name: 'Your Property Business' })),
      apiFetch(unitId ? `/assets?unit_id=${encodeURIComponent(unitId)}` : '/assets'),
    ]);
    settings = s;
    data = d;
  } catch (err) {
    content.innerHTML = `
      <div class="card">
        <p class="error-text">${escapeHtml(err.message)}</p>
        <a class="btn secondary" href="${escapeAttr(basePath)}?tab=assets">Back to assets</a>
      </div>
    `;
    return;
  }

  const businessName = settings.business_name || 'Your Property Business';
  const unit = data.unit || {};
  const assets = Array.isArray(data.assets) ? data.assets : [];

  let flatLine = `Flat: ${unit.unit_number || ''} ${unit.property_name || ''}`.replace(/\s+/g, ' ').trim();
  if (unit.property_address) {
    flatLine += `, ${unit.property_address}`;
  }

  const rows = assets
    .map(
      (a) => `
      <tr>
        <td>${escapeHtml(a.item)}</td>
        <td>${a.condition ? escapeHtml(conditionLabel(a.condition)) : ''}</td>
        <td>${escapeHtml(a.comments)}</td>
      </tr>
    `
    )
    .join('');

  content.innerHTML = `
    <div class="asset-report">
      <div class="report-head">
        <div class="report-business">${escapeHtml(businessName)}</div>
        <div class="report-subtitle">Building &amp; Assets List</div>
        <div class="report-flat">${escapeHtml(flatLine)}</div>
      </div>
      <table class="report-table">
        <thead>
          <tr><th>Asset</th><th>Condition</th><th>Comments</th></tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="3" class="report-empty">No assets recorded.</td></tr>'}
        </tbody>
      </table>
      <div class="report-signature">
        <span>Date: ______</span>
        <span>Lessee signature: ______</span>
        <span>Lessor: ______</span>
      </div>
      <div class="report-actions">
        <a class="btn secondary" href="${escapeAttr(basePath)}?tab=assets">Back to assets</a>
      </div>
    </div>
  `;

  window.print();
}

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

export function escapeAttr(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
