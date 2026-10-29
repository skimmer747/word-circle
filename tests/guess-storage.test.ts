import { describe, expect, it } from 'vitest';
import {
  GUESS_KEY,
  emptyGuessStats,
  freshGuess,
  listWord,
  loadSavedGuess,
  recordGuessSolve,
  saveSavedGuess,
  type SavedGuess,
} from '../src/guess/storage';
import type { GuessWords } from '../src/guess/words';
import { avoidChecker } from '../src/shared/avoid';
import { MemoryStore } from './memory-store';

const WORDS: GuessWords = { answers: ['crane', 'slate', 'house'], accepted: ['crane', 'house', 'slate', 'stare'] };
const SAVED: SavedGuess = {
  index: 1,
  word: 'slate',
  daily: null,
  guesses: ['stare'],
  hinted: [1],
  dailyDone: { date: '2026-10-19', share: 'Wordle 1,948 3/6' },
  stats: { totalSolved: 12, todaySolved: 2, lastPlayedDay: '2026-10-19' },
};
const stored = (value: unknown) => {
  const store = new MemoryStore();
  store.setItem(GUESS_KEY, typeof value === 'string' ? value : JSON.stringify(value));
  return store;
};

describe('saving Word Guess', () => {
  it('starts on the first word with nothing saved', () => {
    expect(loadSavedGuess(new MemoryStore(), WORDS)).toEqual(freshGuess(WORDS));
    expect(freshGuess(WORDS).word).toBe('crane');
  });

  it('round trips her place', () => {
    const store = new MemoryStore();
    saveSavedGuess(store, SAVED);
    expect(loadSavedGuess(store, WORDS)).toEqual(SAVED);
  });

  it('starts her place fresh if the list was regenerated, keeping her counts', () => {
    expect(loadSavedGuess(stored({ ...SAVED, word: 'plant' }), WORDS)).toEqual({ ...SAVED, guesses: [], hinted: [] });
  });

  it('keeps a daily word even though it is not on the list', () => {
    const daily = { ...SAVED, word: 'pious', daily: { date: '2026-10-20', number: 1949 } };
    expect(loadSavedGuess(stored(daily), WORDS)).toEqual(daily);
  });

  it('wraps a place past the end of a shorter list', () => {
    expect(loadSavedGuess(stored({ ...SAVED, index: 4 }), WORDS)).toEqual(SAVED);
  });

  it('starts fresh if the save is damaged', () => {
    for (const bad of ['not json', 'null', { ...SAVED, guesses: ['toolong'] }, { ...SAVED, hinted: [7] }, { ...SAVED, word: 5 }]) {
      expect(loadSavedGuess(stored(bad), WORDS)).toEqual(freshGuess(WORDS));
    }
  });

  it('remembers that she shared today\'s Wordle', () => {
    const shared: SavedGuess = { ...SAVED, dailyDone: { date: '2026-10-19', share: 'Wordle 1,948 3/6', shared: true } };
    const store = new MemoryStore();
    saveSavedGuess(store, shared);
    expect(loadSavedGuess(store, WORDS)).toEqual(shared);
  });

  it('reads a damaged shared mark as not shared, keeping her place', () => {
    expect(loadSavedGuess(stored({ ...SAVED, dailyDone: { ...SAVED.dailyDone, shared: 'yes' } }), WORDS)).toEqual(SAVED);
  });

  it('keeps her place even if her counts are damaged', () => {
    expect(loadSavedGuess(stored({ ...SAVED, stats: { totalSolved: -1 } }), WORDS)).toEqual({ ...SAVED, stats: emptyGuessStats() });
  });

  it('moves her place to a list word, fresh', () => {
    expect(listWord(SAVED, WORDS, 3)).toEqual({ ...SAVED, index: 0, word: 'crane', daily: null, guesses: [], hinted: [] });
  });
});

describe('counting finished words', () => {
  it('counts words today and in all', () => {
    expect(recordGuessSolve(SAVED.stats, '2026-10-19')).toEqual({ totalSolved: 13, todaySolved: 3, lastPlayedDay: '2026-10-19' });
  });

  it("starts today's count over on a new day", () => {
    expect(recordGuessSolve(SAVED.stats, '2026-10-20')).toEqual({ totalSolved: 13, todaySolved: 1, lastPlayedDay: '2026-10-20' });
  });
});

describe('words she should never see', () => {
  const avoided = avoidChecker(['slate']);

  it('skips an avoided word when moving to a place', () => {
    expect(listWord(SAVED, WORDS, 1, avoided)).toMatchObject({ index: 2, word: 'house' });
  });

  it('moves her off a word that has just been avoided, fresh', () => {
    expect(loadSavedGuess(stored(SAVED), WORDS, avoided)).toEqual({ ...SAVED, index: 2, word: 'house', guesses: [], hinted: [] });
  });

  it('moves her off an avoided daily word onto her list word', () => {
    const daily: SavedGuess = { ...SAVED, word: 'grave', daily: { date: '2026-10-20', number: 1949 } };
    expect(loadSavedGuess(stored(daily), WORDS, avoidChecker(['grave']))).toEqual({
      ...SAVED,
      word: 'slate',
      daily: null,
      guesses: [],
      hinted: [],
    });
  });

  it('starts a new player on the first word not avoided', () => {
    expect(loadSavedGuess(new MemoryStore(), WORDS, avoidChecker(['crane'])).word).toBe('slate');
  });
});

describe('play time on a word', () => {
  it('keeps the time so far, and older saves load without it', () => {
    expect(loadSavedGuess(stored({ ...SAVED, elapsedMs: 42_000 }), WORDS).elapsedMs).toBe(42_000);
    expect(loadSavedGuess(stored(SAVED), WORDS).elapsedMs).toBeUndefined();
    expect(loadSavedGuess(stored({ ...SAVED, elapsedMs: -5 }), WORDS).elapsedMs).toBeUndefined();
  });

  it('starts a new word at no time', () => {
    expect(listWord({ ...SAVED, elapsedMs: 5000 }, WORDS, 0).elapsedMs).toBeUndefined();
  });
});
