/** Allowed client codes: 2–5 uppercase letters or digits (stored uppercase). */
export const CLIENT_CODE_PATTERN = /^[A-Z0-9]{2,5}$/;

export function normalizeClientCode(input) {
  return input.trim().toUpperCase();
}

export function isValidClientCode(input) {
  return CLIENT_CODE_PATTERN.test(normalizeClientCode(input));
}
