import { GAME_TITLES, type FrameHost, type GameScreen, type GameSummary, type GameTargets } from '../frame/games';
import type { FrameLayout, Rect } from '../frame/layout';
import type { ButtonGeometry } from '../input/touch';
import { dayKey } from '../shared/days';
import type { KeyValueStore } from '../shared/store';
import { PlayTimer } from '../shared/timer';
import { jigsawRecord } from '../stats/records';
import { wait } from '../ui/dom';
import { jigsawLines } from './celebration';
import { cutPieces, pieceSeed, tabFor, type PieceShape } from './cut';
import { clampToFree, computeJigsawLayout, computePicturePageLayout, tablePieces, type JigsawLayout } from './layout';
import { renderPicturePage } from './picture-page';
import { picturePage } from './pictures';
import { JigsawGame } from './rules';
import {
  loadSavedJigsaw,
  placeFor,
  recordJigsawSolve,
  saveSavedJigsaw,
  withFinished,
  withPlace,
  withoutPlace,
  type SavedJigsaw,
} from './storage';
import { GRID_SIZES, JIGSAW_STYLES, PIECE_COUNTS, type JigsawStyle, type Picture, type PieceCount, type Point } from './types';
import { JigsawView, type JigsawViewState, type PieceSpot } from './view';

/** The Hint button starts to pulse after this long without a piece moved. */
const IDLE_HINT_MS = 120_000;
/** The "Well done!" card moves on by itself after this long. */
const CELEBRATION_MS = 15_000;
/** She sees the finished picture and its caption this long before "Well done!". */
const ADMIRE_MS = 2_500;

/** What she's holding: pieces that move together (a Table group), where they started, and where her finger is on the first. */
interface Held {
  id: number;
  ids: number[];
  starts: Rect[];
  /** Set on the first move. */
  grab: Point | null;
  fromTray: boolean;
}

export interface JigsawOptions {
  /** The pictures she can choose from. */
  loadPictures: () => Promise<Picture[]>;
  /** The current time; tests can pass a fixed one. */
  now?: () => Date;
}

const boundsOf = (rects: readonly Rect[]): Rect => {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  return { x, y, w: Math.max(...rects.map((r) => r.x + r.w)) - x, h: Math.max(...rects.map((r) => r.y + r.h)) - y };
};

const moved = (a: PieceSpot, b: PieceSpot) => a.where !== b.where || a.body.x !== b.body.x || a.body.y !== b.body.y;

/** Jigsaw: big-piece puzzles from pictures, played from a tray, on a board, or loose on a table. */
export class JigsawScreen implements GameScreen {
  readonly id = 'jigsaw';
  readonly title = GAME_TITLES.jigsaw;
  /** True while the picture is coming together or she's celebrating. */
  busy = false;
  private host!: FrameHost;
  private saved!: SavedJigsaw;
  private mode: 'pictures' | 'puzzle' = 'pictures';
  /** Null until the list has loaded. */
  private pictures: Picture[] | null = null;
  /** The picture in progress. */
  private picture: Picture | null = null;
  private page = 0;
  /** Made at the next render (Table pieces start where the layout has room). */
  private game: JigsawGame | null = null;
  private shapes: PieceShape[] = [];
  private readonly images = new Map<string, HTMLImageElement>();
  private held: Held | null = null;
  private lifted: number | null = null;
  private hintFlying = false;
  /** While the hint star flies, the pieces it moves are drawn where they were. */
  private frozen: Map<number, PieceSpot> | null = null;
  /** True while Jigsaw is on screen (between resume and pause). */
  private shown = false;
  private view: JigsawView | null = null;
  private layout: JigsawLayout | null = null;
  private idleTimer = 0;
  private timer = new PlayTimer();
  private readonly now: () => Date;

  constructor(
    private readonly store: KeyValueStore,
    private readonly options: JigsawOptions,
  ) {
    this.now = options.now ?? (() => new Date());
  }

  start(host: FrameHost): void {
    this.host = host;
    this.saved = loadSavedJigsaw(this.store);
    this.mode = this.saved.current ? 'puzzle' : 'pictures';
    this.timer.pause();
    void this.options.loadPictures().then((pictures) => this.picturesLoaded(pictures));
  }

