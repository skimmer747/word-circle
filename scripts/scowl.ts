import fs from 'node:fs';
import path from 'node:path';

export const SCOWL_LEVELS = [10, 20, 35, 40, 50, 55, 60] as const;
const CATEGORIES = ['english-words', 'american-words'];
const WORD_PATTERN = /^[a-z]{3,6}$/;

/** Words of 3–6 lowercase letters up to the given SCOWL size, mapped to the size they first appear at. */
export function readScowl(dir: string, maxSize: number): Map<string, number> {
  const words = new Map<string, number>();
  for (const level of SCOWL_LEVELS) {
    if (level > maxSize) break;
    for (const category of CATEGORIES) {
      const text = fs.readFileSync(path.join(dir, `${category}.${level}`), 'latin1');
      for (const line of text.split(/\r?\n/)) {
        const word = line.trim();
        if (WORD_PATTERN.test(word) && !words.has(word)) words.set(word, level);
      }
    }
  }
  return words;
}

export function readBlocklist(file: string): Set<string> {
  const words = new Set<string>();
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const word = line.trim().toLowerCase();
    if (word && !word.startsWith('#')) words.add(word);
  }
  return words;
}

/** SCOWL's offensive and profane lists, which are never used. */
const TABOO_LISTS = ['offensive.1', 'offensive.2', 'profane.1', 'profane.3'];

/** Every word that must never appear: the owner's words/blocklist.txt plus SCOWL's offensive and profane lists. */
export function readNeverUse(root: string): Set<string> {
  const files = [path.join(root, 'words/blocklist.txt'), ...TABOO_LISTS.map((name) => path.join(root, 'words/scowl/misc', name))];
  return new Set(files.flatMap((file) => [...readBlocklist(file)]));
}
