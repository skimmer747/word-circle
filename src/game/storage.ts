import type { Progress, Puzzle } from './types';

export const STORAGE_KEY = 'word-circle:v1';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface StartPoint {
  index: number;
  found: string[];
  revealed: Record<string, number[]>;
}

function isProgress(value: unknown): value is Progress {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    Number.isInteger(p.puzzleIndex) &&
    (p.puzzleIndex as number) >= 0 &&
    typeof p.puzzleId === 'string' &&
    Array.isArray(p.found) &&
    p.found.every((w) => typeof w === 'string') &&
    typeof p.revealed === 'object' &&
    p.revealed !== null &&
    Object.values(p.revealed).every((v) => Array.isArray(v) && v.every((n) => Number.isInteger(n)))
  );
}

export function loadProgress(store: KeyValueStore): Progress | null {
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isProgress(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveProgress(store: KeyValueStore, progress: Progress): void {
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage full or unavailable: keep playing; progress just won't survive a restart.
  }
}

/** Where to start: the saved puzzle if it still matches, otherwise that position fresh. */
export function resolveStart(puzzles: readonly Puzzle[], saved: Progress | null): StartPoint {
  if (!saved) return { index: 0, found: [], revealed: {} };
  const index = saved.puzzleIndex % puzzles.length;
  if (puzzles[index].id !== saved.puzzleId) return { index, found: [], revealed: {} };
  return { index, found: saved.found, revealed: saved.revealed };
}

export function nextIndex(index: number, count: number): number {
  return (index + 1) % count;
}
