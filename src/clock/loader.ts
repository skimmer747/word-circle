import type { KeyValueStore } from '../game/storage';
import { parseSchedule, type ScheduledEvent } from './schedule';

/** The last schedule text the iPad saw, so the clock still works offline. */
export const SCHEDULE_CACHE_KEY = 'word-circle:schedule';

export function cachedSchedule(store: KeyValueStore): ScheduledEvent[] {
  try {
    return parseSchedule(store.getItem(SCHEDULE_CACHE_KEY) ?? '');
  } catch {
    return [];
  }
}

/** Fetches the schedule; returns its events, or null if it couldn't be fetched (the cached copy still stands). */
export async function refreshSchedule(fetchText: () => Promise<string>, store: KeyValueStore): Promise<ScheduledEvent[] | null> {
  let text: string;
  try {
    text = await fetchText();
  } catch {
    return null;
  }
  try {
    store.setItem(SCHEDULE_CACHE_KEY, text);
  } catch {
    // Storage unavailable: use this copy for now anyway.
  }
  return parseSchedule(text);
}
