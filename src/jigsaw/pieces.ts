import { piecePath, tabFor, type PieceShape } from './cut';

/** Sharper pieces on Retina screens, but never more than twice the size, to save memory. */
const MAX_SCALE = 2;
/** Room around each piece's outline, so its white edge isn't cut off at the tips of its tabs. */
export const EDGE_ROOM = 2;

/**
 * Cuts a 4:3 picture into piece images, each w × h plus its tabs and EDGE_ROOM on every side: the photo inside the
 * piece's outline, with a thin white edge so neighbors stand apart until the end.
 */
export function drawPieces(image: HTMLImageElement, shapes: readonly PieceShape[], cols: number, rows: number, w: number, h: number): HTMLCanvasElement[] {
  const tab = tabFor(w, h);
  const scale = Math.min(MAX_SCALE, window.devicePixelRatio || 1);
  // Picture pixels per screen pixel.
  const sx = image.naturalWidth / (cols * w);
  const sy = image.naturalHeight / (rows * h);
  return shapes.map((shape) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil((w + 2 * tab + 2 * EDGE_ROOM) * scale);
    canvas.height = Math.ceil((h + 2 * tab + 2 * EDGE_ROOM) * scale);
    const context = canvas.getContext('2d');
    if (!context) return canvas;
    context.scale(scale, scale);
    context.translate(EDGE_ROOM, EDGE_ROOM);
    const outline = new Path2D(piecePath(shape, w, h, tab));
    context.save();
    context.clip(outline);
    // The piece's box in the picture, kept inside the picture: older Safari draws nothing for a box that isn't.
    const left = shape.col * w - tab;
    const top = shape.row * h - tab;
    const [x0, y0] = [Math.max(0, left), Math.max(0, top)];
    const [x1, y1] = [Math.min(cols * w, left + w + 2 * tab), Math.min(rows * h, top + h + 2 * tab)];
    context.drawImage(image, x0 * sx, y0 * sy, (x1 - x0) * sx, (y1 - y0) * sy, x0 - left, y0 - top, x1 - x0, y1 - y0);
    context.restore();
    context.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    context.lineWidth = 2;
    context.stroke(outline);
    return canvas;
  });
}
