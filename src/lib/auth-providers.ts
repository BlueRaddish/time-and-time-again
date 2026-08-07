/**
 * The sign-in methods, as data.
 *
 * ## Why this is a list and not two buttons
 *
 * iOS is not a release target right now (`PLAN.md`, decision log 2026-08-07). If it is ever
 * added while Google sign-in is live, **Sign in with Apple becomes mandatory** — Apple
 * requires an equivalent option wherever a third-party social login is offered, and its
 * absence is a documented App Store rejection reason.
 *
 * Adding a provider to a list is an entry. Unpicking a hard-wired pair of buttons is a
 * refactor. Since the cost of the list is nothing today, it is a list today:
 *
 * ```ts
 * { id: 'apple', label: 'Continue with Apple', kind: 'oauth', isConfigured: () => … }
 * ```
 *
 * That object, plus a case in the sign-in screen's handler, is the whole of re-adding Apple.
 */

import { isGoogleSignInConfigured } from '@/lib/firebase-config';

export type AuthProviderId = 'password' | 'google';

export type AuthProviderSpec = {
  id: AuthProviderId;
  label: string;
  /** `password` renders a form; `oauth` renders a single button. */
  kind: 'password' | 'oauth';
  /**
   * Whether the credentials this provider needs are actually present. A provider that is
   * listed but unconfigured is shown disabled rather than hidden, so a missing client id
   * looks like a missing client id instead of a missing feature.
   */
  isConfigured: () => boolean;
};

export const AUTH_PROVIDERS: AuthProviderSpec[] = [
  {
    id: 'password',
    label: 'Email and password',
    kind: 'password',
    // Email/password needs nothing beyond the Firebase project itself.
    isConfigured: () => true,
  },
  {
    id: 'google',
    label: 'Continue with Google',
    kind: 'oauth',
    isConfigured: isGoogleSignInConfigured,
  },
];

export function availableAuthProviders(
  providers: AuthProviderSpec[] = AUTH_PROVIDERS
): AuthProviderSpec[] {
  return providers.filter((provider) => provider.isConfigured());
}
