/**
 * Phase 4 — one-way sync from Things to Google Calendar and Google Tasks.
 *
 * Three entry points: connect, disconnect, and a Firestore trigger that mirrors every change.
 * Sync is one-way by design (`PLAN.md` §5) — calendar edits do not flow back, because that
 * needs conflict resolution and change-token polling and buys little for a first release.
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';

import {
  clearConnection,
  markNeedsReconnect,
  readConnection,
  writeConnection,
} from './connection';
import {
  createCalendarEvent,
  createTask,
  deleteCalendarEvent,
  deleteTask,
  NotFoundError,
  updateCalendarEvent,
  updateTask,
} from './google-api';
import {
  exchangeCodeForTokens,
  InvalidGrantError,
  refreshAccessToken,
  revokeToken,
} from './google-oauth';
import { toCalendarEvent, toTask } from './mapping';
import { formatSyncRef, planSync, type SyncTargetName } from './sync';
import type { Thing } from './thing';

initializeApp();
const db = getFirestore();

const GOOGLE_CLIENT_ID = defineSecret('GOOGLE_OAUTH_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = defineSecret('GOOGLE_OAUTH_CLIENT_SECRET');

/** Firestore stores the Thing without its id; the id is the document key. */
function toThing(id: string, data: FirebaseFirestore.DocumentData): Thing {
  return { ...(data as Omit<Thing, 'id'>), id };
}

/**
 * Exchanges the client's one-time authorization code for a refresh token.
 *
 * The code is single-use and short-lived, so it is safe for the client to hold. The refresh
 * token it becomes is not, which is the entire reason this runs on a server.
 */
export const connectGoogle = onCall(
  { secrets: [GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in before connecting Google.');

    const { code, redirectUri, timeZone } = request.data as {
      code?: string;
      redirectUri?: string;
      timeZone?: string;
    };
    if (!code || !redirectUri) {
      throw new HttpsError('invalid-argument', 'code and redirectUri are both required.');
    }

    try {
      const tokens = await exchangeCodeForTokens({
        code,
        redirectUri,
        clientId: GOOGLE_CLIENT_ID.value(),
        clientSecret: GOOGLE_CLIENT_SECRET.value(),
      });

      if (!tokens.refresh_token) {
        // Google omits the refresh token when the user has already granted consent and the
        // request did not ask to see the prompt again. Without it there is nothing to store.
        throw new HttpsError(
          'failed-precondition',
          'Google did not return a refresh token. Retry with prompt=consent and access_type=offline.'
        );
      }

      await writeConnection(db, uid, {
        refreshToken: tokens.refresh_token,
        scope: tokens.scope ?? '',
        timeZone: timeZone || 'UTC',
        status: 'active',
        connectedAt: new Date().toISOString(),
      });

      return { connected: true };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      logger.error('connectGoogle failed', { uid, error });
      throw new HttpsError('internal', 'Could not complete the Google connection.');
    }
  }
);

export const disconnectGoogle = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in first.');

  const connection = await readConnection(db, uid);
  if (connection) await revokeToken(connection.refreshToken);
  await clearConnection(db, uid);

  return { connected: false };
});

/**
 * Mirrors one Thing to Google.
 *
 * Failures are logged and swallowed rather than thrown: a retried Firestore trigger would
 * replay the same write, and a create that already succeeded remotely would then run twice and
 * leave a duplicate event. Losing one sync is recoverable — the next edit re-syncs it — while
 * a duplicate is not.
 */
export const syncThing = onDocumentWritten(
  {
    document: 'users/{uid}/things/{thingId}',
    secrets: [GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET],
  },
  async (event) => {
    const uid = event.params.uid;
    const thingId = event.params.thingId;

    const beforeSnapshot = event.data?.before;
    const afterSnapshot = event.data?.after;

    const before =
      beforeSnapshot?.exists && beforeSnapshot.data()
        ? toThing(thingId, beforeSnapshot.data()!)
        : null;
    const after =
      afterSnapshot?.exists && afterSnapshot.data()
        ? toThing(thingId, afterSnapshot.data()!)
        : null;

    const action = planSync(before, after);
    if (action.kind === 'none') return;

    const connection = await readConnection(db, uid);
    if (!connection || connection.status !== 'active') return;

    try {
      const { access_token: accessToken } = await refreshAccessToken({
        refreshToken: connection.refreshToken,
        clientId: GOOGLE_CLIENT_ID.value(),
        clientSecret: GOOGLE_CLIENT_SECRET.value(),
      });

      const write = async (target: SyncTargetName): Promise<string> => {
        if (!after) throw new Error('unreachable: writing a deleted Thing');
        return target === 'calendar'
          ? createCalendarEvent(accessToken, toCalendarEvent(after, connection.timeZone))
          : createTask(accessToken, toTask(after));
      };

      const remove = async (target: SyncTargetName, id: string): Promise<void> => {
        try {
          if (target === 'calendar') await deleteCalendarEvent(accessToken, id);
          else await deleteTask(accessToken, id);
        } catch (error) {
          // Already gone is the state we wanted. The user may have deleted it by hand.
          if (!(error instanceof NotFoundError)) throw error;
        }
      };

      switch (action.kind) {
        case 'create': {
          const id = await write(action.target);
          // Writing this back retriggers this function; planSync returns `none` that time
          // because no sync-relevant field changed.
          await afterSnapshot!.ref.update({
            calendarSyncId: formatSyncRef({ target: action.target, id }),
          });
          break;
        }

        case 'update': {
          if (!after) break;
          if (action.ref.target === 'calendar') {
            await updateCalendarEvent(
              accessToken,
              action.ref.id,
              toCalendarEvent(after, connection.timeZone)
            );
          } else {
            await updateTask(accessToken, action.ref.id, toTask(after));
          }
          break;
        }

        case 'delete':
          await remove(action.ref.target, action.ref.id);
          break;

        case 'move': {
          await remove(action.from.target, action.from.id);
          const id = await write(action.to);
          await afterSnapshot!.ref.update({
            calendarSyncId: formatSyncRef({ target: action.to, id }),
          });
          break;
        }
      }
    } catch (error) {
      if (error instanceof InvalidGrantError) {
        // Expected, not exceptional: the user revoked access, or the consent screen is still
        // in Testing status where refresh tokens die after 7 days. See docs/PHASE-0.md.
        logger.info('Google grant is no longer valid; asking the user to reconnect', { uid });
        await markNeedsReconnect(db, uid);
        return;
      }
      logger.error('syncThing failed', { uid, thingId, action: action.kind, error });
    }
  }
);
