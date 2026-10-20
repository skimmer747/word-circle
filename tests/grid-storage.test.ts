import { describe, expect, it } from 'vitest';
import {
  GRID_KEY,
  loadSavedGrid,
  nextPuzzle,
  progressFor,
  recordGridSolve,
  saveSavedGrid,
  type SavedGrid,
} from '../src/grid/storage';
import { answerWords } from '../src/grid/puzzle';
import type { GridPuzzleSet } from '../src/grid/types';
import { avoidChecker } from '../src/shared/avoid';
import { MemoryStore } from './memory-store';

const puzzle = (cells: string) => ({ size: 2, cells, sections: 'aabb' });
const PUZZLES: GridPuzzleSet = {
  easy: [puzzle('abcd'), puzzle('efgh')],
  medium: [puzzle('ijkl'), puzzle('mnop')],
  hard: [puzzle('qrst'), puzzle('uvwx')],
};
const SAVED: SavedGrid = {
  level: 'medium',
  levels: {
    easy: { index: 1, id: 'efgh', placed: ['e', '', '', ''], hinted: [3] },
    medium: { index: 0, id: 'ijkl', placed: [], hinted: [] },
  },
  stats: { totalSolved: 4, todaySolved: 2, lastPlayedDay: '2026-10-19' },
};

describe('saving Word Grid', () => {
  it('starts on Easy with nothing played', () => {
    expect(loadSavedGrid(new MemoryStore())).toEqual({
      level: 'easy',
      levels: {},
      stats: { totalSolved: 0, todaySolved: 0, lastPlayedDay: null },
    });
  });

  it('remembers her level, her place and letters in each level, and her counts', () => {
    const store = new MemoryStore();
    saveSavedGrid(store, SAVED);
    expect(loadSavedGrid(store)).toEqual(SAVED);
  });

  it('starts fresh if the save is damaged', () => {
    for (const raw of ['not json', 'null', '{"level":"expert","levels":{},"stats":null}', '{"level":"easy","levels":3}']) {
      const store = new MemoryStore();
      store.setItem(GRID_KEY, raw);
      expect(loadSavedGrid(store).levels).toEqual({});
    }
  });

  it('drops only a damaged level, keeping the others and her counts', () => {
    const store = new MemoryStore();
    const damaged = { ...SAVED, levels: { ...SAVED.levels, medium: { index: 0, id: 'ijkl', placed: ['A'], hinted: [] } } };
    store.setItem(GRID_KEY, JSON.stringify(damaged));
    const loaded = loadSavedGrid(store);
    expect(loaded.levels.easy).toEqual(SAVED.levels.easy);
    expect(loaded.levels.medium).toBeUndefined();
    expect(loaded.stats).toEqual(SAVED.stats);
  });

  it('keeps her counts at zero if they are damaged', () => {
    const store = new MemoryStore();
    store.setItem(GRID_KEY, JSON.stringify({ ...SAVED, stats: { totalSolved: -1 } }));
    expect(loadSavedGrid(store).stats).toEqual({ totalSolved: 0, todaySolved: 0, lastPlayedDay: null });
  });
});

describe('her place in a level', () => {
  it('starts a level she has never played at its first puzzle', () => {
    expect(progressFor(SAVED, PUZZLES, 'hard')).toEqual({ index: 0, id: 'qrst', placed: [], hinted: [] });
  });

  it('keeps her place and letters when the puzzle is still there', () => {
    expect(progressFor(SAVED, PUZZLES, 'easy')).toEqual(SAVED.levels.easy);
  });

  it('starts that place fresh if the list was regenerated', () => {
    const changed = { ...PUZZLES, easy: [puzzle('abcd'), puzzle('zzzz')] };
    expect(progressFor(SAVED, changed, 'easy')).toEqual({ index: 1, id: 'zzzz', placed: [], hinted: [] });
  });

  it('moves on to the next puzzle, wrapping at the end, leaving other levels alone', () => {
    const after = nextPuzzle(SAVED, PUZZLES, 'easy');
    expect(after.levels.easy).toEqual({ index: 0, id: 'abcd', placed: [], hinted: [] });
    expect(after.levels.medium).toEqual(SAVED.levels.medium);
    expect(nextPuzzle(SAVED, PUZZLES, 'medium').levels.medium).toEqual({ index: 1, id: 'mnop', placed: [], hinted: [] });
  });
});

describe('counting finished puzzles', () => {
  it('counts today, starting over on a new day', () => {
    const first = recordGridSolve({ totalSolved: 0, todaySolved: 0, lastPlayedDay: null }, '2026-10-20');
    expect(first).toEqual({ totalSolved: 1, todaySolved: 1, lastPlayedDay: '2026-10-20' });
    expect(recordGridSolve(first, '2026-10-20')).toEqual({ totalSolved: 2, todaySolved: 2, lastPlayedDay: '2026-10-20' });
    expect(recordGridSolve(first, '2026-10-21')).toEqual({ totalSolved: 2, todaySolved: 1, lastPlayedDay: '2026-10-21' });
  });
});

describe('words she should never see', () => {
  it('lists every word across and down', () => {
    expect(answerWords(puzzle('abcd'))).toEqual(['ab', 'cd', 'ac', 'bd']);
  });

  it('skips a saved puzzle with an avoided word, fresh, and keeps one without', () => {
    // Easy's saved puzzle, efgh, has "eg" down.
    expect(progressFor(SAVED, PUZZLES, 'easy', avoidChecker(['eg']))).toEqual({ index: 0, id: 'abcd', placed: [], hinted: [] });
    expect(progressFor(SAVED, PUZZLES, 'easy', avoidChecker(['ab']))).toEqual(SAVED.levels.easy);
  });

  it('skips avoided puzzles when moving on', () => {
    expect(nextPuzzle(SAVED, PUZZLES, 'medium', avoidChecker(['mn'])).levels.medium).toEqual({ index: 0, id: 'ijkl', placed: [], hinted: [] });
  });

  it('starts a new player on the chosen level', () => {
    expect(loadSavedGrid(new MemoryStore(), 'hard').level).toBe('hard');
  });
});
