/** Every safe zone is at least about an inch wide... */
export const SAFE_ZONE_MIN = 130;
/** ...and the side a thumb rests on grows to about 1.5 inches where there's room. */
export const SAFE_ZONE_THUMB = 200;

/** Which side a thumb rests on while she plays (set on the settings page). */
export const THUMBS = ['left', 'right', 'none'] as const;
export type Thumb = (typeof THUMBS)[number];
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
/** The card's Back to puzzle and Your stats buttons sit in a smaller row above Next. */
const BACK_WIDTH = 340;
const CARD_STATS_WIDTH = 260;
const SMALL_HEIGHT = 84;
const ROW_GAP = 16;
const GAME_CARD_MAX_WIDTH = 360;
const GAME_CARD_GAP = 24;
/** Every game's Hint button sits in the top-left corner of the play area, at this size... */
const HINT_WIDTH = 130;
const HINT_HEIGHT = 96;
/** The help bubble under Hint: two lines of 28 px with room for its padding, and the gap its arrow points through. */
const HELP_WIDTH = 460;
const HELP_HEIGHT = 120;
const HELP_GAP = 18;
/** ...and every game with levels has Easy, Medium and Hard in a row at the bottom left. Three fit beside Word
 * Circle's letter circle on the narrowest iPad. */
const LEVEL_WIDTH = 100;
const LEVEL_HEIGHT = 64;
const LEVEL_GAP = 8;
const LEVEL_COUNT = 3;
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
  /** Hint, in the same place in every game. */
  hintButton: Rect;
  /** The help bubble that points up at Hint after a quiet minute, in the same place in every game. */
  helpBubble: Rect;
  /** Easy, Medium and Hard, in the same place in every game that has levels. */
  levelButtons: Rect[];
  /** The "Well done!" card and the pop-ups fill almost the whole screen so their text can be as big as possible. */
  card: Rect;
  /** A card's single button (Next puzzle). */
  nextButton: Rect;
  /** A card's Share and Next word buttons, side by side. */
  shareButton: Rect;
  nextWordButton: Rect;
  /** The card's Back to puzzle and Your stats buttons, side by side above Next. */
  backButton: Rect;
  cardStatsButton: Rect;
  /** The pop-ups' Close button. */
  closeButton: Rect;
  /** One big card per game in the Games pop-up. */
  gameCards: Rect[];
}

export function computeFrameLayout(width: number, height: number, gameCount = 2, thumb: Thumb = 'left'): FrameLayout {
  const wide = Math.min(SAFE_ZONE_THUMB, Math.max(SAFE_ZONE_MIN, width - SAFE_ZONE_MIN - MIN_PLAY_WIDTH));
  const safeZoneLeft = thumb === 'left' ? wide : SAFE_ZONE_MIN;
  const safeZoneRight = thumb === 'right' ? wide : SAFE_ZONE_MIN;
  const play: Rect = {
    x: safeZoneLeft + MARGIN,
    y: MARGIN,
    w: width - safeZoneLeft - safeZoneRight - 2 * MARGIN,
    h: height - 2 * MARGIN,
  };
  const clockButton: Rect = { x: play.x + play.w - CORNER_SIZE, y: MARGIN, w: CORNER_SIZE, h: CORNER_SIZE };
  const gamesButton: Rect = { x: clockButton.x - CORNER_GAP - CORNER_SIZE, y: MARGIN, w: CORNER_SIZE, h: CORNER_SIZE };
  const corner: Rect = { x: gamesButton.x, y: MARGIN, w: clockButton.x + clockButton.w - gamesButton.x, h: CORNER_SIZE };
  const hintButton: Rect = { x: play.x, y: play.y, w: HINT_WIDTH, h: HINT_HEIGHT };
  const helpBubble: Rect = { x: play.x, y: hintButton.y + hintButton.h + HELP_GAP, w: Math.min(HELP_WIDTH, play.w), h: HELP_HEIGHT };
  const levelButtons: Rect[] = Array.from({ length: LEVEL_COUNT }, (_, i) => ({
    x: play.x + i * (LEVEL_WIDTH + LEVEL_GAP),
    y: play.y + play.h - LEVEL_HEIGHT,
    w: LEVEL_WIDTH,
    h: LEVEL_HEIGHT,
  }));
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
  const smallLeft = playCenter - (BACK_WIDTH + PAIR_GAP + CARD_STATS_WIDTH) / 2;
  const smallY = nextButton.y - ROW_GAP - SMALL_HEIGHT;
  const backButton: Rect = { x: smallLeft, y: smallY, w: BACK_WIDTH, h: SMALL_HEIGHT };
  const cardStatsButton: Rect = { x: smallLeft + BACK_WIDTH + PAIR_GAP, y: smallY, w: CARD_STATS_WIDTH, h: SMALL_HEIGHT };
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
    safeZoneRight,
    play,
    gamesButton,
    clockButton,
    corner,
    hintButton,
    helpBubble,
    levelButtons,
    card,
    nextButton,
    shareButton,
    nextWordButton,
    backButton,
    cardStatsButton,
    closeButton,
    gameCards,
  };
}

/**
 * Where Next goes while she looks back at a finished puzzle: as big as the card's Next button, centered over `area`
 * (the part of the game she no longer needs, like the letters she played with), and no bigger than it.
 */
export function reviewButtonIn(area: Rect): Rect {
  const w = Math.min(NEXT_WIDTH, area.w);
  const h = Math.min(NEXT_HEIGHT, area.h);
  return { x: area.x + (area.w - w) / 2, y: area.y + (area.h - h) / 2, w, h };
}