  render(layer: HTMLElement, frame: FrameLayout, animateIn: boolean): GameTargets {
    if (!this.view) this.view = new JigsawView(layer);
    this.held = null;
    this.layout = computeJigsawLayout(frame);
    if (this.mode === 'pictures') return this.renderPictures(layer, frame, animateIn);
    this.ensureGame(this.layout);
    // The screen may have changed since the table was laid out: every group comes back into view.
    if (this.game?.style === 'table') this.keepAllInView(this.layout, this.game);
    this.view.render(this.layout, this.viewState(), animateIn);
    return this.targets();
  }

  buttonTapped(id: string): void {
    if (this.busy) return;
    if (id.startsWith('pic:')) this.openPicture(Number(id.slice('pic:'.length)));
    else if (id === 'pics-back' || id === 'pics-more') this.turnPage(id === 'pics-more' ? 1 : -1);
    else if (id === 'pics-close') this.closePictures();
    else if (id === 'pictures') this.showPictures();
    else if (id === 'hint') void this.hint();
    else if (id.startsWith('style:')) this.choose({ style: id.slice('style:'.length) as JigsawStyle });
    else if (id.startsWith('count:')) this.choose({ count: Number(id.slice('count:'.length)) as PieceCount });
    else if (id.startsWith('piece:')) this.tapPiece(Number(id.slice('piece:'.length)));
    else if (id.startsWith('spot:')) this.tapSpot(Number(id.slice('spot:'.length)));
  }

  /** She picked a piece up. Its targets wait until she lets go: new targets now would cancel the drag. */
  dragStarted(id: string): void {
    const game = this.game;
    if (this.busy || !game || !this.view || this.mode !== 'puzzle' || !id.startsWith('piece:')) return;
    const piece = Number(id.slice('piece:'.length));
    const spots = this.pieceSpots();
    // A table piece brings its group; the one under her finger comes first.
    const ids = [piece, ...game.groupOf(piece).filter((p) => p !== piece)];
    const starts = ids.map((p) => spots.find((s) => s.id === p)?.body);
    if (starts.some((s) => !s)) return;
    this.lifted = null;
    this.held = { id: piece, ids, starts: starts as Rect[], grab: null, fromTray: game.tray.includes(piece) };
    this.view.hold(ids);
  }

  dragMoved(_id: string, x: number, y: number): void {
    const held = this.held;
    if (!held || !this.view) return;
    if (!held.grab) {
      const first = held.starts[0];
      // A piece from the tray grows to full size under her finger; anything else keeps its place under her finger.
      if (held.fromTray) {
        held.starts[0] = { ...first, x: x - first.w / 2, y: y - first.h / 2 };
        held.grab = { x: first.w / 2, y: first.h / 2 };
      } else {
        held.grab = { x: x - first.x, y: y - first.y };
      }
    }
    this.view.moveHeld(this.heldBodies(held, x, y));
  }

  dragEnded(_id: string, x: number, y: number): void {
    const held = this.held;
    const game = this.game;
    const layout = this.layout;
    this.held = null;
    if (!held?.grab || !game || !layout || !this.view) return this.dragCancelled();
    const bodies = this.heldBodies(held, x, y).map((b) => b.body);
    // What she drops stays inside the free area, tabs too (a group as a whole).
    const box = boundsOf(bodies);
    const kept = clampToFree(layout.free, box, this.tab(layout, game));
    const first = { ...bodies[0], x: bodies[0].x + kept.x - box.x, y: bodies[0].y + kept.y - box.y };
    const result = game.drop(held.id, this.toPieces(layout, game, first));
    // A join lines the group up with the piece it fits, which can nudge it partly out of the free area.
    this.keepInView(layout, game, held.id);
    this.view.release();
    this.changed();
    if (result === 'placed' || result === 'joined') this.view.pop(held.id);
  }

  /** The iPad cancelled the touch (or the screen changed): the pieces glide back. Targets are unchanged. */
  dragCancelled(): void {
    this.held = null;
    this.view?.release();
    if (this.mode === 'puzzle' && this.game) this.view?.update(this.viewState());
  }

  pause(): void {
    this.shown = false;
    this.timer.pause();
    window.clearTimeout(this.idleTimer);
    this.view?.setHintPulse(false);
    if (this.held) this.dragCancelled();
    this.save();
  }

