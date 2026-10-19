import type { PlayDays } from '../shared/days';
import type { KeyValueStore } from '../shared/store';
import { GAME_IDS, type GameId } from './games';

export const FRAME_KEY = 'word-games:v1';

/** Which game is on screen, and her days in a row across both games. */
export interface SavedFrame extends PlayDays {
  current: GameId;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Loads the frame's save. The first time (or if it's damaged), her days in a row come from `seed` (Word Circle's stats). */
export function loadSavedFrame(store: KeyValueStore, seed: PlayDays): SavedFrame {
  try {
    const raw = store.getItem(FRAME_KEY);
    const value: unknown = raw === null ? null : JSON.parse(raw);
    if (typeof value === 'object' && value !== null) {
      const { current, streakDays, lastPlayedDay } = value as Record<string, unknown>;
      if (
        GAME_IDS.includes(current as GameId) &&
        Number.isInteger(streakDays) &&
        (streakDays as number) >= 0 &&
        (lastPlayedDay === null || (typeof lastPlayedDay === 'string' && DAY.test(lastPlayedDay)))
      ) {
        return { current: current as GameId, streakDays: streakDays as number, lastPlayedDay: lastPlayedDay as string | null };
      }
    }
  } catch {
    // Unreadable save: start from the seed.
  }
  return { current: 'circle', streakDays: seed.streakDays, lastPlayedDay: seed.lastPlayedDay };
}

export function saveSavedFrame(store: KeyValueStore, saved: SavedFrame): void {
  try {
    store.setItem(FRAME_KEY, JSON.stringify(saved));
  } catch {
    // Storage full or unavailable: this session still works.
  }
}
