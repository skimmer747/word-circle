import type { ButtonGeometry, TileGeometry } from '../input/touch';
import type { FrameLayout } from './layout';
import type { CelebrationCard } from './view';

export type GameId = 'circle';

/** What the touch tracker listens for in a game: its letter tiles (for tracing words) and its buttons. */
export interface GameTargets {
  tiles: TileGeometry[];
  buttons: ButtonGeometry[];
}

/** What the frame lends the game on screen. */
export interface FrameHost {
  /** True while she's tracing a word through letter tiles. */
  readonly isTracing: boolean;
  /** The tiles traced so far. */
  readonly selection: readonly number[];
  /** Shows the "Well done!" card until she taps its button or it moves on by itself. */
  celebrate(card: CelebrationCard): Promise<void>;
  /** Redraws the game (and tells the touch tracker about its new targets). */
  redraw(animateIn: boolean): void;
}

/** A game the frame can show. Button ids "next", "clock" and "close" belong to the frame. */
export interface GameScreen {
  readonly id: GameId;
  /** True while it's animating or celebrating: pop-ups wait. */
  readonly busy: boolean;
  /** Loads its saved progress. Called once, before the first render. */
  start(host: FrameHost): void;
  /** Draws itself into `layer` and returns what the touch tracker should listen for. */
  render(layer: HTMLElement, frame: FrameLayout, animateIn: boolean): GameTargets;
  buttonTapped(id: string): void;
  letterAdded?(): void;
  letterRemoved?(): void;
  selectionCleared?(): void;
  wordSubmitted?(tiles: readonly number[]): void;
  /** A finger touched down or lifted (for play time). */
  activity?(): void;
  /** She left it (the app went to the background): save and stop timers. */
  pause(): void;
  /** She's back. */
  resume(): void;
}
