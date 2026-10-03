export function logoSvg({ size = 52, variant = 'auto', title = 'Stead Lynk' } = {}) {
  const coercedSize = Number(size);
  const safeSize = Number.isFinite(coercedSize) ? Math.min(Math.max(coercedSize, 16), 512) : 52;
  const variantClass = variant === 'dark' ? 'logo--dark' : variant === 'light' ? 'logo--light' : '';

  return `<svg class="logo ${variantClass}" width="${safeSize}" height="${safeSize}" viewBox="0 0 120 120" role="img" aria-label="${title}"><rect width="120" height="120" rx="27" style="fill:var(--logo-tile)"/><rect x="5" y="5" width="110" height="110" rx="22" fill="none" style="stroke:var(--logo-ring)" stroke-opacity=".4" stroke-width="1.2"/><path d="M90 52 L60 26 L30 52 V70 H90 V94 H30" fill="none" style="stroke:var(--logo-line)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="60" cy="53" r="5.5" style="fill:var(--logo-dot)"/></svg>`;
}
