export function normalizePhone(phoneNumber) {
  const digits = String(phoneNumber || "").replace(/\D/g, "");
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `91${digits}`;
  }
  return digits;
}
