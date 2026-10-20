import type { GridPuzzle } from './types';

/** A puzzle, read. Squares are numbered row by row across the whole box: row × size + column. */
export interface GridShape {
  size: number;
  /** True for each square that holds a letter. */
  open: boolean[];
  /** The open squares, in reading order. */
  squares: number[];
  /** Every run of two or more open squares in a line: across (top to bottom), then down (left to right). */
  runs: number[][];
  /** Each square's section (an index into `sections`), or -1 for a blocked square. */
  sectionOf: number[];
  /** Each section's squares, in reading order. */
  sections: number[][];
  /** Each section's letters, in alphabetical order. */
  letters: string[][];
  /** The answer letter in each square ('' for a blocked square). */
  answer: string[];
}

/** Runs of two or more open squares: across first (row by row), then down (column by column). */
export function findRuns(open: readonly boolean[], size: number): number[][] {
  const runs: number[][] = [];
  const scan = (squareAt: (line: number, i: number) => number) => {
    for (let line = 0; line < size; line++) {
      let run: number[] = [];
      for (let i = 0; i <= size; i++) {
        const square = i < size ? squareAt(line, i) : -1;
        if (square >= 0 && open[square]) {
          run.push(square);
        } else {
          if (run.length >= 2) runs.push(run);
          run = [];
        }
      }
    }
  };
  scan((row, col) => row * size + col);
  scan((col, row) => row * size + col);
  return runs;
}

export function readPuzzle(puzzle: GridPuzzle): GridShape {
  const { size, cells } = puzzle;
  const open = [...cells].map((ch) => ch !== '.');
  const sectionOf = [...puzzle.sections].map((code) => (code === '.' ? -1 : code.charCodeAt(0) - 97));
  const sections: number[][] = Array.from({ length: Math.max(-1, ...sectionOf) + 1 }, () => []);
  sectionOf.forEach((section, square) => {
    if (section >= 0) sections[section].push(square);
  });
  return {
    size,
    open,
    squares: open.flatMap((isOpen, square) => (isOpen ? [square] : [])),
    runs: findRuns(open, size),
    sectionOf,
    sections,
    letters: sections.map((squares) => squares.map((square) => cells[square]).sort()),
    answer: [...cells].map((ch) => (ch === '.' ? '' : ch)),
  };
}

/** Every word across and down in the puzzle's answer. */
export function answerWords(puzzle: GridPuzzle): string[] {
  const open = [...puzzle.cells].map((ch) => ch !== '.');
  return findRuns(open, puzzle.size).map((run) => run.map((square) => puzzle.cells[square]).join(''));
}
