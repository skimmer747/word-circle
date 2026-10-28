import { describe, expect, it } from 'vitest';
import { jigsawLines } from '../src/jigsaw/celebration';

const text = (lines: ReturnType<typeof jigsawLines>) => lines.map((line) => line.text);

describe("Jigsaw's good news", () => {
  it('says she needed no hints, her days in a row, jigsaws today and the jigsaw number', () => {
    expect(text(jigsawLines({ hinted: false, streakDays: 3, todaySolved: 2, puzzleNumber: 7 }))).toEqual([
      'Done with no hints',
      '3 days in a row',
      '2 jigsaws today',
      'Jigsaw number 7',
    ]);
  });

  it('leaves out the no-hints line after a hint, and days in a row on day one', () => {
    expect(text(jigsawLines({ hinted: true, streakDays: 1, todaySolved: 1, puzzleNumber: 1 }))).toEqual(['1 jigsaw today', 'Jigsaw number 1']);
  });

  it('highlights a milestone jigsaw', () => {
    const lines = jigsawLines({ hinted: true, streakDays: 1, todaySolved: 1, puzzleNumber: 25 });
    expect(lines[lines.length - 1]).toMatchObject({ text: 'Jigsaw number 25!', highlight: true });
  });
});
