import { describe, expect, it } from 'vitest';
import {
  STORAGE_KEY,
  loadProgress,
  nextIndex,
  resolveStart,
  saveProgress,
  type KeyValueStore,
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

describe('saving and loading progress', () => {
  it('round-trips progress', () => {
    const store = new MemoryStore();
    saveProgress(store, PROGRESS);
    expect(loadProgress(store)).toEqual(PROGRESS);
  });

  it('returns null when nothing is saved', () => {
    expect(loadProgress(new MemoryStore())).toBeNull();
  });

  it('returns null for corrupt or malformed data', () => {
    const store = new MemoryStore();
    store.setItem(STORAGE_KEY, '{not json');
    expect(loadProgress(store)).toBeNull();
    store.setItem(STORAGE_KEY, JSON.stringify({ puzzleIndex: -1, puzzleId: 'x', found: [], revealed: {} }));
    expect(loadProgress(store)).toBeNull();
    store.setItem(STORAGE_KEY, JSON.stringify({ puzzleIndex: 0, puzzleId: 'x', found: [3], revealed: {} }));
    expect(loadProgress(store)).toBeNull();
    store.setItem(STORAGE_KEY, JSON.stringify({ puzzleIndex: 0, puzzleId: 'x', found: [], revealed: {}, bonusFound: [3] }));
    expect(loadProgress(store)).toBeNull();
  });

  it('loads saves from before extra words were tracked', () => {
    const store = new MemoryStore();
    store.setItem(STORAGE_KEY, JSON.stringify({ puzzleIndex: 1, puzzleId: 'fghij', found: ['hi'], revealed: {} }));
    expect(loadProgress(store)).toEqual({ puzzleIndex: 1, puzzleId: 'fghij', found: ['hi'], revealed: {}, bonusFound: [] });
  });

  it('keeps playing when storage refuses to save', () => {
    const store: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(() => saveProgress(store, PROGRESS)).not.toThrow();
  });
});

describe('resolveStart', () => {
  it('starts at the first puzzle with nothing saved', () => {
    expect(resolveStart(PUZZLES, null)).toEqual({ index: 0, found: [], revealed: {}, bonusFound: [] });
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
