import { describe, expect, it } from 'vitest';
import { seededRandom } from '../src/shared/random';
import { identityOrder, shuffleRing } from '../src/ui/ring';

describe('identityOrder', () => {
  it('lists ring slots in order', () => {
    expect(identityOrder(5)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('shuffleRing', () => {
  const letters = ['s', 't', 'o', 'n', 'e'];

  it('returns a permutation whose letters read differently', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const order = [0, 1, 2, 3, 4];
      const next = shuffleRing(order, letters, seededRandom(seed));
      expect([...next].sort()).toEqual(order);
      expect(next.map((i) => letters[i]).join('')).not.toBe('stone');
    }
  });

  it('gives up gracefully when every letter is the same', () => {
    const next = shuffleRing([0, 1, 2], ['a', 'a', 'a'], seededRandom(1));
    expect([...next].sort()).toEqual([0, 1, 2]);
  });
});
