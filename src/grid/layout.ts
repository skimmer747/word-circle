import { reviewButtonIn, type FrameLayout, type Rect } from '../frame/layout';

/** Space between Hint, the tray, the grid, the level buttons and the top-right buttons. */
const GAP = 16;
/** The tray is this share of the screen height, within the limits below. */
const TRAY_SHARE = 0.12;
const TRAY_MIN = 96;
const TRAY_MAX = 110;
const TRAY_PADDING = 6;
const TILE_GAP = 12;
const SQUARE_MAX = 150;
const LETTER_SCALE = 0.62;
/** A section's letters, printed small in its first square. */
const CORNER_SCALE = 0.24;
const CORNER_MIN = 24;

export interface GridLayout {
  frame: FrameLayout;
  /** Easy, Medium, Hard: the frame's row at the bottom left, as in every game. */
  levels: Rect[];
  hintButton: Rect;
  /** The yellow backing for the selected section's letters. */
  tray: Rect;
  tileSize: number;
  tileFont: number;
  /** Every square of the puzzle's box, row by row, blocked ones included. */
  squares: Rect[];
  squareSize: number;
  squareFont: number;
  cornerFont: number;
  /** Next, over the (empty) tray, while she looks back at a finished puzzle. */
  reviewButton: Rect;
}

export function computeGridLayout(frame: FrameLayout, size: number): GridLayout {
  // Hint in the top-left corner and the levels in the bottom row, as in every game; the tray between Hint and
  // the top-right buttons; the grid in the whole width between the tray and the levels.
  const { play, hintButton, levelButtons: levels } = frame;
  const trayLeft = hintButton.x + hintButton.w + GAP;
  const trayH = Math.round(Math.min(TRAY_MAX, Math.max(TRAY_MIN, frame.height * TRAY_SHARE)));
  const tray = { x: trayLeft, y: play.y, w: frame.corner.x - GAP - trayLeft, h: trayH };
  const tileSize = trayH - 2 * TRAY_PADDING;

  const left = play.x;
  const top = Math.max(tray.y + trayH, hintButton.y + hintButton.h) + GAP;
  const right = play.x + play.w;
  const bottom = levels[0].y - GAP;
  const squareSize = Math.floor(Math.min(SQUARE_MAX, (right - left) / size, (bottom - top) / size));
  const x0 = left + (right - left - size * squareSize) / 2;
  const y0 = top + (bottom - top - size * squareSize) / 2;
  const squares = Array.from({ length: size * size }, (_, i) => ({
    x: x0 + (i % size) * squareSize,
    y: y0 + Math.floor(i / size) * squareSize,
    w: squareSize,
    h: squareSize,
  }));

  return {
    frame,
    levels,
    hintButton,
    tray,
    tileSize,
    tileFont: Math.round(tileSize * LETTER_SCALE),
    squares,
    squareSize,
    squareFont: Math.round(squareSize * LETTER_SCALE),
    cornerFont: Math.max(CORNER_MIN, Math.round(squareSize * CORNER_SCALE)),
    reviewButton: reviewButtonIn(tray),
  };
}

/** Where the tray's `count` tiles go: side by side, centered in the tray. */
export function trayTiles(layout: GridLayout, count: number): Rect[] {
  const { tray, tileSize } = layout;
  const total = count * tileSize + Math.max(0, count - 1) * TILE_GAP;
  const x0 = tray.x + (tray.w - total) / 2;
  return Array.from({ length: count }, (_, i) => ({ x: x0 + i * (tileSize + TILE_GAP), y: tray.y + TRAY_PADDING, w: tileSize, h: tileSize }));
}
