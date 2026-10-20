import type { GridWords } from './types';

/** Tells whether a run spells a real word. */
export function wordChecker(words: GridWords): (word: string) => boolean {
  const set = new Set(words.words);
  return (word) => set.has(word);
}
