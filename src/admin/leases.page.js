// src/admin/leases.page.js
import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { toast } from '../shared/toast.js';
import { createSignaturePad, fileToSignatureDataUrl } from '../shared/signature-pad.js';

export async function renderLeases(root) {
  const content = renderShell(root, { activeHref: '#/admin/tenants', title: 'Leases' });
  const query = new URLSearchParams(window.location.hash.split('?')[1] || '');

  if (query.has('view')) return renderLeaseView(content, query.get('view'));
  if (query.has('edit')) return renderLeaseForm(content, { leaseId: query.get('edit') });
  if (query.has('unit')) return renderLeaseForm(content, { unitId: query.get('unit') });
  return renderLeaseList(content);
}

const CLAUSES = [
  ['additional_charges', 'Additional charges', 'The tenant shall be responsible for utilities and services as specified in the schedule.'],
  ['payments', 'Payments', 'Rent shall be paid by electronic transfer to the landlord\'s designated bank account. The tenant shall provide proof of payment upon request.'],
  ['pets', 'Pets', 'No pets shall be kept on the premises without the landlord\'s prior written consent.'],
  ['assignment_subletting', 'Assignment & subletting', 'The tenant shall not assign or sublet the premises without the landlord\'s prior written consent.'],
  ['sundry_duties', 'Sundry duties', 'The tenant shall keep the premises in a clean and habitable condition, and shall comply with all reasonable rules and regulations of the property.'],
  ['maintenance', 'Maintenance', 'The landlord shall be responsible for structural maintenance, while the tenant shall be responsible for day-to-day maintenance and minor repairs.'],
  ['special_remedy', 'Special remedy', 'In the event of breach, the landlord shall have all remedies available at law and equity, including but not limited to eviction and damages.'],
  ['option_of_renewal', 'Option of renewal', 'This lease may be renewed upon mutual agreement of both parties, subject to rent adjustment and terms to be negotiated.'],
];

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = String(value == null ? '' : value);
  return div.innerHTML;
}

function statusBadge(status) {
  const badges = {
    draft: ['new', 'Draft'],
    sent: ['pending', 'Awaiting signature'],
    signed: ['finished', 'Signed'],
    superseded: ['outstanding', 'Superseded'],
    expired: ['outstanding', 'Expired'],
  };
  const [type, label] = badges[status] || ['outstanding', String(status || 'Unknown')];
  return `<span class="badge ${type}">${escapeHtml(label)}</span>`;
}

