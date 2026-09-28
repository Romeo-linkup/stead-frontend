// src/shared/format.js — shared display formatting for money, dates and labels.

export function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';
  return `R ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// style 'long' -> "1 October", 'short' -> "1 Oct". Year is only appended
// when the date falls outside the current year. The day is de-padded because
// en-ZA's short-month pattern zero-pads it ("01 Oct").
export function formatDueDate(value, style = 'long') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: style === 'short' ? 'short' : 'long',
  });
  const unpadded = day.replace(/^0(\d)/, '$1');
  return date.getFullYear() === new Date().getFullYear() ? unpadded : `${unpadded} ${date.getFullYear()}`;
}

export function capitalise(value) {
  const text = String(value == null ? '' : value);
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}
