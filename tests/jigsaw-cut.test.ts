import { describe, expect, it } from 'vitest';
import { cutPieces, pieceSeed, piecePath, tabFor } from '../src/jigsaw/cut';
import { GRID_SIZES, PIECE_COUNTS } from '../src/jigsaw/types';

const numbers = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

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

  it("draws each outline inside the piece's box, with a knob for every tab and hole", () => {
    const [w, h] = [105, 94];
    const tab = tabFor(w, h);
    for (const piece of cutPieces(6, 5, 99)) {
      const d = piecePath(piece, w, h, tab);
      expect(d).toMatch(/^M /);
      expect(d).toMatch(/ Z$/);
      const values = numbers(d);
      expect(Math.min(...values)).toBeGreaterThanOrEqual(-0.01);
      expect(Math.max(...values)).toBeLessThanOrEqual(Math.max(w, h) + 2 * tab + 0.01);
      const knobs = [piece.top, piece.right, piece.bottom, piece.left].filter((edge) => edge !== 0).length;
      expect((d.match(/ C /g) ?? []).length).toBe(4 * knobs);
    }
  });

  it('makes tabs a fifth of the shorter side', () => {
    expect(tabFor(100, 80)).toBe(16);
  });
});
