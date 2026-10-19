import { clockFace, upcomingLines } from './clock/clock';
import { cachedSchedule, refreshSchedule } from './clock/loader';
import type { ScheduledEvent } from './clock/schedule';
import { Game } from './game/state';
import { dayKey, emptyStats, recordSolve, type Celebration } from './game/stats';
import { PlayTimer } from './game/timer';
import {
  loadSavedGame,
  nextIndex,
  resolveStart,
  saveSavedGame,
  type KeyValueStore,
  type SavedGame,
  type StartPoint,
} from './game/storage';
import { LEVELS, type Level, type PuzzleSet } from './game/types';
import { LetterTracer, type PointerInput } from './input/touch';
import { computeLayout, type Layout } from './ui/layout';
import { identityOrder, shuffleRing } from './ui/ring';
import { View, type RowState } from './ui/view';

const IDLE_HINT_MS = 120_000;
const GOOD_MS = 1200;
/** The celebration moves on by itself after this long if she doesn't tap Next puzzle. */
const CELEBRATION_MS = 15_000;
/** The clock pop-up closes by itself after this long. */
const CLOCK_OPEN_MS = 60_000;
/** With the clock's very large text, three events fit on every iPad. */
const CLOCK_MAX_EVENTS = 3;
/** How often to check the online schedule for changes. */
const SCHEDULE_REFRESH_MS = 5 * 60_000;

export interface Updates {
  /** Applies a waiting update (reloading the page). Returns true if it did. */
  applyIfPending(): boolean;
}

export class App {
  /** True once she has touched the screen in this session. */
  interacted = false;
  private saved: SavedGame = { level: 'medium', levels: {}, stats: emptyStats() };
  private level: Level = 'medium';
  private index = 0;
  private game!: Game;
  private timer = new PlayTimer();
  private ringOrder: number[] = [];
  private busy = false;
  private idleTimer = 0;
  private layout: Layout | null = null;
  /** Set while the celebration card is up; calling it moves on to the next puzzle. */
  private endCelebration: (() => void) | null = null;
  private schedule: ScheduledEvent[] = [];
  private clockOpen = false;
  private clockTick = 0;
  private clockAutoClose = 0;
  private readonly view: View;
  private readonly tracer: LetterTracer;

  constructor(
    root: HTMLElement,
    private readonly puzzles: PuzzleSet,
    private readonly store: KeyValueStore,
    private readonly updates: Updates,
  ) {
    this.view = new View(root);
    this.tracer = new LetterTracer({
      letterAdded: () => this.showSelection(),
      letterRemoved: () => this.showSelection(),
      selectionCleared: () => this.view.showSelection([]),
      wordSubmitted: (tiles) => void this.submit(tiles),
      buttonTapped: (id) => this.buttonTapped(id),
    });
  }

  private buttonTapped(id: string): void {
    if (id === 'next') this.endCelebration?.();
    else if (id === 'clock') this.openClock();
    else if (id === 'close') this.closeClock();
    else if (id === 'shuffle') this.shuffle();
    else if (id === 'hint') this.hint();
    else if (id.startsWith('level:')) this.chooseLevel(id.slice('level:'.length) as Level);
  }

  start(): void {
    this.saved = loadSavedGame(this.store);
    this.schedule = cachedSchedule(this.store);
    this.openLevel(this.saved.level);
    this.relayout(false);
    this.listen();
    this.resetIdle();
    void this.refreshSchedule();
    window.setInterval(() => {
      if (!document.hidden) void this.refreshSchedule();
    }, SCHEDULE_REFRESH_MS);
  }

