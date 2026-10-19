import { describe, expect, it } from 'vitest';
import { datesAround, formatDailyFile, parseNytReply } from '../scripts/daily-lib';
import { parseDailyWords } from '../src/guess/daily';

const REPLY = { id: 1, solution: 'Plank', print_date: '2026-10-20', days_since_launch: 1949, editor: 'An Editor' };
const NONE = new Set<string>();

describe("reading the NYT's daily word", () => {
  it('reads the word, the date and the puzzle number', () => {
    expect(parseNytReply(REPLY, '2026-10-20', NONE)).toEqual({ date: '2026-10-20', number: 1949, word: 'plank' });
  });

  it('skips a word on the never-use list', () => {
    expect(parseNytReply(REPLY, '2026-10-20', new Set(['plank']))).toBeNull();
  });

  it("skips another day's reply, and words that aren't five letters a–z", () => {
    expect(parseNytReply(REPLY, '2026-10-21', NONE)).toBeNull();
    expect(parseNytReply({ ...REPLY, solution: 'plan' }, '2026-10-20', NONE)).toBeNull();
    expect(parseNytReply({ ...REPLY, solution: 'café!' }, '2026-10-20', NONE)).toBeNull();
  });

  it('skips replies that are not what it expects', () => {
    for (const reply of [null, 'html', 42, {}, { ...REPLY, days_since_launch: 'many' }, { ...REPLY, solution: 5 }]) {
      expect(parseNytReply(reply, '2026-10-20', NONE)).toBeNull();
    }
  });
});

describe('which days to fetch', () => {
  it('fetches yesterday through two days ahead', () => {
    expect(datesAround(new Date('2026-10-20T09:00:00Z'))).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22']);
  });
});

describe('writing daily-word.txt', () => {
  it('writes one line per day that the app reads back', () => {
    const words = [
      { date: '2026-10-20', number: 1949, word: 'plank' },
      { date: '2026-10-21', number: 1950, word: 'scald' },
    ];
    const text = formatDailyFile(words);
    expect(text).toBe('2026-10-20 1949 plank\n2026-10-21 1950 scald\n');
    expect(parseDailyWords(text)).toEqual(words);
  });

  it('writes an empty file when there are no words', () => {
    expect(formatDailyFile([])).toBe('');
  });
});
