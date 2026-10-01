// src/tenant/pay.page.js
import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { getCurrentUser } from '../auth/session.js';
import { formatMoney, formatDueDate, capitalise } from '../shared/format.js';

const DUE_BADGE = {
  outstanding: { cls: 'outstanding', label: 'Not yet marked paid' },
  pending: { cls: 'pending', label: 'Pending' },
};

const HISTORY_BADGE = {
  paid: { cls: 'finished', label: 'Paid' },
  pending: { cls: 'pending', label: 'Pending' },
  outstanding: { cls: 'outstanding', label: 'Outstanding' },
};

export async function renderPay(root) {
  const content = renderShell(root, { activeHref: '#/tenant/pay', title: 'Rent & accounts' });
  const user = getCurrentUser();

  content.innerHTML = `
    <div class="pagehead"><h2>Rent &amp; accounts</h2><p id="pay-sub"></p></div>
    <div id="pay-body">Loading...</div>
  `;

  const subEl = content.querySelector('#pay-sub');
  const bodyEl = content.querySelector('#pay-body');

  try {
    const [tenantUnit, payments, settings] = await Promise.all([
      apiFetch('/units/me').catch((err) => {
        if (err.message.includes('404')) return null;
        throw err;
      }),
      apiFetch('/payments'),
      // No bank details in app_settings today; the call must never block the page.
      apiFetch('/settings').catch(() => ({})),
    ]);

    if (!tenantUnit) {
      subEl.textContent = 'No unit assigned.';
      bodyEl.textContent = '';
      return;
    }

    const unitPayments = payments
      .filter((p) => p.unit_id === tenantUnit.id)
      .sort((a, b) => new Date(b.due_date) - new Date(a.due_date));

    subEl.textContent = subLineFor(tenantUnit);
    bodyEl.innerHTML = [
      thisMonthCard(unitPayments),
      howToPayCard(tenantUnit, settings),
      waterAndExtrasCard(unitPayments),
      historySection(unitPayments),
    ].join('');
  } catch (err) {
    bodyEl.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
  }
}

function thisMonthCard(unitPayments) {
  const rentDue = unitPayments
    .filter(p => p.type === 'rent' && (p.status === 'outstanding' || p.status === 'pending'))
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];

  if (!rentDue) {
    return '<div class="card"><span class="small" style="color:var(--forest);">Rent is up to date</span></div>';
  }

  const badge = DUE_BADGE[rentDue.status];
  const when = isThisMonthOrEarlier(rentDue.due_date) ? 'This month' : 'Upcoming';
  return `
    <div class="card">
      <div class="row">
        <span class="small muted">${when}</span>
        <span class="badge ${badge.cls}">${escapeHtml(badge.label)}</span>
      </div>
      <div class="amount" style="margin:6px 0;">${escapeHtml(formatMoney(rentDue.amount))}</div>
      <div class="small muted">Due ${escapeHtml(formatDueDate(rentDue.due_date))}</div>
    </div>
  `;
}

function howToPayCard(tenantUnit, settings) {
  const account = bankAccountBlock(tenantUnit, settings);
  return `
    <div class="card">
      <b class="small">How to pay</b>
      <p class="small muted" style="margin:6px 0;">Pay by EFT using the details below, or pay in person. Either way, the admin confirms receipt and marks it paid on their side, usually within a day. Payments aren't made inside the app.</p>
      ${account}
    </div>
  `;
}

// Bank details are never hardcoded and never logged: the block only renders
// what app_settings actually exposes.
function bankAccountBlock(tenantUnit, settings) {
  const source = settings && (settings.bank_details || settings.bankDetails) ? settings.bank_details || settings.bankDetails : settings || {};
  const bank = firstOf(source, ['bank_name', 'bankName', 'bank']);
  const type = firstOf(source, ['account_type', 'accountType']);
  const number = firstOf(source, ['account_number', 'accountNumber', 'account_no', 'accountNo']);

  if (!bank || !number) {
    return '<p class="small muted">Ask your property admin for the payment details.</p>';
  }

  const parts = [bank, type, number].filter(Boolean);
  const reference = tenantUnit.property_name
    ? `${tenantUnit.unit_number} ${tenantUnit.property_name}`
    : `Unit ${tenantUnit.unit_number}`;

  return `<div class="small" style="font-family:'Newsreader',serif;">${escapeHtml(parts.join(' · '))}<br>Reference: ${escapeHtml(reference)}</div>`;
}

function waterAndExtrasCard(unitPayments) {
  const extras = unitPayments
    .filter(p => p.type !== 'rent' && (p.status === 'outstanding' || p.status === 'pending'))
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  if (!extras.length) return '';

  const rows = extras.map((payment, i) => {
    const isLast = i === extras.length - 1;
    return `<div class="row small"${isLast ? '' : ' style="margin-bottom:8px;"'}>
      <span>${escapeHtml(`${capitalise(payment.type)} — due ${formatDueDate(payment.due_date)}`)}</span>
      <span>${escapeHtml(formatMoney(payment.amount))}</span>
    </div>`;
  }).join('');

  return `<div class="card"><b class="small">Water &amp; extras</b><div class="hairline"></div>${rows}</div>`;
}

function historySection(unitPayments) {
  if (!unitPayments.length) {
    return '<p class="small muted">No payments yet.</p>';
  }

  const rows = unitPayments.map(payment => {
    const badge = HISTORY_BADGE[payment.status] || { cls: payment.status, label: String(payment.status || '') };
    return `<tr>
      <td>${escapeHtml(formatDueDate(payment.due_date, 'short'))}</td>
      <td>${escapeHtml(capitalise(payment.type))}</td>
      <td>${escapeHtml(formatMoney(payment.amount))}</td>
      <td><span class="badge ${badge.cls}">${escapeHtml(badge.label)}</span></td>
    </tr>`;
  }).join('');

  return `
    <b class="small" style="display:block; margin:14px 0 8px;">Payment history</b>
    <div class="table-wrap">
      <table class="simple">
        <thead><tr><th>Date</th><th>Item</th><th>Amount</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function subLineFor(unit) {
  const parts = [];
  if (unit.property_name) parts.push(unit.property_name);
  if (unit.unit_number) parts.push(`Unit ${unit.unit_number}`);
  return parts.join(' · ');
}

function isThisMonthOrEarlier(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  if (date.getFullYear() !== now.getFullYear()) return date.getFullYear() < now.getFullYear();
  return date.getMonth() <= now.getMonth();
}

function firstOf(source, keys) {
  for (const key of keys) {
    if (source[key]) return source[key];
  }
  return '';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
