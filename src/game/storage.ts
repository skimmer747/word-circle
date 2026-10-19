import { LEVELS, type Level, type Progress, type Puzzle } from './types';

export const STORAGE_KEY = 'word-circle:v2';
/** Single-level progress saved before difficulty levels existed; moved into Medium on load. */
export const OLD_STORAGE_KEY = 'word-circle:v1';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The level she's on, and where she is in each level she has played. */
export interface SavedGame {
  level: Level;
  levels: Partial<Record<Level, Progress>>;
}

export interface StartPoint {
  index: number;
  found: string[];
  revealed: Record<string, number[]>;
  bonusFound: string[];
}

const fresh = (): SavedGame => ({ level: 'medium', levels: {} });

const isWordList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((w) => typeof w === 'string');

const isLevel = (value: unknown): value is Level => LEVELS.includes(value as Level);

/** Saves from before extra words were tracked have no bonusFound. */
function isProgress(value: unknown): value is Omit<Progress, 'bonusFound'> & { bonusFound?: string[] } {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    Number.isInteger(p.puzzleIndex) &&
    (p.puzzleIndex as number) >= 0 &&
    typeof p.puzzleId === 'string' &&
    isWordList(p.found) &&
    typeof p.revealed === 'object' &&
    p.revealed !== null &&
    Object.values(p.revealed).every((v) => Array.isArray(v) && v.every((n) => Number.isInteger(n))) &&
    (p.bonusFound === undefined || isWordList(p.bonusFound))
  );
}

const withBonus = (p: Omit<Progress, 'bonusFound'> & { bonusFound?: string[] }): Progress => ({
  ...p,
  bonusFound: p.bonusFound ?? [],
});

function readSavedGame(value: unknown): SavedGame | null {
  if (typeof value !== 'object' || value === null) return null;
  const { level, levels } = value as Record<string, unknown>;
  if (!isLevel(level) || typeof levels !== 'object' || levels === null) return null;
  const result: SavedGame = { level, levels: {} };
  for (const [key, progress] of Object.entries(levels)) {
    if (!isLevel(key) || !isProgress(progress)) return null;
    result.levels[key] = withBonus(progress);
  }
  return result;
}

export function loadSavedGame(store: KeyValueStore): SavedGame {
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (raw !== null) return readSavedGame(JSON.parse(raw)) ?? fresh();
    const old = store.getItem(OLD_STORAGE_KEY);
    if (old !== null) {
      const progress: unknown = JSON.parse(old);
      if (isProgress(progress)) return { level: 'medium', levels: { medium: withBonus(progress) } };
    }
  } catch {
    // Unreadable save: start fresh.
  }
  return fresh();
}

export function saveSavedGame(store: KeyValueStore, game: SavedGame): void {
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(game));
  } catch {
    // Storage full or unavailable: keep playing; progress just won't survive a restart.
  }
}

/** Where to start in a level: the saved puzzle if it still matches, otherwise that position fresh. */
export function resolveStart(puzzles: readonly Puzzle[], saved: Progress | undefined): StartPoint {
  if (!saved) return { index: 0, found: [], revealed: {}, bonusFound: [] };
  const index = saved.puzzleIndex % puzzles.length;
  if (puzzles[index].id !== saved.puzzleId) return { index, found: [], revealed: {}, bonusFound: [] };
  return { index, found: saved.found, revealed: saved.revealed, bonusFound: saved.bonusFound };
}

export function nextIndex(index: number, count: number): number {
  return (index + 1) % count;
}
