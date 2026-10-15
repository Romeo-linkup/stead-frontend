// src/platform/format.js — shared helpers for the platform admin pages

export function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value == null ? '' : String(value);
  return div.innerHTML;
}

const ROLE_LABELS = {
  owner: 'Owner',
  admin: 'Admin',
  property_manager: 'Property manager',
  service_provider: 'Service provider',
  tenant: 'Tenant',
};

export function roleLabel(role) {
  if (ROLE_LABELS[role]) return ROLE_LABELS[role];
  const text = String(role || '').replace(/_/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '-';
}

export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
