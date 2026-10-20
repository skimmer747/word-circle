import { firstAllowed, type AvoidCheck } from '../shared/avoid';
import type { KeyValueStore } from '../shared/store';
import { emptyStats, type Stats } from './stats';
import { LEVELS, type Level, type Progress, type Puzzle } from './types';

export type { KeyValueStore };

export const STORAGE_KEY = 'word-circle:v2';
/** Single-level progress saved before difficulty levels existed; moved into Medium on load. */
export const OLD_STORAGE_KEY = 'word-circle:v1';

/** The level she's on, where she is in each level she has played, and her stats. */
export interface SavedGame {
  level: Level;
  levels: Partial<Record<Level, Progress>>;
  stats: Stats;
}

export interface StartPoint {
  index: number;
  found: string[];
  revealed: Record<string, number[]>;
  bonusFound: string[];
  elapsedMs: number;
}

const fresh = (level: Level = 'medium'): SavedGame => ({ level, levels: {}, stats: emptyStats() });

const isWordList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((w) => typeof w === 'string');

const isLevel = (value: unknown): value is Level => LEVELS.includes(value as Level);

const isTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** Progress as saved by older versions, which may lack bonusFound and elapsedMs. */
type StoredProgress = Omit<Progress, 'bonusFound' | 'elapsedMs'> & { bonusFound?: string[]; elapsedMs?: number };

function isProgress(value: unknown): value is StoredProgress {
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
    (p.bonusFound === undefined || isWordList(p.bonusFound)) &&
    (p.elapsedMs === undefined || isTime(p.elapsedMs))
  );
}

const complete = (p: StoredProgress): Progress => ({ ...p, bonusFound: p.bonusFound ?? [], elapsedMs: p.elapsedMs ?? 0 });

function isStats(value: unknown): value is Stats {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  const count = (n: unknown) => Number.isInteger(n) && (n as number) >= 0;
  return (
    count(s.totalSolved) &&
    count(s.streakDays) &&
    count(s.todaySolved) &&
    (s.lastPlayedDay === null || (typeof s.lastPlayedDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.lastPlayedDay))) &&
    typeof s.bestMs === 'object' &&
    s.bestMs !== null &&
    Object.entries(s.bestMs).every(([level, ms]) => isLevel(level) && isTime(ms))
  );
}

function readSavedGame(value: unknown): SavedGame | null {
  if (typeof value !== 'object' || value === null) return null;
  const { level, levels, stats } = value as Record<string, unknown>;
  if (!isLevel(level) || typeof levels !== 'object' || levels === null) return null;
  // Damaged or missing stats never cost her progress.
  const result: SavedGame = { level, levels: {}, stats: isStats(stats) ? stats : emptyStats() };
  for (const [key, progress] of Object.entries(levels)) {
    if (!isLevel(key) || !isProgress(progress)) return null;
    result.levels[key] = complete(progress);
  }
  return result;
}

/** Her save, or a fresh start on `startLevel` (set on the settings page). */
export function loadSavedGame(store: KeyValueStore, startLevel: Level = 'medium'): SavedGame {
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (raw !== null) return readSavedGame(JSON.parse(raw)) ?? fresh(startLevel);
    const old = store.getItem(OLD_STORAGE_KEY);
    if (old !== null) {
      const progress: unknown = JSON.parse(old);
      if (isProgress(progress)) return { level: 'medium', levels: { medium: complete(progress) }, stats: emptyStats() };
    }
  } catch {
    // Unreadable save: start fresh.
  }
  return fresh(startLevel);
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
  if (!saved) return { index: 0, found: [], revealed: {}, bonusFound: [], elapsedMs: 0 };
  const index = saved.puzzleIndex % puzzles.length;
  if (puzzles[index].id !== saved.puzzleId) return { index, found: [], revealed: {}, bonusFound: [], elapsedMs: 0 };
  return { index, found: saved.found, revealed: saved.revealed, bonusFound: saved.bonusFound, elapsedMs: saved.elapsedMs };
}

export function nextIndex(index: number, count: number): number {
  return (index + 1) % count;
}

/** Where to start instead if a puzzle's words include one she should never see: the next puzzle without one, fresh. */
export function skipAvoided(puzzles: readonly Puzzle[], start: StartPoint, avoided: AvoidCheck): StartPoint {
  const index = firstAllowed(puzzles, start.index, (puzzle) => puzzle.words.some(avoided));
  return index === start.index ? start : { index, found: [], revealed: {}, bonusFound: [], elapsedMs: 0 };
}

/** The puzzle without extra words she should never see (they then don't count as words at all). */
export function withoutAvoidedBonus(puzzle: Puzzle, avoided: AvoidCheck): Puzzle {
  return puzzle.bonus.some(avoided) ? { ...puzzle, bonus: puzzle.bonus.filter((word) => !avoided(word)) } : puzzle;
}
