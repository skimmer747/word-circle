import { GAME_TITLES, type FrameHost, type GameScreen, type GameTargets } from '../frame/games';
import type { FrameLayout } from '../frame/layout';
import type { KeyValueStore } from '../shared/store';
import { circleLines } from './celebration';
import { computeLayout, type Layout } from './layout';
import { identityOrder, shuffleRing } from './ring';
import { Game } from './state';
import { NOTHING_AVOIDED, type AvoidCheck } from '../shared/avoid';
import { dayKey } from '../shared/days';
import { emptyStats, recordSolve } from './stats';
import {
  loadSavedGame,
  nextIndex,
  resolveStart,
  saveSavedGame,
  skipAvoided,
  withoutAvoidedBonus,
  type SavedGame,
  type StartPoint,
} from './storage';
import { PlayTimer } from './timer';
import { LEVELS, type Level, type PuzzleSet } from './types';
import { View, type RowState } from './view';

const IDLE_HINT_MS = 120_000;
const GOOD_MS = 1200;
/** The celebration moves on by itself after this long if she doesn't tap Next puzzle. */
const CELEBRATION_MS = 15_000;

export interface CircleOptions {
  /** Her level the very first time (default Medium). */
  startLevel?: Level;
  /** Words she should never see: puzzles with one are skipped, and they never count as extra words. */
  avoided?: AvoidCheck;
}

/** Word Circle: slide across a circle of letters to fill the word slots. */
export class CircleScreen implements GameScreen {
  readonly id = 'circle';
  readonly title = GAME_TITLES.circle;
  /** True from finishing a puzzle until the next one is on screen. */
  busy = false;
  private host!: FrameHost;
  private saved: SavedGame = { level: 'medium', levels: {}, stats: emptyStats() };
  private level: Level = 'medium';
  private index = 0;
  private game!: Game;
  private timer = new PlayTimer();
  private ringOrder: number[] = [];
  private idleTimer = 0;
  private layout: Layout | null = null;
  /** Created on the first render; taps and words can only arrive after that. */
  private view!: View;

  private readonly startLevel: Level;
  private readonly avoided: AvoidCheck;

  constructor(
    private readonly puzzles: PuzzleSet,
    private readonly store: KeyValueStore,
    options: CircleOptions = {},
  ) {
    this.startLevel = options.startLevel ?? 'medium';
    this.avoided = options.avoided ?? NOTHING_AVOIDED;
  }

  start(host: FrameHost): void {
    this.host = host;
    this.saved = loadSavedGame(this.store, this.startLevel);
    this.openLevel(this.saved.level);
  }

  render(layer: HTMLElement, frame: FrameLayout, animateIn: boolean): GameTargets {
    if (!this.view) this.view = new View(layer);
    const { puzzle } = this.game;
    const layout = computeLayout(frame, {
      letterCount: puzzle.letters.length,
      wordLengths: puzzle.words.map((w) => w.length),
    });
    this.layout = layout;
    this.view.render(
      puzzle,
      layout,
      { ringOrder: this.ringOrder, rows: this.rowStates(), extras: this.game.foundBonus(), level: this.level },
      animateIn,
    );
    return {
      tiles: layout.tiles,
      buttons: [
        { id: 'shuffle', ...layout.shuffleButton },
        { id: 'hint', ...layout.hintButton },
        ...LEVELS.map((level, i) => ({ id: `level:${level}`, ...layout.levels[i] })),
      ],
    };
  }

  buttonTapped(id: string): void {
    if (id === 'shuffle') this.shuffle();
    else if (id === 'hint') this.hint();
    else if (id.startsWith('level:')) this.chooseLevel(id.slice('level:'.length) as Level);
  }

  letterAdded(): void {
    this.showSelection();
  }

  letterRemoved(): void {
    this.showSelection();
  }

  selectionCleared(): void {
    this.view.showSelection([]);
  }

  wordSubmitted(tiles: readonly number[]): void {
    void this.submit(tiles);
  }

  activity(): void {
    this.timer.activity(performance.now());
  }

  /** Play time stops while she's away. */
  pause(): void {
    this.timer.pause();
    window.clearTimeout(this.idleTimer);
    this.view?.setHintPulse(false);
    this.save();
  }

  resume(): void {
    this.timer.resume(performance.now());
    if (!this.busy) this.resetIdle();
  }

  /** Switches to a level's saved place (or its first puzzle). */
  private openLevel(level: Level): void {
    this.level = level;
    const list = this.puzzles[level];
    this.loadPuzzle(skipAvoided(list, resolveStart(list, this.saved.levels[level]), this.avoided));
  }

