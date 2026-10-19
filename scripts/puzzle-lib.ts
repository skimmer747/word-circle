import type { Puzzle } from '../src/circle/types';
import { shuffle } from '../src/shared/random';

export const MIN_LENGTH = 3;
export const MAX_LENGTH = 6;

/** How a level's puzzles are shaped: circle size and how many words go in the slots. */
export interface PuzzleShape {
  letterCount: number;
  minWords: number;
  maxWords: number;
}

export type LetterCounts = Map<string, number>;

export function letterCounts(word: string): LetterCounts {
  const counts: LetterCounts = new Map();
  for (const ch of word) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  return counts;
}

export function canForm(word: string, available: LetterCounts): boolean {
  const used: LetterCounts = new Map();
  for (const ch of word) {
    const count = (used.get(ch) ?? 0) + 1;
    if (count > (available.get(ch) ?? 0)) return false;
    used.set(ch, count);
  }
  return true;
}

export function sortedLetters(word: string): string {
  return [...word].sort().join('');
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Slot order: shortest first, then alphabetical. */
export function sortForSlots(words: readonly string[]): string[] {
  return [...words].sort((a, b) => a.length - b.length || compare(a, b));
}

/** True if reading the circle clockwise from some letter spells the word. */
export function spellsClockwise(letters: readonly string[], word: string): boolean {
  for (let start = 0; start < letters.length; start++) {
    if ([...letters.slice(start), ...letters.slice(0, start)].join('') === word) return true;
  }
  return false;
}

/** A circle order that spells none of `avoid` clockwise, or null if there isn't one (e.g. LOOP/POOL/POLO). */
export function scrambleLetters(base: string, avoid: readonly string[], random: () => number): string[] | null {
  for (let attempt = 0; attempt < 100; attempt++) {
    const letters = shuffle([...base], random);
    if (!avoid.some((word) => spellsClockwise(letters, word))) return letters;
  }
  return null;
}

/** Base word plus others up to maxWords: one of each length first, then the most common. */
export function pickWords(base: string, formable: ReadonlyArray<readonly [string, number]>, maxWords: number): string[] {
  const others = formable
    .filter(([word]) => word !== base)
    .sort((a, b) => a[1] - b[1] || compare(a[0], b[0]))
    .map(([word]) => word);
  const chosen: string[] = [];
  const lengths = new Set<number>();
  for (const word of others) {
    if (chosen.length === maxWords - 1) break;
    if (!lengths.has(word.length)) {
      chosen.push(word);
      lengths.add(word.length);
    }
  }
  for (const word of others) {
    if (chosen.length === maxWords - 1) break;
    if (!chosen.includes(word)) chosen.push(word);
  }
  return sortForSlots([base, ...chosen]);
}

export interface BuildSources {
  /** Common words (3–6 letters) mapped to their SCOWL size. */
  answers: ReadonlyMap<string, number>;
  /** Every word that earns credit (includes the answers). */
  accepted: ReadonlySet<string>;
  blocklist: ReadonlySet<string>;
  random: () => number;
  /** How many puzzles to make. */
  target: number;
}

export interface BuildOptions extends PuzzleShape, BuildSources {}

/** Builds one level's puzzles: one per letter set of `letterCount` letters, most common base words first. */
export function buildPuzzles(options: BuildOptions): Puzzle[] {
  const { blocklist, random, letterCount, minWords, maxWords, target } = options;
  const answers = [...options.answers].filter(([word]) => !blocklist.has(word));
  const accepted = [...options.accepted].filter((word) => !blocklist.has(word));
  const bases = answers
    .filter(([word]) => word.length === letterCount)
    .map(([word, size]) => ({ word, size, tiebreak: random() }))
    .sort((a, b) => a.size - b.size || a.tiebreak - b.tiebreak);

  const seen = new Set<string>();
  const puzzles: Puzzle[] = [];
  for (const { word: base } of bases) {
    if (puzzles.length >= target) break;
    const id = sortedLetters(base);
    if (seen.has(id)) continue;
    seen.add(id);
    const counts = letterCounts(base);
    const formable = answers.filter(([word]) => canForm(word, counts));
    if (formable.length < minWords) continue;
    const words = pickWords(base, formable, maxWords);
    const chosen = new Set(words);
    const bonus = accepted.filter((word) => !chosen.has(word) && canForm(word, counts)).sort();
    const fullLength = words.filter((word) => word.length === base.length);
    const letters = scrambleLetters(base, fullLength, random);
    if (!letters) continue;
    puzzles.push({ id, letters, words, bonus });
  }
  return shuffle(puzzles, random);
}

export function validatePuzzle(puzzle: Puzzle, blocklist: ReadonlySet<string>, shape: PuzzleShape): string[] {
  const problems: string[] = [];
  const letters = puzzle.letters.join('');
  const label = letters.toUpperCase();
  const counts = letterCounts(letters);
  const report = (message: string) => problems.push(`${label}: ${message}`);

  if (puzzle.letters.length !== shape.letterCount) {
    report(`has ${puzzle.letters.length} letters (needs ${shape.letterCount})`);
  }
  if (puzzle.words.length < shape.minWords || puzzle.words.length > shape.maxWords) {
    report(`has ${puzzle.words.length} words (needs ${shape.minWords}–${shape.maxWords})`);
  }
  if (puzzle.id !== sortedLetters(letters)) report(`id "${puzzle.id}" does not match its letters`);
  if (!puzzle.words.some((word) => word.length === puzzle.letters.length)) report('no word uses every letter');
  if (puzzle.words.join(',') !== sortForSlots(puzzle.words).join(',')) report('words are not in slot order');
  for (const word of [...puzzle.words, ...puzzle.bonus]) {
    if (!canForm(word, counts)) report(`"${word}" cannot be made from the letters`);
    if (word.length < MIN_LENGTH || word.length > MAX_LENGTH) report(`"${word}" is not 3–6 letters`);
    if (blocklist.has(word)) report(`"${word}" is on the never-use list`);
  }
  for (const word of puzzle.words) {
    if (word.length === puzzle.letters.length && spellsClockwise(puzzle.letters, word)) {
      report(`circle spells "${word}"`);
    }
  }
  return problems;
}
