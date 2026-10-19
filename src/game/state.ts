import type { Puzzle } from './types';

export const MIN_WORD_LENGTH = 3;

export type WordResultKind = 'answer' | 'alreadyFound' | 'bonus' | 'notAWord' | 'tooShort';

export interface WordResult {
  kind: WordResultKind;
  word: string;
}

export interface HintResult {
  word: string;
  index: number;
  completedWord: boolean;
}

export class Game {
  private readonly found = new Set<string>();
  private readonly revealed = new Map<string, Set<number>>();

  constructor(
    readonly puzzle: Puzzle,
    found: readonly string[] = [],
    revealed: Record<string, number[]> = {},
  ) {
    for (const word of found) {
      if (puzzle.words.includes(word)) this.found.add(word);
    }
    for (const [word, indices] of Object.entries(revealed)) {
      if (!puzzle.words.includes(word)) continue;
      const valid = indices.filter((i) => Number.isInteger(i) && i >= 0 && i < word.length);
      if (valid.length > 0) this.revealed.set(word, new Set(valid));
    }
  }

  tryWord(input: string): WordResult {
    const word = input.toLowerCase();
    if (word.length < MIN_WORD_LENGTH) return { kind: 'tooShort', word };
    if (this.puzzle.words.includes(word)) {
      if (this.found.has(word)) return { kind: 'alreadyFound', word };
      this.found.add(word);
      return { kind: 'answer', word };
    }
    if (this.puzzle.bonus.includes(word)) return { kind: 'bonus', word };
    return { kind: 'notAWord', word };
  }

  /** Reveals the leftmost hidden letter of the shortest unfound word. */
  hint(): HintResult | null {
    const remaining = this.puzzle.words.filter((w) => !this.found.has(w));
    if (remaining.length === 0) return null;
    const shortest = Math.min(...remaining.map((w) => w.length));
    const word = remaining.find((w) => w.length === shortest)!;
    const shown = this.revealed.get(word) ?? new Set<number>();
    let index = 0;
    while (shown.has(index)) index++;
    shown.add(index);
    this.revealed.set(word, shown);
    const completedWord = shown.size === word.length;
    if (completedWord) this.found.add(word);
    return { word, index, completedWord };
  }

  isFound(word: string): boolean {
    return this.found.has(word);
  }

  revealedIndices(word: string): number[] {
    return [...(this.revealed.get(word) ?? [])].sort((a, b) => a - b);
  }

  isComplete(): boolean {
    return this.puzzle.words.every((w) => this.found.has(w));
  }

  foundWords(): string[] {
    return this.puzzle.words.filter((w) => this.found.has(w));
  }

  revealedRecord(): Record<string, number[]> {
    const record: Record<string, number[]> = {};
    for (const word of this.revealed.keys()) record[word] = this.revealedIndices(word);
    return record;
  }
}
