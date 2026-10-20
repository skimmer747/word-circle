export const GRID_LEVELS = ['easy', 'medium', 'hard'] as const;
export type GridLevel = (typeof GRID_LEVELS)[number];

/** One Word Grid puzzle, as stored in src/data/grid-puzzles.json. */
export interface GridPuzzle {
  /** Squares across (and down) in its box: 4, 5 or 6. */
  size: number;
  /** The answer row by row, lowercase, with "." for a blocked square. Also the puzzle's id. */
  cells: string;
  /** Each square's section, lettered "a", "b", … in order of first appearance, with "." for a blocked square. */
  sections: string;
}

/** Each level's puzzles, in play order. */
export type GridPuzzleSet = Record<GridLevel, GridPuzzle[]>;

/** Every real word (what a run across or down must spell), from src/data/grid-words.json. */
export interface GridWords {
  words: string[];
}
