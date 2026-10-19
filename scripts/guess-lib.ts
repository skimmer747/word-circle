import type { GuessWords } from '../src/guess/words';
import { shuffle } from '../src/shared/random';

const FIVE = /^[a-z]{5}$/;

export interface GuessSources {
  /** Plain answer words, mapped to the SCOWL size they first appear at. */
  answers: ReadonlyMap<string, number>;
  /** Every word that counts as a real word. */
  accepted: ReadonlySet<string>;
  blocklist: ReadonlySet<string>;
  random: () => number;
}

/** Answers in play order (most common SCOWL size first, each size shuffled) and every accepted guess, sorted. */
export function buildGuessWords({ answers, accepted, blocklist, random }: GuessSources): GuessWords {
  const bySize = new Map<number, string[]>();
  for (const [word, size] of answers) {
    if (!FIVE.test(word) || blocklist.has(word)) continue;
    const group = bySize.get(size) ?? [];
    group.push(word);
    bySize.set(size, group);
  }
  const sizes = [...bySize.keys()].sort((a, b) => a - b);
  const answerList = sizes.flatMap((size) => shuffle(bySize.get(size)!.sort(), random));
  const acceptedSet = new Set(answerList);
  for (const word of accepted) if (FIVE.test(word) && !blocklist.has(word)) acceptedSet.add(word);
  return { answers: answerList, accepted: [...acceptedSet].sort() };
}

/** Everything wrong with the answers; empty when they're fine. */
export function validateGuessWords(words: GuessWords, blocklist: ReadonlySet<string>, inflected: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  const accepted = new Set(words.accepted);
  const seen = new Set<string>();
  for (const word of words.answers) {
    const say = (problem: string) => problems.push(`Word Guess: "${word}" ${problem}`);
    if (seen.has(word)) say('is in the answers twice');
    seen.add(word);
    if (blocklist.has(word)) say('is on the never-use list');
    if (!FIVE.test(word)) say('is not five letters a–z');
    if (!accepted.has(word)) say('is not an accepted guess');
    if (inflected.has(word)) say('is a plural or other ending');
  }
  return problems;
}
