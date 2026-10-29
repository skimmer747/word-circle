import { GAME_TITLES, type FrameHost, type GameScreen, type GameSummary, type GameTargets } from '../frame/games';
import type { FrameLayout, Rect } from '../frame/layout';
import type { NoticeCard } from '../frame/view';
import type { ButtonGeometry } from '../input/touch';
import type { PhotoAdder } from '../photos/adder';
import { FAMILY, type PictureList } from '../photos/family';
import { PhotoError } from '../photos/shrink';
import { dayKey } from '../shared/days';
import type { KeyValueStore } from '../shared/store';
import { PlayTimer } from '../shared/timer';
import { jigsawRecord } from '../stats/records';
import { wait } from '../ui/dom';
import { PICTURES_ICON } from '../ui/icons';
import { jigsawLines } from './celebration';
import { cutPieces, disguiseEdges, pieceSeed, tabFor, type PieceShape } from './cut';
import { clampToFree, computeJigsawLayout, computePicturePageLayout, tablePieces, type JigsawLayout } from './layout';
import { renderPicturePage } from './picture-page';
import { PAGE_SIZE, PAGE_WITH_ADD, picturePage, pictureShown } from './pictures';
import { JigsawGame } from './rules';
import {
  loadSavedJigsaw,
  placeFor,
  recordJigsawSolve,
  saveSavedJigsaw,
  withFinished,
  withPlace,
  withoutPictures,
  withoutPlace,
  type SavedJigsaw,
} from './storage';
import { GRID_SIZES, JIGSAW_STYLES, PIECE_COUNTS, type JigsawStyle, type Picture, type PieceCount, type Point } from './types';
import { JigsawView, type JigsawViewState, type PieceSpot } from './view';

/** The "Well done!" card moves on by itself after this long. */
const CELEBRATION_MS = 15_000;
/** She sees the finished picture and its caption this long before "Well done!". */
const ADMIRE_MS = 2_500;

/** What she's holding: pieces that move together (a Table group), where they started, and where her finger is on the first. */
interface Held {
  id: number;
  ids: number[];
  starts: Rect[];
  /** Where her finger first came down. */
  down: Point;
  /** Where her finger is on the first piece's body; set on the first move. */
  grab: Point | null;
  /** It was shown smaller (in the tray, or lying around in Board style) and grows to full size under her finger. */
  grows: boolean;
}

export interface JigsawOptions {
  /** The pictures she can choose from, and which family photos there are. */
  loadPictures: () => Promise<PictureList>;
  /** Adding a family photo; null where photos can't be kept (no Add a photo tile). */
  photos?: PhotoAdder | null;
  /** The current time; tests can pass a fixed one. */
  now?: () => Date;
}

/** What she's told when a photo can't be added. */
const photoProblem = (error: unknown): NoticeCard =>
  error instanceof PhotoError && error.reason === 'unsaved'
    ? { icon: PICTURES_ICON, title: "That photo couldn't be saved", lines: ['The iPad may be full.'] }
    : { icon: PICTURES_ICON, title: "That photo can't be used", lines: ['Try another one.'] };

const boundsOf = (rects: readonly Rect[]): Rect => {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  return { x, y, w: Math.max(...rects.map((r) => r.x + r.w)) - x, h: Math.max(...rects.map((r) => r.y + r.h)) - y };
};

const moved = (a: PieceSpot, b: PieceSpot) => a.where !== b.where || a.body.x !== b.body.x || a.body.y !== b.body.y;

/** `body` shrunk to `scale` around its middle. */
const around = (body: Rect, scale: number): Rect => ({
  x: body.x + (body.w * (1 - scale)) / 2,
  y: body.y + (body.h * (1 - scale)) / 2,
  w: body.w * scale,
  h: body.h * scale,
});

/** Jigsaw: big-piece puzzles from pictures, played from a tray, on a board, or loose on a table. */
/**
 * Resolves once `image` has loaded, or failed to. (Not decode(), which can wait for the page to draw a frame, and a
 * page in the background never does.)
 */