  resume(): void {
    this.shown = true;
    if (this.mode === 'puzzle') this.timer.resume(performance.now());
    // A puzzle finished just before she switched away (by a piece while a hint star flew) is celebrated when she's back.
    if (this.game?.solved && !this.busy && !this.hintFlying) void this.finish();
    else if (!this.busy) this.resetIdle();
  }

  activity(): void {
    if (this.mode === 'puzzle') this.timer.activity(performance.now());
  }

  summary(): GameSummary {
    return { solved: this.saved.stats.totalSolved };
  }

  private picturesLoaded(pictures: Picture[]): void {
    this.pictures = pictures;
    const current = this.saved.current;
    if (current && !this.picture) {
      this.picture = pictures.find((p) => p.id === current) ?? null;
      // Its picture is gone from the site: back to choosing.
      if (!this.picture) {
        this.saved = { ...this.saved, current: null };
        this.mode = 'pictures';
        saveSavedJigsaw(this.store, this.saved);
      }
    }
    if (this.shown && !this.busy && !this.held) this.host.redraw(false);
  }

  private renderPictures(layer: HTMLElement, frame: FrameLayout, animateIn: boolean): GameTargets {
    const layout = computePicturePageLayout(frame);
    const page = picturePage(this.pictures ?? [], this.page);
    // The list may have shrunk since she turned to this page.
    this.page = page.page;
    renderPicturePage(
      layer,
      layout,
      {
        pictures: this.pictures && page.pictures,
        finished: new Set(this.saved.finished),
        hasBack: page.hasBack,
        hasMore: page.hasMore,
        canClose: this.picture !== null,
      },
      animateIn,
    );
    const buttons: ButtonGeometry[] = page.pictures.map((_, i) => ({ id: `pic:${i}`, ...layout.tiles[i] }));
    if (page.hasBack) buttons.push({ id: 'pics-back', ...layout.back });
    if (this.picture) buttons.push({ id: 'pics-close', ...layout.close });
    if (page.hasMore) buttons.push({ id: 'pics-more', ...layout.more });
    return { tiles: [], buttons };
  }

  /** The puzzle for her picture, style and piece count: her saved place in it, or a new one. */
  private ensureGame(layout: JigsawLayout): void {
    const picture = this.picture;
    if (this.game || !picture) return;
    const { style, count } = this.saved;
    const { cols, rows } = GRID_SIZES[count];
    const seed = pieceSeed(picture.id, count);
    const place = placeFor(this.saved, picture.id, style, count);
    const restored = place ? JigsawGame.restore(style, count, place.progress) : null;
    this.game = restored ?? JigsawGame.fresh(style, count, seed, style === 'table' ? this.startSpots(layout, count) : []);
    this.shapes = cutPieces(cols, rows, seed);
    this.timer = new PlayTimer(restored && place ? place.progress.elapsedMs : 0);
    if (document.hidden) this.timer.pause();
    else this.timer.activity(performance.now());
    this.save();
  }

  /** Where table pieces may start, in table pieces from the table's corner. */
  private startSpots(layout: JigsawLayout, count: PieceCount): Point[] {
    const table = tablePieces(layout, count);
    const origin = layout.free[0];
    return table.spots.map((s) => ({ x: (s.x - origin.x) / table.w, y: (s.y - origin.y) / table.h }));
  }

  private save(): void {
    const { game, picture } = this;
    if (game && picture && !game.solved) {
      this.saved = withPlace(this.saved, { picture: picture.id, style: game.style, count: game.count, progress: game.progress(this.timer.elapsedMs) });
    }
    saveSavedJigsaw(this.store, this.saved);
  }

  private imageFor(picture: Picture): HTMLImageElement {
    let image = this.images.get(picture.src);
    if (!image) {
      image = new Image();
      image.decoding = 'async';
      image.onload = () => {
        if (this.picture?.src === picture.src && this.mode === 'puzzle' && this.shown && !this.busy && !this.held) this.host.redraw(false);
      };
      image.src = picture.src;
      this.images.set(picture.src, image);
    }
    return image;
  }

  private ready(): HTMLImageElement | null {
    const image = this.picture && this.imageFor(this.picture);
    return image && image.complete && image.naturalWidth > 0 ? image : null;
  }

