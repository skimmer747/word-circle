import { describe, expect, it } from 'vitest';
import { parseInflectedForms } from '../scripts/inflections';

const SAMPLE = [
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

  it('ignores variant numbers, notes and markers', () => {
    expect(inflected.has('spake')).toBe(true);
    expect(inflected.has('2')).toBe(false);
    expect(inflected.has('{rock}')).toBe(false);
    expect(inflected.has('laces<')).toBe(false);
  });
});
