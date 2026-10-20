import { describe, expect, it } from 'vitest';
import { buildGridWordLists, PatternIndex, TWO_LETTER_ANSWERS } from '../scripts/grid-lib';

describe('the Word Grid word lists', () => {
  const lists = buildGridWordLists({
    common: ['cat', 'dog', 'gun', 'damn'],
    all: ['cat', 'dog', 'gun', 'damn', 'zax'],
    neverUse: new Set(['damn']),
    skip: new Set(['gun']),
  });

  it('counts every real word, plus the two-letter words, but never a never-use word', () => {
    expect(lists.words).toEqual(expect.arrayContaining(['cat', 'dog', 'gun', 'zax', 'am', 'we', 'ad', 'ye']));
    expect(lists.words).not.toContain('damn');
    expect(lists.words).toEqual([...lists.words].sort());
  });

  it('makes answers from common words and everyday two-letter words, never touchy or never-use words', () => {
    expect(lists.answers).toEqual([...TWO_LETTER_ANSWERS, 'cat', 'dog'].sort());
  });
});

describe('the pattern index', () => {
  const index = new PatternIndex(['cat', 'cot', 'at']);

  it('knows whether a partly filled run can still become a word', () => {
    expect(index.has('cat')).toBe(true);
    expect(index.has('c.t')).toBe(true);
    expect(index.has('...')).toBe(true);
    expect(index.has('.a.')).toBe(true);
    expect(index.has('cab')).toBe(false);
    expect(index.has('d..')).toBe(false);
    expect(index.has('..')).toBe(true);
    expect(index.has('....')).toBe(false);
  });
});
