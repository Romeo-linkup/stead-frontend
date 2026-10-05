// src/tenant/pay.page.js
import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { toast } from '../shared/toast.js';
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

const MAX_RECEIPT_MB = 5 * 1024 * 1024;
const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export async function renderPay(root) {
  const content = renderShell(root, { activeHref: '#/tenant/pay', title: 'Rent & accounts' });

  content.innerHTML = `
    <div class="pagehead"><h2>Rent &amp; accounts</h2><p id="pay-sub"></p></div>
    <div id="pay-body">Loading...</div>
  `;

  await loadPayData(content);
}

async function loadPayData(content) {
  const subEl = content.querySelector('#pay-sub');
  const bodyEl = content.querySelector('#pay-body');
  if (!subEl || !bodyEl) return;

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

    wireReceiptEvents(content);
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

// Each payment is a card so its receipts and upload control fit
// at 360px (a table row could not hold a file input).
function historySection(unitPayments) {
  if (!unitPayments.length) {
    return '<p class="small muted">No payments yet.</p>';
  }

  return `
    <b class="small" style="display:block; margin:14px 0 8px;">Payment history</b>
    ${unitPayments.map(paymentCard).join('')}
  `;
}

function paymentCard(payment) {
  const badge = HISTORY_BADGE[payment.status] || { cls: payment.status, label: String(payment.status || '') };
  const isUnpaid = payment.status !== 'paid';
  const receipts = Array.isArray(payment.receipts) ? payment.receipts : [];

  const receiptsHtml = receipts.length
    ? receipts
        .map(
          (r) => `
        <div class="row small" style="margin-bottom:6px; gap:8px;">
          <a href="${escapeAttr(r.url)}" target="_blank" rel="noopener" style="overflow-wrap:anywhere;">Receipt ${escapeHtml(formatDueDate(r.created_at, 'short'))}</a>
          ${isUnpaid ? `<button class="btn danger sm remove-receipt-btn" type="button" data-payment-id="${escapeAttr(payment.id)}" data-receipt-id="${escapeAttr(r.id)}">Remove</button>` : ''}
        </div>
      `
        )
        .join('')
    : '<p class="small muted" style="margin:0;">No receipts uploaded.</p>';

  // Upload control + confirmation text only while unpaid.
  const uploadHtml = isUnpaid
    ? `
      <div class="hairline"></div>
      <label class="field-label" for="receipt-${escapeAttr(payment.id)}">Upload proof of payment</label>
      <input class="field" id="receipt-${escapeAttr(payment.id)}" type="file" accept="image/*,application/pdf" data-upload-payment-id="${escapeAttr(payment.id)}">
      <p class="small muted" style="margin:6px 0 0;">The property manager will confirm your payment.</p>
    `
    : '';

  return `
    <div class="card" style="margin-bottom:10px;">
      <div class="row">
        <div>
          <b class="small">${escapeHtml(capitalise(payment.type))} · ${escapeHtml(formatMoney(payment.amount))}</b>
          <div class="small muted">Due ${escapeHtml(formatDueDate(payment.due_date, 'short'))}</div>
        </div>
        <span class="badge ${badge.cls}">${escapeHtml(badge.label)}</span>
      </div>
      <div style="margin-top:10px;">${receiptsHtml}</div>
      ${uploadHtml}
    </div>
  `;
}

function wireReceiptEvents(content) {
  content.querySelectorAll('input[type="file"][data-upload-payment-id]').forEach((input) => {
    input.addEventListener('change', async () => {
      const paymentId = input.dataset.uploadPaymentId;
      const file = input.files[0];
      if (!file) return;

      // Client-side type + size checks before any upload.
      if (!RECEIPT_TYPES.includes(file.type)) {
        toast('Only JPG, PNG, WebP or PDF files are allowed.');
        input.value = '';
        return;
      }
      if (file.size > MAX_RECEIPT_MB) {
        toast('File size must be 5MB or less.');
        input.value = '';
        return;
      }

      const formData = new FormData();
      formData.append('receipt', file);

      input.disabled = true;
      try {
        await apiFetch(`/payments/${encodeURIComponent(paymentId)}/receipts`, {
          method: 'POST',
          body: formData,
          isFormData: true,
        });
        toast('Receipt uploaded.');
        await loadPayData(content);
      } catch (err) {
        toast(err.message || 'Failed to upload receipt.');
        input.disabled = false;
        input.value = '';
      }
    });
  });

  content.querySelectorAll('.remove-receipt-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const paymentId = btn.dataset.paymentId;
      const receiptId = btn.dataset.receiptId;
      if (!window.confirm('Remove this receipt?')) return;

      btn.disabled = true;
      try {
        await apiFetch(
          `/payments/${encodeURIComponent(paymentId)}/receipts/${encodeURIComponent(receiptId)}`,
          { method: 'DELETE' }
        );
        toast('Receipt removed.');
        await loadPayData(content);
      } catch (err) {
        toast(err.message || 'Failed to remove receipt.');
        btn.disabled = false;
      }
    });
  });
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

function escapeAttr(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
