import { describe, expect, it } from 'vitest';
import { JigsawGame, JOIN, SNAP, trayOrder } from '../src/jigsaw/rules';
import { seededRandom } from '../src/shared/random';

const sorted = (ids: readonly number[]) => [...ids].sort((a, b) => a - b);
const firstInTray = (game: JigsawGame) => game.tray.find((id) => id !== null)!;

describe('the tray', () => {
  it('hands out the corners first, then the other edge pieces, then the middle', () => {
    const order = trayOrder(3, 3, seededRandom(1));
    expect(sorted(order.slice(0, 4))).toEqual([0, 2, 6, 8]);
    expect(sorted(order.slice(4, 8))).toEqual([1, 3, 5, 7]);
    expect(order[8]).toBe(4);
    const big = trayOrder(6, 5, seededRandom(1));
    expect(new Set(big).size).toBe(30);
    expect(sorted(big.slice(0, 4))).toEqual([0, 5, 24, 29]);
  });

  it('starts with three corners in the tray', () => {
    const game = JigsawGame.fresh('tray', 9, 42);
    expect(game.tray).toHaveLength(3);
    for (const id of game.tray) expect([0, 2, 6, 8]).toContain(id);
    expect(game.placed).toEqual([]);
  });
});

describe('Tray style', () => {
  it('clicks a piece into its spot when dropped near it, and slides the next one in', () => {
    const game = JigsawGame.fresh('tray', 9, 42);
    const id = game.tray[1]!;
    const home = game.home(id);
    expect(game.drop(id, { x: home.x + SNAP - 0.01, y: home.y - SNAP + 0.01 })).toBe('placed');
    expect(game.isPlaced(id)).toBe(true);
    expect(game.tray).not.toContain(id);
    expect(game.tray[1]).not.toBeNull();
  });

  it('sends a piece back to the tray when dropped anywhere else', () => {
    const game = JigsawGame.fresh('tray', 9, 42);
    const id = game.tray[0]!;
    const home = game.home(id);
    expect(game.drop(id, { x: home.x + SNAP + 0.05, y: home.y })).toBe('back');
    expect(game.tray[0]).toBe(id);
    expect(game.isPlaced(id)).toBe(false);
    expect(game.loose).toEqual([]);
  });

  it("hints the tray's first piece, and is solved when every piece is in", () => {
    const game = JigsawGame.fresh('tray', 9, 7);
    const first = game.tray[0]!;
    expect(game.hint()).toBe(first);
    expect(game.isPlaced(first)).toBe(true);
    while (!game.solved) {
      const id = firstInTray(game);
      expect(game.drop(id, game.home(id))).toBe('placed');
    }
    expect(game.tray).toEqual([null, null, null]);
    expect(game.hints).toBe(1);
    expect(game.hint()).toBeNull();
  });
});

describe('Board style', () => {
  it('leaves a piece where she drops it, and hands her the next one', () => {
    const game = JigsawGame.fresh('board', 16, 3);
    const id = game.tray[2]!;
    expect(game.drop(id, { x: 1.5, y: 1.5 })).toBe('loose');
    expect(game.loose).toEqual([[id, { x: 1.5, y: 1.5 }]]);
    expect(game.tray).not.toContain(id);
    expect(game.tray[2]).not.toBeNull();
  });

  it('lets her pick a loose piece up again and click it in', () => {
    const game = JigsawGame.fresh('board', 16, 3);
    const id = game.tray[0]!;
    game.drop(id, { x: 1.5, y: 1.5 });
    expect(game.drop(id, game.home(id))).toBe('placed');
    expect(game.loose).toEqual([]);
  });

  it('keeps the most recently moved loose piece on top', () => {
    const game = JigsawGame.fresh('board', 16, 3);
    const [a, b] = [game.tray[0]!, game.tray[1]!];
    game.drop(a, { x: 1.5, y: 1.5 });
    game.drop(b, { x: 1.6, y: 1.6 });
    game.drop(a, { x: 1.7, y: 1.7 });
    expect(game.loose.map(([id]) => id)).toEqual([b, a]);
  });

  it('hints a piece from the tray first, then the bottom piece lying around', () => {
    const game = JigsawGame.fresh('board', 9, 5);
    const dropped: number[] = [];
    while (game.tray.some((id) => id !== null)) {
      const id = firstInTray(game);
      dropped.push(id);
      game.drop(id, { x: 1.5, y: 1.5 });
    }
    expect(game.hint()).toBe(dropped[0]);
    expect(game.loose).toHaveLength(8);
  });
});