  private boardSize(layout: JigsawLayout, count: PieceCount): { w: number; h: number } {
    const { cols, rows } = GRID_SIZES[count];
    return { w: layout.board.w / cols, h: layout.board.h / rows };
  }

  private pieceSize(layout: JigsawLayout, game: JigsawGame): { w: number; h: number } {
    if (game.style !== 'table') return this.boardSize(layout, game.count);
    const { w, h } = tablePieces(layout, game.count);
    return { w, h };
  }

  /** How far a piece's tabs reach beyond its body. */
  private tab(layout: JigsawLayout, game: JigsawGame): number {
    const { w, h } = this.pieceSize(layout, game);
    return tabFor(w, h);
  }

  /** Positions are counted from the board's corner (Tray, Board) or the table's (Table). */
  private origin(layout: JigsawLayout, game: JigsawGame): Point {
    return game.style === 'table' ? layout.free[0] : layout.board;
  }

  private toPieces(layout: JigsawLayout, game: JigsawGame, body: Rect): Point {
    const { w, h } = this.pieceSize(layout, game);
    const origin = this.origin(layout, game);
    return { x: (body.x - origin.x) / w, y: (body.y - origin.y) / h };
  }

  private fromPieces(layout: JigsawLayout, game: JigsawGame, at: Point): Rect {
    const { w, h } = this.pieceSize(layout, game);
    const origin = this.origin(layout, game);
    return { x: origin.x + at.x * w, y: origin.y + at.y * h, w, h };
  }

  /** Table: moves `id`'s group back inside the free area (tabs too), in the rules as well, so it joins where it's seen. */
  private keepInView(layout: JigsawLayout, game: JigsawGame, id: number): void {
    if (game.style !== 'table') return;
    const box = boundsOf(game.groupOf(id).map((p) => this.fromPieces(layout, game, game.positionOf(p))));
    const kept = clampToFree(layout.free, box, this.tab(layout, game));
    if (kept.x === box.x && kept.y === box.y) return;
    const body = this.fromPieces(layout, game, game.positionOf(id));
    game.settle(id, this.toPieces(layout, game, { ...body, x: body.x + kept.x - box.x, y: body.y + kept.y - box.y }));
  }

  private keepAllInView(layout: JigsawLayout, game: JigsawGame): void {
    const done = new Set<number>();
    for (const id of game.stacking) {
      if (done.has(id)) continue;
      for (const p of game.groupOf(id)) done.add(p);
      this.keepInView(layout, game, id);
    }
  }

  /** Where every piece is drawn, bottom first. */
  private pieceSpots(): PieceSpot[] {
    const { game, layout } = this;
    if (!game || !layout) return [];
    let spots: PieceSpot[];
    if (game.style === 'table') {
      // Table groups are kept in view in the rules themselves (keepInView), so they're drawn where they are.
      spots = game.stacking.map((id) => ({ id, body: this.fromPieces(layout, game, game.positionOf(id)), where: 'table' }));
    } else {
      const { w, h } = this.boardSize(layout, game.count);
      const tab = tabFor(w, h);
      spots = game.placed.map((id) => ({ id, body: this.fromPieces(layout, game, game.home(id)), where: 'placed' as const }));
      for (const [id, at] of game.loose) spots.push({ id, body: clampToFree(layout.free, this.fromPieces(layout, game, at), tab), where: 'loose' });
      game.tray.forEach((id, i) => {
        if (id === null) return;
        const slot = layout.slots[i];
        spots.push({ id, body: { x: slot.x + slot.w / 2 - w / 2, y: slot.y + slot.h / 2 - h / 2, w, h }, where: 'tray', slot });
      });
    }
    const frozen = this.frozen;
    return frozen ? spots.map((s) => frozen.get(s.id) ?? s) : spots;
  }

  private viewState(): JigsawViewState {
    const { game, layout } = this;
    const image = this.ready();
    return {
      style: this.saved.style,
      count: this.saved.count,
      picture: this.picture,
      image,
      shapes: image && game ? this.shapes : [],
      pieceSize: game && layout ? this.pieceSize(layout, game) : { w: 0, h: 0 },
      pieces: image ? this.pieceSpots() : [],
      lifted: this.lifted,
    };
  }

