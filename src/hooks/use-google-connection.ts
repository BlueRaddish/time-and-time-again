/**
 * Connecting a Google account for calendar and tasks sync.
 *
 * ## Why this is separate from signing in with Google
 *
 * Signing in needs an **id token** — proof of who you are, used once. Sync needs an
 * **authorization code** that a server exchanges for a *refresh* token, so it can keep writing
 * to your calendar long after you closed the app. Different flows, different scopes, and a
 * user may well want one without the other: sign in with email, connect Google later, or
 * never. Two hooks keeps that honest.
 *
 * ## The three parameters that actually matter
 *
 * - `access_type=offline` — without it Google returns no refresh token at all.
 * - `prompt=consent` — Google omits the refresh token on a *repeat* authorization unless the
 *   consent screen is forced. This is the single most common reason a working integration
 *   breaks for returning users.
 * - `shouldAutoExchangeCode: false` — the exchange needs the client secret, which belongs on
 *   the server and nowhere else. The code goes to the Cloud Function untouched.
 */

import * as Google from 'expo-auth-session/providers/google';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useCallback, useEffect, useState } from 'react';

import { getFirebase } from '@/lib/firebase';
import { googleClientIds, isGoogleSignInConfigured } from '@/lib/firebase-config';

/** Must match GOOGLE_SCOPES in functions/src/google-oauth.ts. Both are sensitive, not restricted. */
export const SYNC_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/tasks',
];

export type GoogleConnection = {
  available: boolean;
  preparing: boolean;
  connecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
};

function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function useGoogleConnection(): GoogleConnection {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: googleClientIds.web,
    androidClientId: googleClientIds.android,
    scopes: SYNC_SCOPES,
    shouldAutoExchangeCode: false,
    extraParams: { access_type: 'offline', prompt: 'consent' },
  });

  useEffect(() => {
    if (response?.type !== 'success') return;

    const code = response.params?.code;
    const redirectUri = request?.redirectUri;
    if (!code || !redirectUri) {
      setError('Google did not return an authorization code. Try connecting again.');
      return;
    }

    const firebase = getFirebase();
    if (!firebase) return;

    setConnecting(true);
    setError(null);

    // The redirect URI must be byte-identical to the one used in the request, or Google
    // rejects the exchange with redirect_uri_mismatch.
    httpsCallable(
      getFunctions(firebase.app),
      'connectGoogle'
    )({ code, redirectUri, timeZone: localTimeZone() })
      .catch(() => setError('Could not finish connecting Google. Try again.'))
      .finally(() => setConnecting(false));
  }, [response, request]);

  const connect = useCallback(async () => {
    setError(null);
    await promptAsync();
  }, [promptAsync]);

  const disconnect = useCallback(async () => {
    const firebase = getFirebase();
    if (!firebase) return;

    setConnecting(true);
    try {
      await httpsCallable(getFunctions(firebase.app), 'disconnectGoogle')();
    } catch {
      setError('Could not disconnect. Try again.');
    } finally {
      setConnecting(false);
    }
  }, []);

  return {
    available: isGoogleSignInConfigured(),
    preparing: !request,
    connecting,
    error,
    connect,
    disconnect,
  };
}
