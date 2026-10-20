import { reviewButtonIn, type FrameLayout, type Rect } from '../frame/layout';

/** Wordle's keyboard rows. Enter and Back go either side of the bottom row. */
const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const KEY_GAP = 8;
const KEY_MIN_HEIGHT = 64;
const KEY_MAX_HEIGHT = 84;
/** Keys are this share of the screen height, within the limits above. */
const KEY_HEIGHT_SHARE = 0.09;
const WIDE_KEY = 1.5;
/** Space between the board and the keyboard. */
const BOARD_GAP = 24;
const SQUARE_GAP = 8;
const SQUARE_MAX = 110;
const SQUARE_LETTER_SCALE = 0.62;
const KEY_LETTER_SCALE = 0.55;
/** Space between the left column (Hint, All letters, Today's Wordle) and the board. */
const COLUMN_GAP = 24;
/** Space between the board and the top-right buttons. */
const CORNER_CLEARANCE = 16;
const BUTTON_GAP = 16;
const DAILY_MAX_HEIGHT = 180;

export interface Key {
  /** "key:a" … "key:z", "key:enter" or "key:back". */
  id: string;
  rect: Rect;
}

export interface GuessLayout {
  frame: FrameLayout;
  /** The six board rows, top to bottom. */
  rows: Rect[];
  squareSize: number;
  squareGap: number;
  squareFont: number;
  keys: Key[];
  keyFont: number;
  hintButton: Rect;
  allLettersButton: Rect;
  /** Today's Wordle label, or Share today's Wordle. */
  dailyButton: Rect;
  /** Next, over the keyboard, while she looks back at a finished word. */
  reviewButton: Rect;
}

export function computeGuessLayout(frame: FrameLayout): GuessLayout {
  const { play } = frame;
  const keyH = Math.round(Math.min(KEY_MAX_HEIGHT, Math.max(KEY_MIN_HEIGHT, frame.height * KEY_HEIGHT_SHARE)));
  const keyW = (play.w - 9 * KEY_GAP) / 10;
  const keyboardTop = play.y + play.h - (3 * keyH + 2 * KEY_GAP);
  const keys: Key[] = [];
  const addRow = (letters: string, left: number, y: number) =>
    [...letters].forEach((letter, i) => keys.push({ id: `key:${letter}`, rect: { x: left + i * (keyW + KEY_GAP), y, w: keyW, h: keyH } }));
  addRow(KEY_ROWS[0], play.x, keyboardTop);
  addRow(KEY_ROWS[1], play.x + (keyW + KEY_GAP) / 2, keyboardTop + keyH + KEY_GAP);
  const bottomY = keyboardTop + 2 * (keyH + KEY_GAP);
  const wideW = keyW * WIDE_KEY + KEY_GAP / 2;
  keys.push({ id: 'key:enter', rect: { x: play.x, y: bottomY, w: wideW, h: keyH } });
  addRow(KEY_ROWS[2], play.x + wideW + KEY_GAP, bottomY);
  keys.push({ id: 'key:back', rect: { x: play.x + play.w - wideW, y: bottomY, w: wideW, h: keyH } });

  const boardBottom = keyboardTop - BOARD_GAP;
  // The left column is as wide as Hint, which sits in the same top-left place in every game.
  const { hintButton } = frame;
  const regionLeft = hintButton.x + hintButton.w + COLUMN_GAP;
  const regionRight = frame.corner.x - CORNER_CLEARANCE;
  const byHeight = (boardBottom - play.y - 5 * SQUARE_GAP) / 6;
  const byWidth = (regionRight - regionLeft - 4 * SQUARE_GAP) / 5;
  const squareSize = Math.floor(Math.min(SQUARE_MAX, byHeight, byWidth));
  const boardW = 5 * squareSize + 4 * SQUARE_GAP;
  const boardH = 6 * squareSize + 5 * SQUARE_GAP;
  const centered = play.x + play.w / 2 - boardW / 2;
  const boardX = Math.min(Math.max(centered, regionLeft), regionRight - boardW);
  const boardY = play.y + (boardBottom - play.y - boardH) / 2;
  const rows: Rect[] = Array.from({ length: 6 }, (_, i) => ({
    x: boardX,
    y: boardY + i * (squareSize + SQUARE_GAP),
    w: boardW,
    h: squareSize,
  }));

  const allLettersButton: Rect = { ...hintButton, y: hintButton.y + hintButton.h + BUTTON_GAP };
  const dailyY = allLettersButton.y + allLettersButton.h + BUTTON_GAP;
  const dailyButton: Rect = { x: hintButton.x, y: dailyY, w: hintButton.w, h: Math.min(DAILY_MAX_HEIGHT, boardBottom - dailyY) };

  return {
    frame,
    rows,
    squareSize,
    squareGap: SQUARE_GAP,
    squareFont: Math.round(squareSize * SQUARE_LETTER_SCALE),
    keys,
    keyFont: Math.round(keyH * KEY_LETTER_SCALE),
    hintButton,
    allLettersButton,
    dailyButton,
    reviewButton: reviewButtonIn({ x: play.x, y: keyboardTop, w: play.w, h: bottomY + keyH - keyboardTop }),
  };
}
