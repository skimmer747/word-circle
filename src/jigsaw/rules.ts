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

/** How many of the picture's edges a piece is on: 2 for a corner, 1 for an edge piece, 0 in the middle. */
function edgesOf(id: number, cols: number, rows: number): number {
  const col = id % cols;
  const row = Math.floor(id / cols);
  return Number(col === 0 || col === cols - 1) + Number(row === 0 || row === rows - 1);
}

/** The order the tray hands pieces out: the corners, then the other edge pieces, then the middle, each shuffled. */
export function trayOrder(cols: number, rows: number, random: () => number, mixed = false): number[] {
  // With edges hidden, corners first would give them away.
  if (mixed) return shuffle(range(cols * rows), random);
  const corners: number[] = [];
  const edges: number[] = [];
  const middle: number[] = [];
  for (let id = 0; id < cols * rows; id++) {
    const sides = edgesOf(id, cols, rows);
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
  if (p.tray.length !== TRAY_SIZE || !isPermutation(every, count)) return false;
  // Board has no tray: every piece is placed or lying around (a save from when it had one starts afresh).
  if (style === 'board') return p.queue.length === 0 && inTray.length === 0;
  // Tray: nothing lies around, and a place in the tray is only ever empty once nothing is left to hand out.
  return p.loose.length === 0 && (p.queue.length === 0 || !p.tray.includes(null));
}

/**
 * One puzzle being played. Positions are in pieces (x in piece widths, y in piece heights) for a piece's body, from
 * the board's top-left corner (Tray and Board) or the table's (Table). A piece's own spot is (col, row).
 */
export class JigsawGame {
  readonly cols: number;
  readonly rows: number;
  private hintCount: number;
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
    this.hintCount = progress.hints;
    this.placedSet = new Set(progress.placed);
    this.queue = [...progress.queue];
    this.slots = [...progress.tray];
    this.looseMap = new Map(progress.loose.map(([id, x, y]) => [id, { x, y }]));
    this.positions = progress.positions.map(([x, y]) => ({ x, y }));
    this.groups = [...progress.groups];
    this.order = [...progress.order];
  }

  /**
   * A new puzzle, dealt from `seed`. Board and Table pieces start spread out in `spots` (needs at least one per piece,
   * in pieces like every position), shuffled; Tray pieces wait in the tray and its queue, corners first, or in any
   * order when `mixed` (Hide edges).
   */
  static fresh(style: JigsawStyle, count: PieceCount, seed: number, spots: readonly Point[] = [], mixed = false): JigsawGame {
    const { cols, rows } = GRID_SIZES[count];
    // Not the same numbers as the cut, so which pieces come first isn't tied to their shapes.
    const random = seededRandom(seed ^ 0x5bd1e995);
    const empty: JigsawProgress = { placed: [], queue: [], tray: [], loose: [], positions: [], groups: [], order: [], hints: 0, elapsedMs: 0 };
    if (style !== 'tray') {
      const where = shuffle(spots.length > 0 ? spots : [{ x: 0, y: 0 }], random);
      const positions = range(count).map((id): [number, number] => [where[id % where.length].x, where[id % where.length].y]);
      if (style === 'board') {
        return new JigsawGame(style, count, { ...empty, tray: [null, null, null], loose: positions.map(([x, y], id): [number, number, number] => [id, x, y]) });
      }
      return new JigsawGame(style, count, { ...empty, positions, groups: range(count), order: range(count) });
    }
    const order = trayOrder(cols, rows, random, mixed);
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

  /** How many times Hint has helped. */
  get hints(): number {
    return this.hintCount;
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
    return [...this.slots];
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

  /** She let go of piece `id`; `at` is where its body's top-left corner is, in pieces. */
  drop(id: number, at: Point): DropResult {
    if (!Number.isFinite(at.x) || !Number.isFinite(at.y)) return this.style === 'table' ? 'moved' : 'back';
    if (this.style === 'table') return this.positions[id] ? this.dropOnTable(id, at) : 'moved';
    // Only a piece in the tray or lying around can be moved.
    if (!this.slots.includes(id) && !this.looseMap.has(id)) return 'back';
    if (near(at, this.home(id), SNAP)) {
      this.place(id);
      return 'placed';
    }
    if (this.style === 'tray') return 'back';
    this.takeOut(id);
    this.looseMap.set(id, { ...at });
    return 'loose';
  }

  /** Table: moves `id`'s group so `id` lies at `at`, without joining or raising it (the screen keeping a group in view). */
  settle(id: number, at: Point): void {
    if (this.style !== 'table' || !this.positions[id] || !Number.isFinite(at.x) || !Number.isFinite(at.y)) return;
    const from = this.positions[id];
    this.shift(this.groupOf(id), at.x - from.x, at.y - from.y);
  }

  /**
   * Hint: places the tray's first piece (Tray), or a piece lying around, corners first, then edge pieces, then the
   * middle, the lowest first (Board). Table joins a piece to the biggest group. Returns the piece, or null when done.
   */
  hint(): number | null {
    if (this.solved) return null;
    if (this.style === 'table') return this.hintOnTable();
    const lying = [...this.looseMap.keys()];
    const byEdges = (a: number, b: number) => edgesOf(b, this.cols, this.rows) - edgesOf(a, this.cols, this.rows);
    const id = this.slots.find((slot) => slot !== null) ?? lying.sort(byEdges)[0];
    if (id === undefined || id === null) return null;
    this.place(id);
    this.hintCount++;
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
      hints: this.hintCount,
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

  private dropOnTable(id: number, at: Point): DropResult {
    const group = this.groupOf(id);
    const from = this.positions[id];
    this.shift(group, at.x - from.x, at.y - from.y);
    this.raise(group);
    return this.joinAll(group) ? 'joined' : 'moved';
  }

  /** Joins the biggest group (the lowest-numbered of the biggest) to a piece that belongs next to it. */
  private hintOnTable(): number | null {
    const sizes = new Map<number, number>();
    for (const group of this.groups) sizes.set(group, (sizes.get(group) ?? 0) + 1);
    let biggest = this.groups[0];
    for (const [group, size] of sizes) {
      const best = sizes.get(biggest)!;
      if (size > best || (size === best && group < biggest)) biggest = group;
    }
    const members = range(this.count).filter((p) => this.groups[p] === biggest);
    for (const p of members) {
      for (const q of this.neighbors(p)) {
        if (this.groups[q] === biggest) continue;
        const target = this.beside(p, q);
        this.shift(this.groupOf(q), target.x - this.positions[q].x, target.y - this.positions[q].y);
        this.raise(this.merge(members, this.groupOf(q)));
        this.hintCount++;
        return q;
      }
    }
    return null;
  }

  /** Where `q` belongs if `p` stays put. */
  private beside(p: number, q: number): Point {
    return {
      x: this.positions[p].x + (q % this.cols) - (p % this.cols),
      y: this.positions[p].y + Math.floor(q / this.cols) - Math.floor(p / this.cols),
    };
  }

  /** The pieces above, right, below and left of `p` in the picture. */
  private neighbors(p: number): number[] {
    const col = p % this.cols;
    const row = Math.floor(p / this.cols);
    const out: number[] = [];
    if (row > 0) out.push(p - this.cols);
    if (col < this.cols - 1) out.push(p + 1);
    if (row < this.rows - 1) out.push(p + this.cols);
    if (col > 0) out.push(p - 1);
    return out;
  }

  /** A piece of `members` and a neighbor outside the group that lies close to where it belongs: the closest such pair. */
  private closePair(members: readonly number[]): [number, number] | null {
    let best: [number, number] | null = null;
    let bestDistance = Infinity;
    for (const p of members) {
      for (const q of this.neighbors(p)) {
        if (this.groups[q] === this.groups[p]) continue;
        const want = this.beside(p, q);
        const distance = Math.max(Math.abs(this.positions[q].x - want.x), Math.abs(this.positions[q].y - want.y));
        if (distance <= JOIN && distance < bestDistance) [best, bestDistance] = [[p, q], distance];
      }
    }
    return best;
  }

  /** The first join moves what she dropped onto the piece it fits; anything else that then fits is pulled in. */
  private joinAll(dropped: number[]): boolean {
    let members = dropped;
    let joined = false;
    for (let pair = this.closePair(members); pair; pair = this.closePair(members)) {
      const [p, q] = pair;
      const target = this.beside(p, q);
      const other = this.groupOf(q);
      if (joined) this.shift(other, target.x - this.positions[q].x, target.y - this.positions[q].y);
      else this.shift(members, this.positions[q].x - target.x, this.positions[q].y - target.y);
      members = this.merge(members, other);
      joined = true;
    }
    if (joined) this.raise(members);
    return joined;
  }

  /** One group from two; it takes the lower group number. */
  private merge(a: readonly number[], b: readonly number[]): number[] {
    const group = Math.min(this.groups[a[0]], this.groups[b[0]]);
    for (const p of [...a, ...b]) this.groups[p] = group;
    return this.groupOf(a[0]);
  }

  private shift(ids: readonly number[], dx: number, dy: number): void {
    for (const p of ids) this.positions[p] = { x: this.positions[p].x + dx, y: this.positions[p].y + dy };
  }

  /** Brings pieces to the top, keeping their order among themselves. */
  private raise(ids: readonly number[]): void {
    const lifted = new Set(ids);
    this.order = [...this.order.filter((p) => !lifted.has(p)), ...this.order.filter((p) => lifted.has(p))];
  }
}
