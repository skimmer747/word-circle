/** Every Word Guess word has five letters. */
export const WORD_LENGTH = 5;
/** The board always shows six rows, like Wordle. */
export const VISIBLE_ROWS = 6;

/** Wordle's colors: right letter in the right spot, right letter in the wrong spot, not in the word. */
export type Mark = 'right' | 'present' | 'absent';
/** What a keyboard key shows: the best mark its letter has earned, or nothing yet. */
export type KeyState = Mark | 'unused';

/** One square of the row she's typing. Locked squares hold letters she already knows (carried down or hinted). */
export interface Square {
  letter: string;
  locked: boolean;
}

/**
 * A letter she found in the wrong spot and hasn't placed yet, with the squares it could still go in. Sure when it has
 * no square to spare: it must go in every one of them.
 */
export interface YellowLetter {
  letter: string;
  spots: number[];
  sure: boolean;
}

/** A yellow letter in a square's corner, or null for an empty corner. */
export type Corner = { letter: string; sure: boolean } | null;

export type EnterResult = 'incomplete' | 'notAWord' | 'guessed' | 'solved';

const RANK: Record<KeyState, number> = { unused: 0, absent: 1, present: 2, right: 3 };

/**
 * Wordle's colors for a guess: right spots first, then wrong spots, but only as many times as the answer has
 * that letter; extra copies are absent.
 */
export function markGuess(guess: string, answer: string): Mark[] {
  const marks: Mark[] = Array.from({ length: guess.length }, (): Mark => 'absent');
  const unmatched = new Map<string, number>();
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === answer[i]) marks[i] = 'right';
    else unmatched.set(answer[i], (unmatched.get(answer[i]) ?? 0) + 1);
  }
  for (let i = 0; i < guess.length; i++) {
    const left = unmatched.get(guess[i]) ?? 0;
    if (marks[i] === 'right' || left === 0) continue;
    marks[i] = 'present';
    unmatched.set(guess[i], left - 1);
  }
  return marks;
}

/** A square has four corners for yellow letters. */
const CORNERS = 4;

/**
 * The yellow letters in each square's corners (top left, top right, bottom left, bottom right). Each letter keeps one
 * corner across the row; with more than four letters, each square fills its corners in turn.
 */
export function yellowCorners(yellow: readonly YellowLetter[]): Corner[][] {
  return Array.from({ length: WORD_LENGTH }, (_, i) => {
    const corners: Corner[] = Array.from({ length: CORNERS }, () => null);
    const here = yellow.filter(({ spots }) => spots.includes(i));
    const corner = ({ letter, sure }: YellowLetter): Corner => ({ letter, sure });
    if (yellow.length <= CORNERS) {
      for (const item of here) corners[yellow.indexOf(item)] = corner(item);
    } else {
      here.slice(0, CORNERS).forEach((item, c) => (corners[c] = corner(item)));
    }
    return corners;
  });
}

/** The first checked guess the board shows: it shows the last five guesses and the row she's typing. */
export function firstVisibleGuess(guessCount: number): number {
  return Math.max(0, guessCount - (VISIBLE_ROWS - 1));
}

/** One word of Word Guess: her checked guesses, hinted squares and the row she's typing. No screen code. */
export class GuessGame {
  private readonly checked: string[];
  private hints: number[];
  private current: Square[];

  constructor(
    readonly answer: string,
    guesses: readonly string[],
    hinted: readonly number[],
    private readonly isAccepted: (word: string) => boolean,
  ) {
    this.checked = [...guesses];
    this.hints = [...new Set(hinted)].filter((i) => i >= 0 && i < WORD_LENGTH).sort((a, b) => a - b);
    this.current = this.freshRow();
  }

  get guesses(): readonly string[] {
    return this.checked;
  }

  get hinted(): readonly number[] {
    return this.hints;
  }

  get row(): readonly Square[] {
    return this.current;
  }

  /** She typed the winning word herself. */
  get solvedByGuess(): boolean {
    return this.checked.length > 0 && this.checked[this.checked.length - 1] === this.answer;
  }

  /** Solved by typing the word, or by knowing every letter. */
  get solved(): boolean {
    return this.solvedByGuess || this.known().length === WORD_LENGTH;
  }

  /** Nothing guessed, hinted or typed yet. */
  get untouched(): boolean {
    return this.checked.length === 0 && this.hints.length === 0 && this.current.every((square) => square.letter === '');
  }

  /** Squares whose letter she knows: right-spot letters from any guess, and hinted squares. */
  known(): number[] {
    const known = new Set(this.hints);
    for (const guess of this.checked) {
      for (let i = 0; i < WORD_LENGTH; i++) if (guess[i] === this.answer[i]) known.add(i);
    }
    return [...known].sort((a, b) => a - b);
  }

  marks(guess: string): Mark[] {
    return markGuess(guess, this.answer);
  }

