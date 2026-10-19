import { describe, expect, it } from 'vitest';
import { seededRandom, shuffle } from '../src/shared/random';

describe('seededRandom', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('produces numbers in [0, 1)', () => {
    const random = seededRandom(7);
    for (let i = 0; i < 1000; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('differs between seeds', () => {
    expect(seededRandom(1)()).not.toBe(seededRandom(2)());
  });
});

describe('shuffle', () => {
  it('returns a permutation without changing the input', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const output = shuffle(input, seededRandom(3));
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...output].sort()).toEqual(input);
  });

  it('is reproducible with the same seed', () => {
    expect(shuffle([1, 2, 3, 4, 5, 6], seededRandom(9))).toEqual(shuffle([1, 2, 3, 4, 5, 6], seededRandom(9)));
  });
});
