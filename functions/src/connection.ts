/**
 * The stored Google authorization.
 *
 * Lives at `users/{uid}/private/google`, which `firestore.rules` denies to every client —
 * including the user it belongs to. Only the Admin SDK reads it, and the Admin SDK bypasses
 * rules. A refresh token that a client can read is a refresh token in the bundle.
 */

import type { Firestore } from 'firebase-admin/firestore';

export type ConnectionStatus = 'active' | 'needs-reconnect';

export type GoogleConnection = {
  refreshToken: string;
  scope: string;
  /** IANA zone used for timed calendar events; falls back to UTC when the client sends none. */
  timeZone: string;
  status: ConnectionStatus;
  connectedAt: string;
  /** Set when the grant died, so the app can explain *why* it is asking to reconnect. */
  invalidatedAt?: string;
};

export function connectionDoc(db: Firestore, uid: string) {
  return db.collection('users').doc(uid).collection('private').doc('google');
}

export async function readConnection(
  db: Firestore,
  uid: string
): Promise<GoogleConnection | null> {
  const snapshot = await connectionDoc(db, uid).get();
  return snapshot.exists ? (snapshot.data() as GoogleConnection) : null;
}

export async function writeConnection(
  db: Firestore,
  uid: string,
  connection: GoogleConnection
): Promise<void> {
  await connectionDoc(db, uid).set(connection);
}

/**
 * Records a dead grant instead of deleting it.
 *
 * The document staying put is what lets the app say "reconnect your Google account" rather
 * than silently reverting to looking like sync was never set up.
 */
export async function markNeedsReconnect(db: Firestore, uid: string): Promise<void> {
  await connectionDoc(db, uid).set(
    { status: 'needs-reconnect', invalidatedAt: new Date().toISOString() },
    { merge: true }
  );
}

export async function clearConnection(db: Firestore, uid: string): Promise<void> {
  await connectionDoc(db, uid).delete();
}
