import type { ButtonGeometry, TileGeometry } from '../input/touch';
import type { FrameLayout } from './layout';
import type { CelebrationCard } from './view';

export const GAME_IDS = ['circle', 'guess', 'grid'] as const;
export type GameId = (typeof GAME_IDS)[number];

/** What the touch tracker listens for in a game: its letter tiles (for tracing words) and its buttons. */
export interface GameTargets {
  tiles: TileGeometry[];
  buttons: ButtonGeometry[];
  /** Letters she can tap, or pick up and drag (Word Grid). */
  draggables?: ButtonGeometry[];
}

/** What the frame lends the game on screen. */
export interface FrameHost {
  /** True while she's tracing a word through letter tiles. */
  readonly isTracing: boolean;
  /** The tiles traced so far. */
  readonly selection: readonly number[];
  /** Shows the "Well done!" card until she taps its Next button or it moves on by itself. */
  celebrate(card: CelebrationCard): Promise<void>;
  /** Redraws the game (and tells the touch tracker about its new targets). */
  redraw(animateIn: boolean): void;
  /** The game's buttons changed without a redraw (e.g. keys hidden): tells the touch tracker. */
  updateTargets(targets: GameTargets): void;
  /** Marks today as played (in either game) and returns her days in a row. */
  recordPlayDay(): number;
}

/**
 * A game the frame can show. Button ids "next", "share", "clock", "close", "games", "games-close" and
 * "game:…" belong to the frame.
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
  /** She picked up a draggable letter... */
  dragStarted?(id: string): void;
  /** ...moved it... */
  dragMoved?(id: string, x: number, y: number): void;
  /** ...and let go there. */
  dragEnded?(id: string, x: number, y: number): void;
  /** The drag was cancelled; put the letter back. */
  dragCancelled?(id: string): void;
  /** A finger touched down or lifted (for play time). */
  activity?(): void;
  /** She left it: she picked another game, or the app went to the background. Save and stop timers. */
  pause(): void;
  /** She's back. */
  resume(): void;
  /** A line under its name in the Games pop-up, or null. */
  note?(): string | null;
}
