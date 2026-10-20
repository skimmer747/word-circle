import { describe, expect, it } from 'vitest';
import { NOTHING_AVOIDED, avoidChecker, firstAllowed, parseAvoidWords } from '../src/shared/avoid';

describe('parseAvoidWords', () => {
  it('reads words separated by commas, spaces or new lines', () => {
    expect(parseAvoidWords('cancer, Funeral\nhospice  grave')).toEqual(['cancer', 'funeral', 'hospice', 'grave']);
  });

  it('drops anything that is not a letter, and repeats', () => {
    expect(parseAvoidWords(' 42, ill!, ILL; \n\n')).toEqual(['ill']);
  });

  it('reads an empty box as no words', () => {
    expect(parseAvoidWords('')).toEqual([]);
  });

  it('keeps a word together when it has a mark inside it', () => {
    expect(parseAvoidWords("can't, ex-wife")).toEqual(['cant', 'exwife']);
  });

  it('reads a box of only separators as no words', () => {
    expect(parseAvoidWords(' \n , ')).toEqual([]);
  });
});

describe('avoidChecker', () => {
  it('avoids exactly the listed words, in any case', () => {
    const avoided = avoidChecker(['grave']);
    expect(avoided('grave')).toBe(true);
    expect(avoided('GRAVE')).toBe(true);
    expect(avoided('gravel')).toBe(false);
  });

  it('avoids a listed word even if the list has capitals', () => {
    expect(avoidChecker(['Grave'])('grave')).toBe(true);
  });

  it('avoids nothing for an empty list', () => {
    expect(avoidChecker([])).toBe(NOTHING_AVOIDED);
  });
});

describe('firstAllowed', () => {
  const list = ['a', 'b', 'c', 'd'];

  it('keeps a place that is not avoided', () => {
    expect(firstAllowed(list, 1, (x) => x === 'c')).toBe(1);
  });

  it('moves on past avoided places, wrapping at the end', () => {
    expect(firstAllowed(list, 2, (x) => x === 'c')).toBe(3);
    expect(firstAllowed(list, 3, (x) => x === 'd' || x === 'a')).toBe(1);
  });

  it('wraps a place past the end', () => {
    expect(firstAllowed(list, 5, NOTHING_AVOIDED)).toBe(1);
  });

  it('stays put if everything is avoided', () => {
    expect(firstAllowed(list, 2, () => true)).toBe(2);
    expect(firstAllowed(list, 6, () => true)).toBe(2);
  });

  it('gives the place back as it was for an empty list', () => {
    expect(firstAllowed([], 3, NOTHING_AVOIDED)).toBe(3);
  });
});
