import { findRuns, readPuzzle } from '../src/grid/puzzle';
import type { GridPuzzle } from '../src/grid/types';
import { shuffle } from '../src/shared/random';

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

/** About 70% of a box's squares are open... */
const OPEN_SHARE = 0.7;
/** ...and never fewer than 60% or more than 90% (so there are always blocked squares, as in a crossword). */
const OPEN_MIN = 0.6;
const OPEN_MAX = 0.9;
/** Filling gives up on a shape after this many steps, and a new shape is tried. */
const FILL_BUDGET = 20_000;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

function openSquares(open: readonly boolean[]): number[] {
  return open.flatMap((isOpen, square) => (isOpen ? [square] : []));
}

function neighbours(square: number, size: number): number[] {
  const row = Math.floor(square / size);
  const col = square % size;
  const result: number[] = [];
  if (row > 0) result.push(square - size);
  if (row < size - 1) result.push(square + size);
  if (col > 0) result.push(square - 1);
  if (col < size - 1) result.push(square + 1);
  return result;
}

/** The squares of `within` that can be reached from `start` side to side. */
function connected(start: number, within: ReadonlySet<number>, size: number): Set<number> {
  const seen = new Set([start]);
  const todo = [start];
  while (todo.length > 0) {
    for (const next of neighbours(todo.pop()!, size)) {
      if (within.has(next) && !seen.has(next)) {
        seen.add(next);
        todo.push(next);
      }
    }
  }
  return seen;
}

/** What's wrong with a crossword shape; empty when it's fine. */
export function shapeProblems(open: readonly boolean[], size: number): string[] {
  const problems: string[] = [];
  const squares = openSquares(open);
  const share = squares.length / (size * size);
  if (share < OPEN_MIN || share > OPEN_MAX) problems.push(`${squares.length} open squares`);
  for (let line = 0; line < size; line++) {
    if (!squares.some((s) => Math.floor(s / size) === line)) problems.push(`row ${line + 1} is empty`);
    if (!squares.some((s) => s % size === line)) problems.push(`column ${line + 1} is empty`);
  }
  if (squares.length > 0 && connected(squares[0], new Set(squares), size).size !== squares.length) {
    problems.push('not all one piece');
  }
  const inWords = new Set(findRuns(open, size).flat());
  for (const square of squares) if (!inWords.has(square)) problems.push(`square ${square} is in no word`);
  return problems;
}

/** A random crossword shape that follows the rules. */
export function randomShape(size: number, random: () => number): boolean[] {
  for (;;) {
    const open = Array.from({ length: size * size }, () => random() < OPEN_SHARE);
    if (shapeProblems(open, size).length === 0) return open;
  }
}

/**
 * Fills a shape square by square with random letters, backing up whenever a run can no longer become an answer
 * word, so that every run is an answer word and no word appears twice. Null if it can't within `budget` steps.
 */
export function fillShape(
  open: readonly boolean[],
  size: number,
  answers: PatternIndex,
  random: () => number,
  budget = FILL_BUDGET,
): string[] | null {
  const runs = findRuns(open, size);
  const squares = openSquares(open);
  const runsThrough = new Map(squares.map((square) => [square, runs.filter((run) => run.includes(square))]));
  const letters = open.map(() => '');
  const pattern = (run: readonly number[]) => run.map((square) => letters[square] || '.').join('');
  let steps = 0;
  const fill = (i: number): boolean => {
    if (++steps > budget) return false;
    if (i === squares.length) return new Set(runs.map(pattern)).size === runs.length;
    const square = squares[i];
    for (const letter of shuffle([...ALPHABET], random)) {
      letters[square] = letter;
      if (runsThrough.get(square)!.every((run) => answers.has(pattern(run))) && fill(i + 1)) return true;
    }
    letters[square] = '';
    return false;
  };
  return fill(0) ? letters : null;
}