  private targets(): GameTargets {
    const { game, layout } = this;
    if (!layout) return { tiles: [], buttons: [] };
    const buttons: ButtonGeometry[] = [
      { id: 'hint', ...layout.hintButton },
      { id: 'pictures', ...layout.picturesButton },
      ...JIGSAW_STYLES.map((style, i) => ({ id: `style:${style}`, ...layout.styleButtons[i] })),
      ...PIECE_COUNTS.map((count, i) => ({ id: `count:${count}`, ...layout.countButtons[i] })),
    ];
    const draggables: ButtonGeometry[] = [];
    if (game && this.ready()) {
      // Topmost first: the touch tracker takes the first piece under her finger.
      for (const spot of [...this.pieceSpots()].reverse()) {
        if (spot.where === 'placed' || this.frozen?.has(spot.id)) continue;
        draggables.push({ id: `piece:${spot.id}`, ...(spot.slot ?? spot.body) });
      }
      // With a piece lifted by a tap, the board's empty spots can be tapped.
      if (this.lifted !== null) {
        for (let id = 0; id < game.count; id++) if (!game.isPlaced(id)) buttons.push({ id: `spot:${id}`, ...this.fromPieces(layout, game, game.home(id)) });
      }
    }
    return { tiles: [], buttons, draggables, reviewButton: layout.reviewButton };
  }

  private heldBodies(held: Held, x: number, y: number): Array<{ id: number; body: Rect }> {
    const dx = x - held.grab!.x - held.starts[0].x;
    const dy = y - held.grab!.y - held.starts[0].y;
    return held.ids.map((id, i) => ({ id, body: { ...held.starts[i], x: held.starts[i].x + dx, y: held.starts[i].y + dy } }));
  }

  /** Redraws the pieces and tells the touch tracker what can be touched now. */
  private refresh(): void {
    if (this.mode !== 'puzzle') return;
    this.view?.update(this.viewState());
    this.host.updateTargets(this.targets());
  }

  /** Something moved: save it, show it, and see if she's finished. */
  private changed(): void {
    this.save();
    this.resetIdle();
    this.refresh();
    // If the hint star is still flying, it finishes the puzzle when it lands.
    if (this.game?.solved && !this.hintFlying && !this.busy) void this.finish();
  }

  /** Tray and Board: a tap lifts a piece (or puts it down again). Table: a wiggle. */
  private tapPiece(id: number): void {
    const game = this.game;
    if (!game || this.mode !== 'puzzle') return;
    if (game.style === 'table') return this.view?.wiggle(id);
    this.lifted = this.lifted === id ? null : id;
    this.refresh();
  }

  /** A tap on the board with a piece lifted: its own spot clicks it in; Board leaves it on any other spot. */
  private tapSpot(spot: number): void {
    const game = this.game;
    const id = this.lifted;
    if (!game || id === null) return;
    this.lifted = null;
    const result = game.drop(id, game.home(spot));
    this.changed();
    if (result === 'placed') this.view?.pop(id);
  }

  private async hint(): Promise<void> {
    const { game, layout } = this;
    // One star at a time, so a double tap doesn't use two hints.
    if (this.hintFlying || !game || !layout || this.mode !== 'puzzle' || !this.ready() || game.solved) return;
    this.lifted = null;
    const before = new Map(this.pieceSpots().map((s) => [s.id, s]));
    const id = game.hint();
    if (id === null) return;
    this.keepInView(layout, game, id);
    const after = this.pieceSpots();
    const target = after.find((s) => s.id === id)!.body;
    this.frozen = new Map(after.filter((s) => before.has(s.id) && moved(before.get(s.id)!, s)).map((s) => [s.id, before.get(s.id)!]));
    this.hintFlying = true;
    // A hint that finishes the puzzle: nothing more to do until "Well done!".
    if (game.solved) this.busy = true;
    this.save();
    this.resetIdle();
    this.refresh();
    await this.view?.flyStar(target);
    this.hintFlying = false;
    this.frozen = null;
    // If she chose another picture, style or piece count while the star flew, that puzzle is gone from the screen.
    if (this.game === game && this.mode === 'puzzle') {
      this.view?.update(this.viewState());
      if (this.shown) this.view?.land(id);
      // Setting the touch targets while she holds a piece would drop it; they're set when she lets go.
      if (!this.held) this.host.updateTargets(this.targets());
    }
    if (game.solved && this.game === game && (this.busy || this.shown)) void this.finish();
  }

