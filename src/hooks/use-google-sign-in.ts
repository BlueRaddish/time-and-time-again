/**
 * Google sign-in, over the browser-based OAuth flow.
 *
 * ## Why `expo-auth-session` and not a native Google SDK
 *
 * Expo's guide now points at `@react-native-google-signin/google-signin` and
 * `react-native-nitro-google-signin`, and marks this provider deprecated. Both of those
 * require custom native code, which means **no Expo Go and no web** — and web is a release
 * target here, plus the whole point of looking at the app right now is the web build.
 *
 * `expo-auth-session` covers web and Android from one code path with no native module. The
 * trade-off is a browser hand-off rather than Android's native Credential Manager sheet: a
 * slightly less polished sign-in on Android, in exchange for the platform matrix actually
 * being covered. Revisit when Android is the priority — it is a swap of this file alone.
 *
 * There is a second reason to stay here: phase 4 needs an *authorization code* with the
 * calendar and tasks scopes so a Cloud Function can exchange it for a refresh token. The same
 * library issues that, so both halves of Google integration use one flow.
 */

import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect } from 'react';

import { googleClientIds, isGoogleSignInConfigured } from '@/lib/firebase-config';
import { useAuth } from '@/store/auth-provider';

/** Closes the popup that the OAuth redirect lands in. Required on web; harmless elsewhere. */
WebBrowser.maybeCompleteAuthSession();

export type GoogleSignIn = {
  /** False when no client id is configured — the button should be hidden, not broken. */
  available: boolean;
  /** True while the request is still being prepared; the button should be disabled. */
  preparing: boolean;
  signIn: () => Promise<void>;
};

export function useGoogleSignIn(): GoogleSignIn {
  const { signInWithGoogleIdToken } = useAuth();

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: googleClientIds.web,
    androidClientId: googleClientIds.android,
  });

  useEffect(() => {
    if (response?.type !== 'success') return;
    const idToken = response.params?.id_token;
    if (!idToken) return;

    // The provider already turned any failure into user-facing text; swallowing the rejection
    // here only stops it becoming an unhandled promise.
    signInWithGoogleIdToken(idToken).catch(() => {});
  }, [response, signInWithGoogleIdToken]);

  const signIn = useCallback(async () => {
    await promptAsync();
  }, [promptAsync]);

  return {
    available: isGoogleSignInConfigured(),
    preparing: !request,
    signIn,
  };
}
