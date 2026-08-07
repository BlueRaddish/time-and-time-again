/**
 * Who is signed in.
 *
 * ## Two modes, one interface
 *
 * When Firebase is not configured — which is the state until phase 0 is done — this runs in
 * `local` mode: there is no user, no sign-in step, and the app behaves exactly as it did in
 * phase 1. When it is configured, `firebase` mode gates the app behind a sign-in screen.
 *
 * Screens never test for the mode. They read `user` and, if they need to know whether accounts
 * exist at all, `requiresAuth`. Keeping the branch in one place is what stops the local path
 * from rotting the moment the project is created.
 */

import {
  createUserWithEmailAndPassword,
  deleteUser,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { describeAuthError } from '@/lib/auth-errors';
import { getFirebase } from '@/lib/firebase';

export type AuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
};

export type AuthMode = 'local' | 'firebase';

type AuthContextValue = {
  mode: AuthMode;
  /** True when the app should refuse to render its content without a signed-in user. */
  requiresAuth: boolean;
  user: AuthUser | null;
  /** True until the first auth state has been resolved — render nothing decisive before then. */
  initializing: boolean;
  busy: boolean;
  error: string | null;
  clearError: () => void;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogleIdToken: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthUser(user: User): AuthUser {
  return { uid: user.uid, email: user.email, displayName: user.displayName };
}

export function AuthProvider({
  children,
  onBeforeDeleteAccount,
}: {
  children: ReactNode;
  /**
   * Runs before the auth record is destroyed, while credentials are still valid — the only
   * moment the user's own data can be deleted under Firestore rules scoped by `uid`.
   * Phase 5 wires the Things wipe in here.
   */
  onBeforeDeleteAccount?: (uid: string) => Promise<void>;
}) {
  const firebase = getFirebase();
  const mode: AuthMode = firebase ? 'firebase' : 'local';

  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(mode === 'firebase');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebase) return;
    return onAuthStateChanged(firebase.auth, (next) => {
      setUser(next ? toAuthUser(next) : null);
      setInitializing(false);
    });
  }, [firebase]);

  /**
   * Every sign-in path shares the same shape: clear the last error, mark busy, translate any
   * failure, always release. Wrapping it once keeps four call sites from each getting it
   * slightly wrong.
   */
  const run = useCallback(async (action: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (caught) {
      setError(describeAuthError(caught));
      throw caught;
    } finally {
      setBusy(false);
    }
  }, []);

  const requireFirebase = useCallback(() => {
    if (!firebase) {
      throw new Error('Accounts are unavailable: this build has no Firebase configuration.');
    }
    return firebase;
  }, [firebase]);

  const signInWithEmail = useCallback(
    (email: string, password: string) =>
      run(async () => {
        const { auth } = requireFirebase();
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }),
    [requireFirebase, run]
  );

  const registerWithEmail = useCallback(
    (email: string, password: string) =>
      run(async () => {
        const { auth } = requireFirebase();
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      }),
    [requireFirebase, run]
  );

  const signInWithGoogleIdToken = useCallback(
    (idToken: string) =>
      run(async () => {
        const { auth } = requireFirebase();
        await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
      }),
    [requireFirebase, run]
  );

  const signOut = useCallback(
    () =>
      run(async () => {
        const { auth } = requireFirebase();
        await firebaseSignOut(auth);
      }),
    [requireFirebase, run]
  );

  /**
   * Required by Google Play for any app that offers account creation — in-app, not by email
   * request. See `docs/PHASE-0.md`; dropping iOS did not remove this obligation.
   */
  const deleteAccount = useCallback(
    () =>
      run(async () => {
        const { auth } = requireFirebase();
        const current = auth.currentUser;
        if (!current) throw new Error('Nobody is signed in.');
        await onBeforeDeleteAccount?.(current.uid);
        await deleteUser(current);
      }),
    [onBeforeDeleteAccount, requireFirebase, run]
  );

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({
      mode,
      requiresAuth: mode === 'firebase',
      user,
      initializing,
      busy,
      error,
      clearError,
      signInWithEmail,
      registerWithEmail,
      signInWithGoogleIdToken,
      signOut,
      deleteAccount,
    }),
    [
      mode,
      user,
      initializing,
      busy,
      error,
      clearError,
      signInWithEmail,
      registerWithEmail,
      signInWithGoogleIdToken,
      signOut,
      deleteAccount,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
}
