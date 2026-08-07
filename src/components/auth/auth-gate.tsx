/**
 * Decides whether the app or the sign-in screen renders.
 *
 * ## Why this is a component and not a route
 *
 * `PARALLEL-SESSIONS.md` assigns `src/app/(auth)/**` to the identity stream, which implies a
 * route group and a redirect. That does not fit the router as it is actually built: the root
 * layout renders the tab navigator directly, and every screen is a tab trigger enumerated by
 * name in `app-tabs`. A sibling route group would sit outside that navigator and fight it.
 *
 * A gate wrapping the navigator gets the same result with none of that, and behaves the same
 * on web and native. The cost is that sign-in has no deep-linkable URL — worth revisiting if
 * password-reset or email-verification links ever need to land somewhere specific.
 */

import type { ReactNode } from 'react';

import { SignInScreen } from '@/components/auth/sign-in-screen';
import { useAuth } from '@/store/auth-provider';

export function AuthGate({ children }: { children: ReactNode }) {
  const { requiresAuth, user, initializing } = useAuth();

  // Local mode: no project configured, so no accounts exist to gate on. Phase-1 behaviour.
  if (!requiresAuth) return <>{children}</>;

  // Rendering the sign-in screen before the stored session is read would flash it at every
  // already-signed-in user on every cold start. The splash overlay is still up here.
  if (initializing) return null;

  if (!user) return <SignInScreen />;

  return <>{children}</>;
}
