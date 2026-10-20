/** Everyday two-letter words that can be in an answer. */
export const TWO_LETTER_ANSWERS = [
  'am', 'an', 'as', 'at', 'be', 'by', 'do', 'go', 'he', 'hi', 'if', 'in', 'is', 'it',
  'me', 'my', 'no', 'of', 'oh', 'on', 'or', 'ox', 'so', 'to', 'up', 'us', 'we',
];
/** Two-letter words that count as real words but are never in an answer. */
export const TWO_LETTER_EXTRAS = ['ad', 'ah', 'ax', 'eh', 'ha', 'ho', 'id', 'la', 'lo', 'ma', 'pa', 'ye'];

export interface GridWordSources {
  /** Common words (SCOWL size ≤ 20, 3–6 letters). */
  common: Iterable<string>;
  /** Every real word (SCOWL size ≤ 60, 3–6 letters). */
  all: Iterable<string>;
  neverUse: ReadonlySet<string>;
  /** Touchy words: never in an answer, but still real words (words/guess-skip.txt). */
  skip: ReadonlySet<string>;
}

export interface GridWordLists {
  /** What the generator fills grids with, sorted. */
  answers: string[];
  /** Every real word, sorted: what the squiggle and the one-answer checks use. */
  words: string[];
}

export function buildGridWordLists({ common, all, neverUse, skip }: GridWordSources): GridWordLists {
  const words = new Set([...all, ...TWO_LETTER_ANSWERS, ...TWO_LETTER_EXTRAS].filter((word) => !neverUse.has(word)));
  const answers = new Set([...common, ...TWO_LETTER_ANSWERS].filter((word) => words.has(word) && !skip.has(word)));
  return { answers: [...answers].sort(), words: [...words].sort() };
}

/** Answers "can this partly filled run still become a word?" for any mix of letters and "." */
export class PatternIndex {
  private readonly patterns = new Set<string>();

  constructor(words: Iterable<string>) {
    for (const word of words) {
      const n = word.length;
      for (let mask = 0; mask < 1 << n; mask++) {
        let pattern = '';
        for (let i = 0; i < n; i++) pattern += mask & (1 << i) ? '.' : word[i];
        this.patterns.add(pattern);
      }
    }
  }

  has(pattern: string): boolean {
    return this.patterns.has(pattern);
  }
}
