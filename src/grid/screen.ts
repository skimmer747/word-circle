import { GAME_TITLES, type FrameHost, type GameScreen, type GameTargets } from '../frame/games';
import type { FrameLayout, Rect } from '../frame/layout';
import type { ButtonGeometry } from '../input/touch';
import { NOTHING_AVOIDED, type AvoidCheck } from '../shared/avoid';
import { dayKey } from '../shared/days';
import type { KeyValueStore } from '../shared/store';
import { gridLines } from './celebration';
import { computeGridLayout, trayTiles, type GridLayout } from './layout';
import { GridGame, type TrayLetter } from './rules';
import { loadSavedGrid, nextPuzzle, progressFor, recordGridSolve, saveSavedGrid, type SavedGrid } from './storage';
import { GRID_LEVELS, type GridLevel, type GridPuzzleSet, type GridWords } from './types';
import { GridView, type GridViewState } from './view';
import { wordChecker } from './words';

/** The Hint button starts to pulse after this long without a letter placed or moved. */
const IDLE_HINT_MS = 120_000;
/** The "Well done!" card moves on by itself after this long. */
const CELEBRATION_MS = 15_000;

/** The letter she's holding: one from the tray (by its place there) or one from a square. */
type Held = { from: 'tray'; index: number; letter: string } | { from: 'square'; square: number; letter: string };

const contains = (rect: Rect, x: number, y: number) => x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;

export interface GridOptions {
  /** Her level the very first time (default Easy). */
  startLevel?: GridLevel;
  /** Words she should never see: puzzles with one are skipped. */
  avoided?: AvoidCheck;
  /** The current time; tests can pass a fixed one. */
  now?: () => Date;
}

/** Word Grid: Knotwords in big print, with a tray of letters on top to tap or drag into place. */
export class GridScreen implements GameScreen {
  readonly id = 'grid';
  readonly title = GAME_TITLES.grid;
  /** True while the words are turning green or she's celebrating. */
  busy = false;
  private host!: FrameHost;
  private saved!: SavedGrid;
  private game!: GridGame;
  private selected = 0;
  private held: Held | null = null;
  private view: GridView | null = null;
  private layout: GridLayout | null = null;
  private idleTimer = 0;
  private readonly isWord: (word: string) => boolean;
  private readonly startLevel: GridLevel;
  private readonly avoided: AvoidCheck;
  private readonly now: () => Date;

  constructor(
    private readonly puzzles: GridPuzzleSet,
    words: GridWords,
    private readonly store: KeyValueStore,
    options: GridOptions = {},
  ) {
    this.isWord = wordChecker(words);
    this.startLevel = options.startLevel ?? 'easy';
    this.avoided = options.avoided ?? NOTHING_AVOIDED;
    this.now = options.now ?? (() => new Date());
  }

  start(host: FrameHost): void {
    this.host = host;
    this.saved = loadSavedGrid(this.store, this.startLevel);
    this.loadPuzzle();
    this.save();
  }

  render(layer: HTMLElement, frame: FrameLayout, animateIn: boolean): GameTargets {
    if (!this.view) this.view = new GridView(layer);
    this.held = null;
    this.layout = computeGridLayout(frame, this.game.shape.size);
    this.view.render(this.layout, this.viewState(), animateIn);
    return this.targets();
  }

  buttonTapped(id: string): void {
    if (this.busy) return;
    if (id === 'hint') this.hint();
    else if (id.startsWith('level:')) this.chooseLevel(id.slice('level:'.length) as GridLevel);
    else if (id.startsWith('square:')) this.select(Number(id.slice('square:'.length)));
    else if (id.startsWith('tray:')) this.tapTray(Number(id.slice('tray:'.length)));
  }

  buttonPressed(id: string): void {
    this.view?.setPressed(id, true);
  }

  buttonReleased(id: string): void {
    this.view?.setPressed(id, false);
  }

