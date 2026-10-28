import { describe, expect, it } from 'vitest';
import {
  DAILY_CACHE_KEY,
  cachedDailyWords,
  dailyFor,
  finishWord,
  isTodaysWordle,
  parseDailyWords,
  refreshDailyWords,
  swapInDaily,
  type DailyWord,
} from '../src/guess/daily';
import { emptyGuessStats, type SavedGuess } from '../src/guess/storage';
import type { GuessWords } from '../src/guess/words';
import { avoidChecker } from '../src/shared/avoid';
import { MemoryStore } from './memory-store';

const WORDS: GuessWords = { answers: ['crane', 'slate', 'house'], accepted: ['crane', 'house', 'slate'] };
const TODAY: DailyWord = { date: '2026-10-20', number: 1949, word: 'pious' };
const ON_LIST: SavedGuess = {
  index: 1,
  word: 'slate',
  daily: null,
  guesses: [],
  hinted: [],
  dailyDone: null,
  stats: emptyGuessStats(),
};
const ON_DAILY: SavedGuess = { ...ON_LIST, word: 'pious', daily: { date: '2026-10-20', number: 1949 }, guesses: ['stare'] };

describe('reading daily-word.txt', () => {
  it('reads one word per line', () => {
    expect(parseDailyWords('2026-10-20 1949 pious\n2026-10-21 1950 crane\n')).toEqual([
      TODAY,
      { date: '2026-10-21', number: 1950, word: 'crane' },
    ]);
  });

  it('skips lines it cannot read', () => {
    expect(parseDailyWords('# note\n2026-10-20 pious\n2026-10-20 1949 pi\n<html>\n\n2026-10-20 1949 PIOUS\r\n')).toEqual([TODAY]);
  });

  it("finds today's word", () => {
    expect(dailyFor([TODAY], '2026-10-20')).toEqual(TODAY);
    expect(dailyFor([TODAY], '2026-10-21')).toBeNull();
  });
});

describe('fetching daily-word.txt', () => {
  it('remembers what it fetched, for when the iPad is offline', async () => {
    const store = new MemoryStore();
    expect(await refreshDailyWords(async () => '2026-10-20 1949 pious', store)).toEqual([TODAY]);
    expect(store.getItem(DAILY_CACHE_KEY)).toBe('2026-10-20 1949 pious');
    expect(cachedDailyWords(store)).toEqual([TODAY]);
  });

  it('keeps the last copy when offline', async () => {
    const store = new MemoryStore();
    store.setItem(DAILY_CACHE_KEY, '2026-10-20 1949 pious');
    const fetched = await refreshDailyWords(async () => {
      throw new Error('offline');
    }, store);
    expect(fetched).toBeNull();
    expect(cachedDailyWords(store)).toEqual([TODAY]);
  });
});

describe("bringing in today's word", () => {
  it('takes the place of a list word she has not touched, keeping her place in the list', () => {
    expect(swapInDaily(ON_LIST, TODAY, true)).toEqual({ ...ON_LIST, word: 'pious', daily: { date: '2026-10-20', number: 1949 } });
  });

  it('never interrupts a word she has started', () => {
    expect(swapInDaily(ON_LIST, TODAY, false)).toBeNull();
  });

  it('does nothing without a word for today', () => {
    expect(swapInDaily(ON_LIST, null, true)).toBeNull();
  });

  it('does nothing once she has played it, or while she is on it', () => {
    expect(swapInDaily({ ...ON_LIST, dailyDone: { date: '2026-10-20', share: 'x' } }, TODAY, true)).toBeNull();
    expect(swapInDaily({ ...ON_DAILY, guesses: [] }, TODAY, true)).toBeNull();
  });

  it("replaces an earlier day's daily word she never started", () => {
    const stale: SavedGuess = { ...ON_LIST, word: 'crane', daily: { date: '2026-10-19', number: 1948 } };
    expect(swapInDaily(stale, TODAY, true)?.daily).toEqual({ date: '2026-10-20', number: 1949 });
  });
});

describe('after she finishes a word', () => {
  it('moves on to the next list word', () => {
    expect(finishWord(ON_LIST, WORDS, '2026-10-20', '', null)).toEqual({ ...ON_LIST, index: 2, word: 'house' });
  });

  it("brings in today's word next if she hasn't played it", () => {
    expect(finishWord(ON_LIST, WORDS, '2026-10-20', '', TODAY)).toEqual({
      ...ON_LIST,
      index: 2,
      word: 'pious',
      daily: { date: '2026-10-20', number: 1949 },
    });
  });

  it("remembers today's word and its share text, then goes back to the list where she was", () => {
    expect(finishWord(ON_DAILY, WORDS, '2026-10-20', 'Wordle 1,949 2/6', TODAY)).toEqual({
      ...ON_LIST,
      dailyDone: { date: '2026-10-20', share: 'Wordle 1,949 2/6' },
    });
  });

  it("finishes an earlier day's daily word like any word, then brings in today's", () => {
    const stale: SavedGuess = { ...ON_DAILY, daily: { date: '2026-10-19', number: 1948 } };
    expect(finishWord(stale, WORDS, '2026-10-20', '', TODAY)).toEqual({
      ...ON_LIST,
      word: 'pious',
      daily: { date: '2026-10-20', number: 1949 },
    });
  });

  it('wraps to the start of the list', () => {
    expect(finishWord({ ...ON_LIST, index: 2, word: 'house' }, WORDS, '2026-10-20', '', null)).toMatchObject({ index: 0, word: 'crane' });
  });
});

describe('finishWord with words she should never see', () => {
  it('skips an avoided list word after she finishes', () => {
    expect(finishWord(ON_LIST, WORDS, '2026-10-20', '', null, avoidChecker(['house']))).toMatchObject({ index: 0, word: 'crane' });
  });
});

describe('play time and the daily word', () => {
  it('starts the daily word at no time', () => {
    expect(swapInDaily({ ...ON_LIST, elapsedMs: 5000 }, TODAY, true)?.elapsedMs).toBeUndefined();
  });
});

describe('isTodaysWordle (no hints on it)', () => {
  it('is true on the daily word on its own day', () => {
    expect(isTodaysWordle(ON_DAILY, '2026-10-20')).toBe(true);
  });

  it('is false on a list word', () => {
    expect(isTodaysWordle(ON_LIST, '2026-10-20')).toBe(false);
  });

  it('is false once its day is over, when it finishes like any other word', () => {
    expect(isTodaysWordle(ON_DAILY, '2026-10-21')).toBe(false);
  });
});