  private loadPuzzle(start: StartPoint): void {
    this.index = start.index;
    this.game = new Game(
      withoutAvoidedBonus(this.puzzles[this.level][start.index], this.avoided),
      start.found,
      start.revealed,
      start.bonusFound,
    );
    this.ringOrder = identityOrder(this.game.puzzle.letters.length);
    this.timer = new PlayTimer(start.elapsedMs);
    if (document.hidden) this.timer.pause();
    else this.timer.activity(performance.now());
    this.save();
  }

  /** Each level keeps its own place, so switching never loses anything. */
  private chooseLevel(level: Level): void {
    if (this.busy || this.host.isTracing || level === this.level) return;
    this.openLevel(level);
    this.host.redraw(true);
    this.resetIdle();
  }

  private rowStates(): RowState[] {
    return this.game.puzzle.words.map((word) => this.rowState(word));
  }

  private rowState(word: string): RowState {
    return { found: this.game.isFound(word), revealed: this.game.revealedIndices(word) };
  }

  private showSelection(): void {
    this.view.hideMessage();
    this.view.showSelection(this.host.selection);
  }

  private async submit(tiles: readonly number[]): Promise<void> {
    const { puzzle } = this.game;
    const word = tiles.map((tile) => puzzle.letters[this.ringOrder[tile]]).join('');
    this.view.releaseTiles();
    const result = this.game.tryWord(word);
    const row = puzzle.words.indexOf(result.word);
    switch (result.kind) {
      case 'answer':
        this.save();
        this.resetIdle();
        await this.view.flyToRow(row);
        this.view.setRow(row, this.rowState(result.word));
        await this.afterWordFound();
        return;
      case 'alreadyFound':
        this.view.hideBar();
        this.view.pulseRow(row);
        return;
      case 'bonus':
        this.save();
        this.view.barMessage('Good word!');
        this.view.setExtras(this.game.foundBonus(), result.word);
        return;
      case 'bonusAgain':
        this.view.hideBar();
        if (!this.view.pulseExtra(result.word)) this.view.barMessage('Good word!');
        return;
      case 'notAWord':
        this.view.wiggleBar();
        return;
      case 'tooShort':
        this.view.hideBar();
        return;
    }
  }

  private async afterWordFound(): Promise<void> {
    if (this.game.isComplete()) await this.finishPuzzle();
    else void this.view.showMessage('Good!', 'circle', GOOD_MS);
  }

  private async finishPuzzle(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.view.showSelection([]);
    window.clearTimeout(this.idleTimer);
    this.view.setHintPulse(false);
    this.timer.activity(performance.now());
    const { stats, celebration } = recordSolve(this.saved.stats, this.level, this.timer.elapsedMs, dayKey(new Date()));
    this.saved.stats = stats;
    // Save the next puzzle as her place now, so closing the app mid-celebration loses nothing.
    this.loadPuzzle(
      skipAvoided(
        this.puzzles[this.level],
        { index: nextIndex(this.index, this.puzzles[this.level].length), found: [], revealed: {}, bonusFound: [], elapsedMs: 0 },
        this.avoided,
      ),
    );
    this.timer.pause();
    // Days in a row count puzzles and words in either game.
    const streakDays = this.host.recordPlayDay();
    await this.host.celebrate({
      lines: circleLines({ ...celebration, streakDays }),
      nextLabel: 'Next puzzle',
      timeoutMs: CELEBRATION_MS,
    });
    this.timer.resume(performance.now());
    this.busy = false;
    this.host.redraw(true);
    this.resetIdle();
  }

  private hint(): void {
    if (this.busy || this.host.isTracing) return;
    const result = this.game.hint();
    if (!result) return;
    this.save();
    this.resetIdle();
    const row = this.game.puzzle.words.indexOf(result.word);
    this.view.setRow(row, this.rowState(result.word));
    if (result.completedWord) void this.afterWordFound();
  }

  private shuffle(): void {
    if (this.busy || this.host.isTracing) return;
    this.ringOrder = shuffleRing(this.ringOrder, this.game.puzzle.letters, Math.random);
    this.view.setRingOrder(this.ringOrder);
  }

  private resetIdle(): void {
    window.clearTimeout(this.idleTimer);
    this.view?.setHintPulse(false);
    this.idleTimer = window.setTimeout(() => this.view?.setHintPulse(true), IDLE_HINT_MS);
  }

  private save(): void {
    this.saved.level = this.level;
    this.saved.levels[this.level] = {
      puzzleIndex: this.index,
      puzzleId: this.game.puzzle.id,
      found: this.game.foundWords(),
      revealed: this.game.revealedRecord(),
      bonusFound: this.game.foundBonus(),
      elapsedMs: this.timer.elapsedMs,
    };
    saveSavedGame(this.store, this.saved);
  }
}
