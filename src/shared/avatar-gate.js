// src/shared/avatar-gate.js — blocks tenants/providers without a photo until they add one
import { apiFetch } from './api.js';
import { logout } from '../auth/session.js';
import { renderPhotoPicker } from './photo-picker.js';
import { logoSvg } from './logo.js';
import { toast } from './toast.js';

const PHOTO_ROLES = ['tenant', 'service_provider'];
let confirmedUserId = null; // keyed by user so a second person signing in on the same device is still checked
let pendingName = '';

export function markAvatarPresent(userId) {
  confirmedUserId = userId;
}

export async function userNeedsAvatar(user) {
  if (!PHOTO_ROLES.includes(user.role)) return false;
  if (confirmedUserId === user.user_id) return false;
  try {
    const me = await apiFetch('/users/me');
    pendingName = me.name || '';
    if (me.avatar_url) {
      confirmedUserId = user.user_id;
      return false;
    }
    return true;
  } catch (err) {
    return false; // offline or server error: never lock people out because of a failed check
  }
}

export function renderAvatarRequired(root, { user, onDone }) {
  root.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="mark">${logoSvg({ size: 52 })}</div>
        <h1 class="serif">Add your photo</h1>
        <p class="sub">Everyone on Stead has a photo, so the people you deal with know who they are talking to. It takes a few seconds.</p>
        <form id="avatar-form">
          <div id="photo-slot"></div>
          <button class="btn brass block" type="submit" id="avatar-submit" style="margin-top:16px;">Continue</button>
        </form>
        <button class="btn secondary block" type="button" id="avatar-logout" style="margin-top:8px;">Log out</button>
      </div>
    </div>
  `;

  const picker = renderPhotoPicker(root.querySelector('#photo-slot'), { name: pendingName });
  const submitBtn = root.querySelector('#avatar-submit');

  root.querySelector('#avatar-logout').addEventListener('click', logout);

  root.querySelector('#avatar-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const file = picker.getFile();
    if (!file) {
      picker.showError('Please choose a photo to continue.');
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading...';
    try {
      const data = new FormData();
      data.append('photo', file);
      await apiFetch('/users/me/avatar', { method: 'POST', body: data, isFormData: true });
      markAvatarPresent(user.user_id);
      toast('Photo saved.');
      onDone();
    } catch (err) {
      picker.showError(err.message || 'Could not upload your photo.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Continue';
    }
  });
}
