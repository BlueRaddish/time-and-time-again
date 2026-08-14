/**
 * The Calendar and Tasks REST calls.
 *
 * Plain `fetch` rather than the `googleapis` package: this uses six endpoints, and the
 * official client pulls a very large dependency tree into a function whose cold-start time is
 * paid on every sync.
 *
 * Everything writes to the user's primary calendar and default task list. Choosing a target
 * list is a Layer 2 preference and belongs to phase 5.
 */

import type { CalendarEvent, TaskResource } from './mapping';

const CALENDAR_EVENTS = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const TASKS = 'https://tasks.googleapis.com/tasks/v1/lists/@default/tasks';

/** Raised when Google says the resource is gone. Treated as success by the delete paths. */
export class NotFoundError extends Error {
  constructor(message = 'The remote resource no longer exists') {
    super(message);
    this.name = 'NotFoundError';
  }
}

async function call<T>(
  url: string,
  accessToken: string,
  init: { method: string; body?: unknown }
): Promise<T> {
  const response = await fetch(url, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });

  if (response.status === 404 || response.status === 410) {
    // 410 Gone is what Calendar returns for an event the user already deleted by hand.
    throw new NotFoundError();
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`${init.method} ${url} failed with ${response.status}: ${detail.slice(0, 300)}`);
  }

  // 204 No Content on delete — there is nothing to parse.
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

type WithId = { id: string };

export async function createCalendarEvent(
  accessToken: string,
  event: CalendarEvent
): Promise<string> {
  const created = await call<WithId>(CALENDAR_EVENTS, accessToken, {
    method: 'POST',
    body: event,
  });
  return created.id;
}

export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  event: CalendarEvent
): Promise<void> {
  // PUT, not PATCH: the mapping produces the complete event, and a PATCH would leave a stale
  // `end` behind when a timed event becomes an all-day one.
  await call(`${CALENDAR_EVENTS}/${encodeURIComponent(eventId)}`, accessToken, {
    method: 'PUT',
    body: event,
  });
}

export async function deleteCalendarEvent(accessToken: string, eventId: string): Promise<void> {
  await call(`${CALENDAR_EVENTS}/${encodeURIComponent(eventId)}`, accessToken, {
    method: 'DELETE',
  });
}

export async function createTask(accessToken: string, task: TaskResource): Promise<string> {
  const created = await call<WithId>(TASKS, accessToken, { method: 'POST', body: task });
  return created.id;
}

export async function updateTask(
  accessToken: string,
  taskId: string,
  task: TaskResource
): Promise<void> {
  await call(`${TASKS}/${encodeURIComponent(taskId)}`, accessToken, {
    method: 'PUT',
    body: task,
  });
}

export async function deleteTask(accessToken: string, taskId: string): Promise<void> {
  await call(`${TASKS}/${encodeURIComponent(taskId)}`, accessToken, { method: 'DELETE' });
}
