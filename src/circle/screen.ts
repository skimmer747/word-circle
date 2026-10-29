import { GAME_TITLES, type FrameHost, type GameScreen, type GameSummary, type GameTargets } from '../frame/games';
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
import { PlayTimer } from '../shared/timer';
import { circleRecord } from '../stats/records';
import { LEVELS, type Level, type PuzzleSet } from './types';
import { View, type RowState } from './view';

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
  /** True while the hint star flies; Hint taps are ignored until it lands. */
  private hintFlying = false;
  /** The letter the hint star is flying to: hidden until it lands. */
  private hiddenHint: { word: string; index: number } | null = null;
  /** True while Word Circle is on screen (between resume and pause). */
  private shown = false;
  /** Traced words still flying to their rows. */
  private wordsFlying = 0;
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
      reviewButton: layout.reviewButton,
    };
  }

  buttonTapped(id: string): void {
    if (id === 'shuffle') this.shuffle();
    else if (id === 'hint') void this.hint();
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

  /** For the frame's help bubble after a quiet minute. */
  help(): string | null {
    return this.busy || this.hintFlying ? null : 'Make words from these letters.';
  }

  setHintPulse(on: boolean): void {
    this.view?.setHintPulse(on);
  }

  /** Play time stops while she's away. */
  pause(): void {
    this.shown = false;
    this.timer.pause();
    this.save();
  }

  resume(): void {
    this.shown = true;
    this.timer.resume(performance.now());
    // A puzzle completed while something flew, just before she switched away, is celebrated when she's back.
    this.finishIfComplete();
  }

  summary(): GameSummary {
    return { solved: this.saved.stats.totalSolved, bestMs: this.saved.stats.bestMs };
  }

  /** Switches to a level's saved place (or its first puzzle). */
  private openLevel(level: Level): void {
    this.level = level;
    const list = this.puzzles[level];
    this.loadPuzzle(skipAvoided(list, resolveStart(list, this.saved.levels[level]), this.avoided));
  }

  private loadPuzzle(start: StartPoint): void {
    this.hiddenHint = null;
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
    if (this.busy || this.host.isTracing || this.hintFlying || level === this.level) return;
    this.openLevel(level);
    this.host.redraw(true);
    // A level saved complete but never celebrated (e.g. the app closed mid-flight) is celebrated now.
    this.finishIfComplete();
  }

  private rowStates(): RowState[] {
    return this.game.puzzle.words.map((word) => this.rowState(word));
  }

  private rowState(word: string): RowState {
    const revealed = this.game.revealedIndices(word);
    if (this.hiddenHint?.word === word) {
      const hidden = this.hiddenHint.index;
      return { found: false, revealed: revealed.filter((i) => i !== hidden) };
    }
    return { found: this.game.isFound(word), revealed };
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
        const game = this.game;
        this.wordsFlying++;
        try {
          await this.view.flyToRow(row);
        } finally {
          this.wordsFlying--;
        }
        // The puzzle moved on (a level switch, or the hint star finished it) while the word flew: nothing to draw.
        // If the new puzzle was saved complete, it's celebrated now.
        if (this.game !== game) {
          this.finishIfComplete();
          return;
        }
        this.view.setRow(row, this.rowState(result.word));
        this.afterWordFound();
        return;
      case 'alreadyFound':
        this.view.hideBar();
        if (this.hiddenHint?.word !== result.word) this.view.pulseRow(row);
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

  private afterWordFound(): void {
    if (this.game.isComplete()) this.finishIfComplete();
    else void this.view.showMessage('Good!', 'circle', GOOD_MS);
  }

  /** A complete puzzle gets its "Well done!" once nothing is flying to the board and she's on Word Circle. */
  private finishIfComplete(): void {
    if (!this.game.isComplete() || !this.view || !this.shown || this.busy || this.hintFlying || this.wordsFlying > 0) return;
    void this.finishPuzzle();
  }

  private async finishPuzzle(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.view.showSelection([]);
    this.timer.activity(performance.now());
    const { stats, celebration } = recordSolve(this.saved.stats, this.level, this.timer.elapsedMs, dayKey(new Date()));
    this.saved.stats = stats;
    this.host.logPlay(
      circleRecord({
        words: this.game.puzzle.words,
        extras: this.game.foundBonus(),
        revealed: this.game.revealedRecord(),
        level: this.level,
        ms: this.timer.elapsedMs,
        now: new Date(),
      }),
    );
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
  }

  private async hint(): Promise<void> {
    // One star at a time, so a double tap doesn't use two hints.
    if (this.busy || this.host.isTracing || this.hintFlying) return;
    const result = this.game.hint();
    if (!result) return;
    this.save();
    const row = this.game.puzzle.words.indexOf(result.word);
    this.hintFlying = true;
    this.hiddenHint = { word: result.word, index: result.index };
    this.view.setRow(row, this.rowState(result.word));
    try {
      await this.view.flyStar(row, result.index);
    } finally {
      this.hintFlying = false;
    }
    // If she switched level while the star flew, that puzzle is gone from the screen.
    const landed = this.hiddenHint?.word === result.word;
    if (landed) {
      this.hiddenHint = null;
      this.view.setRow(row, this.rowState(result.word));
      this.view.landSlot(row, result.index);
    }
    // A puzzle completed during the flight gets its "Well done!" now if nothing else is flying and she's here; otherwise the last flight, or resume(), does it.
    if (this.game.isComplete()) this.finishIfComplete();
    else if (landed && result.completedWord) void this.view.showMessage('Good!', 'circle', GOOD_MS);
  }

  private shuffle(): void {
    if (this.busy || this.host.isTracing) return;
    this.ringOrder = shuffleRing(this.ringOrder, this.game.puzzle.letters, Math.random);
    this.view.setRingOrder(this.ringOrder);
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