const loaded = (image: HTMLImageElement): Promise<void> =>
  image.complete
    ? Promise.resolve()
    : new Promise((resolve) => {
        image.addEventListener('load', () => resolve(), { once: true });
        image.addEventListener('error', () => resolve(), { once: true });
      });

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
  /** The picture she just finished, while it shows (for its Cartoon button). */
  private finishedPicture: Picture | null = null;
  private page = 0;
  /** Made at the next render (Table pieces start where the layout has room). */
  private game: JigsawGame | null = null;
  private shapes: PieceShape[] = [];
  /** The same pieces with their straight sides hidden (Hide edges). */
  private disguises: PieceShape[] = [];
  private readonly images = new Map<string, HTMLImageElement>();
  private held: Held | null = null;
  private lifted: number | null = null;
  private hintFlying = false;
  /** While the hint star flies, the pieces it moves are drawn where they were. */
  private frozen: Map<number, PieceSpot> | null = null;
  /** True while Jigsaw is on screen (between resume and pause). */
  private shown = false;
  /** The pictures or the photo arrived while it couldn't be redrawn: redraw when she's back. */
  private stale = false;
  private view: JigsawView | null = null;
  private layout: JigsawLayout | null = null;
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
    this.stale = false;
    this.layout = computeJigsawLayout(frame, this.saved.style);
    // The finished picture is on screen (fading in, or behind "Well done!"): keep it, only moved to fit.
    if (this.busy && this.mode === 'puzzle') {
      this.view.placeFinished(this.layout);
      return { tiles: [], buttons: [], reviewButton: this.layout.reviewButton };
    }
    if (this.mode === 'pictures') return this.renderPictures(layer, frame, animateIn);
    this.ensureGame(this.layout);
    // The screen may have changed since the table was laid out: every group comes back into view.
    if (this.game?.style === 'table') this.keepAllInView(this.layout, this.game);
    this.view.render(this.layout, this.viewState(), animateIn);
    return this.targets();
  }

  buttonTapped(id: string): void {
    // The finished picture's Cartoon works while the game is busy celebrating.
    if (id === 'finished-cartoon') {
      this.finishedCartoon();
      return;
    }
    if (this.busy) return;
    if (id === 'pic:add') this.addPhoto();
    else if (id.startsWith('pic:')) this.openPicture(Number(id.slice('pic:'.length)));
    else if (id === 'pics-back' || id === 'pics-more') this.turnPage(id === 'pics-more' ? 1 : -1);
    else if (id === 'pics-close') this.closePictures();
    else if (id === 'cartoon') this.cartoon();
    else if (id === 'pictures') this.showPictures();
    else if (id === 'hint') void this.hint();
    else if (id === 'move-picture') this.movePicture();
    else if (id === 'hide-edges') this.hideEdges();
    else if (id.startsWith('style:')) this.choose({ style: id.slice('style:'.length) as JigsawStyle });
    else if (id.startsWith('count:')) this.choose({ count: Number(id.slice('count:'.length)) as PieceCount });
    else if (id.startsWith('piece:')) this.tapPiece(Number(id.slice('piece:'.length)));
    else if (id.startsWith('spot:')) this.tapSpot(Number(id.slice('spot:'.length)));
  }

  /** She picked a piece up. Its targets wait until she lets go: new targets now would cancel the drag. */
  dragStarted(id: string, x: number, y: number): void {
    const game = this.game;
    if (this.busy || !game || !this.view || this.mode !== 'puzzle' || !id.startsWith('piece:')) return;
    const piece = Number(id.slice('piece:'.length));
    const spots = this.pieceSpots();
    // A table piece brings its group; the one under her finger comes first.
    const ids = [piece, ...game.groupOf(piece).filter((p) => p !== piece)];
    const starts = ids.map((p) => spots.find((s) => s.id === p)?.body);
    if (starts.some((s) => !s)) return;
    this.lifted = null;
    const grows = game.tray.includes(piece) || (game.style === 'board' && !game.isPlaced(piece));
    this.held = { id: piece, ids, starts: starts as Rect[], down: { x, y }, grab: null, grows };
    this.view.hold(ids);
  }

  dragMoved(_id: string, x: number, y: number): void {
    const held = this.held;
    if (!held || !this.view) return;
    if (!held.grab) {
      const first = held.starts[0];
      // A piece shown smaller grows to full size under her finger; anything else stays held where she touched it
      // (the finger has already moved a little before a drag starts).
      if (held.grows) {
        held.starts[0] = { ...first, x: x - first.w / 2, y: y - first.h / 2 };
        held.grab = { x: first.w / 2, y: first.h / 2 };
      } else {
        held.grab = { x: held.down.x - first.x, y: held.down.y - first.y };
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
    // What she drops stays inside the free area, tabs too (a group as a whole; in Board style, the smaller piece it
    // goes back to being if it doesn't click in).
    const box = game.style === 'board' ? this.shrunk(layout, game, bodies[0]) : boundsOf(bodies);
    const boxTab = game.style === 'board' ? tabFor(box.w, box.h) : this.tab(layout, game);
    const kept = clampToFree(layout.free, box, boxTab);
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
    if (this.held) this.dragCancelled();
    this.save();
  }

  resume(): void {
    this.shown = true;
    if (this.mode === 'puzzle') this.timer.resume(performance.now());
    // A puzzle finished just before she switched away (by a piece while a hint star flew) is celebrated when she's back.
    if (this.game?.solved && !this.busy && !this.hintFlying) return void this.finish();
    if (this.busy) return;
    if (this.stale) this.host.redraw(false);
    // A hint star that landed while she was away couldn't set the touch targets then.
    else if (this.mode === 'puzzle' && this.game && !this.hintFlying) this.host.updateTargets(this.targets());
  }

  activity(): void {
    if (this.mode === 'puzzle') this.timer.activity(performance.now());
  }

  /** For the frame's help bubble after a quiet minute. */
  help(): string | null {
    return this.mode === 'puzzle' && this.game && !this.busy ? 'Put the pieces in the picture.' : null;
  }

  setHintPulse(on: boolean): void {
    this.view?.setHintPulse(on);
  }

  summary(): GameSummary {
    return { solved: this.saved.stats.totalSolved };
  }

  private picturesLoaded({ pictures, family }: PictureList): void {
    this.pictures = pictures;
    // Family photos removed on the settings page: their places and checks go too (only when the photos could be read).
    if (family) {
      this.saved = withoutPictures(this.saved, (id) => id.startsWith(FAMILY) && !family.includes(id));
      saveSavedJigsaw(this.store, this.saved);
    }
    const current = this.saved.current;
    if (!current && !this.picture) this.mode = 'pictures';
    if (current && !this.picture) {
      const found = pictures.find((p) => p.id === current);
      this.picture = found ? this.asShown(found) : null;
      if (!this.picture) {
        this.mode = 'pictures';
        // Its picture is gone from the site: back to choosing. (With no list at all, offline, she keeps her place.)
        if (pictures.length > 0) {
          this.saved = { ...this.saved, current: null };
          saveSavedJigsaw(this.store, this.saved);
        }
      }
    }
    this.redrawWhenFree();
  }

  /** Redraws now if nothing is in the way, otherwise when she's next back. */
  private redrawWhenFree(): void {
    if (this.shown && !this.busy && !this.held) this.host.redraw(false);
    else this.stale = true;
  }

  private renderPictures(layer: HTMLElement, frame: FrameLayout, animateIn: boolean): GameTargets {
    const layout = computePicturePageLayout(frame);
    const page = picturePage(this.pictures ?? [], this.page, this.perPage());
    // The list may have shrunk since she turned to this page.
    this.page = page.page;
    renderPicturePage(
      layer,
      layout,
      {
        pictures: this.pictures && page.pictures.map((picture) => this.asShown(picture)),
        finished: new Set(this.saved.finished),
        hasBack: page.hasBack,
        hasMore: page.hasMore,
        canClose: this.picture !== null,
        canAdd: this.canAdd(),
        cartoons: this.hasCartoons() ? this.saved.cartoons : null,
      },
      animateIn,
    );
    const offset = this.canAdd() ? 1 : 0;
    const buttons: ButtonGeometry[] = page.pictures.map((_, i) => ({ id: `pic:${i}`, ...layout.tiles[i + offset] }));
    if (offset) buttons.unshift({ id: 'pic:add', ...layout.tiles[0] });
    if (this.hasCartoons()) buttons.push({ id: 'cartoon', ...layout.cartoons });
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
    const spots = style === 'tray' ? [] : this.startSpots(layout, style, count);
    this.game = restored ?? JigsawGame.fresh(style, count, seed, spots, this.saved.hideEdges);
    this.shapes = cutPieces(cols, rows, seed);
    this.disguises = disguiseEdges(this.shapes, seed);
    this.timer = new PlayTimer(restored && place ? place.progress.elapsedMs : 0);
    if (document.hidden) this.timer.pause();
    else this.timer.activity(performance.now());
    this.save();
  }

  /**
   * Where spread-out pieces start: in table pieces from the table's corner (Table), or, for Board, where a full-size
   * piece would be (in board pieces from the board's corner) with its middle on the spot's middle.
   */
  private startSpots(layout: JigsawLayout, style: JigsawStyle, count: PieceCount): Point[] {
    const table = tablePieces(layout, count);
    if (style === 'table') {
      const origin = layout.free[0];
      return table.spots.map((s) => ({ x: (s.x - origin.x) / table.w, y: (s.y - origin.y) / table.h }));
    }
    const { w, h } = this.boardSize(layout, count);
    const { board } = layout;
    return table.spots.map((s) => ({ x: (s.x + s.w / 2 - w / 2 - board.x) / w, y: (s.y + s.h / 2 - h / 2 - board.y) / h }));
  }

  /** A Board piece lying around: the full-size body, shrunk to the spread-out size around its middle. */
  private shrunk(layout: JigsawLayout, game: JigsawGame, full: Rect): Rect {
    return around(full, tablePieces(layout, game.count).w / full.w);
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
        if (this.picture?.src === picture.src && this.mode === 'puzzle') this.redrawWhenFree();
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
      spots = game.placed.map((id) => ({ id, body: this.fromPieces(layout, game, game.home(id)), where: 'placed' as const }));
      // Pieces lying around (Board) are drawn smaller, around the middle of where a full-size one would be, and that
      // smaller piece is what's kept in the free area (the screen may have changed since it was put down).
      for (const [id, at] of game.loose) {
        const full = this.fromPieces(layout, game, at);
        const small = this.shrunk(layout, game, full);
        const kept = clampToFree(layout.free, small, tabFor(small.w, small.h));
        spots.push({ id, body: { ...full, x: full.x + kept.x - small.x, y: full.y + kept.y - small.y }, where: 'loose', scale: small.w / full.w });
      }
      game.tray.forEach((id, i) => {
        if (id === null) return;
        const slot = layout.slots[i];
        spots.push({ id, body: { x: slot.x + slot.w / 2 - w / 2, y: slot.y + slot.h / 2 - h / 2, w, h }, where: 'tray', slot });
      });
    }
    // Hide edges: a piece keeps its disguise until it's in place (Tray, Board) or joined to another (Table).
    if (this.saved.hideEdges) {
      for (const spot of spots) spot.disguised = game.style === 'table' ? game.groupOf(spot.id).length === 1 : spot.where !== 'placed';
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
      // Table has no faint picture: its small picture is always in the corner.
      guide: this.saved.style === 'table' ? 'corner' : this.saved.guide,
      hideEdges: this.saved.hideEdges,
      cartoon: this.picture?.cartoon ? this.saved.cartoons : null,
      disguises: image && game && this.saved.hideEdges ? this.disguises : [],
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
    if (this.saved.style !== 'table') buttons.push({ id: 'move-picture', ...layout.pictureButton });
    buttons.push({ id: 'hide-edges', ...layout.edgesButton });
    if (this.picture?.cartoon) buttons.push({ id: 'cartoon', ...layout.cartoonButton });
    const draggables: ButtonGeometry[] = [];
    if (game && this.ready()) {
      // Topmost first: the touch tracker takes the first piece under her finger (where she sees it, shrunk or not).
      for (const spot of [...this.pieceSpots()].reverse()) {
        if (spot.where === 'placed' || this.frozen?.has(spot.id)) continue;
        draggables.push({ id: `piece:${spot.id}`, ...(spot.slot ?? (spot.scale ? around(spot.body, spot.scale) : spot.body)) });
      }
      // With a piece lifted by a tap, the board's empty spots can be tapped. They come after the pieces (the touch
      // tracker would put buttons first), so a piece lying over a spot is still picked up.
      if (this.lifted !== null) {
        for (let id = 0; id < game.count; id++) if (!game.isPlaced(id)) draggables.push({ id: `spot:${id}`, ...this.fromPieces(layout, game, game.home(id)) });
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
    this.refresh();
    try {
      await this.view?.flyStar(target);
    } finally {
      this.hintFlying = false;
      this.frozen = null;
    }
    // If she chose another picture, style or piece count while the star flew, that puzzle is gone from the screen.
    if (this.game === game && this.mode === 'puzzle') {
      this.view?.update(this.viewState());
      if (this.shown) this.view?.land(id);
      // Only while Jigsaw is on screen (another game's targets would be replaced; resume sets ours), and not while she
      // holds a piece (it would drop; they're set when she lets go).
      if (this.shown && !this.held) this.host.updateTargets(this.targets());
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
  }

  private openPicture(index: number): void {
    const picture = picturePage(this.pictures ?? [], this.page, this.perPage()).pictures[index];
    if (picture) this.startPicture(picture);
  }

  /** Starts `picture` in her style and piece count, or picks up where she left off in it. */
  private startPicture(picture: Picture): void {
    this.save();
    this.picture = this.asShown(picture);
    this.game = null;
    this.lifted = null;
    this.keepDecodedOnly(this.picture.src);
    this.saved = { ...this.saved, current: picture.id };
    this.mode = 'puzzle';
    this.host.redraw(true);
    this.timer.resume(performance.now());
  }

  /** Only the picture on screen is kept decoded: a 1600 × 1200 photo takes several MB. */
  private keepDecodedOnly(src: string): void {
    for (const kept of [...this.images.keys()]) if (kept !== src) this.images.delete(kept);
  }

  /** The picture as she sees it: its drawing while Cartoons is on, if it has one. */
  private asShown(picture: Picture): Picture {
    return pictureShown(picture, this.saved.cartoons);
  }

  /** Cartoons is offered on Pick a picture once the pictures are in and one of them has a drawing. */
  private hasCartoons(): boolean {
    return this.pictures?.some((picture) => picture.cartoon) ?? false;
  }

  /**
   * Cartoon on or off, from the puzzle or from Pick a picture: the pictures on the page change, and so does the puzzle
   * she's doing, her place kept (the pieces are the same shapes). The new look is loaded before it's shown, so the
   * pieces never blink out. Remembered.
   */
  private cartoon(): void {
    if (this.mode === 'pictures' ? !this.hasCartoons() : !this.picture?.cartoon) return;
    this.saved = { ...this.saved, cartoons: !this.saved.cartoons };
    saveSavedJigsaw(this.store, this.saved);
    this.host.redraw(false);
    const picture = this.picture;
    const listed = picture?.cartoon && this.pictures?.find((p) => p.id === picture.id);
    if (!listed) return;
    const next = this.asShown(listed);
    const image = this.imageFor(next);
    void loaded(image).then(() => {
      // Unless she has switched again, or moved on to another picture, meanwhile.
      if (this.picture?.id !== next.id || this.asShown(listed).src !== next.src) return;
      if (image.naturalWidth > 0) {
        this.picture = next;
        this.keepDecodedOnly(next.src);
      } else {
        // It couldn't be had (offline before the app ever saved it): she stays as she was.
        this.images.delete(next.src);
        this.saved = { ...this.saved, cartoons: !this.saved.cartoons };
        saveSavedJigsaw(this.store, this.saved);
      }
      this.redrawWhenFree();
    });
  }

  /** Add a photo shows once the pictures are in (a photo added before would be lost when they arrive). */
  private canAdd(): boolean {
    return this.options.photos != null && this.pictures !== null;
  }

  /** Pictures per page: five beside Add a photo, or six where photos can't be kept. */
  private perPage(): number {
    return this.options.photos ? PAGE_WITH_ADD : PAGE_SIZE;
  }

  /** Add a photo: the iPad's picker, then "Your new puzzle"; Start puzzle starts it straight away. */
  private addPhoto(): void {
    const photos = this.options.photos;
    if (!photos || !this.canAdd() || this.mode !== 'pictures') return;
    void photos.pick().then(async (file) => {
      if (!file) return;
      const uncover = this.host.cover();
      try {
        const picture = await photos.create(file);
        if (!picture) return;
        // Newest first, ahead of every other picture.
        this.pictures = [picture, ...(this.pictures ?? [])];
        this.startPicture(picture);
      } catch (error) {
        this.host.notice(photoProblem(error));
      } finally {
        uncover();
      }
    });
  }

  private showPictures(): void {
    this.save();
    this.lifted = null;
    this.timer.pause();
    this.mode = 'pictures';
    this.page = 0;
    this.host.redraw(true);
  }

  private closePictures(): void {
    if (!this.picture) return;
    this.mode = 'puzzle';
    this.host.redraw(true);
    this.timer.resume(performance.now());
  }

  /** Hide edges on or off: the pieces change straight away; a new Tray puzzle deals mixed. Remembered. */
  private hideEdges(): void {
    this.saved = { ...this.saved, hideEdges: !this.saved.hideEdges };
    saveSavedJigsaw(this.store, this.saved);
    this.host.redraw(false);
  }

  /** Move picture: the guide picture between faint-on-the-board and small in the corner. Remembered. */
  private movePicture(): void {
    if (this.saved.style === 'table') return;
    this.saved = { ...this.saved, guide: this.saved.guide === 'board' ? 'corner' : 'board' };
    saveSavedJigsaw(this.store, this.saved);
    this.host.redraw(false);
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
    // Whatever happens, she ends up on the picture page, never stuck with the Games button waiting on "busy".
    try {
      if (this.shown) await this.view?.finish(picture, this.assembled(layout));
      // The pieces and the decoded photo aren't needed any more (the finished photo is its own image).
      this.images.clear();
      this.timer.activity(performance.now());
      this.host.logPlay(jigsawRecord({ count: game.count, style: game.style, hints: game.hints, ms: this.timer.elapsedMs, now: this.now() }));
      const done = withFinished(withoutPlace(this.saved, picture.id, game.style, game.count), picture.id);
      this.saved = { ...done, current: null, stats: recordJigsawSolve(this.saved.stats, dayKey(this.now())) };
      const streakDays = this.host.recordPlayDay();
      // Saved as done now, so closing the app mid-celebration loses nothing.
      this.game = null;
      // Kept for Cartoon while she looks back at it: the listed picture, which knows its drawing.
      this.finishedPicture = this.pictures?.find((p) => p.id === picture.id) ?? picture;
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
        nextLabel: 'Pick a picture',
        timeoutMs: CELEBRATION_MS,
      });
    } finally {
      this.finishedPicture = null;
      this.mode = 'pictures';
      this.page = 0;
      this.busy = false;
      this.host.redraw(true);
    }
  }

  /** She's looking back at the finished picture: Cartoon beside its caption, if it has a drawing. */
  reviewStarted(): ButtonGeometry[] {
    const layout = this.layout;
    if (!layout || !this.finishedPicture?.cartoon) return [];
    this.view?.showFinishedCartoon(layout, this.saved.cartoons);
    return [{ id: 'finished-cartoon', ...layout.finishedCartoon }];
  }

  /** Cartoon on or off over the finished picture: the tick at once, the picture once the other look is loaded. Remembered. */
  private finishedCartoon(): void {
    const finished = this.finishedPicture;
    if (!finished?.cartoon) return;
    this.saved = { ...this.saved, cartoons: !this.saved.cartoons };
    saveSavedJigsaw(this.store, this.saved);
    const on = this.saved.cartoons;
    this.view?.setFinishedCartoon(on);
    const image = new Image();
    image.src = this.asShown(finished).src;
    void loaded(image).then(() => {
      // Unless she has switched again, or moved on, meanwhile.
      if (this.finishedPicture !== finished || this.saved.cartoons !== on) return;
      if (image.naturalWidth > 0) {
        this.view?.setFinishedImage(image.src);
        return;
      }
      // It couldn't be had (offline before the app ever saved it): she stays as she was.
      this.saved = { ...this.saved, cartoons: !on };
      saveSavedJigsaw(this.store, this.saved);
      this.view?.setFinishedCartoon(!on);
    });
  }
}