function dateOnly(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function formatDate(value) {
  const day = dateOnly(value);
  if (!day) return '';
  const date = new Date(`${day}T12:00:00`);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-ZA');
}

function unitLabel(unit) {
  return `${unit.property_name || ''} - ${unit.unit_number || ''}`.trim();
}

function withDisabledButtons(container, action) {
  const buttons = [...container.querySelectorAll('button')];
  buttons.forEach((button) => { button.disabled = true; });
  return Promise.resolve()
    .then(action)
    .finally(() => buttons.forEach((button) => { button.disabled = false; }));
}

function showError(error, fallback) {
  toast(error?.message || fallback);
}

async function renderLeaseList(content) {
  content.innerHTML = `
    <div class="pagehead"><h2>Leases</h2><p>All lease agreements</p></div>
    <section class="card">
      <h3>New lease</h3>
      <div class="field">
        <label class="field-label" for="new-lease-unit">Unit</label>
        <select class="field" id="new-lease-unit" aria-label="Unit"><option value="">Loading units...</option></select>
      </div>
      <button class="btn brass sm" id="start-lease" type="button">Start</button>
    </section>
    <div id="leases-table-state" class="table-wrap"><p class="small muted">Loading leases...</p></div>
  `;
  const unitSelect = content.querySelector('#new-lease-unit');
  const tableState = content.querySelector('#leases-table-state');

  content.querySelector('#start-lease').addEventListener('click', () => {
    if (!unitSelect.value) {
      toast('Select a unit first.');
      return;
    }
    window.location.hash = `#/admin/leases?unit=${encodeURIComponent(unitSelect.value)}`;
  });

  try {
    const [units, leases] = await Promise.all([apiFetch('/units'), apiFetch('/leases')]);
    unitSelect.innerHTML = `<option value="">Select a unit</option>${units.map((unit) =>
      `<option value="${escapeHtml(unit.id)}">${escapeHtml(unitLabel(unit))}</option>`
    ).join('')}`;
    if (!leases.length) {
      tableState.innerHTML = '<p class="small muted">No leases yet.</p>';
      return;
    }

    tableState.innerHTML = `
      <table class="simple">
        <thead><tr><th>Unit</th><th>Lessee</th><th>Status</th><th>Term</th><th>Actions</th></tr></thead>
        <tbody>${leases.map((lease) => `<tr>
          <td>${escapeHtml(lease.property_name)} · ${escapeHtml(lease.unit_number)}</td>
          <td>${escapeHtml(lease.lessee_name)}</td>
          <td>${leaseStatus(lease)}</td>
          <td>${escapeHtml(formatDate(lease.start_date))} - ${escapeHtml(formatDate(lease.end_date))}</td>
          <td><div class="row lease-actions">${leaseActions(lease)}</div></td>
        </tr>`).join('')}</tbody>
      </table>
    `;
    tableState.querySelectorAll('button[data-action]').forEach((button) => {
      button.addEventListener('click', () => handleListAction(button, tableState));
    });
  } catch (error) {
    tableState.innerHTML = '<p class="small muted">Leases could not be loaded.</p>';
    showError(error, 'Unable to load leases.');
  }
}

function leaseActions(lease) {
  const id = escapeHtml(lease.id);
  const edit = `<a class="btn secondary sm" href="#/admin/leases?edit=${encodeURIComponent(lease.id)}">Edit</a>`;
  const view = `<a class="btn secondary sm" href="#/admin/leases?view=${encodeURIComponent(lease.id)}">View</a>`;
  const sign = `<a class="btn brass sm" href="#/admin/leases?view=${encodeURIComponent(lease.id)}">Sign as lessor</a>`;
  const button = (action, label, style = 'secondary') =>
    `<button class="btn ${style} sm" type="button" data-action="${action}" data-id="${id}">${label}</button>`;
  if (lease.status === 'draft') {
    return `${edit}${lease.lessor_signature_url ? button('send', 'Send', 'brass') : sign}${button('delete', 'Delete')}`;
  }
  if (lease.status === 'sent') return `${button('edit-sent', 'Edit')}${lease.lessor_signature_url ? view : sign}`;
  if (lease.status === 'signed') {
    return `${view}${lease.lessor_signature_url ? '' : sign}${button('renew', 'Renew / amend', 'brass')}`;
  }
  return view;
}

function leaseStatus(lease) {
  return `${statusBadge(lease.status)}${lease.status === 'signed' && !lease.lessor_signature_url
    ? '<div class="small muted">Lessor not signed</div>'
    : ''}`;
}

async function handleListAction(button, container) {
  const { action, id } = button.dataset;
  if (action === 'send' && !confirm('Send this lease to the tenant for signature?')) return;
  if (action === 'delete' && !confirm('Delete this draft lease? This cannot be undone.')) return;
  if (action === 'edit-sent' && !confirm('Editing this sent lease will withdraw it back to draft. Continue?')) return;
  if (action === 'renew' && !confirm('Create a new lease version that replaces this one after the tenant signs?')) return;
  try {
    await withDisabledButtons(container, async () => {
      if (action === 'send') {
        await apiFetch(`/leases/${encodeURIComponent(id)}/send`, { method: 'PATCH' });
        toast('Lease sent for signature.');
        await renderLeaseList(container.closest('.content') || container.parentElement);
      } else if (action === 'delete') {
        await apiFetch(`/leases/${encodeURIComponent(id)}`, { method: 'DELETE' });
        toast('Draft lease deleted.');
        await renderLeaseList(container.closest('.content') || container.parentElement);
      } else if (action === 'edit-sent') {
        window.location.hash = `#/admin/leases?edit=${encodeURIComponent(id)}`;
      } else if (action === 'renew') {
        const renewed = await apiFetch(`/leases/${encodeURIComponent(id)}/supersede`, { method: 'POST' });
        window.location.hash = `#/admin/leases?edit=${encodeURIComponent(renewed.id)}`;
      }
    });
  } catch (error) {
    showError(error, 'Unable to update the lease.');
  }
}

function parseTerms(value) {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      value = {};
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function calculateEndDate(startDate, durationMonths) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate || '') || !Number.isInteger(durationMonths) || durationMonths < 1) return '';
  const [year, month, day] = startDate.split('-').map(Number);
  const monthIndex = month - 1 + durationMonths;
  const targetYear = year + Math.floor(monthIndex / 12);
  const targetMonth = monthIndex % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const anniversaryDay = Math.min(day, lastDay);
  const end = new Date(Date.UTC(targetYear, targetMonth, anniversaryDay - 1));
  return `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, '0')}-${String(end.getUTCDate()).padStart(2, '0')}`;
}

