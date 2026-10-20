import { describe, expect, it } from 'vitest';
import { gridLines } from '../src/grid/celebration';

const text = (lines: ReturnType<typeof gridLines>) => lines.map((line) => line.text);

describe("Word Grid's good news", () => {
  it('says she needed no hints, her days in a row, puzzles today and the puzzle number', () => {
    expect(text(gridLines({ hinted: false, streakDays: 5, todaySolved: 3, puzzleNumber: 12 }))).toEqual([
      'Solved with no hints',
      '5 days in a row',
      '3 puzzles today',
      'Puzzle number 12',
    ]);
  });

  it('leaves out the no-hints line after a hint, and days in a row on day one', () => {
    expect(text(gridLines({ hinted: true, streakDays: 1, todaySolved: 1, puzzleNumber: 1 }))).toEqual([
      '1 puzzle today',
      'Puzzle number 1',
    ]);
  });

  it('highlights a milestone puzzle', () => {
    const lines = gridLines({ hinted: true, streakDays: 1, todaySolved: 1, puzzleNumber: 25 });
    expect(lines[lines.length - 1]).toMatchObject({ text: 'Puzzle number 25!', highlight: true });
    expect(lines[0].highlight).toBe(false);
  });
});
