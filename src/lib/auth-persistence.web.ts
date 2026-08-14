/**
 * Where Firebase Auth keeps the session, on web.
 *
 * `browserLocalPersistence` rather than `indexedDBLocalPersistence`: localStorage survives
 * private-browsing modes and storage-partitioning quirks that silently disable IndexedDB, and
 * a session is small enough that IndexedDB buys nothing here.
 */

import { browserLocalPersistence, type Persistence } from 'firebase/auth';

export function authPersistence(): Persistence {
  return browserLocalPersistence;
}