  /** The best each letter has earned (right over present over absent). Hinted letters count as right. */
  keyStates(): Map<string, KeyState> {
    const states = new Map<string, KeyState>();
    const raise = (letter: string, state: KeyState) => {
      if (RANK[state] > RANK[states.get(letter) ?? 'unused']) states.set(letter, state);
    };
    for (const guess of this.checked) markGuess(guess, this.answer).forEach((mark, i) => raise(guess[i], mark));
    for (const i of this.hints) raise(this.answer[i], 'right');
    return states;
  }

  /**
   * Letters she found in the wrong spot and hasn't placed yet, in the order she found them, each with the squares
   * it could still go in: not a square she knows, not one where she already tried it, and not one a sure letter must
   * go in (which can make another letter sure).
   */
  yellowLetters(): YellowLetter[] {
    const known = new Set(this.known());
    const found: string[] = [];
    /** The fewest copies of each letter the answer has, from her best guess. */
    const copies = new Map<string, number>();
    const tried = new Map<string, Set<number>>();
    for (const guess of this.checked) {
      const inWord = new Map<string, number>();
      markGuess(guess, this.answer).forEach((mark, i) => {
        const letter = guess[i];
        if (mark === 'present' && !found.includes(letter)) found.push(letter);
        if (mark !== 'absent') inWord.set(letter, (inWord.get(letter) ?? 0) + 1);
        if (mark !== 'right') tried.set(letter, (tried.get(letter) ?? new Set()).add(i));
      });
      for (const [letter, count] of inWord) copies.set(letter, Math.max(copies.get(letter) ?? 0, count));
    }
    const placed = (letter: string) => [...known].filter((i) => this.answer[i] === letter).length;
    const yellow = found
      .map((letter) => ({ letter, needed: (copies.get(letter) ?? 0) - placed(letter) }))
      .filter(({ needed }) => needed > 0)
      .map(({ letter, needed }) => ({
        letter,
        needed,
        spots: Array.from({ length: WORD_LENGTH }, (_, i) => i).filter((i) => !known.has(i) && !tried.get(letter)?.has(i)),
      }));
    const isSure = ({ spots, needed }: { spots: number[]; needed: number }) => spots.length <= needed;
    for (let changed = true; changed; ) {
      changed = false;
      const taken = new Set(yellow.filter(isSure).flatMap(({ spots }) => spots));
      for (const item of yellow) {
        if (isSure(item)) continue;
        const spots = item.spots.filter((i) => !taken.has(i));
        // Never down to nothing: her guesses always leave each letter somewhere to go.
        if (spots.length === item.spots.length || spots.length === 0) continue;
        item.spots = spots;
        changed = true;
      }
    }
    return yellow.map((item) => ({ letter: item.letter, spots: item.spots, sure: isSure(item) }));
  }

  /** The square her next letter goes in, or -1 if the row is full. */
  nextSquare(): number {
    return this.current.findIndex((square) => !square.locked && square.letter === '');
  }

  /** Puts a letter in the next empty square. False if the row is full. */
  type(letter: string): boolean {
    const at = this.nextSquare();
    if (at < 0) return false;
    this.current = this.current.map((square, i) => (i === at ? { letter, locked: false } : square));
    return true;
  }

  /** Removes the last letter she typed; never a locked one. False if there was none. */
  back(): boolean {
    for (let i = WORD_LENGTH - 1; i >= 0; i--) {
      const square = this.current[i];
      if (square.locked || square.letter === '') continue;
      this.current = this.current.map((s, j) => (j === i ? { letter: '', locked: false } : s));
      return true;
    }
    return false;
  }

  /** Checks the row. An accepted word becomes a guess, and the next row starts with every known letter. */
  enter(): EnterResult {
    if (this.current.some((square) => square.letter === '')) return 'incomplete';
    const word = this.current.map((square) => square.letter).join('');
    if (word !== this.answer && !this.isAccepted(word)) return 'notAWord';
    this.checked.push(word);
    this.current = this.freshRow();
    return word === this.answer ? 'solved' : 'guessed';
  }

  /**
   * Puts the right letter in the highlighted square, or, when the row is full, in the leftmost square she doesn't
   * know yet. Null if she knows every letter.
   */
  hint(): { position: number; solved: boolean } | null {
    const known = new Set(this.known());
    let position = this.nextSquare();
    for (let i = 0; i < WORD_LENGTH && position < 0; i++) if (!known.has(i)) position = i;
    if (position < 0) return null;
    this.hints = [...this.hints, position].sort((a, b) => a - b);
    this.current = this.current.map((square, i) => (i === position ? { letter: this.answer[i], locked: true } : square));
    return { position, solved: this.known().length === WORD_LENGTH };
  }

  private freshRow(): Square[] {
    const known = new Set(this.known());
    return Array.from({ length: WORD_LENGTH }, (_, i) =>
      known.has(i) ? { letter: this.answer[i], locked: true } : { letter: '', locked: false },
    );
  }
}
