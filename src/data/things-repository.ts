/**
 * Persistence boundary.
 *
 * The interface is deliberately shaped like Firestore — per-item create/update/remove rather
 * than "save the whole array" — even though the phase-1 implementation stores one blob. That
 * means phase 3 replaces the implementation without touching a single caller.
 */

import type { Thing, ThingPatch } from '@/types/thing';

export interface ThingsRepository {
  list(): Promise<Thing[]>;
  create(thing: Thing): Promise<void>;
  update(id: string, patch: ThingPatch): Promise<void>;
  remove(id: string): Promise<void>;
}
