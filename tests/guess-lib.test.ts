import { describe, expect, it } from 'vitest';
import { buildGuessWords, validateGuessWords } from '../scripts/guess-lib';
import { seededRandom } from '../src/shared/random';

const ANSWERS = new Map([
  ['house', 10],
  ['plant', 10],
  ['crane', 20],
  ['slate', 20],
  ['abbey', 35],
  ['zebra', 35],
  ['nasty', 35],
  ['cat', 10],
]);
const ACCEPTED = new Set([...ANSWERS.keys(), 'cares', 'slats', 'tones', 'things']);
const BLOCKLIST = new Set(['nasty', 'tones']);
const build = (skip = new Set<string>()) =>
  buildGuessWords({ answers: ANSWERS, accepted: ACCEPTED, blocklist: BLOCKLIST, skip, random: seededRandom(1) });

describe('building the Word Guess lists', () => {
  it('uses only five-letter answers that are not blocked', () => {
    expect([...build().answers].sort()).toEqual(['abbey', 'crane', 'house', 'plant', 'slate', 'zebra']);
  });

  it('plays the most common words first', () => {
    const { answers } = build();
    expect(answers.slice(0, 2).sort()).toEqual(['house', 'plant']);
    expect(answers.slice(2, 4).sort()).toEqual(['crane', 'slate']);
    expect(answers.slice(4).sort()).toEqual(['abbey', 'zebra']);
  });

  it('comes out the same every build', () => {
    expect(build()).toEqual(build());
  });

  it('accepts every answer and every other unblocked five-letter word, in order', () => {
    expect(build().accepted).toEqual(['abbey', 'cares', 'crane', 'house', 'plant', 'slate', 'slats', 'zebra']);
  });

  it('never makes a skipped word the answer, but still accepts it as a guess', () => {
    const words = build(new Set(['crane', 'zebra']));
    expect([...words.answers].sort()).toEqual(['abbey', 'house', 'plant', 'slate']);
    expect(words.accepted).toContain('crane');
    expect(words.accepted).toContain('zebra');
  });
});

describe('checking the Word Guess lists', () => {
  it('passes good lists', () => {
    expect(validateGuessWords({ answers: ['crane'], accepted: ['crane'] }, new Set(), new Set(), new Set())).toEqual([]);
  });

  it('reports every kind of bad answer', () => {
    const problems = validateGuessWords(
      { answers: ['crane', 'crane', 'nasty', 'cats', 'cares', 'fever'], accepted: ['cares', 'crane', 'fever', 'nasty'] },
      new Set(['nasty']),
      new Set(['cares']),
      new Set(['fever']),
    );
    expect(problems).toEqual([
      'Word Guess: "crane" is in the answers twice',
      'Word Guess: "nasty" is on the never-use list',
      'Word Guess: "cats" is not five letters a–z',
      'Word Guess: "cats" is not an accepted guess',
      'Word Guess: "cares" is a plural or other ending',
      'Word Guess: "fever" is on the Word Guess skip list',
    ]);
  });
});
