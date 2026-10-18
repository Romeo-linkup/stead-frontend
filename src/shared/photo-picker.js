// src/shared/photo-picker.js
import { avatarHtml, resizeToSquareJpeg } from './avatar.js';

export function renderPhotoPicker(container, { initialUrl = '', name = '', onChange } = {}) {
  container.innerHTML = `
    <div class="photo-picker">
      <div class="photo-preview" data-photo-preview>${avatarHtml(initialUrl, name, 96)}</div>
      <div class="photo-picker-side">
        <button type="button" class="btn secondary sm" data-photo-choose>${initialUrl ? 'Change photo' : 'Add photo'}</button>
        <input type="file" accept="image/*" hidden data-photo-input>
        <p class="small muted" style="margin:6px 0 0;">A clear photo of your face. The people you deal with on Stead will see it.</p>
        <div class="error-text" data-photo-error hidden></div>
      </div>
    </div>
  `;

  const input = container.querySelector('[data-photo-input]');
  const preview = container.querySelector('[data-photo-preview]');
  const errorEl = container.querySelector('[data-photo-error]');
  const chooseBtn = container.querySelector('[data-photo-choose]');
  let selected = null;
  let previewUrl = null;

  function showError(message) {
    errorEl.textContent = message || '';
    errorEl.hidden = !message;
  }

  chooseBtn.addEventListener('click', () => input.click());

  input.addEventListener('change', async () => {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    showError('');
    try {
      const resized = await resizeToSquareJpeg(file);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(resized);
      preview.innerHTML = `<img class="user-av" style="width:96px;height:96px" src="${previewUrl}" alt="Photo preview">`;
      chooseBtn.textContent = 'Change photo';
      selected = resized;
      if (typeof onChange === 'function') onChange(resized);
    } catch (err) {
      showError(err.message);
    }
  });

  return {
    getFile: () => selected,
    hasPhoto: () => Boolean(selected || initialUrl),
    showError,
    markSaved(url) {
      initialUrl = url;
      selected = null;
    },
  };
}
