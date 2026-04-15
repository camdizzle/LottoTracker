// Shared formatting helpers.

export function formatCents(cents) {
  const n = Number(cents) || 0;
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const dollars = Math.floor(abs / 100);
  const pennies = abs % 100;
  return `${sign}$${dollars.toLocaleString()}.${pennies
    .toString()
    .padStart(2, '0')}`;
}

// Parse a user-entered dollar string ("20", "20.00", "$20.50") into cents.
// Returns NaN if invalid or non-positive.
export function parseDollarsToCents(input) {
  if (input == null) return NaN;
  const cleaned = String(input).replace(/[$,\s]/g, '');
  if (!/^\d*(\.\d{0,2})?$/.test(cleaned) || cleaned === '' || cleaned === '.') {
    return NaN;
  }
  const f = parseFloat(cleaned);
  if (!Number.isFinite(f)) return NaN;
  return Math.round(f * 100);
}
