// src/app.js — hash-based router + route guard. Add a `case` here as
// each new phase's pages get built.
import { renderLogin } from './auth/login.page.js';
import { renderDistricts } from './admin/districts.page.js';
import { renderCodes } from './admin/codes.page.js';
import { renderProperties } from './admin/properties.page.js';
import { renderLeases } from './admin/leases.page.js';
import { renderComplaints as renderAdminComplaints } from './admin/complaints.page.js';
import { renderEmergency } from './admin/emergency.page.js';
import { renderAudit } from './admin/audit.page.js';
import { renderHome } from './tenant/home.page.js';
import { renderPay } from './tenant/pay.page.js';
import { renderMaintenance } from './tenant/maintenance.page.js';
import { renderLease } from './tenant/lease.page.js';
import { renderTasks } from './provider/tasks.page.js';
import { renderMessages as renderProviderMessages } from './provider/messages.page.js';
import { renderComplaints as renderTenantComplaints } from './tenant/complaints.page.js';
import { renderMessages as renderTenantMessages } from './tenant/messages.page.js';
import { renderInfo as renderTenantInfo } from './tenant/info.page.js';
import { renderProfile as renderTenantProfile } from './tenant/profile.page.js';
import { renderInfo as renderProviderInfo } from './provider/info.page.js';
import { renderProfile as renderProviderProfile } from './provider/profile.page.js';
import { renderOverview } from './admin/overview.page.js';
import { renderTenants } from './admin/tenants.page.js';
import { renderMaintenance as renderAdminMaintenance } from './admin/maintenance.page.js';
import { renderPayments as renderAdminPayments } from './admin/payments.page.js';
import { renderProfile as renderAdminProfile } from './admin/profile.page.js';
import { getCurrentUser } from './auth/session.js';

const root = document.getElementById('app-root');

const ADMIN_ROLES = ['owner', 'admin', 'property_manager'];
const TENANT_ROLES = ['tenant'];
const PROVIDER_ROLES = ['service_provider'];

async function router() {
  const hash = window.location.hash || '#/login';
  const user = getCurrentUser();

  if (hash !== '#/login' && !user) {
    window.location.hash = '#/login';
    return;
  }

  switch (true) {
    case hash === '#/login':
      renderLogin(root);
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

    case hash === '#/admin/maintenance':
      if (!ADMIN_ROLES.includes(user.role)) return unauthorized();
      renderAdminMaintenance(root);
      break;

    case hash === '#/admin/payments':
      if (!ADMIN_ROLES.includes(user.role)) return unauthorized();
      renderAdminPayments(root);
      break;

    case hash === '#/admin/profile':
      if (!ADMIN_ROLES.includes(user.role)) return unauthorized();
      renderAdminProfile(root);
      break;

    case hash === '#/admin/leases':
      if (!ADMIN_ROLES.includes(user.role)) return unauthorized();
      renderLeases(root);
      break;

    case hash === '#/admin/complaints':
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

    case hash === '#/tenant/home':
      if (!TENANT_ROLES.includes(user.role)) return unauthorized();
      renderHome(root);
      break;

    case hash === '#/tenant/pay':
      if (!TENANT_ROLES.includes(user.role)) return unauthorized();
      renderPay(root);
      break;

    case hash === '#/tenant/maintenance':
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

    case hash === '#/tenant/messages':
      if (!TENANT_ROLES.includes(user.role)) return unauthorized();
      renderTenantMessages(root);
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

    case hash === '#/provider/messages':
      if (!PROVIDER_ROLES.includes(user.role)) return unauthorized();
      renderProviderMessages(root);
      break;

    case hash === '#/provider/info':
      if (!PROVIDER_ROLES.includes(user.role)) return unauthorized();
      renderProviderInfo(root);
      break;

    case hash === '#/provider/profile':
      if (!PROVIDER_ROLES.includes(user.role)) return unauthorized();
      renderProviderProfile(root);
      break;

    // '#/tenant' and '#/provider' land here once Phase 2/4 build those
    // dashboards — for now, send everyone somewhere sensible.
    default:
      if (user) {
        if (ADMIN_ROLES.includes(user.role)) {
          window.location.hash = '#/admin/districts';
        } else if (TENANT_ROLES.includes(user.role)) {
          window.location.hash = '#/tenant/home';
        } else if (PROVIDER_ROLES.includes(user.role)) {
          window.location.hash = '#/provider/tasks';
        } else {
          window.location.hash = '#/login';
        }
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