  /**
   * She picked up a letter. Its targets wait until she lets go: telling the touch tracker about new targets now
   * would cancel the drag.
   */
  dragStarted(id: string): void {
    if (this.busy || !this.view) return;
    if (id.startsWith('tray:')) {
      const index = Number(id.slice('tray:'.length));
      const tile = this.trayLetters()[index];
      if (!tile || tile.used) return;
      this.held = { from: 'tray', index, letter: tile.letter };
    } else if (id.startsWith('square:')) {
      const square = Number(id.slice('square:'.length));
      const letter = this.game.letterAt(square);
      if (!letter || this.game.isHinted(square)) return;
      // Picking up a letter selects its square, so the tray shows its section.
      this.selected = square;
      this.view.update(this.viewState());
      this.held = { from: 'square', square, letter };
    } else {
      return;
    }
    this.view.startDrag(this.held.letter, id);
  }

  dragMoved(_id: string, x: number, y: number): void {
    if (this.held) this.view?.moveDrag(x, y);
  }

  dragEnded(_id: string, x: number, y: number): void {
    const held = this.held;
    const layout = this.layout;
    this.held = null;
    if (!held || !layout || !this.view) return;
    const target = this.game.shape.squares.find((square) => contains(layout.squares[square], x, y)) ?? -1;
    const home = this.game.sectionOf(held.from === 'tray' ? this.selected : held.square);
    const inSection = target >= 0 && this.game.sectionOf(target) === home;
    if (held.from === 'tray') {
      if (inSection && this.game.place(target, held.letter)) return this.landed(target);
      // Anywhere else: back to its place in the tray.
      this.view.dropDrag(trayTiles(layout, this.trayLetters().length)[held.index]);
      return this.refresh();
    }
    if (inSection && target !== held.square && this.game.move(held.square, target)) return this.landed(target);
    if (inSection) {
      // Its own square, or a hinted one: it stays where it was.
      this.view.dropDrag(layout.squares[held.square]);
      return this.refresh();
    }
    // Off the grid, or onto another section: back to the tray.
    this.game.remove(held.square);
    this.view.dropDrag(this.trayRectFor(held.letter));
    this.changed();
  }

  /** The iPad cancelled the touch (or the screen changed): put the letter back. Targets are unchanged. */
  dragCancelled(): void {
    this.held = null;
    this.view?.dropDrag(null);
    this.view?.update(this.viewState());
  }

  pause(): void {
    window.clearTimeout(this.idleTimer);
    this.view?.setHintPulse(false);
    if (this.held) this.dragCancelled();
    this.save();
  }

  resume(): void {
    if (!this.busy) this.resetIdle();
  }

  private loadPuzzle(): void {
    const level = this.saved.level;
    const progress = progressFor(this.saved, this.puzzles, level, this.avoided);
    this.game = new GridGame(this.puzzles[level][progress.index], progress.placed, progress.hinted, this.isWord);
    this.saved = { ...this.saved, levels: { ...this.saved.levels, [level]: progress } };
    this.selected = this.game.firstEmpty();
  }

  private save(): void {
    const level = this.saved.level;
    const progress = progressFor(this.saved, this.puzzles, level, this.avoided);
    const current = { ...progress, placed: this.game.placed, hinted: this.game.hinted };
    this.saved = { ...this.saved, levels: { ...this.saved.levels, [level]: current } };
    saveSavedGrid(this.store, this.saved);
  }

  private trayLetters(): TrayLetter[] {
    return this.game.tray(this.game.sectionOf(this.selected));
  }

  /** Where a letter goes back to in the tray: a free tile with that letter. */
  private trayRectFor(letter: string): Rect | null {
    if (!this.layout) return null;
    const tray = this.trayLetters();
    const index = tray.findIndex((tile) => !tile.used && tile.letter === letter);
    return trayTiles(this.layout, tray.length)[Math.max(0, index)] ?? null;
  }

  private viewState(): GridViewState {
    const { shape } = this.game;
    return {
      level: this.saved.level,
      shape,
      letters: shape.open.map((_, square) => this.game.letterAt(square)),
      hinted: new Set(this.game.hinted),
      selected: this.selected,
      tray: this.trayLetters(),
      corners: shape.sections.map((_, section) => this.game.tray(section)),
      badRuns: this.game.badRuns().map((i) => shape.runs[i]),
    };
  }

