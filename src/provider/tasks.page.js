// src/provider/tasks.page.js
import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';

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

      listEl.innerHTML = tasks.map(task => `
        <article class="card">
          <div class="row">
            <strong>${escapeHtml(task.category)}</strong>
            <span class="badge ${task.status === 'finished' ? 'badge-active' : 'badge-inactive'}">${escapeHtml(task.status)}</span>
          </div>
          <p style="margin:8px 0 4px;">${escapeHtml(task.description)}</p>
          <p class="small" style="color:var(--slate);margin:0;">${escapeHtml(task.property_name || 'Property')} - Unit ${escapeHtml(String(task.unit_number || task.unit_id))}</p>
          ${task.status === 'outstanding' ? `
            <button class="btn btn-outline accept-task" data-id="${task.id}" type="button" style="margin-top:12px;">Accept task</button>
          ` : ''}
          ${task.status === 'pending' ? `
            <form class="complete-task" data-id="${task.id}" style="margin-top:12px;">
              <label class="field-label" for="after-photo-${task.id}">After photo (optional)</label>
              <input id="after-photo-${task.id}" name="after" type="file" accept="image/jpeg,image/png,image/webp">
              <button class="btn btn-primary" type="submit" style="margin-top:10px;">Mark complete</button>
              <div class="error-text task-error" hidden></div>
            </form>
          ` : ''}
          ${task.status === 'finished' && task.after_photo_url ? `<p class="small" style="margin:10px 0 0;"><a href="${escapeHtml(task.after_photo_url)}" target="_blank" style="color:var(--brass-dark);">View after photo</a></p>` : ''}
        </article>
      `).join('');

      content.querySelectorAll('.accept-task').forEach(button => {
        button.addEventListener('click', async () => {
          button.disabled = true;
          try {
            await apiFetch(`/maintenance/${button.dataset.id}/accept`, { method: 'PATCH' });
            await loadTasks();
          } catch (err) {
            button.disabled = false;
            alert(err.message);
          }
        });
      });

      content.querySelectorAll('.complete-task').forEach(form => {
        form.addEventListener('submit', async event => {
          event.preventDefault();
          const errorEl = form.querySelector('.task-error');
          errorEl.hidden = true;
          const formData = new FormData();
          const file = form.elements.after.files[0];
          if (file) formData.append('after', file);

          try {
            await apiFetch(`/maintenance/${form.dataset.id}/complete`, {
              method: 'PATCH',
              body: formData,
              isFormData: true
            });
            await loadTasks();
          } catch (err) {
            errorEl.textContent = err.message;
            errorEl.hidden = false;
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
  div.textContent = value;
  return div.innerHTML;
}
