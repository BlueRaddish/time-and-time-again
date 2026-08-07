/**
 * Firebase configuration, read from the environment.
 *
 * ## Why the app must work without this
 *
 * Phase 0 — creating the Firebase project — is manual console work that has not happened yet,
 * and the app has to keep running in the meantime. So configuration is *optional*: when the
 * variables are absent the app runs exactly as it did in phase 1, local-only and with no
 * sign-in step. Nothing here throws on a missing value.
 *
 * `isFirebaseConfigured()` is the single switch the rest of the app reads. See
 * `docs/PHASE-0.md`.
 *
 * ## Why these are `EXPO_PUBLIC_`
 *
 * Expo inlines `EXPO_PUBLIC_*` into the client bundle at build time, so they are not secret.
 * That is correct here: the Firebase web config is designed to be public, and access is
 * controlled by Firestore security rules, not by hiding the project id. Nothing that is
 * actually secret — above all the OAuth refresh token — ever goes in one of these.
 *
 * Expo only substitutes literal member expressions, so every read below is written out in
 * full rather than looped over. Do not refactor these into a loop.
 */

export type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

/** Client ids for Google sign-in, per platform. Absent until phase 0 creates them. */
export type GoogleClientIds = {
  web?: string;
  android?: string;
};

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

const candidate = {
  apiKey: clean(process.env.EXPO_PUBLIC_FIREBASE_API_KEY),
  authDomain: clean(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: clean(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: clean(process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: clean(process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: clean(process.env.EXPO_PUBLIC_FIREBASE_APP_ID),
};

/**
 * Every field is required — a half-filled config is a misconfiguration, not a degraded mode,
 * and silently starting Firebase with a missing `projectId` produces errors far from the
 * cause.
 */
export function readFirebaseConfig(
  source: Record<keyof FirebaseConfig, string | undefined> = candidate
): FirebaseConfig | null {
  const keys = Object.keys(candidate) as (keyof FirebaseConfig)[];
  const cleaned = {} as FirebaseConfig;

  for (const key of keys) {
    // Trimming here rather than only at the env read: a value of "   " from a hand-edited
    // .env.local is missing, and should be caught wherever the config comes from.
    const value = clean(source[key]);
    if (!value) return null;
    cleaned[key] = value;
  }

  return cleaned;
}

export const firebaseConfig: FirebaseConfig | null = readFirebaseConfig();

/** The switch the rest of the app reads. False means phase-1 behaviour: local, no accounts. */
export function isFirebaseConfigured(): boolean {
  return firebaseConfig !== null;
}

export const googleClientIds: GoogleClientIds = {
  web: clean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
  android: clean(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID),
};

/**
 * Google sign-in needs its own client ids on top of the Firebase config, so it can be
 * unavailable even when Firebase is configured. Email/password never is.
 */
export function isGoogleSignInConfigured(ids: GoogleClientIds = googleClientIds): boolean {
  return Boolean(clean(ids.web) || clean(ids.android));
}
