import { MARGIN, type FrameLayout, type Rect } from '../frame/layout';

export type { Rect };

const COLUMN_GAP = 24;
const LEFT_SHARE = 0.45;
/** Room for the "Extra words" label and two rows of word chips. */
const EXTRAS_HEIGHT = 130;
const EXTRAS_GAP = 8;
/** Space between Extra words and the buttons in the top-right corner. */
const CORNER_GAP = 12;
const BAR_HEIGHT = 96;
const BAR_MAX_WIDTH = 420;
const BAR_GAP = 16;
const MIN_TILE_DIAMETER = 110;
const BACKING_PADDING = 8;
const SLOT_GAP = 6;
const ROW_GAP = 12;
const MIN_SLOT = 48;
const MAX_SLOT = 72;
/** Space between Hint and Shuffle, and between the word slots and the buttons above and below them. */
const BUTTON_GAP = 16;

export interface Circle {
  x: number;
  y: number;
  r: number;
}

/** How many letters are in the circle, and how long each answer word is. */
export interface CircleShape {
  letterCount: number;
  wordLengths: number[];
}

export interface Layout {
  /** The frame's geometry: safe zones, play area, top-right buttons and pop-up cards. */
  frame: FrameLayout;
  /** Easy, Medium and Hard: the frame's row at the bottom left, as in every game. */
  levels: Rect[];
  /** "Extra words" list at the top right. */
  extras: Rect;
  /** Current-word bar above the circle. */
  bar: Rect;
  /** Pale circle behind the letters. */
  backing: Circle;
  /** Letter tile positions by ring slot. */
  tiles: Circle[];
  letterFontSize: number;
  slotSize: number;
  slotGap: number;
  /** One rect per answer word, in slot order. */
  rows: Rect[];
  shuffleButton: Rect;
  hintButton: Rect;
}

export function computeLayout(frame: FrameLayout, { letterCount, wordLengths }: CircleShape): Layout {
  const { height } = frame;
  const playLeft = frame.play.x;
  const columnsWidth = frame.play.w - COLUMN_GAP;
  const leftWidth = columnsWidth * LEFT_SHARE;
  const rightWidth = columnsWidth - leftWidth;
  const rightLeft = playLeft + leftWidth + COLUMN_GAP;
  const rightCenter = rightLeft + rightWidth / 2;

  const extras: Rect = { x: rightLeft, y: MARGIN, w: frame.corner.x - CORNER_GAP - rightLeft, h: EXTRAS_HEIGHT };
  const barWidth = Math.min(rightWidth, BAR_MAX_WIDTH);
  const bar: Rect = { x: rightCenter - barWidth / 2, y: extras.y + extras.h + EXTRAS_GAP, w: barWidth, h: BAR_HEIGHT };

  const circleTop = bar.y + bar.h + BAR_GAP;
  const circleSpace = height - MARGIN - circleTop;
  const diameter = Math.min(rightWidth, circleSpace);
  const backing: Circle = { x: rightCenter, y: circleTop + circleSpace / 2, r: diameter / 2 };

  const tileShare = letterCount <= 4 ? 0.34 : letterCount === 5 ? 0.3 : 0.27;
  const tileR = Math.max(diameter * tileShare, MIN_TILE_DIAMETER) / 2;
  const ringR = backing.r - tileR - BACKING_PADDING;
  const tiles: Circle[] = Array.from({ length: letterCount }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / letterCount;
    return { x: backing.x + ringR * Math.cos(angle), y: backing.y + ringR * Math.sin(angle), r: tileR };
  });

  // Hint in the top-left corner, as in every game, with Shuffle beside it; the levels in the frame's bottom row.
  const hintButton: Rect = frame.hintButton;
  const shuffleButton: Rect = { ...hintButton, x: hintButton.x + hintButton.w + BUTTON_GAP };
  const levels: Rect[] = frame.levelButtons;

  const leftCenter = playLeft + leftWidth / 2;
  const rowCount = wordLengths.length;
  const longest = Math.max(...wordLengths);
  const slotsTop = hintButton.y + hintButton.h + BUTTON_GAP;
  const slotsSpace = levels[0].y - BUTTON_GAP - slotsTop;
  const byWidth = (leftWidth - (longest - 1) * SLOT_GAP) / longest;
  const byHeight = (slotsSpace - (rowCount - 1) * ROW_GAP) / rowCount;
  const slotSize = Math.min(MAX_SLOT, Math.max(MIN_SLOT, Math.floor(Math.min(byWidth, byHeight))));
  const blockHeight = rowCount * slotSize + (rowCount - 1) * ROW_GAP;
  const blockTop = slotsTop + (slotsSpace - blockHeight) / 2;
  const rows: Rect[] = wordLengths.map((length, i) => {
    const w = length * slotSize + (length - 1) * SLOT_GAP;
    return { x: leftCenter - w / 2, y: blockTop + i * (slotSize + ROW_GAP), w, h: slotSize };
  });

  return {
    frame,
    levels,
    extras,
    bar,
    backing,
    tiles,
    letterFontSize: Math.round(tileR * 2 * 0.6),
    slotSize,
    slotGap: SLOT_GAP,
    rows,
    shuffleButton,
    hintButton,
  };
}
