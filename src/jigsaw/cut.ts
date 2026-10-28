import { seededRandom } from '../shared/random';

/** One side of a piece: flat (the edge of the picture), a tab sticking out, or a hole cut in. */
export type Edge = 0 | 1 | -1;

/** A piece's place in the picture and its four sides. Piece i is at column i % cols, row floor(i / cols). */
export interface PieceShape {
  col: number;
  row: number;
  top: Edge;
  right: Edge;
  bottom: Edge;
  left: Edge;
}

/** How far a tab reaches, as a share of the piece's shorter side. */
export const TAB_SHARE = 0.2;

export function tabFor(w: number, h: number): number {
  return TAB_SHARE * Math.min(w, h);
}

/** A number from the picture and its piece count, so the same puzzle always cuts (and deals) the same way. */
export function pieceSeed(pictureId: string, count: number): number {
  const text = `${pictureId}:${count}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

const flip = (edge: Edge): Edge => (edge === 1 ? -1 : edge === -1 ? 1 : 0);

/** Every inside edge gets a tab on one side and the matching hole on the other; the picture's edges stay flat. */
export function cutPieces(cols: number, rows: number, seed: number): PieceShape[] {
  const random = seededRandom(seed);
  const pieces: PieceShape[] = Array.from({ length: cols * rows }, (_, i) => ({
    col: i % cols,
    row: Math.floor(i / cols),
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  }));
  pieces.forEach((piece, i) => {
    if (piece.col < cols - 1) {
      piece.right = random() < 0.5 ? 1 : -1;
      pieces[i + 1].left = flip(piece.right);
    }
    if (piece.row < rows - 1) {
      piece.bottom = random() < 0.5 ? 1 : -1;
      pieces[i + cols].top = flip(piece.bottom);
    }
  });
  return pieces;
}

const n = (value: number) => String(Math.round(value * 100) / 100);

/** One side from (x0, y0) to (x1, y1); (nx, ny) points out of the piece. A tab is a round knob on a narrower neck. */
function side(x0: number, y0: number, x1: number, y1: number, nx: number, ny: number, edge: Edge, tab: number): string {
  if (edge === 0) return ` L ${n(x1)} ${n(y1)}`;
  const at = (along: number, out: number) =>
    `${n(x0 + (x1 - x0) * along + nx * out * tab * edge)} ${n(y0 + (y1 - y0) * along + ny * out * tab * edge)}`;
  return (
    ` L ${at(0.35, 0)}` +
    ` C ${at(0.4, 0)} ${at(0.42, 0.35)} ${at(0.37, 0.55)}` +
    ` C ${at(0.32, 0.8)} ${at(0.4, 1)} ${at(0.5, 1)}` +
    ` C ${at(0.6, 1)} ${at(0.68, 0.8)} ${at(0.63, 0.55)}` +
    ` C ${at(0.58, 0.35)} ${at(0.6, 0)} ${at(0.65, 0)}` +
    ` L ${at(1, 0)}`
  );
}

/**
 * A piece's outline as an SVG path, clockwise from its top-left corner. The body (w × h) sits at (tab, tab), so the
 * whole piece, tabs included, fits in (w + 2·tab) × (h + 2·tab).
 */
export function piecePath(shape: PieceShape, w: number, h: number, tab: number): string {
  const [l, t, r, b] = [tab, tab, tab + w, tab + h];
  return (
    `M ${n(l)} ${n(t)}` +
    side(l, t, r, t, 0, -1, shape.top, tab) +
    side(r, t, r, b, 1, 0, shape.right, tab) +
    side(r, b, l, b, 0, 1, shape.bottom, tab) +
    side(l, b, l, t, -1, 0, shape.left, tab) +
    ' Z'
  );
}
