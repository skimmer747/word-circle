import type { ButtonGeometry, TileGeometry } from '../input/touch';
import type { FrameLayout, Rect } from './layout';
import type { PlayRecord } from '../stats/log';
import type { CelebrationCard, NoticeCard } from './view';

export const GAME_IDS = ['circle', 'guess', 'grid', 'jigsaw'] as const;
export type GameId = (typeof GAME_IDS)[number];

/** Each game's name, in the Games pop-up and on the settings page. */
export const GAME_TITLES: Record<GameId, string> = { circle: 'Word Circle', guess: 'Word Guess', grid: 'Word Grid', jigsaw: 'Jigsaw' };

/** What the touch tracker listens for in a game: its letter tiles (for tracing words) and its buttons. */
export interface GameTargets {
  tiles: TileGeometry[];
  buttons: ButtonGeometry[];
  /** Letters she can tap, or pick up and drag (Word Grid). */
  draggables?: ButtonGeometry[];
  /** Where Next goes while she looks back at the finished puzzle: over something she no longer needs. */
  reviewButton?: Rect;
}

/** A game's figures for her stats. */
export interface GameSummary {
  /** Puzzles or words she has finished, ever. */
  solved: number;
  /** Word Circle: her best time on each level. */
  bestMs?: Partial<Record<'easy' | 'medium' | 'hard', number>>;
}

/** What the frame lends the game on screen. */
export interface FrameHost {
  /** True while she's tracing a word through letter tiles. */
  readonly isTracing: boolean;
  /** The tiles traced so far. */
  readonly selection: readonly number[];
  /**
   * Shows the "Well done!" card until she taps its Next button or it moves on by itself. She can look back at the
   * finished puzzle first, so the game leaves it on screen (not redrawn) until this resolves.
   */
  celebrate(card: CelebrationCard): Promise<void>;
  /** Shows a card telling her something (e.g. why Hint does nothing) until she taps Close. */
  notice(card: NoticeCard): void;
  /** Redraws the game (and tells the touch tracker about its new targets). */
  redraw(animateIn: boolean): void;
  /** The game's buttons changed without a redraw (e.g. keys hidden): tells the touch tracker. */
  updateTargets(targets: GameTargets): void;
  /**
   * A page of the game's own covers the screen (one with a text box, which needs ordinary taps and the keyboard): the
   * touch tracker stops until the returned function is called.
   */
  cover(): () => void;
  /** Marks today as played (in either game) and returns her days in a row. */
  recordPlayDay(): number;
  /** Saves a finished puzzle or word to the play log. */
  logPlay(record: PlayRecord): void;
}

/**
 * A game the frame can show. Button ids "next", "share", "back", "card-stats", "clock", "close", "games",
 * "games-close", "games-stats", "stats", "stats-next", "stats-close", "notice-close" and "game:…" belong to the
 * frame.
 */
export interface GameScreen {
  readonly id: GameId;
  /** Its name in the Games pop-up. */
  readonly title: string;
  /** True while it's animating or celebrating: pop-ups and switching games wait. */
  readonly busy: boolean;
  /** Loads its saved progress. Called once, before the first render. */
  start(host: FrameHost): void;
  /** Draws itself into `layer` and returns what the touch tracker should listen for. */
  render(layer: HTMLElement, frame: FrameLayout, animateIn: boolean): GameTargets;
  buttonTapped(id: string): void;
  /** A finger came down on a button (for its pressed look)... */
  buttonPressed?(id: string): void;
  /** ...and lifted. */
  buttonReleased?(id: string): void;
  letterAdded?(): void;
  letterRemoved?(): void;
  selectionCleared?(): void;
  wordSubmitted?(tiles: readonly number[]): void;
  /** She picked up a draggable letter (or piece), her finger having first come down at x, y... */
  dragStarted?(id: string, x: number, y: number): void;
  /** ...moved it... */
  dragMoved?(id: string, x: number, y: number): void;
  /** ...and let go there. */
  dragEnded?(id: string, x: number, y: number): void;
  /** The drag was cancelled; put the letter back. */
  dragCancelled?(id: string): void;
  /** A finger touched down or lifted (for play time). */
  activity?(): void;
  /**
   * She tapped Back to puzzle and is looking at what she finished: the game may show buttons of its own beside Next
   * (Jigsaw's Cartoon) and returns where they are. It must change the screen itself, as a redraw ends the looking back.
   */
  reviewStarted?(): ButtonGeometry[];
  /** She left it: she picked another game, or the app went to the background. Save and stop timers. */
  pause(): void;
  /** She's back. */
  resume(): void;
  /** A line under its name in the Games pop-up, or null. */
  note?(): string | null;
  /** Its lifetime count (and Word Circle's best times), for her stats. */
  summary(): GameSummary;
}
