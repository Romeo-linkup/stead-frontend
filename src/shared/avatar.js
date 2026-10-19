// src/shared/avatar.js
function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value == null ? '' : String(value);
  return div.innerHTML;
}

function escapeAttr(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const SILHOUETTE = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="9" r="4" fill="currentColor"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8z" fill="currentColor"/></svg>';

// Round photo, or a neutral silhouette for people who haven't added one.
export function avatarHtml(url, name, size = 40) {
  const style = `width:${size}px;height:${size}px`;
  if (url && String(url).startsWith('https://')) {
    return `<img class="user-av" style="${style}" src="${escapeAttr(url)}" alt="${escapeAttr(name || '')}" width="${size}" height="${size}" loading="lazy">`;
  }
  return `<span class="user-av user-av-placeholder" style="${style}" role="img" aria-label="${escapeAttr(name ? `${name} (no photo)` : 'No photo')}">${SILHOUETTE}</span>`;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(objectUrl); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('We could not read that image. Try a different photo.')); };
    img.src = objectUrl;
  });
}

// Centre-crops to a square and compresses, so phone photos upload fast and fit the server limit.
export async function resizeToSquareJpeg(file, size = 512, quality = 0.85) {
  const img = await loadImage(file);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, size, size);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('We could not process that image. Try a different photo.');
  return new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
}

// Photo + small label + name, used wherever another person is referred to.
export function personLine(url, name, label, size = 32) {
  return `<div class="person-line">${avatarHtml(url, name, size)}<div class="person-text"><div class="small muted">${escapeHtml(label)}</div><div class="small"><b>${escapeHtml(name)}</b></div></div></div>`;
}
