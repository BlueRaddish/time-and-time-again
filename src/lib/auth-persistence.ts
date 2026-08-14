/**
 * Where Firebase Auth keeps the session, on native.
 *
 * The platform difference is isolated to this one file and its `.web` counterpart so that
 * `firebase.ts` itself stays platform-agnostic.
 *
 * ## Why this is not a plain import
 *
 * `getReactNativePersistence` is exported from `firebase/auth` at runtime on React Native —
 * the package resolves to `index.rn.js` there — but the TypeScript types shipped for
 * `firebase/auth` are the browser ones, which do not declare it. As of firebase 12.x this is
 * a known gap (firebase-js-sdk#9316), so the function is reached through a checked cast
 * rather than a direct import that would not compile.
 *
 * If a future firebase release exports it from the public types, delete the cast and import
 * it directly. The runtime check below will not fire either way.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as firebaseAuth from 'firebase/auth';
import type { Persistence } from 'firebase/auth';

type GetReactNativePersistence = (storage: unknown) => Persistence;

export function authPersistence(): Persistence {
  const getReactNativePersistence = (
    firebaseAuth as unknown as {
      getReactNativePersistence?: GetReactNativePersistence;
    }
  ).getReactNativePersistence;

  if (typeof getReactNativePersistence !== 'function') {
    throw new Error(
      'firebase/auth did not export getReactNativePersistence. Without it the session is ' +
        'lost on every reload, which is worse than failing loudly here.'
    );
  }

  return getReactNativePersistence(AsyncStorage);
}