async function renderLeaseForm(content, { unitId = null, leaseId = null }) {
  content.innerHTML = '<div class="card"><p class="small muted">Loading lease details...</p></div>';
  let lease = null;
  let unit = null;
  let units = [];
  let settings = { notice_period_months: 3 };
  let latestLease = null;
  let tenantName = '';

  if (leaseId) {
    try {
      [lease, settings] = await Promise.all([
        apiFetch(`/leases/${encodeURIComponent(leaseId)}`),
        apiFetch('/settings').catch(() => settings),
      ]);
    } catch (error) {
      showError(error, 'Unable to load lease.');
      content.innerHTML = '<div class="card"><p class="small muted">Lease could not be loaded.</p><a class="btn secondary sm" href="#/admin/leases">Back to leases</a></div>';
      return;
    }
    if (['signed', 'superseded', 'expired'].includes(lease.status)) {
      content.innerHTML = `
        <div class="pagehead"><h2>Lease</h2></div>
        <section class="card">
          <h3>This lease is locked.</h3>
          <p>A signed lease can't be changed. To change terms, create a new version that replaces it once the tenant signs.</p>
          <div class="row">
            ${lease.status === 'signed' ? `<button class="btn brass sm" id="locked-renew" type="button" data-id="${escapeHtml(lease.id)}">Renew / amend</button>` : ''}
            <a class="btn secondary sm" href="#/admin/leases?view=${encodeURIComponent(lease.id)}">View lease</a>
          </div>
        </section>
      `;
      content.querySelector('#locked-renew')?.addEventListener('click', async (event) => {
        if (!confirm('Create a new lease version that replaces this one after the tenant signs?')) return;
        const button = event.currentTarget;
        try {
          await withDisabledButtons(content, async () => {
            const renewed = await apiFetch(`/leases/${encodeURIComponent(button.dataset.id)}/supersede`, { method: 'POST' });
            window.location.hash = `#/admin/leases?edit=${encodeURIComponent(renewed.id)}`;
          });
        } catch (error) {
          showError(error, 'Unable to renew this lease.');
        }
      });
      return;
    }
    units = await apiFetch('/units').catch(() => []);
    unit = units.find((candidate) => String(candidate.id) === String(lease.unit_id)) || {
      id: lease.unit_id,
      property_name: lease.property_name,
      unit_number: lease.unit_number,
    };
  } else {
    try {
      units = await apiFetch('/units');
    } catch (error) {
      showError(error, 'Unable to load units.');
      content.innerHTML = '<div class="card"><p class="small muted">Units could not be loaded.</p></div>';
      return;
    }
    unit = units.find((candidate) => String(candidate.id) === String(unitId));
    if (!unit) {
      toast('Unit not found.');
      window.location.hash = '#/admin/leases';
      return;
    }
    [settings, latestLease] = await Promise.all([
      apiFetch('/settings').catch(() => settings),
      apiFetch('/leases').then((items) => items[0] || null).catch(() => null),
      apiFetch('/users?role=tenant').then((users) => {
        const tenant = users.find((item) => String(item.id ?? item.user_id) === String(unit.tenant_user_id));
        tenantName = tenant?.name || '';
      }).catch(() => {}),
    ]);
  }

  const terms = parseTerms(lease?.terms_json);
  const configuredNoticePeriod = Number(settings?.notice_period_months);
  const defaultNoticePeriod = Number.isInteger(configuredNoticePeriod)
    && configuredNoticePeriod >= 1
    && configuredNoticePeriod <= 12
    ? configuredNoticePeriod
    : 3;
  const leaseNoticePeriod = Number(terms.notice_period_months);
  const initialNoticePeriod = Number.isInteger(leaseNoticePeriod)
    && leaseNoticePeriod >= 1
    && leaseNoticePeriod <= 12
    ? leaseNoticePeriod
    : defaultNoticePeriod;
  const initial = {
    lessor_name: lease?.lessor_name || latestLease?.lessor_name || '',
    lessor_id_number: lease?.lessor_id_number || latestLease?.lessor_id_number || '',
    lessee_name: lease?.lessee_name || tenantName || '',
    lessee_id_number: lease?.lessee_id_number || '',
    start_date: dateOnly(lease?.start_date),
    duration_months: lease?.duration_months ?? 12,
    end_date: dateOnly(lease?.end_date),
    rent_amount: lease?.rent_amount ?? unit.rent_amount ?? '',
    rent_increase_pct: lease?.rent_increase_pct ?? '',
    deposit_amount: lease?.deposit_amount ?? '',
    notice_period_months: initialNoticePeriod,
    cancellation_penalty: lease?.cancellation_penalty ?? '',
  };
  const clauseFields = CLAUSES.map(([key, label, fallback]) => `
    <div class="field">
      <label class="field-label" for="clause-${key}">${escapeHtml(label)}</label>
      <textarea class="field" id="clause-${key}" name="clause_${key}" rows="4">${escapeHtml(terms[key] ?? fallback)}</textarea>
    </div>
  `).join('');
  const wasSent = lease?.status === 'sent';

  content.innerHTML = `
    <div class="pagehead"><h2>${lease ? 'Edit lease' : 'New lease'}</h2><p>${escapeHtml(unitLabel(unit))}</p></div>
    ${wasSent ? '<section class="card"><p>This lease has been sent. Saving changes will withdraw it back to draft - you will need to send it again.</p></section>' : ''}
    ${lease?.lessor_signature_url ? '<section class="card"><p>This lease has a lessor signature. Saving changes removes it and you will need to sign again before sending.</p></section>' : ''}
    <form id="lease-form">
      <section class="card">
        <div class="field"><label class="field-label" for="lease-unit-display">Unit</label><input class="field" id="lease-unit-display" value="${escapeHtml(unitLabel(unit))}" readonly></div>
        <div class="grid2">
          ${textInput('lessor_name', 'Lessor name', initial.lessor_name, true)}
          ${textInput('lessor_id_number', 'Lessor ID number', initial.lessor_id_number, true)}
          ${textInput('lessee_name', 'Lessee name', initial.lessee_name, true)}
          ${textInput('lessee_id_number', 'Lessee ID number', initial.lessee_id_number, true)}
          ${dateInput('start_date', 'Start date', initial.start_date)}
          ${numberInput('duration_months', 'Duration (months)', initial.duration_months, '1', '120', '1')}
          ${dateInput('end_date', 'End date', initial.end_date)}
          ${numberInput('rent_amount', 'Monthly rent (R)', initial.rent_amount, '0.01', '', '0.01')}
          ${numberInput('rent_increase_pct', 'Rent increase on renewal (%) optional', initial.rent_increase_pct, '0', '100', '0.01', false)}
          ${numberInput('deposit_amount', 'Deposit (R)', initial.deposit_amount, '0', '', '0.01')}
          ${numberInput('notice_period_months', 'Notice period (months)', initial.notice_period_months, '1', '12', '1')}
          ${numberInput('cancellation_penalty', 'Cancellation penalty (R) optional', initial.cancellation_penalty, '0', '', '0.01', false)}
        </div>
      </section>
      <section class="card"><h3>Clauses</h3>${clauseFields}</section>
      <div class="row lease-form-actions">
        <button class="btn brass" type="submit">${lease ? 'Save changes' : 'Save as draft'}</button>
        <button class="btn secondary" id="cancel-lease" type="button">Cancel</button>
      </div>
    </form>
  `;

  const form = content.querySelector('#lease-form');
  const startField = form.elements.start_date;
  const durationField = form.elements.duration_months;
  const endField = form.elements.end_date;
  let endDateManuallyEdited = false;
  endField.addEventListener('input', () => { endDateManuallyEdited = true; });
  const updateCalculatedEndDate = () => {
    if (endDateManuallyEdited) return;
    const calculated = calculateEndDate(startField.value, Number(durationField.value));
    if (calculated) endField.value = calculated;
  };
  startField.addEventListener('input', updateCalculatedEndDate);
  durationField.addEventListener('input', updateCalculatedEndDate);
  form.querySelector('#cancel-lease').addEventListener('click', () => { window.location.hash = '#/admin/tenants'; });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const body = {
      lessor_name: form.elements.lessor_name.value.trim(),
      lessor_id_number: form.elements.lessor_id_number.value.trim(),
      lessee_name: form.elements.lessee_name.value.trim(),
      lessee_id_number: form.elements.lessee_id_number.value.trim(),
      start_date: form.elements.start_date.value,
      duration_months: Number(form.elements.duration_months.value),
      end_date: form.elements.end_date.value,
      rent_amount: Number(form.elements.rent_amount.value),
      deposit_amount: Number(form.elements.deposit_amount.value),
      terms_json: {
        ...Object.fromEntries(CLAUSES.map(([key]) => [key, form.elements[`clause_${key}`].value])),
        notice_period_months: Number(form.elements.notice_period_months.value),
      },
    };
    if (form.elements.rent_increase_pct.value !== '') body.rent_increase_pct = Number(form.elements.rent_increase_pct.value);
    if (form.elements.cancellation_penalty.value !== '') body.cancellation_penalty = Number(form.elements.cancellation_penalty.value);
    if (!lease) body.unit_id = Number(unit.id);

    try {
      await withDisabledButtons(form, async () => {
        if (lease) {
          const updatedLease = await apiFetch(`/leases/${encodeURIComponent(lease.id)}`, { method: 'PATCH', body });
          if (updatedLease.updated_at === lease.updated_at) {
            toast('No changes to save.');
            window.location.hash = '#/admin/tenants';
          } else if (lease.lessor_signature_url && !updatedLease.lessor_signature_url) {
            toast('Saved. The lessor signature was removed - sign again before sending.');
            window.location.hash = `#/admin/leases?view=${encodeURIComponent(lease.id)}`;
          } else {
            toast(wasSent ? 'Saved. The lease is back in draft - send it again when ready.' : 'Lease updated.');
            window.location.hash = '#/admin/tenants';
          }
        } else {
          await apiFetch('/leases', { method: 'POST', body });
          toast('Lease saved as draft.');
          window.location.hash = '#/admin/tenants';
        }
      });
    } catch (error) {
      showError(error, 'Unable to save lease.');
    }
  });
}

