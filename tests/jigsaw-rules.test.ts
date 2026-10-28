import { describe, expect, it } from 'vitest';
import { computeFrameLayout } from '../src/frame/layout';
import { computeJigsawLayout, tablePieces } from '../src/jigsaw/layout';
import { JigsawGame, JOIN, SNAP, trayOrder } from '../src/jigsaw/rules';
import { JIGSAW_STYLES, PIECE_COUNTS, type Point } from '../src/jigsaw/types';
import { seededRandom } from '../src/shared/random';
import { SCREENS_AND_THUMBS } from './screens';

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

/** Places 1.6 pieces apart, for spreading pieces out: nothing starts close enough to join, or near its own spot. */
const spots = Array.from({ length: 40 }, (_, i) => ({ x: 7 + (i % 8) * 1.6, y: Math.floor(i / 8) * 1.6 }));

describe('Board style', () => {
  it('spreads every piece out at the start, with no tray', () => {
    const game = JigsawGame.fresh('board', 9, 4, spots);
    expect(game.tray).toEqual([null, null, null]);
    expect(game.placed).toEqual([]);
    const where = game.loose.map(([, p]) => p);
    expect(sorted(game.loose.map(([id]) => id))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(where.map((p) => `${p.x},${p.y}`)).size).toBe(9);
    for (const p of where) expect(spots).toContainEqual(p);
  });

  it('clicks a piece into its spot when dropped near it, and leaves it where she drops it otherwise', () => {
    const game = JigsawGame.fresh('board', 16, 3, spots);
    const [[a], [b]] = game.loose;
    expect(game.drop(a, { x: game.home(a).x + SNAP - 0.01, y: game.home(a).y })).toBe('placed');
    expect(game.isPlaced(a)).toBe(true);
    expect(game.drop(b, { x: 1.5, y: 1.5 })).toBe('loose');
    expect(game.loose[game.loose.length - 1]).toEqual([b, { x: 1.5, y: 1.5 }]);
    expect(game.drop(b, game.home(b))).toBe('placed');
  });

  it('keeps the most recently moved loose piece on top', () => {
    const game = JigsawGame.fresh('board', 16, 3, spots);
    const [[a], [b]] = game.loose;
    game.drop(a, { x: 1.5, y: 1.5 });
    game.drop(b, { x: 1.6, y: 1.6 });
    game.drop(a, { x: 1.7, y: 1.7 });
    expect(game.loose.slice(-2).map(([id]) => id)).toEqual([b, a]);
  });

  it('hints the corners first, then the other edge pieces, then the middle', () => {
    const game = JigsawGame.fresh('board', 9, 5, spots);
    const hinted = Array.from({ length: 9 }, () => game.hint()!);
    expect(sorted(hinted.slice(0, 4))).toEqual([0, 2, 6, 8]);
    expect(sorted(hinted.slice(4, 8))).toEqual([1, 3, 5, 7]);
    expect(hinted[8]).toBe(4);
    expect(game.solved).toBe(true);
    expect(game.hints).toBe(9);
  });

  it('starts afresh from a Board save made when Board had a tray', () => {
    const old = JigsawGame.fresh('tray', 9, 1).progress(0);
    expect(JigsawGame.restore('board', 9, old)).toBeNull();
  });
});

