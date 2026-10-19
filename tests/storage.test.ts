import { describe, expect, it } from 'vitest';
import {
  OLD_STORAGE_KEY,
  STORAGE_KEY,
  loadSavedGame,
  nextIndex,
  resolveStart,
  saveSavedGame,
  type KeyValueStore,
  type SavedGame,
} from '../src/game/storage';
import type { Progress, Puzzle } from '../src/game/types';

class MemoryStore implements KeyValueStore {
  data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

const puzzle = (id: string): Puzzle => ({ id, letters: [...id], words: [], bonus: [] });
const PUZZLES = [puzzle('abcde'), puzzle('fghij'), puzzle('klmno')];
const PROGRESS: Progress = {
  puzzleIndex: 1,
  puzzleId: 'fghij',
  found: ['hi'],
  revealed: { fig: [0] },
  bonusFound: ['jig'],
};
const FRESH: SavedGame = { level: 'medium', levels: {} };

describe('saving and loading the game', () => {
  it('starts on Medium with nothing saved', () => {
    expect(loadSavedGame(new MemoryStore())).toEqual(FRESH);
  });

  it('round-trips the current level and each level’s progress', () => {
    const store = new MemoryStore();
    const game: SavedGame = { level: 'hard', levels: { hard: PROGRESS, easy: { ...PROGRESS, puzzleIndex: 0 } } };
    saveSavedGame(store, game);
    expect(loadSavedGame(store)).toEqual(game);
  });

  it('moves progress saved before levels existed into Medium', () => {
    const store = new MemoryStore();
    store.setItem(OLD_STORAGE_KEY, JSON.stringify({ puzzleIndex: 1, puzzleId: 'fghij', found: ['hi'], revealed: {} }));
    expect(loadSavedGame(store)).toEqual({
      level: 'medium',
      levels: { medium: { puzzleIndex: 1, puzzleId: 'fghij', found: ['hi'], revealed: {}, bonusFound: [] } },
    });
  });

  it('prefers the newer save when both exist', () => {
    const store = new MemoryStore();
    store.setItem(OLD_STORAGE_KEY, JSON.stringify(PROGRESS));
    saveSavedGame(store, { level: 'easy', levels: {} });
    expect(loadSavedGame(store)).toEqual({ level: 'easy', levels: {} });
  });

  it('starts fresh from corrupt or malformed data', () => {
    const store = new MemoryStore();
    store.setItem(STORAGE_KEY, '{not json');
    expect(loadSavedGame(store)).toEqual(FRESH);
    store.setItem(STORAGE_KEY, JSON.stringify({ level: 'expert', levels: {} }));
    expect(loadSavedGame(store)).toEqual(FRESH);
    store.setItem(STORAGE_KEY, JSON.stringify({ level: 'easy', levels: { easy: { ...PROGRESS, found: [3] } } }));
    expect(loadSavedGame(store)).toEqual(FRESH);
    store.setItem(STORAGE_KEY, JSON.stringify({ level: 'easy', levels: { easy: { ...PROGRESS, bonusFound: [3] } } }));
    expect(loadSavedGame(store)).toEqual(FRESH);
  });

  it('keeps playing when storage refuses to save', () => {
    const store: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(() => saveSavedGame(store, FRESH)).not.toThrow();
  });
});

describe('resolveStart', () => {
  it('starts at the first puzzle with nothing saved', () => {
    expect(resolveStart(PUZZLES, undefined)).toEqual({ index: 0, found: [], revealed: {}, bonusFound: [] });
  });

  it('restores the saved puzzle when it still matches', () => {
    expect(resolveStart(PUZZLES, PROGRESS)).toEqual({
      index: 1,
      found: ['hi'],
      revealed: { fig: [0] },
      bonusFound: ['jig'],
    });
  });

  it('starts the saved position fresh when the puzzles changed', () => {
    expect(resolveStart(PUZZLES, { ...PROGRESS, puzzleId: 'zzzzz' })).toEqual({
      index: 1,
      found: [],
      revealed: {},
      bonusFound: [],
    });
  });

  it('wraps a saved position past the end of the list', () => {
    expect(resolveStart(PUZZLES, { ...PROGRESS, puzzleIndex: 4 })).toEqual({
      index: 1,
      found: ['hi'],
      revealed: { fig: [0] },
      bonusFound: ['jig'],
    });
  });
});

describe('nextIndex', () => {
  it('moves forward and wraps around', () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(0);
  });
});
