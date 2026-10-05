// src/app.js — hash-based router + route guard. Add a `case` here as
// each new phase's pages get built.
import { initTheme } from './shared/theme.js';
import { initPwa } from './shared/pwa.js';
import { renderLogin, routeToDashboard } from './auth/login.page.js';
import { renderSignup } from './auth/signup.page.js';
import { renderDistricts } from './admin/districts.page.js';
import { renderCodes } from './admin/codes.page.js';
import { renderProperties } from './admin/properties.page.js';
import { renderLeases } from './admin/leases.page.js';
import { renderComplaints as renderAdminComplaints } from './admin/complaints.page.js';
import { renderEmergency } from './admin/emergency.page.js';
import { renderAudit } from './admin/audit.page.js';
import { renderInfo as renderAdminInfo } from './admin/info.page.js';
import { renderNotices as renderAdminNotices } from './admin/notices.page.js';
import { renderHome } from './tenant/home.page.js';
import { renderPay } from './tenant/pay.page.js';
import { renderMaintenance } from './tenant/maintenance.page.js';
import { renderLease } from './tenant/lease.page.js';
import { renderTasks } from './provider/tasks.page.js';
import { renderNotices as renderProviderNotices } from './provider/notices.page.js';
import { renderComplaints as renderTenantComplaints } from './tenant/complaints.page.js';
import { renderNotices as renderTenantNotices } from './tenant/notices.page.js';
import { renderInfo as renderTenantInfo } from './tenant/info.page.js';
import { renderProfile as renderTenantProfile } from './tenant/profile.page.js';
import { renderInfo as renderProviderInfo } from './provider/info.page.js';
import { renderProfile as renderProviderProfile } from './provider/profile.page.js';
import { renderOverview } from './admin/overview.page.js';
import { renderTenants } from './admin/tenants.page.js';
import { renderMaintenance as renderAdminMaintenance } from './admin/maintenance.page.js';
import { renderPayments as renderAdminPayments } from './admin/payments.page.js';
import { renderInvoices as renderAdminInvoices } from './admin/invoices.page.js';
import { renderSettings as renderAdminSettings } from './admin/settings.page.js';
import { renderProfile as renderAdminProfile } from './admin/profile.page.js';
import { getCurrentUser } from './auth/session.js';

const root = document.getElementById('app-root');
initTheme();
initPwa();

const ADMIN_ROLES = ['owner', 'admin', 'property_manager'];
const TENANT_ROLES = ['tenant'];
const PROVIDER_ROLES = ['service_provider'];

// '#/' (no hash), the login route, the signup route, and the bare role paths all mean "take me to
// where this role lands" — for a signed-in user. Keeps old links/bookmarks working.
const ENTRY_HASHES = ['#/', '#/login', '#/signup', '#/tenant', '#/admin', '#/provider'];

function isKnownRole(user) {
  return ADMIN_ROLES.includes(user.role) || TENANT_ROLES.includes(user.role) || PROVIDER_ROLES.includes(user.role);
}

