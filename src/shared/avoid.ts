/** Says whether a word is one she should never see. */
export type AvoidCheck = (word: string) => boolean;

export const NOTHING_AVOIDED: AvoidCheck = () => false;

/** The words in a caregiver's "Words to avoid" box: letters only, lowercase, each once, in the order typed. */
export function parseAvoidWords(text: string): string[] {
  const words = text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((word) => word.length > 0);
  return [...new Set(words)];
}

export function avoidChecker(words: readonly string[]): AvoidCheck {
  if (words.length === 0) return NOTHING_AVOIDED;
  const avoided = new Set(words);
  return (word) => avoided.has(word.toLowerCase());
}

/**
 * The first place from `index` on (wrapping at the end) whose item isn't avoided, so saved places never shift.
 * `index` itself if every item is avoided: better an avoided word than a broken game.
 */
export function firstAllowed<T>(list: readonly T[], index: number, avoided: (item: T) => boolean): number {
  const count = list.length;
  for (let step = 0; step < count; step++) {
    const i = (index + step) % count;
    if (!avoided(list[i])) return i;
  }
  return count === 0 ? index : index % count;
}
