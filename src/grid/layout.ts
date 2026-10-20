import type { FrameLayout, Rect } from '../frame/layout';

/** The left column: Easy, Medium, Hard, then Hint. */
const LEFT_WIDTH = 130;
const LEVEL_HEIGHT = 64;
const LEVEL_GAP = 12;
const HINT_GAP = 28;
const HINT_HEIGHT = 96;
/** Space between the left column, the tray, the grid and the top-right buttons. */
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
const CORNER_SCALE = 0.18;
const CORNER_MIN = 18;

export interface GridLayout {
  frame: FrameLayout;
  /** Easy, Medium, Hard. */
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
}

export function computeGridLayout(frame: FrameLayout, size: number): GridLayout {
  const { play } = frame;
  const levels = [0, 1, 2].map((i) => ({ x: play.x, y: play.y + i * (LEVEL_HEIGHT + LEVEL_GAP), w: LEFT_WIDTH, h: LEVEL_HEIGHT }));
  const hintButton = { x: play.x, y: levels[2].y + LEVEL_HEIGHT + HINT_GAP, w: LEFT_WIDTH, h: HINT_HEIGHT };

  const left = play.x + LEFT_WIDTH + GAP;
  const trayH = Math.round(Math.min(TRAY_MAX, Math.max(TRAY_MIN, frame.height * TRAY_SHARE)));
  const tray = { x: left, y: play.y, w: frame.corner.x - GAP - left, h: trayH };
  const tileSize = trayH - 2 * TRAY_PADDING;

  const top = tray.y + trayH + GAP;
  const right = play.x + play.w;
  const bottom = play.y + play.h;
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
  };
}

/** Where the tray's `count` tiles go: side by side, centered in the tray. */
export function trayTiles(layout: GridLayout, count: number): Rect[] {
  const { tray, tileSize } = layout;
  const total = count * tileSize + Math.max(0, count - 1) * TILE_GAP;
  const x0 = tray.x + (tray.w - total) / 2;
  return Array.from({ length: count }, (_, i) => ({ x: x0 + i * (tileSize + TILE_GAP), y: tray.y + TRAY_PADDING, w: tileSize, h: tileSize }));
}
