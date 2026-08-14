import { describeAuthError, needsRecentLogin } from '@/lib/auth-errors';

/** Firebase throws plain Errors carrying a `code`; this reproduces that shape. */
function authError(code: string): Error {
  return Object.assign(new Error(`Firebase: Error (${code}).`), { code });
}

describe('describeAuthError', () => {
  it('translates a mapped code into an actionable message', () => {
    expect(describeAuthError(authError('auth/wrong-password'))).toBe(
      'That password is wrong. Try again, or reset it.'
    );
  });

  it('never leaks the raw Firebase message for a mapped code', () => {
    const message = describeAuthError(authError('auth/email-already-in-use'));
    expect(message).not.toMatch(/Firebase:/);
  });

  it.each([
    'auth/invalid-email',
    'auth/user-not-found',
    'auth/invalid-credential',
    'auth/weak-password',
    'auth/too-many-requests',
    'auth/network-request-failed',
    'auth/requires-recent-login',
  ])('tells the user what to do about %s', (code) => {
    const message = describeAuthError(authError(code));
    expect(message.length).toBeGreaterThan(0);
    expect(message).not.toContain(code);
  });

  it('surfaces an unmapped code rather than a generic apology', () => {
    // An unmapped code is a gap in the table. Showing it is what gets it reported.
    expect(describeAuthError(authError('auth/brand-new-thing'))).toBe(
      'Sign-in failed (auth/brand-new-thing).'
    );
  });

  it('falls back to the message when there is no code', () => {
    expect(describeAuthError(new Error('offline'))).toBe('offline');
  });

  it('handles values that are not errors at all', () => {
    expect(describeAuthError(null)).toBe('Sign-in failed.');
    expect(describeAuthError('nope')).toBe('Sign-in failed.');
    expect(describeAuthError(undefined)).toBe('Sign-in failed.');
  });
});

describe('needsRecentLogin', () => {
  it('is true only for the re-authentication code', () => {
    expect(needsRecentLogin(authError('auth/requires-recent-login'))).toBe(true);
    expect(needsRecentLogin(authError('auth/wrong-password'))).toBe(false);
    expect(needsRecentLogin(new Error('offline'))).toBe(false);
  });
});