describe('saving and restoring', () => {
  it('picks up exactly where she left off', () => {
    const game = JigsawGame.fresh('board', 16, 9, spots);
    game.drop(game.loose[0][0], { x: 1.5, y: 1.5 });
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

describe('drops that make no sense', () => {
  it.each(['tray', 'board'] as const)('%s: sends back a piece that is waiting, placed, out of range, or dropped nowhere', (style) => {
    const game = JigsawGame.fresh(style, 9, 42, spots);
    const before = game.progress(0);
    if (style === 'tray') {
      const waiting = game.progress(0).queue[0];
      expect(game.drop(waiting, game.home(waiting))).toBe('back');
    }
    expect(game.drop(99, { x: 1, y: 1 })).toBe('back');
    expect(game.drop(-1, { x: 1, y: 1 })).toBe('back');
    expect(game.drop(1.5, { x: 1, y: 1 })).toBe('back');
    const id = style === 'tray' ? game.tray[0]! : game.loose[0][0];
    expect(game.drop(id, { x: NaN, y: 1 })).toBe('back');
    expect(game.drop(id, { x: 1, y: Infinity })).toBe('back');
    expect(game.progress(0)).toEqual(before);

    expect(game.drop(id, game.home(id))).toBe('placed');
    const placed = game.progress(0);
    expect(game.drop(id, { x: 1, y: 1 })).toBe('back');
    expect(game.progress(0)).toEqual(placed);
  });

  it('Table: ignores a piece that does not exist, or a place that is not a place', () => {
    const game = JigsawGame.fresh('table', 9, 4, spots);
    const before = game.progress(0);
    expect(game.drop(99, { x: 1, y: 1 })).toBe('moved');
    expect(game.drop(-1, { x: 1, y: 1 })).toBe('moved');
    expect(game.drop(1.5, { x: 1, y: 1 })).toBe('moved');
    expect(game.drop(2, { x: NaN, y: 1 })).toBe('moved');
    expect(game.drop(2, { x: 1, y: Infinity })).toBe('moved');
    expect(game.progress(0)).toEqual(before);
  });

  it('hands out the tray as a copy, so nobody can change it from outside', () => {
    const game = JigsawGame.fresh('tray', 9, 42);
    const before = game.progress(0);
    (game.tray as Array<number | null>)[0] = null;
    expect(game.progress(0)).toEqual(before);
  });
});

describe('saves that fit, and saves that would leave her stuck', () => {
  it('accepts a Tray save with empty places once nothing is left to hand out', () => {
    const game = JigsawGame.fresh('tray', 9, 11);
    while (game.progress(0).queue.length > 0) game.drop(firstInTray(game), game.home(firstInTray(game)));
    game.drop(firstInTray(game), game.home(firstInTray(game)));
    const saved = game.progress(0);
    expect(saved.queue).toEqual([]);
    expect(saved.tray).toContain(null);
    expect(JigsawGame.restore('tray', 9, saved)!.progress(0)).toEqual(saved);
  });

  it('accepts a Board save with a loose piece lying exactly over its own spot', () => {
    const game = JigsawGame.fresh('board', 9, 11, spots);
    const id = game.loose[0][0];
    const home = game.home(id);
    expect(game.drop(id, { x: home.x + SNAP + 0.01, y: home.y })).toBe('loose');
    const saved = game.progress(0);
    const over = { ...saved, loose: saved.loose.map(([piece, x, y]): [number, number, number] => (piece === id ? [piece, home.x, home.y] : [piece, x, y])) };
    expect(JigsawGame.restore('board', 9, over)!.progress(0)).toEqual(over);
  });

  it('refuses a Tray save with empty places while pieces are still waiting', () => {
    const saved = JigsawGame.fresh('tray', 9, 1).progress(0);
    const inTray = saved.tray.filter((id): id is number => id !== null);
    expect(JigsawGame.restore('tray', 9, { ...saved, tray: [null, null, null], queue: [...inTray, ...saved.queue] })).toBeNull();
    expect(JigsawGame.restore('tray', 9, { ...saved, tray: [inTray[0], null, inTray[2]], queue: [inTray[1], ...saved.queue] })).toBeNull();
  });
});

describe('Table style, the finer points', () => {
  it('does not join a piece dropped just outside JOIN', () => {
    const game = JigsawGame.fresh('table', 9, 4, spots);
    const anchor = game.positionOf(0);
    expect(game.drop(1, { x: anchor.x + 1 + JOIN + 0.02, y: anchor.y })).toBe('moved');
    expect(game.groupOf(1)).toEqual([1]);
    expect(game.positionOf(1).x).toBeCloseTo(anchor.x + 1 + JOIN + 0.02);
  });

  it('pulls in the piece on the other side when a drop fills the gap between two', () => {
    const game = JigsawGame.fresh('table', 9, 4, spots);
    const p0 = game.positionOf(0);
    game.settle(2, { x: p0.x + 2, y: p0.y });
    expect(game.groupOf(2)).toEqual([2]);
    expect(game.drop(1, { x: p0.x + 1.05, y: p0.y + 0.05 })).toBe('joined');
    expect(sorted(game.groupOf(0))).toEqual([0, 1, 2]);
    // Dropped dead centre, so which side it lines up with is a toss-up; all three end up in line.
    expect(game.positionOf(0).x).toBeCloseTo(p0.x);
    expect(game.positionOf(0).y).toBeCloseTo(p0.y);
    expect(game.positionOf(1).x).toBeCloseTo(p0.x + 1);
    expect(game.positionOf(1).y).toBeCloseTo(p0.y);
    expect(game.positionOf(2).x).toBeCloseTo(p0.x + 2);
    expect(game.positionOf(2).y).toBeCloseTo(p0.y);
  });

  it('moves a nearly-placed piece into line when it gets pulled in', () => {
    const game = JigsawGame.fresh('table', 9, 4, spots);
    const p0 = game.positionOf(0);
    game.settle(2, { x: p0.x + 2.2, y: p0.y });
    expect(game.drop(1, { x: p0.x + 1.05, y: p0.y })).toBe('joined');
    expect(sorted(game.groupOf(0))).toEqual([0, 1, 2]);
    expect(game.positionOf(0)).toEqual(p0);
    expect(game.positionOf(1).x).toBeCloseTo(p0.x + 1);
    expect(game.positionOf(2).x).toBeCloseTo(p0.x + 2);
    expect(game.positionOf(2).y).toBeCloseTo(p0.y);
  });

  it('lines a piece up with the closer of two it could join', () => {
    const game = JigsawGame.fresh('table', 9, 4, spots);
    const p0 = game.positionOf(0);
    // Dropped 0.05 from piece 0's side and 0.29 from piece 2's, and the two don't fit each other.
    game.settle(2, { x: p0.x + 2.34, y: p0.y });
    expect(game.drop(1, { x: p0.x + 1.05, y: p0.y })).toBe('joined');
    expect(sorted(game.groupOf(1))).toEqual([0, 1]);
    expect(game.positionOf(1).x).toBeCloseTo(p0.x + 1);
    expect(game.positionOf(2).x).toBeCloseTo(p0.x + 2.34);
  });

  it('hints toward the lower-numbered group when two are the same size', () => {
    const game = JigsawGame.fresh('table', 9, 4, spots);
    const p0 = game.positionOf(0);
    const p7 = game.positionOf(7);
    game.drop(1, { x: p0.x + 1, y: p0.y });
    game.drop(8, { x: p7.x + 1, y: p7.y });
    expect(game.groupOf(0)).toHaveLength(2);
    expect(game.groupOf(7)).toHaveLength(2);
    const hinted = game.hint()!;
    expect(game.groupOf(0)).toContain(hinted);
    expect(game.groupOf(0)).toHaveLength(3);
    expect(game.groupOf(7)).toHaveLength(2);
  });

  it('settles a whole group without joining it to anything or changing what is on top', () => {
    const game = JigsawGame.fresh('table', 9, 4, spots);
    const p0 = game.positionOf(0);
    game.drop(1, { x: p0.x + 1, y: p0.y });
    const stacking = [...game.stacking];
    game.settle(1, { x: 20, y: 20 });
    expect(game.positionOf(1).x).toBeCloseTo(20);
    expect(game.positionOf(1).y).toBeCloseTo(20);
    expect(game.positionOf(0).x).toBeCloseTo(19);
    expect(game.positionOf(0).y).toBeCloseTo(20);
    expect(sorted(game.groupOf(0))).toEqual([0, 1]);
    expect([...game.stacking]).toEqual(stacking);
    // Right where piece 2 belongs beside piece 1, and still it doesn't join.
    game.settle(2, { x: 21, y: 20 });
    expect(game.groupOf(2)).toEqual([2]);
    expect([...game.stacking]).toEqual(stacking);
  });

  it('settles nothing off the table, or for a piece or place that is not real', () => {
    const table = JigsawGame.fresh('table', 9, 4, spots);
    const before = table.progress(0);
    table.settle(99, { x: 1, y: 1 });
    table.settle(2, { x: NaN, y: 1 });
    expect(table.progress(0)).toEqual(before);
    const board = JigsawGame.fresh('board', 9, 4, spots);
    const boardBefore = board.progress(0);
    board.settle(0, { x: 1, y: 1 });
    expect(board.progress(0)).toEqual(boardBefore);
  });
});

describe('a long random game', () => {
  const cases = JIGSAW_STYLES.flatMap((style) => PIECE_COUNTS.map((count) => [style, count] as const));

  it.each(cases)('%s, %i pieces: every piece is in one place, and every save loads', (style, count) => {
    const random = seededRandom(count * 7 + style.length);
    const game = JigsawGame.fresh(style, count, 5, spots);
    const { cols } = game;
    const ids = Array.from({ length: count }, (_, i) => i);
    const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)];
    const aim = (id: number): Point => {
      if (style === 'table') {
        const beside = [id - cols, id + 1, id + cols, id - 1].filter((q) => q >= 0 && q < count && (Math.abs(q - id) !== 1 || Math.floor(q / cols) === Math.floor(id / cols)));
        if (random() < 0.6) {
          const q = pick(beside);
          const at = game.positionOf(q);
          return { x: at.x + (id % cols) - (q % cols) + (random() - 0.5) * 0.7, y: at.y + Math.floor(id / cols) - Math.floor(q / cols) + (random() - 0.5) * 0.7 };
        }
        return { x: random() * 10, y: random() * 8 };
      }
      if (random() < 0.4) return { x: game.home(id).x + (random() - 0.5) * 0.6, y: game.home(id).y + (random() - 0.5) * 0.6 };
      return { x: random() * (cols + 2) - 1, y: random() * (game.rows + 2) - 1 };
    };

    for (let step = 0; step < 300; step++) {
      if (random() < 0.05) {
        game.hint();
      } else {
        const movable = style === 'table' ? ids : [...game.tray.filter((id): id is number => id !== null), ...game.loose.map(([id]) => id)];
        if (movable.length > 0) {
          const id = pick(movable);
          game.drop(id, aim(id));
        }
      }
      const saved = game.progress(0);
      if (style === 'table') {
        expect(sorted(saved.order)).toEqual(ids);
      } else {
        const every = [...saved.placed, ...saved.queue, ...saved.tray.filter((id): id is number => id !== null), ...saved.loose.map(([id]) => id)];
        expect(sorted(every)).toEqual(ids);
      }
      expect(JigsawGame.restore(style, count, JSON.parse(JSON.stringify(saved)))).not.toBeNull();
    }
  });
});

describe('the table layout and the rules', () => {
  it('sets the pieces out so that none joins just by lying there', () => {
    const failures: string[] = [];
    for (const [width, height, thumb] of SCREENS_AND_THUMBS) {
      const layout = computeJigsawLayout(computeFrameLayout(width, height, 4, thumb), 'table');
      const origin = layout.free[0];
      for (const count of PIECE_COUNTS) {
        const table = tablePieces(layout, count);
        if (table.spots.length < count) failures.push(`${width}x${height} thumb ${thumb}, ${count} pieces: only ${table.spots.length} spots`);
        // In table piece units from the table's top-left, as the rules see them.
        const at = table.spots.map((spot) => ({ x: (spot.x - origin.x) / table.w, y: (spot.y - origin.y) / table.h }));
        at.forEach((a, i) =>
          at.forEach((b, j) => {
            if (i >= j) return;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              if (Math.abs(b.x - a.x - dx) <= JOIN && Math.abs(b.y - a.y - dy) <= JOIN) failures.push(`${width}x${height} thumb ${thumb}, ${count} pieces: spots ${i} and ${j}`);
            }
          }),
        );
      }
    }
    expect(failures).toEqual([]);
  });
});