async function router() {
  const hash = window.location.hash || '#/';
  const user = getCurrentUser();

  if (!user) {
    if (hash !== '#/login' && hash !== '#/signup' && hash !== '#/') {
      window.location.hash = '#/login';
      return;
    }
    if (hash === '#/signup') {
      renderSignup(root);
    } else {
      renderLogin(root);
    }
    return;
  }

  if (isKnownRole(user) && ENTRY_HASHES.includes(hash)) {
    routeToDashboard(user.role);
    return;
  }

  switch (true) {
    case hash === '#/login':
      renderLogin(root);
      break;

    case hash === '#/signup':
      window.location.hash = '#/login';
      break;

    case hash === '#/admin/districts':
      if (!ADMIN_ROLES.includes(user.role)) return unauthorized();
      renderDistricts(root);
      break;

    case hash === '#/admin/codes':
      if (!ADMIN_ROLES.includes(user.role)) return unauthorized();
      renderCodes(root);
      break;

    case hash === '#/admin/properties':
      if (!ADMIN_ROLES.includes(user.role)) return unauthorized();
      renderProperties(root);
      break;

    case hash === '#/admin/overview':
      if (!ADMIN_ROLES.includes(user.role)) return unauthorized();
      renderOverview(root);
      break;

    case hash === '#/admin/tenants':
      if (!ADMIN_ROLES.includes(user.role)) return unauthorized();
      renderTenants(root);
      break;

    case hash.split('?')[0] === '#/admin/maintenance':
      if (!ADMIN_ROLES.includes(user.role)) return unauthorized();
      renderAdminMaintenance(root);
      break;

    case hash === '#/admin/payments':
      if (!ADMIN_ROLES.includes(user.role)) return unauthorized();
      renderAdminPayments(root);
      break;

    case hash === '#/admin/invoices':
      if (!ADMIN_ROLES.includes(user.role)) return unauthorized();
      renderAdminInvoices(root);
      break;

    case hash === '#/admin/settings':
      if (!['owner', 'admin'].includes(user.role)) return unauthorized();
      renderAdminSettings(root);
      break;

    case hash === '#/admin/profile':
      if (!ADMIN_ROLES.includes(user.role)) return unauthorized();
      renderAdminProfile(root);
      break;

    case hash.split('?')[0] === '#/admin/leases':
      if (!ADMIN_ROLES.includes(user.role)) return unauthorized();
      renderLeases(root);
      break;

    case hash.split('?')[0] === '#/admin/complaints':
      if (!ADMIN_ROLES.includes(user.role)) return unauthorized();
      renderAdminComplaints(root);
      break;

    case hash === '#/admin/emergency':
      if (!ADMIN_ROLES.includes(user.role)) return unauthorized();
      renderEmergency(root);
      break;

    case hash === '#/admin/audit':
      if (!ADMIN_ROLES.includes(user.role)) return unauthorized();
      renderAudit(root);
      break;

    case hash === '#/admin/info':
      if (!ADMIN_ROLES.includes(user.role)) return unauthorized();
      renderAdminInfo(root);
      break;

    case hash === '#/tenant/home':
      if (!TENANT_ROLES.includes(user.role)) return unauthorized();
      renderHome(root);
      break;

    case hash === '#/tenant/pay':
      if (!TENANT_ROLES.includes(user.role)) return unauthorized();
      renderPay(root);
      break;

    case hash.split('?')[0] === '#/tenant/maintenance':
      if (!TENANT_ROLES.includes(user.role)) return unauthorized();
      renderMaintenance(root);
      break;

    case hash === '#/tenant/lease':
      if (!TENANT_ROLES.includes(user.role)) return unauthorized();
      renderLease(root);
      break;

    case hash === '#/tenant/complaints':
      if (!TENANT_ROLES.includes(user.role)) return unauthorized();
      renderTenantComplaints(root);
      break;

    case hash === '#/tenant/info':
      if (!TENANT_ROLES.includes(user.role)) return unauthorized();
      renderTenantInfo(root);
      break;

    case hash === '#/tenant/profile':
      if (!TENANT_ROLES.includes(user.role)) return unauthorized();
      renderTenantProfile(root);
      break;

    case hash === '#/provider' || hash === '#/provider/tasks':
      if (!PROVIDER_ROLES.includes(user.role)) return unauthorized();
      renderTasks(root);
      break;

    case hash === '#/provider/info':
      if (!PROVIDER_ROLES.includes(user.role)) return unauthorized();
      renderProviderInfo(root);
      break;

    case hash === '#/provider/profile':
      if (!PROVIDER_ROLES.includes(user.role)) return unauthorized();
      renderProviderProfile(root);
      break;

    case hash === '#/admin/notices':
      if (!ADMIN_ROLES.includes(user.role)) return unauthorized();
      renderAdminNotices(root);
      break;

    case hash === '#/tenant/notices':
      if (!TENANT_ROLES.includes(user.role)) return unauthorized();
      renderTenantNotices(root);
      break;

    case hash === '#/provider/notices':
      if (!PROVIDER_ROLES.includes(user.role)) return unauthorized();
      renderProviderNotices(root);
      break;

    // Any unknown hash (typo, retired link): send the user to their own home.
    default:
      if (isKnownRole(user)) {
        routeToDashboard(user.role);
      } else {
        window.location.hash = '#/login';
      }
  }
}

function unauthorized() {
  root.innerHTML = `<div class="auth-shell"><div class="auth-card"><h1 class="serif">Not authorized</h1><p class="sub">You don't have access to that page.</p></div></div>`;
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);
