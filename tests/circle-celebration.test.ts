import { describe, expect, it } from 'vitest';
import { circleLines } from '../src/circle/celebration';

const BASE = { recordMs: null, streakDays: 1, todaySolved: 1, puzzleNumber: 7, milestone: false };

describe("Word Circle's good news", () => {
  it('always shows puzzles today and the puzzle number', () => {
    expect(circleLines(BASE).map((line) => line.text)).toEqual(['1 puzzle today', 'Puzzle number 7']);
  });

  it('puts a new record first, highlighted', () => {
    const lines = circleLines({ ...BASE, recordMs: 112_000 });
    expect(lines[0]).toMatchObject({ kind: 'row-record', text: 'New record! 1 min 52 sec', highlight: true });
  });

  it('shows days in a row from the second day', () => {
    const lines = circleLines({ ...BASE, streakDays: 5, todaySolved: 3 });
    expect(lines.map((line) => line.text)).toEqual(['5 days in a row', '3 puzzles today', 'Puzzle number 7']);
  });

  it('highlights milestones', () => {
    const lines = circleLines({ ...BASE, puzzleNumber: 50, milestone: true });
    expect(lines[lines.length - 1]).toMatchObject({ text: 'Puzzle number 50!', highlight: true });
  });
});
