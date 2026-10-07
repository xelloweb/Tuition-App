/**
 * Password rules shared by the forms (instant feedback) and the API routes.
 *
 * Published passwords appeared in this public repository's history (the old
 * demo setup). Production refuses them for sign-in, and they can never be chosen
 * again, so a leaked default cannot open an account.
 */
export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 200;

const PUBLISHED_PASSWORDS = new Set(["demo123"]);

export function isPublishedPassword(password: string): boolean {
  return PUBLISHED_PASSWORDS.has(password.trim().toLowerCase());
}

/** Why a new password is not acceptable, or null when it is fine. */
export function newPasswordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > MAX_PASSWORD_LENGTH) return `Use ${MAX_PASSWORD_LENGTH} characters or fewer.`;
  if (isPublishedPassword(password)) return "This password is publicly known. Choose a different one.";
  return null;
}
