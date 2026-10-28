import { reviewButtonIn, type FrameLayout, type Rect } from '../frame/layout';
import { tabFor } from './cut';
import { GRID_SIZES, PICTURE_ASPECT, type PieceCount } from './types';

/** Space between Hint, Pictures, the tray, the board, the rows and the top-right buttons. */
const GAP = 16;
const SLOT_COUNT = 3;
const SLOT_GAP = 12;
const SLOT_PADDING = 6;
/** Tray, Board and Table sit this far above 9, 16 and 30. */
const ROW_GAP = 8;
/** Table pieces start at least this far apart. */
const TABLE_GAP = 8;
/** Table pieces are never smaller than this (the free area always has room well above it). */
const TABLE_MIN = 40;
/** The finished picture's caption: up to two lines across the bottom. */
const CAPTION_HEIGHT = 96;
/** "Pick a picture". */
const TITLE_HEIGHT = 72;
const TILE_GAP = 24;
const TILE_CAPTION = 34;
const PAGE_BUTTON_HEIGHT = 96;
const BACK_WIDTH = 200;
const CLOSE_WIDTH = 180;
const MORE_WIDTH = 260;

export interface JigsawLayout {
  frame: FrameLayout;
  hintButton: Rect;
  /** The game's own purple button, beside Hint. */
  picturesButton: Rect;
  /** The yellow backing: the tray (Tray and Board) or the box lid's place (Table). */
  tray: Rect;
  /** The tray's three square places for pieces. */
  slots: Rect[];
  /** The whole picture, small, in the tray's place (Table). */
  lid: Rect;
  /** Tray, Board, Table: just above the piece counts. */
  styleButtons: Rect[];
  /** 9, 16, 30: the frame's level row. */
  countButtons: Rect[];
  /** The 4:3 board (Tray and Board). */
  board: Rect;
  /** Where loose pieces may lie: everything clear of the buttons, the tray and the rows. The table starts at free[0]. */
  free: Rect[];
  /** Where the finished picture is shown, and its caption under it. */
  finished: Rect;
  caption: Rect;
  /** Next, over the tray's place, while she looks back at a finished picture. */
  reviewButton: Rect;
}

/** The largest rectangle of `aspect` (width / height) in `area`, centered in it. */
function fit(area: Rect, aspect: number): Rect {
  const w = Math.min(area.w, area.h * aspect);
  const h = w / aspect;
  return { x: area.x + (area.w - w) / 2, y: area.y + (area.h - h) / 2, w, h };
}

export function computeJigsawLayout(frame: FrameLayout): JigsawLayout {
  // Hint top left and the piece counts in the level row, as in every game; Pictures beside Hint (where Word Circle
  // has Shuffle); the tray between Pictures and the top-right buttons; Tray, Board and Table above the counts.
  const { play, hintButton, levelButtons: countButtons, corner } = frame;
  const picturesButton = { ...hintButton, x: hintButton.x + hintButton.w + GAP };
  const trayLeft = picturesButton.x + picturesButton.w + GAP;
  const tray = { x: trayLeft, y: play.y, w: corner.x - GAP - trayLeft, h: hintButton.h };
  const slot = Math.floor(Math.min(tray.h - 2 * SLOT_PADDING, (tray.w - (SLOT_COUNT + 1) * SLOT_GAP) / SLOT_COUNT));
  const slotsLeft = tray.x + (tray.w - (SLOT_COUNT * slot + (SLOT_COUNT - 1) * SLOT_GAP)) / 2;
  const slots = Array.from({ length: SLOT_COUNT }, (_, i) => ({ x: slotsLeft + i * (slot + SLOT_GAP), y: tray.y + (tray.h - slot) / 2, w: slot, h: slot }));
  const lid = fit({ x: tray.x, y: tray.y + SLOT_PADDING, w: tray.w, h: tray.h - 2 * SLOT_PADDING }, PICTURE_ASPECT);
  const styleButtons = countButtons.map((rect) => ({ ...rect, y: rect.y - ROW_GAP - rect.h }));

  const top = hintButton.y + hintButton.h + GAP;
  const rowsTop = styleButtons[0].y;
  const main = { x: play.x, y: top, w: play.w, h: rowsTop - GAP - top };
  const last = countButtons[countButtons.length - 1];
  const besideRowsLeft = last.x + last.w + GAP;
  const besideRows = { x: besideRowsLeft, y: rowsTop, w: play.x + play.w - besideRowsLeft, h: play.y + play.h - rowsTop };
  const caption = { x: play.x, y: play.y + play.h - CAPTION_HEIGHT, w: play.w, h: CAPTION_HEIGHT };
  return {
    frame,
    hintButton,
    picturesButton,
    tray,
    slots,
    lid,
    styleButtons,
    countButtons,
    board: fit(main, PICTURE_ASPECT),
    free: [main, besideRows],
    finished: fit({ x: play.x, y: top, w: play.w, h: caption.y - GAP - top }, PICTURE_ASPECT),
    caption,
    reviewButton: reviewButtonIn(tray),
  };
}

