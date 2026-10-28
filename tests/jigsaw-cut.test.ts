import { describe, expect, it } from 'vitest';
import { cutPieces, pieceSeed, piecePath, tabFor, type PieceShape } from '../src/jigsaw/cut';
import { GRID_SIZES, PIECE_COUNTS } from '../src/jigsaw/types';

const numbers = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
/** A path's numbers as x values (even positions) and y values (odd positions). */
const xs = (d: string) => numbers(d).filter((_, i) => i % 2 === 0);
const ys = (d: string) => numbers(d).filter((_, i) => i % 2 === 1);

describe('cutting a picture into pieces', () => {
  it.each(PIECE_COUNTS)('fits every tab into the hole next door (%i pieces)', (count) => {
    const { cols, rows } = GRID_SIZES[count];
    const pieces = cutPieces(cols, rows, 12345);
    expect(pieces).toHaveLength(count);
    pieces.forEach((piece, i) => {
      expect(piece).toMatchObject({ col: i % cols, row: Math.floor(i / cols) });
      if (piece.col === 0) expect(piece.left).toBe(0);
      if (piece.row === 0) expect(piece.top).toBe(0);
      if (piece.col === cols - 1) expect(piece.right).toBe(0);
      else {
        expect(piece.right).not.toBe(0);
        expect(pieces[i + 1].left).toBe(-piece.right);
      }
      if (piece.row === rows - 1) expect(piece.bottom).toBe(0);
      else {
        expect(piece.bottom).not.toBe(0);
        expect(pieces[i + cols].top).toBe(-piece.bottom);
      }
    });
  });

  it('cuts the same puzzle the same way every time, and other puzzles differently', () => {
    const seed = pieceSeed('starter:lake', 30);
    expect(cutPieces(6, 5, seed)).toEqual(cutPieces(6, 5, seed));
    expect(pieceSeed('starter:lake', 30)).toBe(seed);
    expect(pieceSeed('starter:barn', 30)).not.toBe(seed);
    expect(pieceSeed('starter:lake', 16)).not.toBe(seed);
  });

  it('a 30-piece puzzle has both tabs and holes on its right edges', () => {
    const rights = cutPieces(6, 5, pieceSeed('starter:lake', 30)).map((piece) => piece.right);
    expect(rights).toContain(1);
    expect(rights).toContain(-1);
  });

  // These pins exist so a change can't silently re-cut saved puzzles.
  it('keeps the seeds and cuts that saved puzzles were made with', () => {
    expect(pieceSeed('starter:lake', 30)).toBe(3378904746);
    const pinned = cutPieces(3, 3, pieceSeed('starter:lake', 9));
    expect(pinned.map((piece) => piece.right)).toEqual([-1, -1, 0, 1, 1, 0, 1, -1, 0]);
    expect(pinned.map((piece) => piece.bottom)).toEqual([1, -1, -1, -1, 1, 1, 0, 0, 0]);
  });

  it("draws each outline inside the piece's box, with a knob for every tab and hole", () => {
    const [w, h] = [105, 94];
    const tab = tabFor(w, h);
    for (const piece of cutPieces(6, 5, 99)) {
      const d = piecePath(piece, w, h, tab);
      expect(d).toMatch(/^M /);
      expect(d).toMatch(/ Z$/);
      expect(Math.min(...numbers(d))).toBeGreaterThanOrEqual(-0.01);
      expect(Math.max(...xs(d))).toBeLessThanOrEqual(w + 2 * tab + 0.01);
      expect(Math.max(...ys(d))).toBeLessThanOrEqual(h + 2 * tab + 0.01);
      const knobs = [piece.top, piece.right, piece.bottom, piece.left].filter((edge) => edge !== 0).length;
      expect((d.match(/ C /g) ?? []).length).toBe(4 * knobs);
    }
  });

  it('makes tabs a fifth of the shorter side', () => {
    expect(tabFor(100, 80)).toBe(16);
  });
});

describe('which way each side bulges, on a 105 × 94 piece', () => {
  // The body's corners sit at x = tab and w + tab, y = tab and h + tab (tab is 18.8 here).
  // A tab reaches a full tab out past the body; a hole cuts a full tab in.
  const [w, h] = [105, 94];
  const tab = tabFor(w, h);
  const flat: PieceShape = { col: 0, row: 0, top: 0, right: 0, bottom: 0, left: 0 };
  const outline = (shape: PieceShape) => piecePath(shape, w, h, tab);

  it('a top tab reaches up to y = 0', () => {
    expect(Math.min(...ys(outline({ ...flat, top: 1 })))).toBeCloseTo(0, 2);
  });

  it('a top hole cuts down to y = 2·tab, and nothing goes above the body', () => {
    const d = outline({ ...flat, top: -1 });
    expect(Math.min(...ys(d))).toBeCloseTo(tab, 2);
    expect(ys(d)).toContainEqual(expect.closeTo(2 * tab, 2));
  });

  it('a right tab reaches out to x = w + 2·tab', () => {
    expect(Math.max(...xs(outline({ ...flat, right: 1 })))).toBeCloseTo(w + 2 * tab, 2);
  });

  it('a right hole cuts in to x = w, and the body still ends at x = w + tab', () => {
    const d = outline({ ...flat, right: -1 });
    expect(Math.max(...xs(d))).toBeCloseTo(w + tab, 2);
    expect(xs(d)).toContainEqual(expect.closeTo(w, 2));
  });

  it('a bottom tab reaches down to y = h + 2·tab', () => {
    expect(Math.max(...ys(outline({ ...flat, bottom: 1 })))).toBeCloseTo(h + 2 * tab, 2);
  });

  it('a bottom hole cuts up to y = h, and the body still ends at y = h + tab', () => {
    const d = outline({ ...flat, bottom: -1 });
    expect(Math.max(...ys(d))).toBeCloseTo(h + tab, 2);
    expect(ys(d)).toContainEqual(expect.closeTo(h, 2));
  });

  it('a left tab reaches out to x = 0', () => {
    expect(Math.min(...xs(outline({ ...flat, left: 1 })))).toBeCloseTo(0, 2);
  });

  it('a left hole cuts in to x = 2·tab, and the body still starts at x = tab', () => {
    const d = outline({ ...flat, left: -1 });
    expect(Math.min(...xs(d))).toBeCloseTo(tab, 2);
    expect(xs(d)).toContainEqual(expect.closeTo(2 * tab, 2));
  });
});
