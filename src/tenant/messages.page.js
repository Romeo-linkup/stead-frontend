// src/tenant/messages.page.js
import { renderShell } from '../shared/shell.js';
import { apiFetch } from '../shared/api.js';

export async function renderMessages(root) {
  const content = renderShell(root, { activeHref: '#/tenant/messages', title: 'Messages' });
  content.innerHTML = messagesMarkup('Message your district admin');
  await bindMessages(content);
}

function messagesMarkup(subtitle) {
  return `<div class="pagehead"><h2>Messages</h2><p>${subtitle}</p></div><div class="card"><div id="messages-list">Loading...</div></div><div class="card"><form id="message-form"><div class="field"><label for="message-body">Message</label><textarea id="message-body" name="body" rows="4" required placeholder="Write a message..."></textarea></div><div id="message-error" class="error-text" hidden></div><button class="btn btn-primary" type="submit">Send message</button></form></div>`;
}

async function bindMessages(content) {
  async function loadMessages() {
    const list = content.querySelector('#messages-list');
    try {
      const messages = await apiFetch('/messages');
      list.innerHTML = messages.length ? messages.map(message => `<div style="padding:10px 0;border-bottom:1px solid var(--line);"><div class="row"><strong>${escapeHtml(message.sender_name)}</strong><span class="small" style="color:var(--slate);">${new Date(message.created_at).toLocaleString()}</span></div><p style="margin:6px 0 0;white-space:pre-wrap;">${escapeHtml(message.body)}</p></div>`).join('') : '<p style="color:var(--slate);">No messages yet.</p>';
    } catch (err) { list.innerHTML = `<p class="error-text">${escapeHtml(err.message)}</p>`; }
  }
  content.querySelector('#message-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.target;
    const error = content.querySelector('#message-error');
    error.hidden = true;
    try { await apiFetch('/messages', { method: 'POST', body: { recipient_scope: 'district_admin', body: form.body.value.trim() } }); form.reset(); await loadMessages(); }
    catch (err) { error.textContent = err.message; error.hidden = false; }
  });
  await loadMessages();
}

function escapeHtml(value) { const div = document.createElement('div'); div.textContent = value; return div.innerHTML; }
