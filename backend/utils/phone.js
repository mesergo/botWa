/**
 * Normalize an Israeli phone number to the 972XXXXXXXXX format.
 * Handles:
 *   0548505808  → 972548505808
 *   972548505808 → 972548505808
 *   +972548505808 → 972548505808
 *   054-850-5808 → 972548505808
 *
 * Non-Israeli numbers that already start with a country code other than 972
 * are left with that country code (spaces/dashes stripped, leading + removed).
 *
 * Returns the original value unchanged if it looks like a simulator token
 * (e.g. "Simulated", "simulator") or is falsy.
 */
export function normalizePhone(phone) {
  if (!phone) return phone;
  const str = String(phone).trim();

  // Leave simulator tokens untouched
  if (!str || str === 'Simulated' || str.toLowerCase() === 'simulator') return str;

  // Strip spaces, dashes, parentheses
  let digits = str.replace(/[\s\-().]/g, '');

  // Remove leading +
  if (digits.startsWith('+')) digits = digits.slice(1);

  // Israeli local format: starts with 0 → replace with 972
  if (digits.startsWith('0')) {
    digits = '972' + digits.slice(1);
  }

  return digits;
}
