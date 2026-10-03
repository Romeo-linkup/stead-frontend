// src/provider/tasks.page.js
import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { toast } from '../shared/toast.js';
import { capitalise, formatDueDate } from '../shared/format.js';
import { icon } from '../shared/icons.js';

export async function renderTasks(root) {
  const content = renderShell(root, { activeHref: '#/provider/tasks', title: 'My tasks' });
  let currentTasks = [];
  let invoicesByTask = new Map();
  let openInvoiceTaskId = null;
  let invoiceDraft = null;

  content.innerHTML = `
    <div class="pagehead">
      <h2>My tasks</h2>
      <p>Maintenance requests assigned to you</p>
    </div>
    <div class="kpi-grid" id="task-summary"></div>
    <div id="tasks-list">Loading...</div>
  `;

  function closeInvoiceForm() {
    invoiceDraft?.receipts.forEach((receipt) => URL.revokeObjectURL(receipt.url));
    invoiceDraft = null;
    openInvoiceTaskId = null;
  }

  function renderTaskCards(tasks) {
    const listEl = content.querySelector('#tasks-list');
    currentTasks = tasks;
    const counts = ['outstanding', 'pending', 'finished'].reduce((result, status) => {
      result[status] = tasks.filter(task => task.status === status).length;
      return result;
    }, {});

    content.querySelector('#task-summary').innerHTML = `
      <div class="kpi"><div class="num">${counts.outstanding}</div><div class="lbl">Outstanding</div></div>
      <div class="kpi"><div class="num">${counts.pending}</div><div class="lbl">Pending</div></div>
      <div class="kpi"><div class="num">${counts.finished}</div><div class="lbl">Finished</div></div>
    `;

    if (!tasks.length) {
      listEl.innerHTML = '<div class="card"><p style="color:var(--slate);">No tasks assigned yet.</p></div>';
      return;
    }

    const statusOrder = { outstanding: 0, pending: 1, finished: 2 };
    const sortedTasks = [...tasks].sort((a, b) => {
      const statusDifference = (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
      if (statusDifference) return statusDifference;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    listEl.innerHTML = sortedTasks.map(task => {
      const taskId = escapeAttr(task.id);
      const beforeLink = task.before_photo_url
        ? `<a class="taskimg filled" href="${escapeAttr(task.before_photo_url)}" target="_blank" rel="noopener">Before</a>`
        : '';
      const afterLink = task.after_photo_url
        ? `<a class="taskimg filled" href="${escapeAttr(task.after_photo_url)}" target="_blank" rel="noopener">After</a>`
        : '';
      const completedBy = task.assigned_to_name || task.completed_by_name || task.completed_by;
      const finishedPhotos = beforeLink && afterLink
        ? `<div class="taskimg-row">${beforeLink}${afterLink}</div>`
        : task.after_photo_url
          ? `<p class="small" style="margin:10px 0 0;"><a href="${escapeAttr(task.after_photo_url)}" target="_blank" rel="noopener" style="color:var(--brass-dark);">View after photo</a></p>`
          : '';
      const createdDate = formatDueDate(task.created_at, 'short');
      const invoice = invoicesByTask.get(String(task.id));
      const invoiceBlock = ['pending', 'finished'].includes(task.status)
        ? renderTaskInvoice(task, invoice)
        : '';

      return `
        <article class="card">
          <div class="row">
            <strong>${escapeHtml(task.category || 'Maintenance')}</strong>
            <span class="badge ${escapeAttr(task.status)}">${escapeHtml(capitalise(task.status))}</span>
          </div>
          <p style="margin:8px 0 4px;">${escapeHtml(task.description || '')}</p>
          <p class="small" style="color:var(--slate);margin:0;">${escapeHtml(task.property_name || 'Property')} - Unit ${escapeHtml(String(task.unit_number || task.unit_id || ''))}</p>
          ${createdDate ? `<p class="small muted" style="margin:4px 0 0;">Reported ${escapeHtml(createdDate)}</p>` : ''}
          ${task.status === 'outstanding' ? `
            <button class="btn secondary sm" data-accept="${taskId}" type="button" style="margin-top:12px;">Accept task</button>
          ` : ''}
          ${task.status === 'pending' ? `
            ${beforeLink ? `<p class="small" style="margin:10px 0 0;"><a style="color:var(--brass-dark);" href="${escapeAttr(task.before_photo_url)}" target="_blank" rel="noopener">View tenant's photo</a></p>` : ''}
            <form class="complete-task" data-id="${taskId}" style="margin-top:12px;">
              <label class="field-label" for="after-photo-${taskId}">After photo (optional)</label>
              <input class="field" id="after-photo-${taskId}" name="after" type="file" accept="image/jpeg,image/png,image/webp">
              <button class="btn brass sm" type="submit" style="margin-top:10px;">Mark complete</button>
              <div class="error-text task-error" hidden></div>
            </form>
          ` : ''}
          ${task.status === 'finished' ? finishedPhotos : ''}
          ${task.status === 'finished' && completedBy ? `<p class="small muted" style="margin-top:8px;">Completed by ${escapeHtml(completedBy)}</p>` : ''}
          ${invoiceBlock}
        </article>
      `;
    }).join('');

    content.querySelectorAll('[data-accept]').forEach(button => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await apiFetch(`/maintenance/${encodeURIComponent(button.dataset.accept)}/accept`, { method: 'PATCH' });
          toast('Task accepted.');
          await loadTasks();
        } catch (err) {
          button.disabled = false;
          toast(err.message);
        }
      });
    });

    content.querySelectorAll('.complete-task').forEach(form => {
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const errorEl = form.querySelector('.task-error');
        const submitButton = form.querySelector('button[type="submit"]');
        errorEl.hidden = true;
        const file = form.elements.after.files[0];

        if (file && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
          errorEl.textContent = 'Please upload a JPG, PNG, or WEBP image.';
          errorEl.hidden = false;
          toast(errorEl.textContent);
          return;
        }
        if (file && file.size > 5 * 1024 * 1024) {
          errorEl.textContent = 'File size must be 5MB or less.';
          errorEl.hidden = false;
          toast(errorEl.textContent);
          return;
        }

        const formData = new FormData();
        if (file) formData.append('after', file);
        submitButton.disabled = true;
        submitButton.textContent = 'Marking complete...';

        try {
          await apiFetch(`/maintenance/${encodeURIComponent(form.dataset.id)}/complete`, {
            method: 'PATCH',
            body: formData,
            isFormData: true
          });
          toast('Marked as complete.');
          await loadTasks();
        } catch (err) {
          errorEl.textContent = err.message;
          errorEl.hidden = false;
          toast(err.message);
        } finally {
          submitButton.disabled = false;
          submitButton.textContent = 'Mark complete';
        }
      });
    });

    wireInvoiceEvents(listEl);
  }

  function renderTaskInvoice(task, invoice) {
    const isOpen = String(openInvoiceTaskId) === String(task.id);
    if (!invoice) {
      return isOpen ? renderInvoiceForm() : `<button class="btn secondary sm" data-open-invoice="${escapeAttr(task.id)}" type="button" style="margin-top:10px;">${icon('invoice')} Add invoice</button>`;
    }

    const status = {
      submitted: { badge: 'new', label: `Submitted · R ${formatInvoiceAmount(invoice.total)}` },
      approved: { badge: 'pending', label: `Approved · R ${formatInvoiceAmount(invoice.total)}` },
      paid: { badge: 'finished', label: `Paid · R ${formatInvoiceAmount(invoice.total)}` },
      rejected: { badge: 'outstanding', label: 'Rejected' },
    }[invoice.status];
    if (!status) return '';

    const receiptCount = Array.isArray(invoice.receipts) ? invoice.receipts.length : 0;
    const summary = `
      <div class="row small"><span class="muted">Invoice</span><span class="badge ${status.badge}">${escapeHtml(status.label)}</span></div>
      <p class="small muted" style="margin:4px 0 0;">To: ${escapeHtml(invoice.to_party)} · ${receiptCount} receipt(s)</p>
    `;
    const rejectedReason = invoice.status === 'rejected'
      ? `<p class="small muted" style="margin:4px 0 0;">Rejected: ${escapeHtml(invoice.review_note || '')}</p>`
      : '';

    if (invoice.status === 'rejected') {
      return `${summary}${rejectedReason}${isOpen ? renderInvoiceForm() : `<button class="btn secondary sm" data-open-invoice="${escapeAttr(task.id)}" type="button" style="margin-top:10px;">${icon('invoice')} Resubmit invoice</button>`}`;
    }
    if (invoice.status !== 'submitted') return summary;

    const receiptPicker = receiptCount < 5 ? `
      <input class="invoice-file-input" type="file" accept="image/jpeg,image/png,image/webp" data-existing-receipt-file="${escapeAttr(invoice.id)}">
      <button class="btn secondary sm" type="button" data-existing-receipt="${escapeAttr(invoice.id)}">Add receipt</button>
    ` : '';
    return `${summary}<div class="invoice-actions">${receiptPicker}<button class="btn secondary sm" type="button" data-withdraw-invoice="${escapeAttr(invoice.id)}">Withdraw</button></div>`;
  }

  function renderInvoiceForm() {
    const draft = invoiceDraft;
    if (!draft) return '';
    return `
      <div class="invoice-box invoice-form" data-invoice-form="${escapeAttr(draft.taskId)}">
        <div class="row" style="margin-bottom:10px;"><b class="small">Quote / Invoice for this job</b><button class="invoice-cancel small muted" type="button" data-cancel-invoice>Cancel</button></div>
        <label class="field-label">To</label>
        <input class="field" data-invoice-field="toParty" placeholder="Owner (reimbursement) or Tenant — Unit 206" maxlength="120" value="${escapeAttr(draft.toParty)}">
        <div class="table-wrap">
          <table class="inv-table">
            <thead><tr><th>Description</th><th>Qty</th><th>Price</th><th>Total</th><th></th></tr></thead>
            <tbody>${renderInvoiceItemRows(draft.items)}</tbody>
          </table>
        </div>
        <button class="btn secondary sm" type="button" data-add-invoice-line>${icon('plus')} Add line</button>
        <div class="grand-row"><span class="lbl">Grand total</span><span class="val" data-invoice-grand>R ${calculateDraftTotal(draft.items).toFixed(2)}</span></div>
        <label class="field-label" style="margin-top:6px;">Note</label>
        <textarea class="field" rows="2" data-invoice-field="note" maxlength="600" placeholder="Any context for the admin...">${escapeHtml(draft.note)}</textarea>
        <label class="field-label">Account to pay into</label>
        <input class="field" data-invoice-field="payoutAccount" placeholder="Bank — account ending ****" maxlength="160" value="${escapeAttr(draft.payoutAccount)}">
        <label class="field-label">Receipts</label>
        <div class="receipt-row" data-draft-receipts>${renderDraftReceipts(draft.receipts)}</div>
        <input class="invoice-file-input" type="file" accept="image/jpeg,image/png,image/webp" multiple data-draft-receipt-file>
        <button class="btn brass block" type="button" data-submit-invoice>Submit invoice</button>
      </div>
    `;
  }

  function renderInvoiceItemRows(items) {
    return items.map((item, index) => `
      <tr>
        <td><input data-item-index="${index}" data-item-field="description" maxlength="200" placeholder="e.g. Geyser element" value="${escapeAttr(item.description)}"></td>
        <td><input class="qty" type="number" min="0" step="0.01" data-item-index="${index}" data-item-field="qty" value="${escapeAttr(item.qty)}"></td>
        <td><input class="price" type="number" min="0" step="0.01" data-item-index="${index}" data-item-field="unit_price" value="${escapeAttr(item.unit_price)}"></td>
        <td class="linetotal">R ${((Number(item.qty) || 0) * (Number(item.unit_price) || 0)).toFixed(2)}</td>
        <td><button class="rmv" type="button" data-remove-invoice-line="${index}" aria-label="Remove line">&times;</button></td>
      </tr>
    `).join('');
  }

  function renderDraftReceipts(receipts) {
    return `${receipts.map((receipt, index) => `
      <div class="receipt-thumb"><img src="${escapeAttr(receipt.url)}" alt="Receipt preview ${index + 1}"><button type="button" class="receipt-remove" data-remove-draft-receipt="${index}" aria-label="Remove receipt">&times;</button></div>
    `).join('')}${receipts.length < 5 ? `<button class="add-receipt" type="button" data-open-draft-receipts aria-label="Add receipt">${icon('plus')}</button>` : ''}`;
  }

  function calculateDraftTotal(items) {
    return items.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.unit_price) || 0), 0);
  }

  function recalculateInvoiceForm(form) {
    const draft = invoiceDraft;
    if (!draft) return;
    form.querySelectorAll('tbody tr').forEach((row, index) => {
      const item = draft.items[index];
      const total = (Number(item?.qty) || 0) * (Number(item?.unit_price) || 0);
      const cell = row.querySelector('.linetotal');
      if (cell) cell.textContent = `R ${total.toFixed(2)}`;
    });
    const grand = form.querySelector('[data-invoice-grand]');
    if (grand) grand.textContent = `R ${calculateDraftTotal(draft.items).toFixed(2)}`;
  }

  function validateInvoiceDraft() {
    const draft = invoiceDraft;
    if (!draft.toParty.trim()) return { error: 'Enter who the invoice is for.' };
    if (draft.toParty.trim().length > 120) return { error: 'The To field must be 120 characters or fewer.' };
    if (!draft.payoutAccount.trim()) return { error: 'Enter an account to pay into.' };
    if (draft.payoutAccount.trim().length > 160) return { error: 'The account field must be 160 characters or fewer.' };

    const items = [];
    for (const item of draft.items) {
      const description = item.description.trim();
      const quantityText = item.qty.trim();
      const priceText = item.unit_price.trim();
      if (!description && !quantityText && !priceText) continue;
      if (!description || description.length > 200) return { error: 'Each line needs a description of 1 to 200 characters.' };
      if (!quantityText || !/^(?:\d+\.?\d{0,2}|\.\d{1,2})$/.test(quantityText) || Number(quantityText) <= 0 || Number(quantityText) > 10000) {
        return { error: 'Each line needs a quantity above 0 with at most 2 decimals.' };
      }
      if (priceText && (!/^(?:\d+\.?\d{0,2}|\.\d{1,2})$/.test(priceText) || Number(priceText) > 10000000)) {
        return { error: 'Prices must be non-negative with at most 2 decimals.' };
      }
      items.push({ description, qty: Number(quantityText), unit_price: Number(priceText) || 0 });
    }
    if (!items.length) return { error: 'Add at least one invoice line.' };
    const total = items.reduce((sum, item) => sum + item.qty * item.unit_price, 0);
    if (!(total > 0)) return { error: 'The invoice total must be greater than zero.' };
    if (total > 10000000) return { error: 'The invoice total cannot exceed R 10,000,000.00.' };
    return { items };
  }

  function wireInvoiceEvents(listEl) {
    listEl.querySelectorAll('[data-open-invoice]').forEach((button) => {
      button.addEventListener('click', () => {
        closeInvoiceForm();
        openInvoiceTaskId = button.dataset.openInvoice;
        invoiceDraft = {
          taskId: openInvoiceTaskId,
          toParty: '',
          note: '',
          payoutAccount: '',
          items: [{ description: '', qty: '', unit_price: '' }],
          receipts: [],
        };
        renderTaskCards(currentTasks);
        listEl.querySelector('[data-invoice-field="toParty"]')?.focus();
      });
    });

    listEl.querySelectorAll('[data-cancel-invoice]').forEach((button) => {
      button.addEventListener('click', () => {
        closeInvoiceForm();
        renderTaskCards(currentTasks);
      });
    });

    listEl.querySelectorAll('[data-withdraw-invoice]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!window.confirm('Withdraw this invoice?')) return;
        button.disabled = true;
        try {
          await apiFetch(`/invoices/${encodeURIComponent(button.dataset.withdrawInvoice)}`, { method: 'DELETE' });
          toast('Invoice withdrawn.');
          await loadTasks();
        } catch (err) {
          toast(err.message || 'Could not withdraw invoice.');
          button.disabled = false;
        }
      });
    });

    listEl.querySelectorAll('[data-existing-receipt]').forEach((button) => {
      button.addEventListener('click', () => button.parentElement.querySelector('[data-existing-receipt-file]')?.click());
    });

    listEl.querySelectorAll('[data-existing-receipt-file]').forEach((input) => {
      input.addEventListener('change', async () => {
        const file = input.files[0];
        if (!file) return;
        if (!validateReceiptFile(file)) {
          input.value = '';
          return;
        }
        const formData = new FormData();
        formData.append('photo', file);
        const button = input.parentElement.querySelector('[data-existing-receipt]');
        if (button) button.disabled = true;
        try {
          await apiFetch(`/invoices/${encodeURIComponent(input.dataset.existingReceiptFile)}/receipts`, {
            method: 'POST', body: formData, isFormData: true,
          });
          toast('Receipt added.');
          await loadTasks();
        } catch (err) {
          toast(err.message || 'Could not add receipt.');
          if (button) button.disabled = false;
        } finally {
          input.value = '';
        }
      });
    });

    const form = listEl.querySelector('[data-invoice-form]');
    if (form) {
      form.addEventListener('input', (event) => {
        const field = event.target.dataset.invoiceField;
        if (field) invoiceDraft[field] = event.target.value;
        const index = event.target.dataset.itemIndex;
        const itemField = event.target.dataset.itemField;
        if (index !== undefined && itemField) {
          invoiceDraft.items[Number(index)][itemField] = event.target.value;
          recalculateInvoiceForm(form);
        }
      });

      form.querySelector('[data-add-invoice-line]')?.addEventListener('click', () => {
        if (invoiceDraft.items.length >= 30) return toast('You can add up to 30 invoice lines.');
        invoiceDraft.items.push({ description: '', qty: '', unit_price: '' });
        form.querySelector('tbody').innerHTML = renderInvoiceItemRows(invoiceDraft.items);
        recalculateInvoiceForm(form);
        form.querySelector('tbody tr:last-child input')?.focus();
      });

      form.addEventListener('click', (event) => {
        const removeLine = event.target.closest('[data-remove-invoice-line]');
        if (removeLine) {
          invoiceDraft.items.splice(Number(removeLine.dataset.removeInvoiceLine), 1);
          form.querySelector('tbody').innerHTML = renderInvoiceItemRows(invoiceDraft.items);
          recalculateInvoiceForm(form);
        }
        const removeReceipt = event.target.closest('[data-remove-draft-receipt]');
        if (removeReceipt) {
          const [receipt] = invoiceDraft.receipts.splice(Number(removeReceipt.dataset.removeDraftReceipt), 1);
          URL.revokeObjectURL(receipt.url);
          form.querySelector('[data-draft-receipts]').innerHTML = renderDraftReceipts(invoiceDraft.receipts);
        }
        if (event.target.closest('[data-open-draft-receipts]')) {
          form.querySelector('[data-draft-receipt-file]')?.click();
        }
      });

      form.querySelector('[data-draft-receipt-file]')?.addEventListener('change', (event) => {
        const files = [...event.target.files];
        if (invoiceDraft.receipts.length + files.length > 5) {
          toast('You can attach a maximum of 5 receipts.');
          event.target.value = '';
          return;
        }
        if (files.some((file) => !validateReceiptFile(file))) {
          event.target.value = '';
          return;
        }
        invoiceDraft.receipts.push(...files.map((file) => ({ file, url: URL.createObjectURL(file) })));
        form.querySelector('[data-draft-receipts]').innerHTML = renderDraftReceipts(invoiceDraft.receipts);
        event.target.value = '';
      });

      form.querySelector('[data-submit-invoice]')?.addEventListener('click', async (event) => {
        const submitButton = event.currentTarget;
        const validation = validateInvoiceDraft();
        if (validation.error) return toast(validation.error);

        submitButton.disabled = true;
        submitButton.textContent = 'Submitting...';
        try {
          const invoice = await apiFetch('/invoices', {
            method: 'POST',
            body: {
              maintenance_request_id: Number(invoiceDraft.taskId),
              to_party: invoiceDraft.toParty.trim(),
              items: validation.items,
              note: invoiceDraft.note.trim(),
              payout_account: invoiceDraft.payoutAccount.trim(),
            },
          });
          let failedReceipts = 0;
          for (const receipt of invoiceDraft.receipts) {
            const receiptForm = new FormData();
            receiptForm.append('photo', receipt.file);
            try {
              await apiFetch(`/invoices/${encodeURIComponent(invoice.id)}/receipts`, {
                method: 'POST', body: receiptForm, isFormData: true,
              });
            } catch {
              failedReceipts += 1;
            }
          }
          closeInvoiceForm();
          toast(failedReceipts
            ? `Invoice submitted, but ${failedReceipts} receipt(s) failed to upload. Add them from the task card.`
            : 'Invoice submitted for review.');
          await loadTasks();
        } catch (err) {
          toast(err.message || 'Could not submit invoice.');
          if (err.message === 'An invoice is already active for this task.') {
            closeInvoiceForm();
            await loadTasks();
          } else {
            submitButton.disabled = false;
            submitButton.textContent = 'Submit invoice';
          }
        }
      });
    }
  }

  function validateReceiptFile(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast('Please upload a JPG, PNG, or WEBP image.');
      return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast('Each receipt must be 5MB or less.');
      return false;
    }
    return true;
  }

  async function loadTasks() {
    const listEl = content.querySelector('#tasks-list');
    try {
      const [tasks, invoices] = await Promise.all([
        apiFetch('/maintenance'),
        apiFetch('/invoices').catch(() => []),
      ]);
      invoicesByTask = new Map();
      [...invoices].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).forEach((invoice) => {
        const key = String(invoice.maintenance_request_id);
        if (!invoicesByTask.has(key)) invoicesByTask.set(key, invoice);
      });
      renderTaskCards(tasks);
    } catch (err) {
      listEl.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
    }
  }

  await loadTasks();
}

function formatInvoiceAmount(value) {
  return (Number(value) || 0).toFixed(2);
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value == null ? '' : String(value);
  return div.innerHTML;
}

function escapeAttr(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
