import type { Rect } from '../frame/layout';
import { el, place, restartAnimation, wait } from '../ui/dom';
import { BACK_ICON, CHECK_ICON, ENTER_ICON, HINT_ICON, KEYBOARD_ICON, NEWS_ICON, SHARE_ICON } from '../ui/icons';
import { flyHintStar, landHintLetter } from '../ui/hint-star';
import type { GuessLayout } from './layout';
import type { KeyState, Mark } from './rules';

/** How one board square looks: empty, where her next letter goes (orange), typed but not checked, or checked. */
export type SquareLook = 'empty' | 'cursor' | 'typed' | Mark;

export interface SquareView {
  letter: string;
  look: SquareLook;
}

/** The left column's third button: nothing, the Today's Wordle label, or Share today's Wordle. */
export type DailyMode = 'none' | 'label' | 'share';

export interface GuessScreenState {
  /** The six board rows, top to bottom. */
  rows: SquareView[][];
  keys: ReadonlyMap<string, KeyState>;
  allLetters: boolean;
  daily: DailyMode;
}

/** Time for each square to color in when a guess is checked. */
const REVEAL_MS = 250;
/** Time for the rows to glide up after the sixth guess (matches the CSS transition). */
const SLIDE_MS = 500;

/** Draws Word Guess and plays its animations. Knows nothing about rules. */
export class GuessView {
  private board: HTMLElement | null = null;
  private layout!: GuessLayout;
  private rowEls: HTMLElement[] = [];
  private squares: HTMLElement[][] = [];
  private readonly keys = new Map<string, HTMLElement>();
  private hintButton: HTMLElement | null = null;
  private allButton: HTMLElement | null = null;
  private dailyButton: HTMLElement | null = null;

  /** Draws into `layer`. Buttons are drawn here but tapped through the touch tracker, which works with a resting thumb. */
  constructor(private readonly layer: HTMLElement) {}

  render(layout: GuessLayout, state: GuessScreenState, animateIn: boolean): void {
    this.layout = layout;
    const board = document.createElement('div');
    board.className = 'board guess';
    this.layer.replaceChildren(board);
    this.board = board;

    this.rowEls = layout.rows.map((rect) => {
      const row = el('div', 'guess-row', board);
      place(row, rect);
      row.style.gap = `${layout.squareGap}px`;
      return row;
    });
    this.squares = this.rowEls.map((row) =>
      Array.from({ length: 5 }, () => {
        const square = el('div', 'square', row);
        square.style.width = `${layout.squareSize}px`;
        square.style.height = `${layout.squareSize}px`;
        square.style.fontSize = `${layout.squareFont}px`;
        return square;
      }),
    );
    state.rows.forEach((squares, i) => this.setRow(i, squares));

    this.keys.clear();
    for (const { id, rect } of layout.keys) {
      const letter = id.slice('key:'.length);
      const key = el('button', 'key', board);
      key.type = 'button';
      key.dataset.letter = letter;
      key.style.fontSize = `${layout.keyFont}px`;
      if (letter === 'enter') {
        key.classList.add('wide');
        key.innerHTML = `${ENTER_ICON}<span>Enter</span>`;
      } else if (letter === 'back') {
        key.classList.add('wide');
        key.innerHTML = `${BACK_ICON}<span>Back</span>`;
      } else {
        key.textContent = letter.toUpperCase();
      }
      place(key, rect);
      this.keys.set(id, key);
    }
    this.setKeys(state.keys, state.allLetters);

    this.hintButton = this.buildButton(board, 'hint', HINT_ICON, 'Hint', layout.hintButton);
    this.allButton = this.buildButton(board, 'all-letters', KEYBOARD_ICON, 'All letters', layout.allLettersButton);
    this.dailyButton = this.buildButton(board, 'daily', NEWS_ICON, "Today's Wordle", layout.dailyButton);
    this.setAllLetters(state.allLetters);
    this.setDaily(state.daily);

    if (animateIn) {
      board.classList.add('entering');
      void board.offsetWidth;
      board.classList.remove('entering');
    }
  }

  setRow(row: number, squares: readonly SquareView[]): void {
    this.squares[row]?.forEach((square, i) => {
      square.textContent = squares[i].letter.toUpperCase();
      square.className = `square ${squares[i].look}`;
    });
  }

