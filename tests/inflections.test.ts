import { describe, expect, it } from 'vitest';
import { parseInflectedForms } from '../scripts/inflections';

const SAMPLE = [
  'make V: made | making | makes',
  'making N: makings',
  'king N: kings',
  'car N: cars',
  'cars N?: carses',
  'fine N: fines',
  'fines V?: finessed | finessing | finesses',
  'news V?: newsed | newsing | newses',
  'lax A: laxer | laxest',
  'lax N?: laxes, laces< 1',
  'news N: newses',
  'note N: notes',
  'note V: noted | noting | notes',
  'run V: ran | run | running | runs',
  'speak V: spoke, spake 2 | spoken, spoke 2 | speaking | speaks',
  'spoke N: spokes',
  'stone N: stones {rock}, stone {weight}',
  'stone V: stoned | stoning | stones',
  '',
].join('\n');

describe('parseInflectedForms', () => {
  const inflected = parseInflectedForms(SAMPLE);

  it('lists plurals and other endings', () => {
    for (const word of ['notes', 'noted', 'noting', 'laxer', 'laxest', 'stones', 'stoned', 'ran', 'running', 'spoken', 'speaks', 'laces']) {
      expect(inflected.has(word), word).toBe(true);
    }
  });

  it('leaves out words that are dictionary words in their own right', () => {
    for (const word of ['note', 'lax', 'news', 'run', 'speak', 'spoke', 'stone']) {
      expect(inflected.has(word), word).toBe(false);
    }
  });

  it('does not trust uncertain entries (marked "?") as dictionary words', () => {
    expect(inflected.has('cars')).toBe(true);
    expect(inflected.has('fines')).toBe(true);
    expect(inflected.has('news')).toBe(false);
  });

  it('treats -ing forms of verbs as endings even when also listed as nouns', () => {
    expect(inflected.has('making')).toBe(true);
    expect(inflected.has('running')).toBe(true);
    expect(inflected.has('king')).toBe(false);
  });

  it('ignores variant numbers, notes and markers', () => {
    expect(inflected.has('spake')).toBe(true);
    expect(inflected.has('2')).toBe(false);
    expect(inflected.has('{rock}')).toBe(false);
    expect(inflected.has('laces<')).toBe(false);
  });
});
