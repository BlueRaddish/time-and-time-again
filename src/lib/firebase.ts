/**
 * The one place Firebase is started.
 *
 * Initialisation is lazy and returns `null` when the project is not configured, so importing
 * this module is always safe — including from tests and from a phase-1 local-only run. Nobody
 * else calls `initializeApp`.
 *
 * Firestore is created with `initializeFirestore` rather than `getFirestore` because the
 * settings below can only be applied before the instance exists; calling `getFirestore` first
 * would lock in the defaults.
 */

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, type Firestore } from 'firebase/firestore';

import { authPersistence } from '@/lib/auth-persistence';
import { firebaseConfig } from '@/lib/firebase-config';

export type FirebaseServices = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
};

const APP_NAME = 'time-and-time-again';

let services: FirebaseServices | null = null;

/**
 * Returns the live services, or `null` when the project is not configured.
 *
 * Callers must handle `null`. That is deliberate: it is the same branch that keeps the app
 * working before phase 0 is done, so it cannot be allowed to rot.
 */
export function getFirebase(): FirebaseServices | null {
  if (services) return services;
  if (!firebaseConfig) return null;

  const app = getApps().some((existing) => existing.name === APP_NAME)
    ? getApp(APP_NAME)
    : initializeApp(firebaseConfig, APP_NAME);

  services = {
    app,
    auth: createAuth(app),
    db: initializeFirestore(app, {
      /**
       * Long polling is auto-detected rather than forced: React Native's fetch implementation
       * does not support the streaming Firestore prefers, and getting this wrong shows up as
       * writes that hang forever rather than as an error.
       */
      experimentalAutoDetectLongPolling: true,
      ignoreUndefinedProperties: true,
    }),
  };

  return services;
}

/**
 * `initializeAuth` throws if auth already exists for the app — which happens under fast
 * refresh, where the module is re-evaluated but the native app instance survives. Falling back
 * to `getAuth` keeps reloads from crashing in development.
 */
function createAuth(app: FirebaseApp): Auth {
  try {
    return initializeAuth(app, { persistence: authPersistence() });
  } catch {
    return getAuth(app);
  }
}

/** Test seam — drops the memoised instance so a fresh config can be read. */
export function resetFirebaseForTests(): void {
  services = null;
}
