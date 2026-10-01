// src/provider/tasks.page.js
import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';
import { toast } from '../shared/toast.js';
import { capitalise, formatDueDate } from '../shared/format.js';

export async function renderTasks(root) {
  const content = renderShell(root, { activeHref: '#/provider/tasks', title: 'My tasks' });

  content.innerHTML = `
    <div class="pagehead">
      <h2>My tasks</h2>
      <p>Maintenance requests assigned to you</p>
    </div>
    <div class="kpi-grid" id="task-summary"></div>
    <div id="tasks-list">Loading...</div>
  `;

  async function loadTasks() {
    const listEl = content.querySelector('#tasks-list');
    try {
      const tasks = await apiFetch('/maintenance');
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
    } catch (err) {
      listEl.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`;
    }
  }

  await loadTasks();
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
