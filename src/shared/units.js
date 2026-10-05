// src/shared/units.js — shared unit-number parsing.
// Splits on commas, spaces and newlines, expands numeric ranges
// like 101-110, and dedupes case-insensitively.
export function parseUnitNumbers(text) {
  const result = [];
  const items = String(text || '').split(/[,\s\n]+/);
  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;

    // Check for range like 101-110
    const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      if (isNaN(start) || isNaN(end) || start > end) {
        throw new Error(`Invalid range: ${trimmed}. Both ends must be whole numbers and start must be <= end.`);
      }
      for (let i = start; i <= end; i++) {
        result.push(String(i));
      }
    } else {
      result.push(trimmed);
    }
  }

  // Dedupe case-insensitively
  const seen = new Set();
  const deduped = [];
  for (const unit of result) {
    const lower = unit.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      deduped.push(unit);
    }
  }

  return deduped;
}
