import { describe, expect, it } from 'vitest';
import { circleRecord, gridRecord, guessRecord, wordFacts } from '../src/stats/records';

const NOW = new Date(2026, 9, 20, 9, 30);

describe('wordFacts', () => {
  it('counts words and letters and finds the first longest word', () => {
    expect(wordFacts(['ore', 'over', 'rove'])).toEqual({ words: 3, letters: 11, longest: 'over' });
    expect(wordFacts([])).toEqual({ words: 0, letters: 0, longest: '' });
  });
});

describe('records', () => {
  it('records a Word Circle puzzle with its answers, extra words and hints', () => {
    const r = circleRecord({
      words: ['ore', 'rev', 'roe', 'over'],
      extras: ['rove'],
      revealed: { over: [0, 1], roe: [2] },
      level: 'medium',
      ms: 61_234.6,
      now: NOW,
    });
    expect(r).toEqual({
      day: '2026-10-20',
      hour: 9,
      game: 'circle',
      level: 'medium',
      ms: 61_235,
      hints: 3,
      tries: 0,
      typed: true,
      daily: false,
      words: 5,
      letters: 17,
      longest: 'over',
      first: '',
    });
  });

  it('records a Word Guess word with its tries and first guess', () => {
    const r = guessRecord({ answer: 'crane', guesses: ['stare', 'crane'], hinted: [1], typed: true, daily: true, ms: 90_000, now: NOW });
    expect(r).toMatchObject({ game: 'guess', level: null, hints: 1, tries: 2, typed: true, daily: true, words: 1, letters: 5, longest: 'crane', first: 'stare' });
    expect(guessRecord({ answer: 'crane', guesses: [], hinted: [0, 1, 2, 3, 4], typed: false, daily: false, ms: 0, now: NOW }).first).toBe('');
  });

  it('records a Word Grid puzzle with every word across and down', () => {
    const r = gridRecord({ puzzle: { size: 2, cells: 'abcd', sections: 'aabb' }, hinted: [3], level: 'easy', ms: 120_000, now: NOW });
    expect(r).toMatchObject({ game: 'grid', level: 'easy', hints: 1, words: 4, letters: 8, longest: 'ab', typed: true });
  });
});
