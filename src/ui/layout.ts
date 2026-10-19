/** Right-edge thumb safe zone (about an inch). */
export const SAFE_ZONE_RIGHT = 130;
/** Her left thumb rests on the screen, so the left safe zone grows to about 1.5 inches where there's room... */
export const SAFE_ZONE_LEFT_TARGET = 200;
/** ...and never shrinks below an inch. */
export const SAFE_ZONE_LEFT_MIN = 130;
/** Play-area width needed for a Hard puzzle at the smallest allowed tile and slot sizes. */
const MIN_PLAY_WIDTH = 760;

const MARGIN = 16;
const COLUMN_GAP = 24;
const LEFT_SHARE = 0.45;
/** Room for the "Extra words" label and two rows of word chips. */
const EXTRAS_HEIGHT = 130;
const EXTRAS_GAP = 8;
const BAR_HEIGHT = 96;
const BAR_MAX_WIDTH = 420;
const BAR_GAP = 16;
const MIN_TILE_DIAMETER = 110;
const BACKING_PADDING = 8;
const SLOT_GAP = 6;
const ROW_GAP = 12;
const MIN_SLOT = 48;
const MAX_SLOT = 72;
const BUTTON_HEIGHT = 96;
const BUTTON_GAP = 16;
const BUTTONS_TOP_GAP = 32;
const LEVEL_HEIGHT = 48;
const LEVEL_MAX_WIDTH = 120;
const LEVEL_GAP = 8;
const LEVELS_BOTTOM_GAP = 16;
const LEVEL_COUNT = 3;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Circle {
  x: number;
  y: number;
  r: number;
}

export interface LayoutInput {
  width: number;
  height: number;
  letterCount: number;
  wordLengths: number[];
}

export interface Layout {
  width: number;
  height: number;
  safeZoneLeft: number;
  safeZoneRight: number;
  /** Easy, Medium and Hard buttons at the top left. */
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

export function computeLayout({ width, height, letterCount, wordLengths }: LayoutInput): Layout {
  const safeZoneLeft = Math.min(
    SAFE_ZONE_LEFT_TARGET,
    Math.max(SAFE_ZONE_LEFT_MIN, width - SAFE_ZONE_RIGHT - MIN_PLAY_WIDTH),
  );
  const playLeft = safeZoneLeft + MARGIN;
  const playRight = width - SAFE_ZONE_RIGHT - MARGIN;
  const columnsWidth = playRight - playLeft - COLUMN_GAP;
  const leftWidth = columnsWidth * LEFT_SHARE;
  const rightWidth = columnsWidth - leftWidth;
  const rightLeft = playLeft + leftWidth + COLUMN_GAP;
  const rightCenter = rightLeft + rightWidth / 2;

  const extras: Rect = { x: rightLeft, y: MARGIN, w: rightWidth, h: EXTRAS_HEIGHT };
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

  const buttonsY = height - MARGIN - BUTTON_HEIGHT;
  const buttonWidth = (leftWidth - BUTTON_GAP) / 2;
  const shuffleButton: Rect = { x: playLeft, y: buttonsY, w: buttonWidth, h: BUTTON_HEIGHT };
  const hintButton: Rect = { x: playLeft + buttonWidth + BUTTON_GAP, y: buttonsY, w: buttonWidth, h: BUTTON_HEIGHT };

  const leftCenter = playLeft + leftWidth / 2;
  const levelWidth = Math.min(LEVEL_MAX_WIDTH, (leftWidth - (LEVEL_COUNT - 1) * LEVEL_GAP) / LEVEL_COUNT);
  const levelsLeft = leftCenter - (LEVEL_COUNT * levelWidth + (LEVEL_COUNT - 1) * LEVEL_GAP) / 2;
  const levels: Rect[] = Array.from({ length: LEVEL_COUNT }, (_, i) => ({
    x: levelsLeft + i * (levelWidth + LEVEL_GAP),
    y: MARGIN,
    w: levelWidth,
    h: LEVEL_HEIGHT,
  }));

  const rowCount = wordLengths.length;
  const longest = Math.max(...wordLengths);
  const slotsTop = MARGIN + LEVEL_HEIGHT + LEVELS_BOTTOM_GAP;
  const slotsSpace = buttonsY - BUTTONS_TOP_GAP - slotsTop;
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
    width,
    height,
    safeZoneLeft,
    safeZoneRight: SAFE_ZONE_RIGHT,
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
