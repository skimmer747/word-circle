/** Right-edge thumb safe zone (about an inch). */
export const SAFE_ZONE_RIGHT = 130;
/** Her left thumb rests on the screen, so the left safe zone grows to about 1.5 inches where there's room... */
export const SAFE_ZONE_LEFT_TARGET = 200;
/** ...and never shrinks below an inch. */
export const SAFE_ZONE_LEFT_MIN = 130;
/** Play-area width needed for a Hard Word Circle puzzle at the smallest allowed tile and slot sizes. */
const MIN_PLAY_WIDTH = 760;
/** Space between the play area and the safe zones and screen edges. */
export const MARGIN = 16;

const CORNER_SIZE = 72;
const NEXT_WIDTH = 420;
const NEXT_HEIGHT = 100;
const CARD_PADDING = 24;
const CLOSE_WIDTH = 360;
const CLOSE_HEIGHT = 100;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What every game shares: the safe zones, the play area, the top-right buttons and the pop-up cards. */
export interface FrameLayout {
  width: number;
  height: number;
  safeZoneLeft: number;
  safeZoneRight: number;
  /** The space between the safe zones, inside the margins. Games draw only in here. */
  play: Rect;
  clockButton: Rect;
  /** Everything in the top-right corner; games keep clear of it. */
  corner: Rect;
  /** The "Well done!" card and the pop-ups fill almost the whole screen so their text can be as big as possible. */
  card: Rect;
  /** A card's single button (Next puzzle). */
  nextButton: Rect;
  /** The clock pop-up's Close button. */
  closeButton: Rect;
}

export function computeFrameLayout(width: number, height: number): FrameLayout {
  const safeZoneLeft = Math.min(
    SAFE_ZONE_LEFT_TARGET,
    Math.max(SAFE_ZONE_LEFT_MIN, width - SAFE_ZONE_RIGHT - MIN_PLAY_WIDTH),
  );
  const play: Rect = {
    x: safeZoneLeft + MARGIN,
    y: MARGIN,
    w: width - safeZoneLeft - SAFE_ZONE_RIGHT - 2 * MARGIN,
    h: height - 2 * MARGIN,
  };
  const clockButton: Rect = { x: play.x + play.w - CORNER_SIZE, y: MARGIN, w: CORNER_SIZE, h: CORNER_SIZE };
  const card: Rect = { x: MARGIN, y: MARGIN, w: width - 2 * MARGIN, h: height - 2 * MARGIN };
  const nextButton: Rect = {
    x: width / 2 - NEXT_WIDTH / 2,
    y: card.y + card.h - CARD_PADDING - NEXT_HEIGHT,
    w: NEXT_WIDTH,
    h: NEXT_HEIGHT,
  };
  const closeButton: Rect = {
    x: width / 2 - CLOSE_WIDTH / 2,
    y: card.y + card.h - CARD_PADDING - CLOSE_HEIGHT,
    w: CLOSE_WIDTH,
    h: CLOSE_HEIGHT,
  };
  return {
    width,
    height,
    safeZoneLeft,
    safeZoneRight: SAFE_ZONE_RIGHT,
    play,
    clockButton,
    corner: { ...clockButton },
    card,
    nextButton,
    closeButton,
  };
}
