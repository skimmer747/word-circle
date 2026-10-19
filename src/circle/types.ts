export const LEVELS = ['easy', 'medium', 'hard'] as const;
export type Level = (typeof LEVELS)[number];

/** Each level's puzzles, in play order. */
export type PuzzleSet = Record<Level, Puzzle[]>;

export interface Puzzle {
  /** Sorted letters, e.g. "enost". Unique per puzzle. */
  id: string;
  /** Letters in their starting circle order, lowercase. */
  letters: string[];
  /** Answer words in slot order (length, then alphabetical). */
  words: string[];
  /** Other real words that earn "Good word!". */
  bonus: string[];
}

export interface Progress {
  puzzleIndex: number;
  puzzleId: string;
  found: string[];
  revealed: Record<string, number[]>;
  /** Extra (bonus) words found, in the order she found them. */
  bonusFound: string[];
  /** Active play time on this puzzle so far. */
  elapsedMs: number;
}