  /** A typed letter pops into its square. */
  popSquare(row: number, col: number): void {
    const square = this.squares[row]?.[col];
    if (square) restartAnimation(square, 'pop');
  }

  /** The hint star flies from Hint to the square. Resolves when it lands. */
  async flyStar(row: number, col: number): Promise<void> {
    const square = this.squares[row]?.[col];
    if (this.hintButton && square) await flyHintStar(this.hintButton, square);
  }

  /** The hinted letter lands in its square with a bounce. */
  landSquare(row: number, col: number): void {
    const square = this.squares[row]?.[col];
    if (square) landHintLetter(square);
  }

  /** One gentle wiggle: the row isn't full, or isn't a word she can use. */
  wiggleRow(row: number): void {
    const rowEl = this.rowEls[row];
    if (rowEl) restartAnimation(rowEl, 'wiggle');
  }

  /** Colors in a checked guess one square at a time, left to right. */
  async reveal(row: number, squares: readonly SquareView[]): Promise<void> {
    for (let i = 0; i < squares.length; i++) {
      const square = this.squares[row]?.[i];
      if (square) {
        square.textContent = squares[i].letter.toUpperCase();
        square.className = `square ${squares[i].look}`;
      }
      await wait(REVEAL_MS);
    }
  }

  /** After the sixth guess: the oldest row fades away upward, the rest glide up one, and a fresh row fades in. */
  async slideUp(rows: readonly SquareView[][]): Promise<void> {
    const board = this.board;
    if (!board || this.rowEls.length === 0) return;
    const step = this.layout.squareSize + this.layout.squareGap;
    const leaving = this.rowEls[0].cloneNode(true) as HTMLElement;
    board.appendChild(leaving);
    rows.forEach((squares, i) => this.setRow(i, squares));
    const last = this.rowEls.length - 1;
    this.rowEls.forEach((row, i) => {
      row.style.transition = 'none';
      if (i === last) row.style.opacity = '0';
      else row.style.transform = `translateY(${step}px)`;
    });
    void board.offsetWidth;
    for (const row of this.rowEls) {
      row.style.transition = '';
      row.style.transform = '';
      row.style.opacity = '';
    }
    leaving.style.transform = `translateY(${-step}px)`;
    leaving.style.opacity = '0';
    await wait(SLIDE_MS);
    leaving.remove();
  }

  /** Colors the keys; letters not in the word are hidden (leaving their gap) unless All letters is on. */
  setKeys(states: ReadonlyMap<string, KeyState>, allLetters: boolean): void {
    for (const key of this.keys.values()) {
      const letter = key.dataset.letter ?? '';
      if (letter === 'enter' || letter === 'back') continue;
      const state = states.get(letter) ?? 'unused';
      key.classList.remove('right', 'present', 'absent', 'gone');
      if (state !== 'unused') key.classList.add(state);
      if (state === 'absent' && !allLetters) key.classList.add('gone');
    }
  }

  setPressed(id: string, on: boolean): void {
    this.keys.get(id)?.classList.toggle('pressed', on);
  }

  setHintPulse(on: boolean): void {
    this.hintButton?.classList.toggle('pulse', on);
  }

  setAllLetters(on: boolean): void {
    if (!this.allButton) return;
    this.allButton.classList.toggle('on', on);
    this.allButton.innerHTML = `${on ? CHECK_ICON : KEYBOARD_ICON}<span>All letters</span>`;
  }

  setDaily(mode: DailyMode): void {
    const button = this.dailyButton;
    if (!button) return;
    button.classList.toggle('hidden', mode === 'none');
    button.classList.toggle('share', mode === 'share');
    button.innerHTML = mode === 'share' ? `${SHARE_ICON}<span>Share today's Wordle</span>` : `${NEWS_ICON}<span>Today's Wordle</span>`;
  }

  private buildButton(board: HTMLElement, kind: string, icon: string, label: string, rect: Rect): HTMLElement {
    const button = el('button', `button ${kind}`, board);
    button.type = 'button';
    button.innerHTML = `${icon}<span>${label}</span>`;
    place(button, rect);
    return button;
  }
}
