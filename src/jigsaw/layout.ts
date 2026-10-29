import { reviewButtonIn, type FrameLayout, type Rect } from '../frame/layout';
import { tabFor } from './cut';
import { GRID_SIZES, PICTURE_ASPECT, type JigsawStyle, type PieceCount } from './types';

/** Space between Hint, Pictures, the tray, the board, the rows and the top-right buttons. */
const GAP = 16;
const SLOT_COUNT = 3;
const SLOT_GAP = 12;
const SLOT_PADDING = 6;
/** Tray, Board and Table sit this far above 9, 16 and 30. */
const ROW_GAP = 8;
/** Spread-out pieces start at least this far apart (enough for 30 pieces of 70 px on the smallest iPad). */
const TABLE_GAP = 6;
/** Table pieces are never smaller than this. On every iPad in landscape there is always a spot per piece well above
 * it (portrait shows the turn-the-iPad overlay instead), so this only stops the search for a size. */
const TABLE_MIN = 40;
/** The finished picture's caption: up to two lines across the bottom. */
const CAPTION_HEIGHT = 96;
/** Cartoon, after Tray, Board and Table. */
const CARTOON_WIDTH = 110;
/** Cartoon beside the finished picture's caption. */
const FINISHED_CARTOON_WIDTH = 170;
/** "Pick a picture". */
const TITLE_HEIGHT = 72;
const TILE_GAP = 24;
/** A picture's caption under it: up to two lines (matches the CSS). */
const TILE_CAPTION = 64;
const PAGE_BUTTON_HEIGHT = 96;
const BACK_WIDTH = 200;
const CLOSE_WIDTH = 180;
const MORE_WIDTH = 260;
/** Cartoons, at the end of the title row. */
const CARTOONS_WIDTH = 200;

export interface JigsawLayout {
  frame: FrameLayout;
  hintButton: Rect;
  /** The game's own purple button, beside Hint. */
  picturesButton: Rect;
  /** The yellow tray (Tray style; the other styles leave this strip to the pieces). */
  tray: Rect;
  /** The tray's three square places for pieces. */
  slots: Rect[];
  /** Move picture, in the bottom-right corner: the guide picture between faint-on-the-board and small (Tray, Board). */
  pictureButton: Rect;
  /** Hide edges, under Move picture. */
  edgesButton: Rect;
  /** Cartoon, as tall as both rows, just after Tray, Board and Table (for pictures with a drawing). */
  cartoonButton: Rect;
  /** The whole picture, small, just left of Move picture and Hide edges (smaller on small iPads, to leave Cartoon room). */
  smallPicture: Rect;
  /** Tray, Board, Table: just above the piece counts. */
  styleButtons: Rect[];
  /** 9, 16, 30: the frame's level row. */
  countButtons: Rect[];
  /** The 4:3 board (Tray and Board). */
  board: Rect;
  /**
   * Where loose pieces may lie: between the Hint row and the button rows (free[0], where spread-out pieces are
   * counted from), plus the tray's strip in the styles without a tray. The bottom-right corner is the small picture's.
   */
  free: Rect[];
  /** Where the finished picture is shown, and its caption under it. */
  finished: Rect;
  caption: Rect;
  /** Cartoon at the end of the caption row while she looks back at a finished picture with a drawing... */
  finishedCartoon: Rect;
  /** ...and the caption then, still centred, clear of it. */
  captionBeside: Rect;
  /** Next, across the top (Hint, Pictures and the tray are hidden then), while she looks back at a finished picture. */
  reviewButton: Rect;
}

/** The largest rectangle of `aspect` (width / height) in `area`, centered in it. */
function fit(area: Rect, aspect: number): Rect {
  const w = Math.min(area.w, area.h * aspect);
  const h = w / aspect;
  return { x: area.x + (area.w - w) / 2, y: area.y + (area.h - h) / 2, w, h };
}