  /** Placed letters can be picked up; empty and hinted squares can only be tapped (to select them). */
  private targets(): GameTargets {
    const layout = this.layout;
    if (!layout) return { tiles: [], buttons: [] };
    const buttons: ButtonGeometry[] = [
      ...GRID_LEVELS.map((level, i) => ({ id: `level:${level}`, ...layout.levels[i] })),
      { id: 'hint', ...layout.hintButton },
    ];
    const draggables: ButtonGeometry[] = [];
    for (const square of this.game.shape.squares) {
      const target = { id: `square:${square}`, ...layout.squares[square] };
      if (this.game.letterAt(square) && !this.game.isHinted(square)) draggables.push(target);
      else buttons.push(target);
    }
    const tray = this.trayLetters();
    trayTiles(layout, tray.length).forEach((rect, i) => {
      if (!tray[i].used) draggables.push({ id: `tray:${i}`, ...rect });
    });
    return { tiles: [], buttons, draggables };
  }

  /** Redraws the squares and tray and tells the touch tracker what can be touched now. */
  private refresh(): void {
    this.view?.update(this.viewState());
    this.host.updateTargets(this.targets());
  }

  /** A letter landed in `square` from a drag. */
  private landed(square: number): void {
    this.selected = square;
    this.view?.dropDrag(null);
    this.changed();
    this.view?.popSquare(square);
  }

  /** Something on the grid changed: save it, show it, and see if she's finished. */
  private changed(): void {
    this.save();
    this.resetIdle();
    this.refresh();
    if (this.game.solved) void this.finish();
  }

  private select(square: number): void {
    if (!this.game.isOpen(square)) return;
    this.selected = square;
    this.refresh();
  }

  private tapTray(index: number): void {
    const tile = this.trayLetters()[index];
    const square = this.selected;
    if (!tile || tile.used || !this.game.place(square, tile.letter)) return;
    this.selected = this.game.nextEmptyInSection(square) ?? square;
    this.changed();
    this.view?.popSquare(square);
  }

  private hint(): void {
    const square = this.game.hint(this.selected);
    if (square === null) return;
    this.selected = square;
    this.changed();
    this.view?.popSquare(square);
  }

  /** Each level keeps its own puzzle and letters, so switching never loses anything. */
  private chooseLevel(level: GridLevel): void {
    if (level === this.saved.level || !GRID_LEVELS.includes(level)) return;
    this.save();
    this.saved = { ...this.saved, level };
    this.loadPuzzle();
    this.save();
    this.host.redraw(true);
    this.resetIdle();
  }

  private async finish(): Promise<void> {
    this.busy = true;
    window.clearTimeout(this.idleTimer);
    this.view?.setHintPulse(false);
    await this.view?.finish(this.game.shape.runs);
    const hinted = this.game.hinted.length > 0;
    this.saved = { ...this.saved, stats: recordGridSolve(this.saved.stats, dayKey(this.now())) };
    const streakDays = this.host.recordPlayDay();
    // Save the next puzzle as her place now, so closing the app mid-celebration loses nothing.
    this.saved = nextPuzzle(this.saved, this.puzzles, this.saved.level, this.avoided);
    this.loadPuzzle();
    this.save();
    await this.host.celebrate({
      lines: gridLines({
        hinted,
        streakDays,
        todaySolved: this.saved.stats.todaySolved,
        puzzleNumber: this.saved.stats.totalSolved,
      }),
      nextLabel: 'Next puzzle',
      timeoutMs: CELEBRATION_MS,
    });
    this.busy = false;
    this.host.redraw(true);
    this.resetIdle();
  }

  private resetIdle(): void {
    window.clearTimeout(this.idleTimer);
    this.view?.setHintPulse(false);
    this.idleTimer = window.setTimeout(() => this.view?.setHintPulse(true), IDLE_HINT_MS);
  }
}
