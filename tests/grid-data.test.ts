import { describe, expect, it } from 'vitest';
import { solveByWords, wordsByLength } from '../scripts/grid-lib';
import gridPuzzles from '../src/data/grid-puzzles.json';
import gridWords from '../src/data/grid-words.json';
import { readPuzzle } from '../src/grid/puzzle';
import { GRID_LEVELS, type GridPuzzleSet } from '../src/grid/types';

const puzzles = gridPuzzles as GridPuzzleSet;
const words = new Set(gridWords.words);
const byLength = wordsByLength(gridWords.words);
const SIZES = { easy: 4, medium: 5, hard: 6 };

describe.each(GRID_LEVELS)('the shipped %s Word Grid puzzles', (level) => {
  it('has at least 400 puzzles of the right size, none repeated', () => {
    expect(puzzles[level].length).toBeGreaterThanOrEqual(400);
    expect(new Set(puzzles[level].map((p) => p.cells)).size).toBe(puzzles[level].length);
    for (const puzzle of puzzles[level]) expect(puzzle.size).toBe(SIZES[level]);
  });

  it('spells a real word in every run', () => {
    for (const puzzle of puzzles[level]) {
      const shape = readPuzzle(puzzle);
      for (const run of shape.runs) expect(words.has(run.map((s) => shape.answer[s]).join('')), puzzle.cells).toBe(true);
    }
  });

  it('has exactly one answer to every puzzle, the stored one', { timeout: 120_000 }, () => {
    for (const puzzle of puzzles[level]) expect(solveByWords(puzzle, byLength), puzzle.cells).toEqual([puzzle.cells]);
  });
});