export function computeJigsawLayout(frame: FrameLayout, style: JigsawStyle): JigsawLayout {
  // Hint top left and the piece counts in the level row, as in every game; Pictures beside Hint (where Word Circle
  // has Shuffle); the tray between Pictures and the top-right buttons; Tray, Board and Table above the counts;
  // Cartoon after Tray, Board and Table; Move picture and Hide edges in the bottom-right corner, with the small
  // picture beside them.
  const { play, hintButton, levelButtons: countButtons, corner } = frame;
  const picturesButton = { ...hintButton, x: hintButton.x + hintButton.w + GAP };
  const trayLeft = picturesButton.x + picturesButton.w + GAP;
  const tray = { x: trayLeft, y: play.y, w: corner.x - GAP - trayLeft, h: hintButton.h };
  const slot = Math.floor(Math.min(tray.h - 2 * SLOT_PADDING, (tray.w - (SLOT_COUNT + 1) * SLOT_GAP) / SLOT_COUNT));
  const slotsLeft = tray.x + (tray.w - (SLOT_COUNT * slot + (SLOT_COUNT - 1) * SLOT_GAP)) / 2;
  const slots = Array.from({ length: SLOT_COUNT }, (_, i) => ({ x: slotsLeft + i * (slot + SLOT_GAP), y: tray.y + (tray.h - slot) / 2, w: slot, h: slot }));
  const styleButtons = countButtons.map((rect) => ({ ...rect, y: rect.y - ROW_GAP - rect.h }));

  const top = hintButton.y + hintButton.h + GAP;
  const rowsTop = styleButtons[0].y;
  const bottom = play.y + play.h;
  const main = { x: play.x, y: top, w: play.w, h: rowsTop - GAP - top };
  // Move picture over Hide edges, each as tall as a level button, lined up under the top-right buttons.
  const columnX = play.x + play.w - corner.w;
  const pictureButton = { x: columnX, y: styleButtons[0].y, w: corner.w, h: styleButtons[0].h };
  const edgesButton = { x: columnX, y: countButtons[0].y, w: corner.w, h: countButtons[0].h };
  const rowsHeight = bottom - rowsTop;
  const lastStyle = styleButtons[styleButtons.length - 1];
  const cartoonButton = { x: lastStyle.x + lastStyle.w + GAP, y: rowsTop, w: CARTOON_WIDTH, h: rowsHeight };
  const smallLeft = Math.max(pictureButton.x - GAP - rowsHeight * PICTURE_ASPECT, cartoonButton.x + cartoonButton.w + GAP);
  const smallWidth = pictureButton.x - GAP - smallLeft;
  const smallHeight = smallWidth / PICTURE_ASPECT;
  const smallPicture = { x: smallLeft, y: rowsTop + (rowsHeight - smallHeight) / 2, w: smallWidth, h: smallHeight };
  const caption = { x: play.x, y: play.y + play.h - CAPTION_HEIGHT, w: play.w, h: CAPTION_HEIGHT };
  const levelHeight = countButtons[0].h;
  const finishedCartoon = { x: play.x + play.w - FINISHED_CARTOON_WIDTH, y: caption.y + (CAPTION_HEIGHT - levelHeight) / 2, w: FINISHED_CARTOON_WIDTH, h: levelHeight };
  const beside = FINISHED_CARTOON_WIDTH + GAP;
  const captionBeside = { ...caption, x: caption.x + beside, w: caption.w - 2 * beside };
  return {
    frame,
    hintButton,
    picturesButton,
    tray,
    slots,
    pictureButton,
    edgesButton,
    cartoonButton,
    smallPicture,
    styleButtons,
    countButtons,
    board: fit(main, PICTURE_ASPECT),
    free: style === 'tray' ? [main] : [main, tray],
    finished: fit({ x: play.x, y: top, w: play.w, h: caption.y - GAP - top }, PICTURE_ASPECT),
    caption,
    finishedCartoon,
    captionBeside,
    reviewButton: reviewButtonIn({ x: play.x, y: play.y, w: corner.x - GAP - play.x, h: hintButton.h }),
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

/** The table pieces of width `w`, in as many spots as the free area has room for. */
function tableAt(layout: JigsawLayout, shape: number, w: number): TablePieces {
  const h = w * shape;
  const tab = tabFor(w, h);
  const cellW = w + 2 * tab + TABLE_GAP;
  const cellH = h + 2 * tab + TABLE_GAP;
  const room = layout.free.flatMap((area) => cells(area, cellW, cellH));
  return { w, h, spots: room.map((cell) => ({ x: cell.x + (cellW - w) / 2, y: cell.y + (cellH - h) / 2, w, h })) };
}

function measureTable(layout: JigsawLayout, count: PieceCount): TablePieces {
  const { cols, rows } = GRID_SIZES[count];
  const shape = layout.board.h / rows / (layout.board.w / cols);
  let w = Math.floor(layout.board.w / cols);
  // Written so that a size that isn't a number ends the search instead of looping for ever.
  while (w > TABLE_MIN) {
    const table = tableAt(layout, shape, w);
    if (table.spots.length >= count) return table;
    w -= 1;
  }
  return tableAt(layout, shape, TABLE_MIN);
}

const tables = new WeakMap<JigsawLayout, Map<PieceCount, TablePieces>>();

/**
 * The biggest table pieces that still leave room for every piece, apart, in the free area (never bigger than on the
 * board). Cached per layout, since every redraw asks for it for every piece.
 */
export function tablePieces(layout: JigsawLayout, count: PieceCount): TablePieces {
  let byCount = tables.get(layout);
  if (!byCount) tables.set(layout, (byCount = new Map()));
  let table = byCount.get(count);
  if (!table) byCount.set(count, (table = measureTable(layout, count)));
  return table;
}

const distance = (area: Rect, x: number, y: number) =>
  Math.hypot(Math.max(area.x - x, 0, x - (area.x + area.w)), Math.max(area.y - y, 0, y - (area.y + area.h)));

/**
 * Moves a piece's body (or a group's bounds) into the free area with its tabs (`overhang`) inside too: into the
 * nearest part it fits in, or the nearest part at all if it fits in none. `free` must not be empty.
 */
export function clampToFree(free: readonly Rect[], body: Rect, overhang = 0): Rect {
  const cx = body.x + body.w / 2;
  const cy = body.y + body.h / 2;
  const inner = free.map((a) => ({ x: a.x + overhang, y: a.y + overhang, w: a.w - 2 * overhang, h: a.h - 2 * overhang }));
  const fits = inner.filter((a) => body.w <= a.w && body.h <= a.h);
  const area = (fits.length > 0 ? fits : inner).reduce((best, a) => (distance(a, cx, cy) < distance(best, cx, cy) ? a : best));
  return {
    ...body,
    x: Math.max(area.x, Math.min(body.x, area.x + area.w - body.w)),
    y: Math.max(area.y, Math.min(body.y, area.y + area.h - body.h)),
  };
}

export interface PicturePageLayout {
  title: Rect;
  /** Cartoons, at the end of the title row, just left of the corner buttons. */
  cartoons: Rect;
  /** Six 4:3 places, three across and two down, with up to two lines of caption under each. */
  tiles: Rect[];
  captions: Rect[];
  back: Rect;
  close: Rect;
  more: Rect;
}

export function computePicturePageLayout(frame: FrameLayout): PicturePageLayout {
  const { play, corner } = frame;
  const cartoons = { x: corner.x - GAP - CARTOONS_WIDTH, y: play.y, w: CARTOONS_WIDTH, h: TITLE_HEIGHT };
  const title = { x: play.x, y: play.y, w: cartoons.x - GAP - play.x, h: TITLE_HEIGHT };
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
    cartoons,
    tiles,
    captions: tiles.map((tile) => ({ x: tile.x, y: tile.y + tile.h, w: tile.w, h: TILE_CAPTION })),
    back: { x: play.x, y: buttonsY, w: BACK_WIDTH, h: PAGE_BUTTON_HEIGHT },
    close: { x: play.x + (play.w - CLOSE_WIDTH) / 2, y: buttonsY, w: CLOSE_WIDTH, h: PAGE_BUTTON_HEIGHT },
    more: { x: play.x + play.w - MORE_WIDTH, y: buttonsY, w: MORE_WIDTH, h: PAGE_BUTTON_HEIGHT },
  };
}

/** The new photo page: margins, the right-hand column, and its parts. */
const NEW_MARGIN = 24;
const NEW_COLUMN = 380;
const NEW_TITLE = 56;
const NEW_LABEL = 32;
/** Two lines of 26 px text, with room for the box's padding and border. */
const NEW_CAPTION = 96;
const NEW_BUTTONS = 80;
/** Two lines of the tip. */
const NEW_TIP = 64;
const NEW_GAP = 16;

export interface NewPhotoLayout {
  /** Where the photo is shown (it's clipped to this); the 4:3 frame sits in its middle, in its coordinates. */
  photoArea: Rect;
  frame: Rect;
  /** Down the right, all in the top part of the screen, as the keyboard covers the bottom half. */
  title: Rect;
  captionLabel: Rect;
  caption: Rect;
  confirm: Rect;
  cancel: Rect;
  /** How to move and zoom the photo, under the buttons (the keyboard may cover it while she types). */
  tip: Rect;
}

/** "Your new puzzle": the photo on the left, the title, caption box and buttons on the right, top-aligned. */
export function computeNewPhotoLayout(width: number, height: number): NewPhotoLayout {
  const column = Math.min(NEW_COLUMN, width * 0.36);
  const photoArea = { x: NEW_MARGIN, y: NEW_MARGIN, w: width - column - 3 * NEW_MARGIN, h: height - 2 * NEW_MARGIN };
  // A little of the photo shows (dimmed) around the frame, so it's clear the photo can move.
  const room = { x: photoArea.w * 0.08, y: photoArea.h * 0.08, w: photoArea.w * 0.84, h: photoArea.h * 0.84 };
  const x = photoArea.x + photoArea.w + NEW_MARGIN;
  const title = { x, y: NEW_MARGIN, w: column, h: NEW_TITLE };
  const captionLabel = { x, y: title.y + title.h + NEW_GAP, w: column, h: NEW_LABEL };
  const caption = { x, y: captionLabel.y + captionLabel.h + 4, w: column, h: NEW_CAPTION };
  const buttonsY = caption.y + caption.h + NEW_GAP;
  const confirmW = Math.round((column - NEW_GAP) * 0.58);
  return {
    photoArea,
    frame: fit(room, PICTURE_ASPECT),
    title,
    captionLabel,
    caption,
    confirm: { x, y: buttonsY, w: confirmW, h: NEW_BUTTONS },
    cancel: { x: x + confirmW + NEW_GAP, y: buttonsY, w: column - confirmW - NEW_GAP, h: NEW_BUTTONS },
    tip: { x, y: buttonsY + NEW_BUTTONS + NEW_GAP, w: column, h: NEW_TIP },
  };
}