/** Table pieces' size, and a starting place (a body rect) for each, apart, in the free area. */
export interface TablePieces {
  w: number;
  h: number;
  spots: Rect[];
}

/** Cells of cellW × cellH across `area`, row by row, the leftover space shared out around them. */
function cells(area: Rect, cellW: number, cellH: number): Rect[] {
  const across = Math.floor(area.w / cellW);
  const down = Math.floor(area.h / cellH);
  const x0 = area.x + (area.w - across * cellW) / 2;
  const y0 = area.y + (area.h - down * cellH) / 2;
  return Array.from({ length: across * down }, (_, i) => ({ x: x0 + (i % across) * cellW, y: y0 + Math.floor(i / across) * cellH, w: cellW, h: cellH }));
}

/** The biggest table pieces that still leave room for every piece, apart, in the free area (never bigger than on the board). */
export function tablePieces(layout: JigsawLayout, count: PieceCount): TablePieces {
  const { cols, rows } = GRID_SIZES[count];
  const shape = layout.board.h / rows / (layout.board.w / cols);
  let w = Math.floor(layout.board.w / cols);
  for (;;) {
    const h = w * shape;
    const tab = tabFor(w, h);
    const cellW = w + 2 * tab + TABLE_GAP;
    const cellH = h + 2 * tab + TABLE_GAP;
    const room = layout.free.flatMap((area) => cells(area, cellW, cellH));
    if (room.length >= count || w <= TABLE_MIN) {
      return { w, h, spots: room.map((cell) => ({ x: cell.x + (cellW - w) / 2, y: cell.y + (cellH - h) / 2, w, h })) };
    }
    w -= 1;
  }
}

const distance = (area: Rect, x: number, y: number) =>
  Math.hypot(Math.max(area.x - x, 0, x - (area.x + area.w)), Math.max(area.y - y, 0, y - (area.y + area.h)));

/** Moves a piece's body (or a group's bounds) inside the part of the free area its middle is nearest. */
export function clampToFree(free: readonly Rect[], body: Rect): Rect {
  const cx = body.x + body.w / 2;
  const cy = body.y + body.h / 2;
  const area = free.reduce((best, a) => (distance(a, cx, cy) < distance(best, cx, cy) ? a : best));
  return {
    ...body,
    x: Math.max(area.x, Math.min(body.x, area.x + area.w - body.w)),
    y: Math.max(area.y, Math.min(body.y, area.y + area.h - body.h)),
  };
}

export interface PicturePageLayout {
  title: Rect;
  /** Six 4:3 places, three across and two down, with a caption line under each. */
  tiles: Rect[];
  captions: Rect[];
  back: Rect;
  close: Rect;
  more: Rect;
}

export function computePicturePageLayout(frame: FrameLayout): PicturePageLayout {
  const { play, corner } = frame;
  const title = { x: play.x, y: play.y, w: corner.x - GAP - play.x, h: TITLE_HEIGHT };
  const buttonsY = play.y + play.h - PAGE_BUTTON_HEIGHT;
  const top = title.y + title.h;
  const room = buttonsY - GAP - top;
  const tileW = Math.min((play.w - 2 * TILE_GAP) / 3, ((room - TILE_GAP) / 2 - TILE_CAPTION) * PICTURE_ASPECT);
  const tileH = tileW / PICTURE_ASPECT;
  const x0 = play.x + (play.w - (3 * tileW + 2 * TILE_GAP)) / 2;
  const y0 = top + (room - (2 * (tileH + TILE_CAPTION) + TILE_GAP)) / 2;
  const tiles = Array.from({ length: 6 }, (_, i) => ({
    x: x0 + (i % 3) * (tileW + TILE_GAP),
    y: y0 + Math.floor(i / 3) * (tileH + TILE_CAPTION + TILE_GAP),
    w: tileW,
    h: tileH,
  }));
  return {
    title,
    tiles,
    captions: tiles.map((tile) => ({ x: tile.x, y: tile.y + tile.h, w: tile.w, h: TILE_CAPTION })),
    back: { x: play.x, y: buttonsY, w: BACK_WIDTH, h: PAGE_BUTTON_HEIGHT },
    close: { x: play.x + (play.w - CLOSE_WIDTH) / 2, y: buttonsY, w: CLOSE_WIDTH, h: PAGE_BUTTON_HEIGHT },
    more: { x: play.x + play.w - MORE_WIDTH, y: buttonsY, w: MORE_WIDTH, h: PAGE_BUTTON_HEIGHT },
  };
}