  /** Picks up changes to the online schedule; keeps the last copy when offline. */
  private async refreshSchedule(): Promise<void> {
    const url = `${import.meta.env.BASE_URL}schedule.txt?v=${Date.now()}`;
    const events = await refreshSchedule(async () => {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Schedule not available (${response.status})`);
      return response.text();
    }, this.store);
    if (!events) return;
    this.schedule = events;
    if (this.clockOpen) this.updateClock();
  }

  private openClock(): void {
    if (this.busy || this.tracer.isTracing || this.clockOpen || !this.layout) return;
    this.clockOpen = true;
    this.view.showClock(clockFace(new Date()), upcomingLines(this.schedule, new Date(), CLOCK_MAX_EVENTS), this.layout);
    this.clockTick = window.setInterval(() => this.updateClock(), 1000);
    this.clockAutoClose = window.setTimeout(() => this.closeClock(), CLOCK_OPEN_MS);
    this.updateTouchTargets();
    void this.refreshSchedule();
  }

  private updateClock(): void {
    const now = new Date();
    this.view.updateClock(clockFace(now), upcomingLines(this.schedule, now, CLOCK_MAX_EVENTS));
  }

  private closeClock(): void {
    if (!this.clockOpen) return;
    window.clearInterval(this.clockTick);
    window.clearTimeout(this.clockAutoClose);
    this.clockOpen = false;
    this.view.hideClock();
    this.updateTouchTargets();
  }

  /** Switches to a level's saved place (or its first puzzle). */
  private openLevel(level: Level): void {
    this.level = level;
    this.loadPuzzle(resolveStart(this.puzzles[level], this.saved.levels[level]));
  }

  private loadPuzzle(start: StartPoint): void {
    this.index = start.index;
    this.game = new Game(this.puzzles[this.level][start.index], start.found, start.revealed, start.bonusFound);
    this.ringOrder = identityOrder(this.game.puzzle.letters.length);
    this.timer = new PlayTimer(start.elapsedMs);
    if (document.hidden) this.timer.pause();
    else this.timer.activity(performance.now());
    this.save();
  }

  /** Each level keeps its own place, so switching never loses anything. */
  private chooseLevel(level: Level): void {
    if (this.busy || this.tracer.isTracing || level === this.level) return;
    this.openLevel(level);
    this.relayout(true);
    this.resetIdle();
  }

  private listen(): void {
    const forward = (type: PointerInput['type']) => (event: PointerEvent) => {
      if (type === 'down') this.interacted = true;
      if (type !== 'move') this.timer.activity(performance.now());
      this.tracer.handle({ type, id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp });
    };
    window.addEventListener('pointerdown', forward('down'));
    window.addEventListener('pointermove', forward('move'));
    window.addEventListener('pointerup', forward('up'));
    window.addEventListener('pointercancel', forward('cancel'));

    const block = (event: Event) => event.preventDefault();
    document.addEventListener('touchmove', block, { passive: false });
    document.addEventListener('gesturestart', block);
    document.addEventListener('contextmenu', block);
    document.addEventListener('dblclick', block);

    // Play time stops while the iPad sleeps or the app is closed.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.timer.pause();
        this.save();
      } else {
        this.timer.resume(performance.now());
        void this.refreshSchedule();
      }
    });

    let frame = 0;
    window.addEventListener('resize', () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => this.relayout(false));
    });
  }

  private relayout(animateIn: boolean): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const portrait = height > width;
    this.view.showRotate(portrait);
    if (portrait) {
      this.tracer.setEnabled(false);
      return;
    }
    const { puzzle } = this.game;
    const layout = computeLayout({
      width,
      height,
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
    this.updateTouchTargets();
  }

  /**
   * What the touch tracer listens for: only Next puzzle while celebrating, only Close while the clock is open,
   * otherwise the game.
   */
  private updateTouchTargets(): void {
    const layout = this.layout;
    if (!layout) return;
    const celebrating = this.endCelebration !== null;
    const popup = celebrating || this.clockOpen;
    let buttons;
    if (celebrating) buttons = [{ id: 'next', ...layout.nextButton }];
    else if (this.clockOpen) buttons = [{ id: 'close', ...layout.closeButton }];
    else
      buttons = [
        { id: 'shuffle', ...layout.shuffleButton },
        { id: 'hint', ...layout.hintButton },
        { id: 'clock', ...layout.clockButton },
        ...LEVELS.map((level, i) => ({ id: `level:${level}`, ...layout.levels[i] })),
      ];
    this.tracer.setGeometry({
      screenWidth: layout.width,
      safeZoneLeft: layout.safeZoneLeft,
      safeZoneRight: layout.safeZoneRight,
      tiles: popup ? [] : layout.tiles,
      buttons,
    });
    if (celebrating) this.view.placeCelebration(layout);
    if (this.clockOpen) this.view.placeClock(layout);
    this.tracer.setEnabled(popup || !this.busy);
  }

  private rowStates(): RowState[] {
    return this.game.puzzle.words.map((word) => this.rowState(word));
  }

  private rowState(word: string): RowState {
    return { found: this.game.isFound(word), revealed: this.game.revealedIndices(word) };
  }

  private showSelection(): void {
    this.view.hideMessage();
    this.view.showSelection(this.tracer.selection);
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
    this.tracer.setEnabled(false);
    this.view.showSelection([]);
    window.clearTimeout(this.idleTimer);
    this.view.setHintPulse(false);
    this.timer.activity(performance.now());
    const { stats, celebration } = recordSolve(this.saved.stats, this.level, this.timer.elapsedMs, dayKey(new Date()));
    this.saved.stats = stats;
    // Save the next puzzle as her place now, so closing the app mid-celebration loses nothing.
    this.loadPuzzle({
      index: nextIndex(this.index, this.puzzles[this.level].length),
      found: [],
      revealed: {},
      bonusFound: [],
      elapsedMs: 0,
    });
    this.timer.pause();
    await this.celebrate(celebration);
    this.timer.resume(performance.now());
    if (this.updates.applyIfPending()) return; // the reload opens the new puzzle
    this.busy = false;
    this.relayout(true);
    this.resetIdle();
  }

  /** Shows the celebration until she taps Next puzzle, or for 15 seconds. */
  private celebrate(celebration: Celebration): Promise<void> {
    return new Promise((resolve) => {
      const done = () => {
        window.clearTimeout(timeout);
        this.endCelebration = null;
        this.view.hideCelebration();
        resolve();
      };
      const timeout = window.setTimeout(done, CELEBRATION_MS);
      this.endCelebration = done;
      if (this.layout) this.view.showCelebration(celebration, this.layout);
      this.updateTouchTargets();
    });
  }

  private hint(): void {
    if (this.busy || this.tracer.isTracing) return;
    const result = this.game.hint();
    if (!result) return;
    this.save();
    this.resetIdle();
    const row = this.game.puzzle.words.indexOf(result.word);
    this.view.setRow(row, this.rowState(result.word));
    if (result.completedWord) void this.afterWordFound();
  }

  private shuffle(): void {
    if (this.busy || this.tracer.isTracing) return;
    this.ringOrder = shuffleRing(this.ringOrder, this.game.puzzle.letters, Math.random);
    this.view.setRingOrder(this.ringOrder);
  }

  private resetIdle(): void {
    window.clearTimeout(this.idleTimer);
    this.view.setHintPulse(false);
    this.idleTimer = window.setTimeout(() => this.view.setHintPulse(true), IDLE_HINT_MS);
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
