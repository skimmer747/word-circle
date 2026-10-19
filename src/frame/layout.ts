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
/** Space between the Games and Clock buttons. */
const CORNER_GAP = 12;
const NEXT_WIDTH = 420;
const NEXT_HEIGHT = 100;
const CARD_PADDING = 24;
const CLOSE_WIDTH = 360;
const CLOSE_HEIGHT = 100;
const SHARE_WIDTH = 290;
const NEXT_WORD_WIDTH = 400;
const PAIR_GAP = 24;
const GAME_CARD_MAX_WIDTH = 360;
const GAME_CARD_GAP = 24;
/** The Games pop-up's cards start below its title... */
const GAME_CARDS_TOP = 0.2;
/** ...and take this share of the card's height. */
const GAME_CARDS_HEIGHT = 0.56;

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
  gamesButton: Rect;
  clockButton: Rect;
  /** Everything in the top-right corner; games keep clear of it. */
  corner: Rect;
  /** The "Well done!" card and the pop-ups fill almost the whole screen so their text can be as big as possible. */
  card: Rect;
  /** A card's single button (Next puzzle). */
  nextButton: Rect;
  /** A card's Share and Next word buttons, side by side. */
  shareButton: Rect;
  nextWordButton: Rect;
  /** The pop-ups' Close button. */
  closeButton: Rect;
  /** One big card per game in the Games pop-up. */
  gameCards: Rect[];
}

export function computeFrameLayout(width: number, height: number, gameCount = 2): FrameLayout {
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
  const gamesButton: Rect = { x: clockButton.x - CORNER_GAP - CORNER_SIZE, y: MARGIN, w: CORNER_SIZE, h: CORNER_SIZE };
  const corner: Rect = { x: gamesButton.x, y: MARGIN, w: clockButton.x + clockButton.w - gamesButton.x, h: CORNER_SIZE };
  const card: Rect = { x: MARGIN, y: MARGIN, w: width - 2 * MARGIN, h: height - 2 * MARGIN };
  const playCenter = play.x + play.w / 2;
  const nextButton: Rect = {
    x: width / 2 - NEXT_WIDTH / 2,
    y: card.y + card.h - CARD_PADDING - NEXT_HEIGHT,
    w: NEXT_WIDTH,
    h: NEXT_HEIGHT,
  };
  const pairLeft = playCenter - (SHARE_WIDTH + PAIR_GAP + NEXT_WORD_WIDTH) / 2;
  const shareButton: Rect = { x: pairLeft, y: nextButton.y, w: SHARE_WIDTH, h: NEXT_HEIGHT };
  const nextWordButton: Rect = { x: pairLeft + SHARE_WIDTH + PAIR_GAP, y: nextButton.y, w: NEXT_WORD_WIDTH, h: NEXT_HEIGHT };
  const closeButton: Rect = {
    x: width / 2 - CLOSE_WIDTH / 2,
    y: card.y + card.h - CARD_PADDING - CLOSE_HEIGHT,
    w: CLOSE_WIDTH,
    h: CLOSE_HEIGHT,
  };
  const cardWidth = Math.min(GAME_CARD_MAX_WIDTH, (play.w - (gameCount - 1) * GAME_CARD_GAP) / gameCount);
  const cardsLeft = playCenter - (gameCount * cardWidth + (gameCount - 1) * GAME_CARD_GAP) / 2;
  const gameCards: Rect[] = Array.from({ length: gameCount }, (_, i) => ({
    x: cardsLeft + i * (cardWidth + GAME_CARD_GAP),
    y: card.y + card.h * GAME_CARDS_TOP,
    w: cardWidth,
    h: card.h * GAME_CARDS_HEIGHT,
  }));
  return {
    width,
    height,
    safeZoneLeft,
    safeZoneRight: SAFE_ZONE_RIGHT,
    play,
    gamesButton,
    clockButton,
    corner,
    card,
    nextButton,
    shareButton,
    nextWordButton,
    closeButton,
    gameCards,
  };
}
