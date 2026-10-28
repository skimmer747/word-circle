import { describe, expect, it } from 'vitest';
import { JigsawGame, SNAP, trayOrder } from '../src/jigsaw/rules';
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