  /** Each picture, style and piece count keeps her place, so switching never loses anything. */
  private choose(change: { style?: JigsawStyle; count?: PieceCount }): void {
    const style = change.style ?? this.saved.style;
    const count = change.count ?? this.saved.count;
    if (!JIGSAW_STYLES.includes(style) || !PIECE_COUNTS.includes(count)) return;
    if (style === this.saved.style && count === this.saved.count) return;
    this.save();
    this.saved = { ...this.saved, style, count };
    this.game = null;
    this.lifted = null;
    saveSavedJigsaw(this.store, this.saved);
    this.host.redraw(true);
    this.resetIdle();
  }

  private openPicture(index: number): void {
    const picture = picturePage(this.pictures ?? [], this.page).pictures[index];
    if (!picture) return;
    this.save();
    this.picture = picture;
    this.game = null;
    this.lifted = null;
    // Only the picture on screen is kept decoded: a 1600 × 1200 photo takes several MB.
    for (const src of [...this.images.keys()]) if (src !== picture.src) this.images.delete(src);
    this.saved = { ...this.saved, current: picture.id };
    this.mode = 'puzzle';
    this.host.redraw(true);
    this.timer.resume(performance.now());
    this.resetIdle();
  }

  private showPictures(): void {
    this.save();
    this.lifted = null;
    this.timer.pause();
    window.clearTimeout(this.idleTimer);
    this.view?.setHintPulse(false);
    this.mode = 'pictures';
    this.page = 0;
    this.host.redraw(true);
  }

  private closePictures(): void {
    if (!this.picture) return;
    this.mode = 'puzzle';
    this.host.redraw(true);
    this.timer.resume(performance.now());
    this.resetIdle();
  }

  private turnPage(step: number): void {
    this.page = Math.max(0, this.page + step);
    this.host.redraw(false);
  }

  /** Where the finished picture is when it comes together: the board, or wherever the table's one group lies. */
  private assembled(layout: JigsawLayout): Rect {
    if (this.game?.style !== 'table') return layout.board;
    return boundsOf(this.pieceSpots().map((s) => s.body));
  }

  private async finish(): Promise<void> {
    const { game, picture, layout } = this;
    if (!game || !picture || !layout) return;
    // A piece she's still holding (picked up while a hint star flew) is let go: the puzzle is done.
    if (this.held) this.dragCancelled();
    this.busy = true;
    this.lifted = null;
    window.clearTimeout(this.idleTimer);
    this.view?.setHintPulse(false);
    if (this.shown) await this.view?.finish(picture, this.assembled(layout));
    this.timer.activity(performance.now());
    this.host.logPlay(jigsawRecord({ count: game.count, style: game.style, hints: game.hints, ms: this.timer.elapsedMs, now: this.now() }));
    const done = withFinished(withoutPlace(this.saved, picture.id, game.style, game.count), picture.id);
    this.saved = { ...done, current: null, stats: recordJigsawSolve(this.saved.stats, dayKey(this.now())) };
    const streakDays = this.host.recordPlayDay();
    // Saved as done now, so closing the app mid-celebration loses nothing.
    this.game = null;
    this.picture = null;
    this.timer.pause();
    saveSavedJigsaw(this.store, this.saved);
    if (this.shown) await wait(ADMIRE_MS);
    await this.host.celebrate({
      lines: jigsawLines({
        hinted: game.hints > 0,
        streakDays,
        todaySolved: this.saved.stats.todaySolved,
        puzzleNumber: this.saved.stats.totalSolved,
      }),
      nextLabel: 'Next picture',
      timeoutMs: CELEBRATION_MS,
    });
    this.mode = 'pictures';
    this.page = 0;
    this.busy = false;
    this.host.redraw(true);
  }

  private resetIdle(): void {
    window.clearTimeout(this.idleTimer);
    this.view?.setHintPulse(false);
    if (this.mode !== 'puzzle') return;
    this.idleTimer = window.setTimeout(() => this.view?.setHintPulse(true), IDLE_HINT_MS);
  }
}