function textInput(name, label, value, required) {
  return `<div class="field"><label class="field-label" for="lease-${name}">${escapeHtml(label)}</label><input class="field" id="lease-${name}" name="${name}" value="${escapeHtml(value)}" maxlength="120" ${required ? 'required' : ''}></div>`;
}

function dateInput(name, label, value) {
  return `<div class="field"><label class="field-label" for="lease-${name}">${escapeHtml(label)}</label><input class="field" id="lease-${name}" name="${name}" type="date" value="${escapeHtml(value)}" required></div>`;
}

function numberInput(name, label, value, min, max, step, required = true) {
  return `<div class="field"><label class="field-label" for="lease-${name}">${escapeHtml(label)}</label><input class="field" id="lease-${name}" name="${name}" type="number" value="${escapeHtml(value)}" min="${min}" ${max ? `max="${max}"` : ''} step="${step}" ${required ? 'required' : ''}></div>`;
}

async function renderLeaseView(content, leaseId) {
  try {
    const lease = await apiFetch(`/leases/${encodeURIComponent(leaseId)}`);
    const title = `${lease.property_name || ''} · ${lease.unit_number || ''}`;
    let actions = '';
    if (lease.status === 'draft') {
      actions += `<a class="btn secondary sm" href="#/admin/leases?edit=${encodeURIComponent(lease.id)}">Edit</a>`;
      actions += lease.lessor_signature_url
        ? '<button class="btn brass sm" id="view-send" type="button">Send for signature</button>'
        : '<p class="small muted">Sign as lessor to enable sending.</p>';
    } else if (lease.status === 'sent') {
      actions += '<button class="btn secondary sm" id="view-edit-sent" type="button">Edit</button>';
      if (!lease.lessor_signature_url) {
        actions += '<p class="small muted">Awaiting lessor signature - the tenant cannot sign until you do.</p>';
      }
    } else if (lease.status === 'signed') {
      actions += `<button class="btn brass sm" id="view-renew" type="button" data-id="${escapeHtml(lease.id)}">Renew / amend</button>`;
    }
    content.innerHTML = `
      <div class="pagehead"><h2>${escapeHtml(title)}</h2><p>${statusBadge(lease.status)}</p></div>
      <section class="card" id="lease-rendered"></section>
      <section class="card" id="lessor-signature-card"></section>
      ${lease.status === 'signed' ? `<p class="small muted">Signed on ${escapeHtml(formatDate(lease.signed_at))}</p>` : ''}
      <div class="row lease-view-actions">
        ${actions}
        <a class="btn secondary sm" href="#/admin/leases">Back</a>
      </div>
    `;
    content.querySelector('#lease-rendered').innerHTML = lease.rendered_html;
    await renderLessorSignatureCard(content.querySelector('#lessor-signature-card'), lease, () => renderLeaseView(content, leaseId));
    content.querySelector('#view-send')?.addEventListener('click', async (event) => {
      if (!confirm('Send this lease to the tenant for signature?')) return;
      const button = event.currentTarget;
      button.disabled = true;
      try {
        await apiFetch(`/leases/${encodeURIComponent(lease.id)}/send`, { method: 'PATCH' });
        toast('Lease sent for signature.');
        window.location.hash = '#/admin/tenants';
      } catch (error) {
        showError(error, 'Unable to send lease.');
        button.disabled = false;
      }
    });
    content.querySelector('#view-edit-sent')?.addEventListener('click', (event) => {
      if (!confirm('Editing this sent lease will withdraw it back to draft. Continue?')) return;
      event.currentTarget.disabled = true;
      window.location.hash = `#/admin/leases?edit=${encodeURIComponent(lease.id)}`;
    });
    content.querySelector('#view-renew')?.addEventListener('click', (event) => renewLease(event.currentTarget, lease.id));
  } catch (error) {
    showError(error, 'Unable to load lease.');
    content.innerHTML = '<div class="card"><p class="small muted">Lease could not be loaded.</p><a class="btn secondary sm" href="#/admin/leases">Back to leases</a></div>';
  }
}

