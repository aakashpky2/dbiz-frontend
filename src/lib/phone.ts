/**
 * Normalize a phone value to exactly 10 digits (India-style).
 * Strips spaces, +91/country code, hyphens, and other non-digits.
 */
export function normalizeEmployeePhone(value: string | null | undefined): string {
  if (!value) return '';
  let digits = String(value).replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) {
    digits = digits.slice(2);
  }
  while (digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits.slice(-10);
}

export function hasValidEmployeePhone(value: string | null | undefined): boolean {
  return normalizeEmployeePhone(value).length === 10;
}
