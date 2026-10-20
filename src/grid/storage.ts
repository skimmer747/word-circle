import { NOTHING_AVOIDED, firstAllowed, type AvoidCheck } from '../shared/avoid';
import type { KeyValueStore } from '../shared/store';
import { answerWords } from './puzzle';
import { GRID_LEVELS, type GridLevel, type GridPuzzle, type GridPuzzleSet } from './types';

export const GRID_KEY = 'word-grid:v1';

/** Where she is in one level. */
export interface GridProgress {
  /** Her place in the level's list. */
  index: number;
  /** The puzzle at that place (its cells string), to spot a regenerated list. */
  id: string;
  /** The letter in each square of the box ('' for none), row by row. Empty when she hasn't started. */
  placed: string[];
  /** Squares filled by Hint. */
  hinted: number[];
  /** Active play time on this puzzle so far (older saves don't have it). */
  elapsedMs?: number;
}

export interface GridStats {
  totalSolved: number;
  todaySolved: number;
  lastPlayedDay: string | null;
}

/** Her level, her place in each level she has played, and her counts. */
export interface SavedGrid {
  level: GridLevel;
  levels: Partial<Record<GridLevel, GridProgress>>;
  stats: GridStats;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const LETTER_OR_EMPTY = /^[a-z]?$/;

export function emptyGridStats(): GridStats {
  return { totalSolved: 0, todaySolved: 0, lastPlayedDay: null };
}

export function freshGrid(level: GridLevel = 'easy'): SavedGrid {
  return { level, levels: {}, stats: emptyGridStats() };
}

const hasAvoided = (avoided: AvoidCheck) => (puzzle: GridPuzzle) => answerWords(puzzle).some(avoided);

/** A fresh start at `index` (wrapping at the end), or at the next puzzle without a word she should never see. */
function freshProgress(puzzles: GridPuzzleSet, level: GridLevel, index: number, avoided: AvoidCheck): GridProgress {
  const list = puzzles[level];
  const i = firstAllowed(list, index % list.length, hasAvoided(avoided));
  return { index: i, id: list[i].cells, placed: [], hinted: [] };
}

/** Her place in `level`: the saved one if that puzzle is still there and allowed, otherwise that place (or the next allowed one), fresh. */
export function progressFor(saved: SavedGrid, puzzles: GridPuzzleSet, level: GridLevel, avoided: AvoidCheck = NOTHING_AVOIDED): GridProgress {
  const progress = saved.levels[level];
  if (!progress) return freshProgress(puzzles, level, 0, avoided);
  const index = progress.index % puzzles[level].length;
  const puzzle = puzzles[level][index];
  return puzzle.cells === progress.id && !hasAvoided(avoided)(puzzle)
    ? { ...progress, index }
    : freshProgress(puzzles, level, index, avoided);
}

/** Moves `level` on to its next allowed puzzle (wrapping at the end), with nothing placed. */
export function nextPuzzle(saved: SavedGrid, puzzles: GridPuzzleSet, level: GridLevel, avoided: AvoidCheck = NOTHING_AVOIDED): SavedGrid {
  const next = freshProgress(puzzles, level, progressFor(saved, puzzles, level, avoided).index + 1, avoided);
  return { ...saved, levels: { ...saved.levels, [level]: next } };
}

/** Counts a finished puzzle; "today" starts over on a new day. */
export function recordGridSolve(stats: GridStats, day: string): GridStats {
  return {
    totalSolved: stats.totalSolved + 1,
    todaySolved: stats.lastPlayedDay === day ? stats.todaySolved + 1 : 1,
    lastPlayedDay: day,
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isCount = (value: unknown): boolean => Number.isInteger(value) && (value as number) >= 0;
const isTime = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value) && value >= 0;

function readStats(value: unknown): GridStats {
  if (
    isRecord(value) &&
    isCount(value.totalSolved) &&
    isCount(value.todaySolved) &&
    (value.lastPlayedDay === null || (typeof value.lastPlayedDay === 'string' && DAY.test(value.lastPlayedDay)))
  ) {
    return {
      totalSolved: value.totalSolved as number,
      todaySolved: value.todaySolved as number,
      lastPlayedDay: value.lastPlayedDay as string | null,
    };
  }
  return emptyGridStats();
}

function readProgress(value: unknown): GridProgress | null {
  if (!isRecord(value)) return null;
  const { index, id, placed, hinted } = value;
  if (!isCount(index) || typeof id !== 'string') return null;
  if (!Array.isArray(placed) || !placed.every((l) => typeof l === 'string' && LETTER_OR_EMPTY.test(l))) return null;
  if (!Array.isArray(hinted) || !hinted.every(isCount)) return null;
  return {
    index: index as number,
    id,
    placed: placed as string[],
    hinted: hinted as number[],
    ...(isTime(value.elapsedMs) ? { elapsedMs: value.elapsedMs as number } : {}),
  };
}

/** A damaged level is dropped on its own, so it never costs her the others. */
function readSavedGrid(value: unknown): SavedGrid | null {
  if (!isRecord(value) || !GRID_LEVELS.includes(value.level as GridLevel) || !isRecord(value.levels)) return null;
  const levels: SavedGrid['levels'] = {};
  for (const level of GRID_LEVELS) {
    const progress = readProgress(value.levels[level]);
    if (progress) levels[level] = progress;
  }
  return { level: value.level as GridLevel, levels, stats: readStats(value.stats) };
}

/** Her save, or a fresh start on `startLevel` (set on the settings page). */
export function loadSavedGrid(store: KeyValueStore, startLevel: GridLevel = 'easy'): SavedGrid {
  try {
    const raw = store.getItem(GRID_KEY);
    const saved = raw === null ? null : readSavedGrid(JSON.parse(raw));
    if (saved) return saved;
  } catch {
    // Unreadable save: start fresh.
  }
  return freshGrid(startLevel);
}

export function saveSavedGrid(store: KeyValueStore, saved: SavedGrid): void {
  try {
    store.setItem(GRID_KEY, JSON.stringify(saved));
  } catch {
    // Storage full or unavailable: keep playing; progress just won't survive a restart.
  }
}
