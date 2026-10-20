import { readPuzzle, type GridShape } from './puzzle';
import type { GridPuzzle } from './types';

/** One of a section's letters, and whether it's already on the grid. */
export interface TrayLetter {
  letter: string;
  used: boolean;
}

const LETTER = /^[a-z]$/;

/** One Word Grid puzzle in play: the letters she has placed and the squares Hint has filled. No screen code. */
export class GridGame {
  readonly shape: GridShape;
  private readonly cells: string[];
  private readonly locked: Set<number>;

  /** `placed` and `hinted` come from her save; anything that doesn't fit the puzzle is dropped. */
  constructor(
    puzzle: GridPuzzle,
    placed: readonly string[],
    hinted: readonly number[],
    private readonly isWord: (word: string) => boolean,
  ) {
    this.shape = readPuzzle(puzzle);
    const { open, answer, squares } = this.shape;
    this.cells = open.map(() => '');
    this.locked = new Set(hinted.filter((square) => open[square] === true));
    for (const square of this.locked) this.cells[square] = answer[square];
    for (const square of squares) {
      const letter = placed[square];
      if (!this.locked.has(square) && typeof letter === 'string' && LETTER.test(letter) && this.room(square, letter)) {
        this.cells[square] = letter;
      }
    }
  }

  /** The letter in each square of the box ('' for none), row by row. */
  get placed(): string[] {
    return [...this.cells];
  }

  /** Squares filled by Hint, in order. */
  get hinted(): number[] {
    return [...this.locked].sort((a, b) => a - b);
  }

  /** Every square filled and every run a real word. Each puzzle has one answer, so this is it. */
  get solved(): boolean {
    return this.shape.squares.every((square) => this.cells[square]) && this.badRuns().length === 0;
  }

  letterAt(square: number): string {
    return this.cells[square] ?? '';
  }

  isOpen(square: number): boolean {
    return this.shape.open[square] === true;
  }

  isHinted(square: number): boolean {
    return this.locked.has(square);
  }

  sectionOf(square: number): number {
    return this.shape.sectionOf[square] ?? -1;
  }

  /** A section's letters in alphabetical order, the ones on the grid marked used (repeated letters counted). */
  tray(section: number): TrayLetter[] {
    const onGrid = new Map<string, number>();
    for (const square of this.shape.sections[section] ?? []) {
      const letter = this.cells[square];
      if (letter) onGrid.set(letter, (onGrid.get(letter) ?? 0) + 1);
    }
    return (this.shape.letters[section] ?? []).map((letter) => {
      const left = onGrid.get(letter) ?? 0;
      if (left > 0) onGrid.set(letter, left - 1);
      return { letter, used: left > 0 };
    });
  }

  /** Puts one of the section's free letters in `square`; whatever was there goes back to the tray. */
  place(square: number, letter: string): boolean {
    if (!this.isOpen(square) || this.locked.has(square) || !this.room(square, letter)) return false;
    this.cells[square] = letter;
    return true;
  }

  /** Moves the letter in `from` to `to` in the same section, swapping with whatever is there. */
  move(from: number, to: number): boolean {
    if (from === to || !this.isOpen(from) || !this.isOpen(to) || !this.cells[from]) return false;
    if (this.locked.has(from) || this.locked.has(to) || this.sectionOf(from) !== this.sectionOf(to)) return false;
    [this.cells[from], this.cells[to]] = [this.cells[to], this.cells[from]];
    return true;
  }

  /** Takes a letter off the grid, back to the tray. */
  remove(square: number): boolean {
    if (!this.isOpen(square) || this.locked.has(square) || !this.cells[square]) return false;
    this.cells[square] = '';
    return true;
  }

  /** The runs (indexes into shape.runs) that are full but aren't real words. */
  badRuns(): number[] {
    return this.shape.runs.flatMap((run, i) => {
      const word = run.map((square) => this.cells[square]).join('');
      return word.length === run.length && !this.isWord(word) ? [i] : [];
    });
  }

  /**
   * Puts the right letter in `selected`, or, if that's already right, in the first square that's empty or wrong,
   * and locks it. Returns that square, or null when everything is right.
   */
  hint(selected: number): number | null {
    const { answer, squares } = this.shape;
    const wrong = (square: number) => this.cells[square] !== answer[square];
    const target = this.isOpen(selected) && wrong(selected) ? selected : squares.find(wrong) ?? null;
    if (target === null) return null;
    const letter = answer[target];
    this.cells[target] = '';
    if (!this.room(target, letter)) {
      // Every copy is on the grid, so one of them is in a square where it's wrong: take it from there.
      const from = this.shape.sections[this.sectionOf(target)].find((s) => this.cells[s] === letter && answer[s] !== letter);
      if (from !== undefined) this.cells[from] = '';
    }
    this.cells[target] = letter;
    this.locked.add(target);
    return target;
  }

  /** The first empty square in reading order, or the first square when the grid is full. */
  firstEmpty(): number {
    return this.shape.squares.find((square) => !this.cells[square]) ?? this.shape.squares[0];
  }

  /** The next empty square of `square`'s section in reading order (wrapping), or null when it's full. */
  nextEmptyInSection(square: number): number | null {
    const squares = this.shape.sections[this.sectionOf(square)] ?? [];
    const at = squares.indexOf(square);
    for (let k = 1; k < squares.length; k++) {
      const next = squares[(at + k) % squares.length];
      if (!this.cells[next]) return next;
    }
    return null;
  }

  /** True if the section has a copy of `letter` that isn't already in one of its other squares. */
  private room(square: number, letter: string): boolean {
    const section = this.sectionOf(square);
    if (section < 0) return false;
    const have = this.shape.letters[section].filter((l) => l === letter).length;
    const used = this.shape.sections[section].filter((s) => s !== square && this.cells[s] === letter).length;
    return used < have;
  }
}
