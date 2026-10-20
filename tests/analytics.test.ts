import { describe, expect, it } from 'vitest';
import { analyticsAllowed, puzzleEvent } from '../src/analytics';
import type { PlayRecord } from '../src/stats/log';

const rec = (o: Partial<PlayRecord> = {}): PlayRecord => ({
  day: '2026-10-20',
  hour: 9,
  game: 'circle',
  level: 'medium',
  ms: 60_000,
  hints: 0,
  tries: 0,
  typed: true,
  daily: false,
  words: 5,
  letters: 20,
  longest: 'stone',
  first: '',
  ...o,
});

describe('analyticsAllowed', () => {
  it('counts only the production build on the live site', () => {
    expect(analyticsAllowed(true, 'skimmer747.github.io')).toBe(true);
    expect(analyticsAllowed(false, 'skimmer747.github.io')).toBe(false);
    expect(analyticsAllowed(true, '127.0.0.1')).toBe(false);
    expect(analyticsAllowed(true, 'localhost')).toBe(false);
  });
});

describe('puzzleEvent', () => {
  it('sends the game, level and whether Hint helped, and nothing else', () => {
    expect(puzzleEvent(rec({ hints: 2, longest: 'secret', first: 'crane' }))).toEqual({ game: 'circle', level: 'medium', used_hint: 'yes' });
    expect(puzzleEvent(rec({ game: 'guess', level: null }))).toEqual({ game: 'guess', level: 'none', used_hint: 'no' });
  });
});