describe('saving and restoring', () => {
  it('picks up exactly where she left off', () => {
    const game = JigsawGame.fresh('board', 16, 9);
    game.drop(game.tray[0]!, { x: 1.5, y: 1.5 });
    game.hint();
    const saved = game.progress(12_345);
    expect(saved.elapsedMs).toBe(12_345);
    expect(JigsawGame.restore('board', 16, saved)!.progress(12_345)).toEqual(saved);
  });

  it("starts afresh when the save doesn't fit the puzzle", () => {
    const saved = JigsawGame.fresh('tray', 9, 1).progress(0);
    expect(JigsawGame.restore('tray', 16, saved)).toBeNull();
    expect(JigsawGame.restore('tray', 9, { ...saved, queue: [...saved.queue, 0] })).toBeNull();
    expect(JigsawGame.restore('tray', 9, { ...saved, loose: [[saved.queue[0], 1, 1]], queue: saved.queue.slice(1) })).toBeNull();
    expect(JigsawGame.restore('table', 9, saved)).toBeNull();
  });
});

/** Table spots 1.6 pieces apart: nothing starts close enough to join. */
const spots = Array.from({ length: 40 }, (_, i) => ({ x: (i % 8) * 1.6, y: Math.floor(i / 8) * 1.6 }));

describe('Table style', () => {
  it('spreads the pieces over the table, each on its own', () => {
    const game = JigsawGame.fresh('table', 9, 4, spots);
    const where = Array.from({ length: 9 }, (_, id) => game.positionOf(id));
    expect(new Set(where.map((p) => `${p.x},${p.y}`)).size).toBe(9);
    for (const p of where) expect(spots).toContainEqual(p);
    expect(game.solved).toBe(false);
  });

  it('joins a piece dropped close beside the piece it fits, lined up exactly', () => {
    const game = JigsawGame.fresh('table', 9, 4, spots);
    const anchor = game.positionOf(0);
    expect(game.drop(1, { x: anchor.x + 1 + JOIN - 0.05, y: anchor.y - 0.1 })).toBe('joined');
    expect(game.positionOf(1).x).toBeCloseTo(anchor.x + 1);
    expect(game.positionOf(1).y).toBeCloseTo(anchor.y);
    expect(game.positionOf(0)).toEqual(anchor);
    expect(sorted(game.groupOf(0))).toEqual([0, 1]);
  });

  it('moves joined pieces together', () => {
    const game = JigsawGame.fresh('table', 9, 4, spots);
    const anchor = game.positionOf(0);
    game.drop(1, { x: anchor.x + 1, y: anchor.y });
    expect(game.drop(0, { x: 20, y: 20 })).toBe('moved');
    expect(game.positionOf(0).x).toBeCloseTo(20);
    expect(game.positionOf(1).x).toBeCloseTo(21);
    expect(game.positionOf(1).y).toBeCloseTo(20);
  });

  it('leaves a piece where she drops it when it fits nothing there, on top', () => {
    const game = JigsawGame.fresh('table', 9, 4, spots);
    expect(game.drop(4, { x: 30, y: 30 })).toBe('moved');
    expect(game.positionOf(4)).toEqual({ x: 30, y: 30 });
    expect(game.stacking[game.stacking.length - 1]).toBe(4);
  });

  it('hints by joining a piece to the biggest group, and is solved when all are one', () => {
    const game = JigsawGame.fresh('table', 9, 4, spots);
    const anchor = game.positionOf(0);
    game.drop(1, { x: anchor.x + 1, y: anchor.y });
    const hinted = game.hint()!;
    expect(game.groupOf(0)).toContain(hinted);
    expect(game.groupOf(0)).toHaveLength(3);
    for (let i = 0; i < 6; i++) game.hint();
    expect(game.solved).toBe(true);
    expect(game.hints).toBe(7);
    expect(game.hint()).toBeNull();
  });

  it('saves and restores the table, and refuses one where joined pieces have come apart', () => {
    const game = JigsawGame.fresh('table', 16, 8, spots);
    const anchor = game.positionOf(5);
    game.drop(6, { x: anchor.x + 1, y: anchor.y });
    const saved = game.progress(500);
    expect(JigsawGame.restore('table', 16, saved)!.progress(500)).toEqual(saved);
    const broken = { ...saved, positions: saved.positions.map(([x, y], id): [number, number] => (id === 6 ? [x + 2, y] : [x, y])) };
    expect(JigsawGame.restore('table', 16, broken)).toBeNull();
  });
});
