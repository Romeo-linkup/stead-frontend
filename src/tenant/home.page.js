// src/tenant/home.page.js
import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { getCurrentUser } from '../auth/session.js';
import { formatMoney, formatDueDate, capitalise } from '../shared/format.js';

const PAYMENT_BADGE = {
  outstanding: { cls: 'outstanding', label: 'Not yet marked paid' },
  pending: { cls: 'pending', label: 'Pending' },
  paid: { cls: 'finished', label: 'Paid' },
};

export async function renderHome(root) {
  const content = renderShell(root, { activeHref: '#/tenant/home', title: 'Home' });
  const user = getCurrentUser();

  content.innerHTML = `
    <div class="pagehead">
      <h2 id="home-greeting">${escapeHtml(greetingFor(user))}</h2>
      <p id="home-sub"></p>
    </div>
    <div class="card" id="rent-card">Loading...</div>
    <div class="card" id="activity-card">Loading...</div>
  `;

  const rentCard = content.querySelector('#rent-card');
  const activityCard = content.querySelector('#activity-card');
  const subEl = content.querySelector('#home-sub');

  try {
    const [tenantUnit, payments, maintenance, settings] = await Promise.all([
      apiFetch('/units/me').catch((err) => {
        if (err.message.includes('404')) return null;
        throw err;
      }),
      apiFetch('/payments'),
      apiFetch('/maintenance'),
      // No notice period in app_settings today; probed so the row appears
      // as soon as the backend exposes one. Never blocks the cards.
      apiFetch('/settings').catch(() => null),
    ]);

    if (!tenantUnit) {
      const empty = '<p class="small muted">No unit assigned.</p>';
      rentCard.innerHTML = empty;
      activityCard.innerHTML = empty;
      return;
    }

    subEl.textContent = subLineFor(tenantUnit);

    const unitPayments = payments.filter((p) => p.unit_id === tenantUnit.id);
    const unitMaintenance = maintenance.filter((m) => m.unit_id === tenantUnit.id);

    rentCard.innerHTML = rentCardHtml(unitPayments);
    activityCard.innerHTML = activityCardHtml(unitMaintenance, unitPayments, noticePeriodMonths(settings));
  } catch (err) {
    const failure = `<p class="error-text">${escapeHtml(err.message)}</p>`;
    rentCard.innerHTML = failure;
    activityCard.innerHTML = failure;
  }
}

function rentCardHtml(unitPayments) {
  const nextPayment = unitPayments
    .filter(p => p.status === 'outstanding' || p.status === 'pending')
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];

  const viewPayments = '<a href="#/tenant/pay" class="btn secondary sm" style="margin-top:10px;">View payments</a>';

  if (!nextPayment) {
    return `<div class="small" style="color:var(--forest);">No outstanding payments</div>${viewPayments}`;
  }

  const badge = PAYMENT_BADGE[nextPayment.status];
  return `
    <div class="row">
      <span class="small muted">${escapeHtml(`${paymentWord(nextPayment.type)} due ${formatDueDate(nextPayment.due_date)}`)}</span>
      <span class="badge ${badge.cls}">${escapeHtml(badge.label)}</span>
    </div>
    <div class="row" style="margin-top:6px;"><span class="amount">${escapeHtml(formatMoney(nextPayment.amount))}</span></div>
    <p class="small muted" style="margin:8px 0 0;">Pay via the bank details on the Rent &amp; accounts page — the admin will mark it as received.</p>
    ${viewPayments}
  `;
}

function activityCardHtml(unitMaintenance, unitPayments, noticeMonths) {
  const items = [
    ...unitMaintenance.map(m => ({ kind: 'maintenance', at: m.created_at, category: m.category, status: m.status })),
    ...unitPayments.map(p => ({ kind: 'payment', at: p.created_at, type: p.type, amount: p.amount, status: p.status })),
  ]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 5);

  const noticeRow = noticeMonths == null
    ? ''
    : `<div class="row small"><span>Notice period</span><span class="small muted">${escapeHtml(noticeMonths)} months required</span></div>`;

  if (!items.length && !noticeRow) {
    return '<p class="small muted">No recent activity.</p>';
  }

  const rows = items.map((item, i) => {
    const isLast = i === items.length - 1 && !noticeRow;
    return `<div class="row small"${isLast ? '' : ' style="margin-bottom:8px;"'}>
      <span>${escapeHtml(item.kind === 'maintenance' ? maintenanceText(item) : paymentActivityText(item))}</span>
      <span class="badge ${activityBadge(item).cls}">${escapeHtml(activityBadge(item).label)}</span>
    </div>`;
  }).join('');

  return `<b class="small">Recent activity</b><div class="hairline"></div>${rows}${noticeRow}`;
}

function maintenanceText(item) {
  return item.category ? `Maintenance — ${item.category}` : 'Maintenance';
}

function paymentActivityText(item) {
  return `${paymentWord(item.type)} — ${formatMoney(item.amount)}`;
}

function activityBadge(item) {
  if (item.kind === 'maintenance') {
    return { cls: item.status, label: capitalise(item.status) };
  }
  return PAYMENT_BADGE[item.status] || { cls: item.status, label: String(item.status || '') };
}

function paymentWord(type) {
  if (type === 'other') return 'Payment';
  return capitalise(type) || 'Payment';
}

function greetingFor(user) {
  const hour = new Date().getHours();
  const partOfDay = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = String(user.name || '').trim().split(' ')[0];
  return firstName ? `${partOfDay}, ${firstName}` : partOfDay;
}

function subLineFor(unit) {
  const parts = [];
  if (unit.property_name) parts.push(unit.property_name);
  if (unit.unit_number) parts.push(`Unit ${unit.unit_number}`);
  return parts.join(' · ');
}

function noticePeriodMonths(settings) {
  if (!settings) return null;
  const value = settings.notice_period_months ?? settings.noticePeriod ?? settings.notice_period;
  const months = Number(value);
  return Number.isFinite(months) ? months : null;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
