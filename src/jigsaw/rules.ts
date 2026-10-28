import { seededRandom, shuffle } from '../shared/random';
import { GRID_SIZES, type JigsawProgress, type JigsawStyle, type PieceCount, type Point } from './types';

/** The tray holds this many pieces at a time. */
export const TRAY_SIZE = 3;
/** A piece dropped this close to its spot (in pieces, across and down) clicks in. */
export const SNAP = 0.4;
/** On the table, a piece this close to where it belongs beside another joins it. */
export const JOIN = 0.3;

/** What a drop did: clicked in, went back to the tray, was left lying, joined others on the table, or just moved. */
export type DropResult = 'placed' | 'back' | 'loose' | 'joined' | 'moved';

/** The order the tray hands pieces out: the corners, then the other edge pieces, then the middle, each shuffled. */
export function trayOrder(cols: number, rows: number, random: () => number): number[] {
  const corners: number[] = [];
  const edges: number[] = [];
  const middle: number[] = [];
  for (let id = 0; id < cols * rows; id++) {
    const col = id % cols;
    const row = Math.floor(id / cols);
    const sides = Number(col === 0 || col === cols - 1) + Number(row === 0 || row === rows - 1);
    (sides === 2 ? corners : sides === 1 ? edges : middle).push(id);
  }
  return [...shuffle(corners, random), ...shuffle(edges, random), ...shuffle(middle, random)];
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const near = (a: Point, b: Point, limit: number) => Math.abs(a.x - b.x) <= limit && Math.abs(a.y - b.y) <= limit;
const isPermutation = (ids: readonly number[], count: number) =>
  ids.length === count && new Set(ids).size === count && ids.every((id) => Number.isInteger(id) && id >= 0 && id < count);

/** True if a saved place belongs to this style and piece count. */
function fits(style: JigsawStyle, count: PieceCount, p: JigsawProgress): boolean {
  const { cols } = GRID_SIZES[count];
  if (style === 'table') {
    if (p.positions.length !== count || p.groups.length !== count || !isPermutation(p.order, count)) return false;
    // Joined pieces must still lie exactly side by side.
    return p.groups.every((group, i) => {
      const first = p.groups.indexOf(group);
      const dx = p.positions[i][0] - p.positions[first][0] - ((i % cols) - (first % cols));
      const dy = p.positions[i][1] - p.positions[first][1] - (Math.floor(i / cols) - Math.floor(first / cols));
      return Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01;
    });
  }
  const inTray = p.tray.filter((id): id is number => id !== null);
  const every = [...p.placed, ...p.queue, ...inTray, ...p.loose.map(([id]) => id)];
  return p.tray.length === TRAY_SIZE && isPermutation(every, count) && (style === 'board' || p.loose.length === 0);
}

/**
 * One puzzle being played. Positions are in pieces (x in piece widths, y in piece heights) for a piece's body, from
 * the board's top-left corner (Tray and Board) or the table's (Table). A piece's own spot is (col, row).
 */
export class JigsawGame {
  readonly cols: number;
  readonly rows: number;
  hints: number;
  private readonly placedSet: Set<number>;
  private readonly queue: number[];
  private readonly slots: Array<number | null>;
  /** Pieces lying around, bottom first (a Map keeps the order they were put down). */
  private readonly looseMap: Map<number, Point>;
  private readonly positions: Point[];
  private readonly groups: number[];
  private order: number[];

  private constructor(
    readonly style: JigsawStyle,
    readonly count: PieceCount,
    progress: JigsawProgress,
  ) {
    const { cols, rows } = GRID_SIZES[count];
    this.cols = cols;
    this.rows = rows;
    this.hints = progress.hints;
    this.placedSet = new Set(progress.placed);
    this.queue = [...progress.queue];
    this.slots = [...progress.tray];
    this.looseMap = new Map(progress.loose.map(([id, x, y]) => [id, { x, y }]));
    this.positions = progress.positions.map(([x, y]) => ({ x, y }));
    this.groups = [...progress.groups];
    this.order = [...progress.order];
  }

  /** A new puzzle, dealt from `seed`. Table pieces start in `spots` (one each), shuffled. */
  static fresh(style: JigsawStyle, count: PieceCount, seed: number, spots: readonly Point[] = []): JigsawGame {
    const { cols, rows } = GRID_SIZES[count];
    // Not the same numbers as the cut, so which pieces come first isn't tied to their shapes.
    const random = seededRandom(seed ^ 0x5bd1e995);
    const empty: JigsawProgress = { placed: [], queue: [], tray: [], loose: [], positions: [], groups: [], order: [], hints: 0, elapsedMs: 0 };
    if (style === 'table') {
      const where = shuffle(spots.length > 0 ? spots : [{ x: 0, y: 0 }], random);
      const positions = range(count).map((id): [number, number] => [where[id % where.length].x, where[id % where.length].y]);
      return new JigsawGame(style, count, { ...empty, positions, groups: range(count), order: range(count) });
    }
    const order = trayOrder(cols, rows, random);
    return new JigsawGame(style, count, { ...empty, queue: order.slice(TRAY_SIZE), tray: order.slice(0, TRAY_SIZE) });
  }

  /** Her saved place, or null if it doesn't fit this puzzle (start afresh). */
  static restore(style: JigsawStyle, count: PieceCount, progress: JigsawProgress): JigsawGame | null {
    return fits(style, count, progress) ? new JigsawGame(style, count, progress) : null;
  }

  /** A piece's own spot. */
  home(id: number): Point {
    return { x: id % this.cols, y: Math.floor(id / this.cols) };
  }

  isPlaced(id: number): boolean {
    return this.placedSet.has(id);
  }

  /** Pieces in their spots, in the order they went in. */
  get placed(): number[] {
    return [...this.placedSet];
  }

  /** The tray's places, left to right: a piece, or null. */
  get tray(): ReadonlyArray<number | null> {
    return this.slots;
  }

  /** Pieces lying around (Board), bottom first. */
  get loose(): Array<[number, Point]> {
    return [...this.looseMap].map(([id, p]) => [id, { ...p }]);
  }

  /** Where a table piece is. */
  positionOf(id: number): Point {
    return { ...this.positions[id] };
  }

  /** Table pieces, bottom first. */
  get stacking(): readonly number[] {
    return this.order;
  }

  /** The pieces joined to `id`, itself included, bottom first (just itself off the table). */
  groupOf(id: number): number[] {
    if (this.style !== 'table') return [id];
    return this.order.filter((p) => this.groups[p] === this.groups[id]);
  }

  get solved(): boolean {
    if (this.style === 'table') return this.groups.every((group) => group === this.groups[0]);
    return this.placedSet.size === this.count;
  }

  /** She let go of piece `id` with its body at `at`. */
  drop(id: number, at: Point): DropResult {
    if (this.style === 'table') return this.dropOnTable(id, at);
    if (this.placedSet.has(id)) return 'back';
    if (near(at, this.home(id), SNAP)) {
      this.place(id);
      return 'placed';
    }
    if (this.style === 'tray') return 'back';
    this.takeOut(id);
    this.looseMap.set(id, { ...at });
    return 'loose';
  }

  /** Hint: places the tray's first piece (or, with the tray empty, the bottom one lying around). Returns it, or null when done. */
  hint(): number | null {
    if (this.solved) return null;
    if (this.style === 'table') return this.hintOnTable();
    const id = this.slots.find((slot) => slot !== null) ?? this.looseMap.keys().next().value;
    if (id === undefined) return null;
    this.place(id);
    this.hints++;
    return id;
  }

  progress(elapsedMs: number): JigsawProgress {
    return {
      placed: [...this.placedSet],
      queue: [...this.queue],
      tray: [...this.slots],
      loose: [...this.looseMap].map(([id, p]) => [id, p.x, p.y]),
      positions: this.positions.map((p) => [p.x, p.y]),
      groups: [...this.groups],
      order: [...this.order],
      hints: this.hints,
      elapsedMs: Math.round(elapsedMs),
    };
  }

  private place(id: number): void {
    this.takeOut(id);
    this.placedSet.add(id);
  }

  /** Takes a piece off the tray (the next one slides into its place) or up from where it was lying. */
  private takeOut(id: number): void {
    const slot = this.slots.indexOf(id);
    if (slot >= 0) this.slots[slot] = this.queue.shift() ?? null;
    this.looseMap.delete(id);
  }

  // Table style: Task 7.
  private dropOnTable(_id: number, _at: Point): DropResult {
    return 'moved';
  }

  private hintOnTable(): number | null {
    return null;
  }
}