async function renewLease(button, leaseId) {
  if (!confirm('Create a new lease version that replaces this one after the tenant signs?')) return;
  button.disabled = true;
  try {
    const renewed = await apiFetch(`/leases/${encodeURIComponent(leaseId)}/supersede`, { method: 'POST' });
    window.location.hash = `#/admin/leases?edit=${encodeURIComponent(renewed.id)}`;
  } catch (error) {
    showError(error, 'Unable to renew this lease.');
    button.disabled = false;
  }
}

async function renderLessorSignatureCard(card, lease, onSigned) {
  if (lease.lessor_signature_url) {
    card.innerHTML = `
      <h3>Lessor signature</h3>
      <div class="sig-preview"><img src="${escapeHtml(lease.lessor_signature_url)}" alt="Lessor signature"></div>
      <p class="small muted">Signed by the lessor on ${escapeHtml(formatDate(lease.lessor_signed_at))}</p>
      ${['draft', 'sent'].includes(lease.status) ? '<p class="small muted">Editing this lease removes the signature and you will need to sign again.</p>' : ''}
    `;
    return;
  }

  if (!['draft', 'sent', 'signed'].includes(lease.status)) {
    card.innerHTML = '<h3>Lessor signature</h3><p class="small muted">Not yet signed</p>';
    return;
  }

  let savedImageUrl = null;
  try {
    const saved = await apiFetch('/leases/signature/saved');
    savedImageUrl = saved.image_url || null;
  } catch (error) {
    showError(error, 'Unable to load saved signature.');
  }

  card.innerHTML = `
    <h3>Lessor signature</h3>
    <div class="sig-mode-buttons" role="group" aria-label="Signature method">
      <button class="btn brass sm" type="button" data-signature-mode="draw" aria-pressed="true">Draw</button>
      <button class="btn secondary sm" type="button" data-signature-mode="upload" aria-pressed="false">Upload image</button>
      <button class="btn secondary sm" type="button" data-signature-mode="saved" aria-pressed="false" ${savedImageUrl ? '' : 'hidden'}>Saved signature</button>
    </div>
    <div class="sig-panel" data-signature-panel="draw">
      <div class="sig-pad"><canvas aria-label="Draw lessor signature"></canvas></div>
      <button class="btn secondary sm" type="button" data-clear-signature>Clear</button>
    </div>
    <div class="sig-panel" data-signature-panel="upload" hidden>
      <label class="field-label" for="lessor-signature-upload">Upload image</label>
      <input class="field" id="lessor-signature-upload" type="file" accept="image/png,image/jpeg,image/webp">
      <p class="small muted">A PNG with a transparent or white background works best, e.g. exported from Word.</p>
      <div data-upload-preview></div>
    </div>
    <div class="sig-panel" data-signature-panel="saved" hidden>
      ${savedImageUrl ? `<div class="sig-preview"><img src="${escapeHtml(savedImageUrl)}" alt="Saved lessor signature"></div>
      <p><button class="btn secondary sm" type="button" data-remove-saved>Remove saved signature</button></p>` : ''}
    </div>
    <label class="small muted sig-remember"><input type="checkbox" data-remember-signature> Remember this signature for future leases</label>
    <div class="sig-submit-row">
      <button class="btn brass sm" type="button" data-sign-lessor>Sign as lessor</button>
      <span class="small muted">Signing confirms the terms above are correct.</span>
    </div>
  `;

  let mode = 'draw';
  let pad = null;
  let uploadedDataUrl = null;
  const signButton = card.querySelector('[data-sign-lessor]');
  const uploadInput = card.querySelector('#lessor-signature-upload');
  const uploadPreview = card.querySelector('[data-upload-preview]');
  const remember = card.querySelector('[data-remember-signature]');
  const savedModeButton = card.querySelector('[data-signature-mode="saved"]');

  function setMode(nextMode) {
    mode = nextMode;
    card.querySelectorAll('[data-signature-mode]').forEach((button) => {
      const active = button.dataset.signatureMode === mode;
      button.classList.toggle('brass', active);
      button.classList.toggle('secondary', !active);
      button.setAttribute('aria-pressed', String(active));
    });
    card.querySelectorAll('[data-signature-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.signaturePanel !== mode;
    });
    remember.closest('label').hidden = mode === 'saved';
    if (mode === 'draw' && !pad) {
      pad = createSignaturePad(card.querySelector('.sig-pad canvas'));
    }
  }

  card.querySelectorAll('[data-signature-mode]').forEach((button) => {
    button.addEventListener('click', () => setMode(button.dataset.signatureMode));
  });
  card.querySelector('[data-clear-signature]').addEventListener('click', () => pad?.clear());
  uploadInput.addEventListener('change', async () => {
    uploadedDataUrl = null;
    uploadPreview.innerHTML = '';
    const file = uploadInput.files?.[0];
    if (!file) return;
    try {
      uploadedDataUrl = await fileToSignatureDataUrl(file);
      uploadPreview.innerHTML = `<div class="sig-preview"><img src="${escapeHtml(uploadedDataUrl)}" alt="Signature upload preview"></div>`;
    } catch (error) {
      uploadInput.value = '';
      showError(error, 'Unable to use that image.');
    }
  });
  card.querySelector('[data-remove-saved]')?.addEventListener('click', async (event) => {
    if (!confirm('Remove your saved signature?')) return;
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await apiFetch('/leases/signature/saved', { method: 'DELETE' });
      toast('Saved signature removed.');
      savedModeButton.hidden = true;
      setMode('draw');
    } catch (error) {
      showError(error, 'Unable to remove saved signature.');
      button.disabled = false;
    }
  });
  signButton.addEventListener('click', async () => {
    const body = { lease_updated_at: lease.updated_at };
    if (mode === 'draw') {
      if (!pad || pad.isBlank()) {
        toast('Please sign first.');
        return;
      }
      body.signature_data_url = pad.toDataUrl();
      body.save_for_later = remember.checked;
    } else if (mode === 'upload') {
      if (!uploadedDataUrl) {
        toast('Please choose an image.');
        return;
      }
      body.signature_data_url = uploadedDataUrl;
      body.save_for_later = remember.checked;
    } else {
      body.use_saved = true;
    }

    signButton.disabled = true;
    try {
      await apiFetch(`/leases/${encodeURIComponent(lease.id)}/lessor-sign`, { method: 'POST', body });
      toast('Lease signed as lessor.');
      await onSigned();
    } catch (error) {
      showError(error, 'Unable to sign lease.');
      if (error?.message?.includes('changed after you opened it')) {
        setTimeout(() => {
          const query = new URLSearchParams(window.location.hash.split('?')[1] || '');
          if (query.get('view') === String(lease.id)) onSigned();
        }, 1500);
      }
      signButton.disabled = false;
    }
  });

  setMode(mode);
}
