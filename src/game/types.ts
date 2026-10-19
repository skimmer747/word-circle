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
}
