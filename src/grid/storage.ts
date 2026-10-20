import type { KeyValueStore } from '../shared/store';
import { GRID_LEVELS, type GridLevel, type GridPuzzleSet } from './types';

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

export function freshGrid(): SavedGrid {
  return { level: 'easy', levels: {}, stats: emptyGridStats() };
}

function freshProgress(puzzles: GridPuzzleSet, level: GridLevel, index: number): GridProgress {
  const list = puzzles[level];
  const i = index % list.length;
  return { index: i, id: list[i].cells, placed: [], hinted: [] };
}

/** Her place in `level`: the saved one if that puzzle is still there, otherwise that place, fresh. */
export function progressFor(saved: SavedGrid, puzzles: GridPuzzleSet, level: GridLevel): GridProgress {
  const progress = saved.levels[level];
  if (!progress) return freshProgress(puzzles, level, 0);
  const index = progress.index % puzzles[level].length;
  return puzzles[level][index].cells === progress.id ? { ...progress, index } : freshProgress(puzzles, level, index);
}

/** Moves `level` on to its next puzzle (wrapping at the end), with nothing placed. */
export function nextPuzzle(saved: SavedGrid, puzzles: GridPuzzleSet, level: GridLevel): SavedGrid {
  const next = freshProgress(puzzles, level, progressFor(saved, puzzles, level).index + 1);
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
  return { index: index as number, id, placed: placed as string[], hinted: hinted as number[] };
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

export function loadSavedGrid(store: KeyValueStore): SavedGrid {
  try {
    const raw = store.getItem(GRID_KEY);
    const saved = raw === null ? null : readSavedGrid(JSON.parse(raw));
    if (saved) return saved;
  } catch {
    // Unreadable save: start fresh.
  }
  return freshGrid();
}

export function saveSavedGrid(store: KeyValueStore, saved: SavedGrid): void {
  try {
    store.setItem(GRID_KEY, JSON.stringify(saved));
  } catch {
    // Storage full or unavailable: keep playing; progress just won't survive a restart.
  }
}
