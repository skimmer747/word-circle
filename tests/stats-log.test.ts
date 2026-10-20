import { describe, expect, it } from 'vitest';
import type { KeyValueStore } from '../src/shared/store';
import {
  LIFETIME_KEY,
  LOG_KEY,
  addPlay,
  emptyLifetime,
  loadLifetime,
  loadLog,
  mostPlayedLevel,
  type PlayRecord,
} from '../src/stats/log';
import { MemoryStore } from './memory-store';

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

describe('the play log', () => {
  it('starts empty', () => {
    const store = new MemoryStore();
    expect(loadLog(store)).toEqual([]);
    expect(loadLifetime(store)).toEqual(emptyLifetime());
  });

  it('saves a finished puzzle and the lifetime figures', () => {
    const store = new MemoryStore();
    addPlay(store, rec());
    expect(loadLog(store)).toEqual([rec()]);
    const life = loadLifetime(store);
    expect(life).toMatchObject({ since: '2026-10-20', daysPlayed: 1, lastDay: '2026-10-20', words: 5, letters: 20, longestWord: 'stone', mostInADay: 1, todayCount: 1 });
    expect(life.hours[9]).toBe(1);
  });

  it('counts days played and the most in one day', () => {
    const store = new MemoryStore();
    addPlay(store, rec());
    addPlay(store, rec());
    expect(loadLifetime(store)).toMatchObject({ daysPlayed: 1, todayCount: 2, mostInADay: 2 });
    addPlay(store, rec({ day: '2026-10-21' }));
    expect(loadLifetime(store)).toMatchObject({ daysPlayed: 2, todayCount: 1, mostInADay: 2, lastDay: '2026-10-21', since: '2026-10-20' });
  });

  it('drops detail older than 400 days, keeping the lifetime figures', () => {
    const store = new MemoryStore();
    store.setItem(LOG_KEY, JSON.stringify([rec({ day: '2025-09-15' }), rec({ day: '2025-09-16' })]));
    addPlay(store, rec());
    expect(loadLog(store).map((r) => r.day)).toEqual(['2025-09-16', '2026-10-20']);
  });

  it('keeps Word Guess figures from typed solves only', () => {
    const store = new MemoryStore();
    addPlay(store, rec({ game: 'guess', level: null, tries: 3, first: 'crane' }));
    addPlay(store, rec({ game: 'guess', level: null, tries: 9, first: 'crane' }));
    addPlay(store, rec({ game: 'guess', level: null, tries: 2, typed: false, first: 'slate' }));
    const life = loadLifetime(store);
    expect(life.triesCounts).toEqual([0, 0, 1, 0, 0, 0, 1]);
    expect(life.fewestTries).toBe(3);
    expect(life.firstGuesses).toEqual({ crane: 2, slate: 1 });
  });

  it('counts Word Grids solved with no hints', () => {
    const store = new MemoryStore();
    addPlay(store, rec({ game: 'grid', hints: 0 }));
    addPlay(store, rec({ game: 'grid', hints: 2 }));
    addPlay(store, rec({ game: 'circle', hints: 0 }));
    expect(loadLifetime(store).noHintGrids).toBe(1);
  });

  it('keeps the longest word, the earlier one on a tie', () => {
    const store = new MemoryStore();
    addPlay(store, rec({ longest: 'stone' }));
    addPlay(store, rec({ longest: 'crane' }));
    expect(loadLifetime(store).longestWord).toBe('stone');
    addPlay(store, rec({ longest: 'strange' }));
    expect(loadLifetime(store).longestWord).toBe('strange');
  });

  it('skips damaged entries and starts damaged figures over', () => {
    const store = new MemoryStore();
    store.setItem(LOG_KEY, JSON.stringify([rec(), { day: 'yesterday' }, 7]));
    expect(loadLog(store)).toEqual([rec()]);
    store.setItem(LOG_KEY, 'not json');
    expect(loadLog(store)).toEqual([]);
    store.setItem(LIFETIME_KEY, JSON.stringify({ words: -1 }));
    expect(loadLifetime(store)).toEqual(emptyLifetime());
  });

  it('never breaks the game when storage is unavailable', () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('unavailable');
      },
      setItem: () => {
        throw new Error('unavailable');
      },
    };
    expect(() => addPlay(broken, rec())).not.toThrow();
    expect(loadLog(broken)).toEqual([]);
  });
});

describe('mostPlayedLevel', () => {
  it('finds the level with the most records, the easier one on a tie', () => {
    expect(mostPlayedLevel([rec({ level: 'hard' }), rec({ level: 'medium' }), rec({ level: 'medium' })])).toBe('medium');
    expect(mostPlayedLevel([rec({ level: 'hard' }), rec({ level: 'easy' })])).toBe('easy');
    expect(mostPlayedLevel([rec({ level: null })])).toBeNull();
    expect(mostPlayedLevel([])).toBeNull();
  });
});
