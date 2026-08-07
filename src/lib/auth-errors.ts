/**
 * Firebase auth error codes, turned into something a person can act on.
 *
 * Every message here names what went wrong *and* what to do about it. "Something went wrong"
 * is not an error message, it is a shrug — and auth is exactly where a vague message costs a
 * user their account rather than a retry.
 *
 * Kept pure and free of any firebase import so it can be tested without a project.
 */

const MESSAGES: Record<string, string> = {
  'auth/invalid-email': "That doesn't look like an email address. Check for a typo.",
  'auth/user-disabled': 'This account has been disabled. Get in touch if that seems wrong.',
  'auth/user-not-found': 'No account with that email. Create one instead?',
  'auth/wrong-password': 'That password is wrong. Try again, or reset it.',
  'auth/invalid-credential': 'That email and password combination is wrong.',
  'auth/email-already-in-use': 'There is already an account with that email. Sign in instead.',
  'auth/weak-password': 'Passwords need at least 6 characters. Try a longer one.',
  'auth/missing-password': 'Enter a password.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  'auth/network-request-failed': 'Could not reach the server. Check your connection.',
  'auth/requires-recent-login': 'For safety this needs a fresh sign-in. Sign out, back in, then try again.',
  'auth/operation-not-allowed': 'That sign-in method is turned off for this project.',
  'auth/popup-closed-by-user': 'The sign-in window closed before finishing. Try again.',
  'auth/account-exists-with-different-credential':
    'That email is already registered with a different sign-in method. Use that one.',
};

/** Firebase throws plain `Error`s carrying a `code`; nothing else about the shape is stable. */
function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

/**
 * Falls back to the raw code rather than a generic apology: an unmapped code is a bug in this
 * table, and showing it is what gets it reported and fixed.
 */
export function describeAuthError(error: unknown): string {
  const code = errorCode(error);
  if (code && MESSAGES[code]) return MESSAGES[code];
  if (code) return `Sign-in failed (${code}).`;
  if (error instanceof Error && error.message) return error.message;
  return 'Sign-in failed.';
}

/** True when the fix is "sign in again", which callers surface differently from a retry. */
export function needsRecentLogin(error: unknown): boolean {
  return errorCode(error) === 'auth/requires-recent-login';
}
