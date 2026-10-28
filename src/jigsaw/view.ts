import type { Rect } from '../frame/layout';
import { el, place, restartAnimation, wait } from '../ui/dom';
import { flyHintStar, landHintLetter } from '../ui/hint-star';
import { CHECK_ICON, HINT_ICON, PICTURES_ICON } from '../ui/icons';
import { piecePath, tabFor, type PieceShape } from './cut';
import type { JigsawLayout } from './layout';
import { EDGE_ROOM, drawPieces } from './pieces';
import { JIGSAW_STYLES, PIECE_COUNTS, type JigsawStyle, type Picture, type PieceCount } from './types';

const STYLE_LABELS: Record<JigsawStyle, string> = { tray: 'Tray', board: 'Board', table: 'Table' };
/** At the end the seams fade into the whole photo (matches the CSS)... */
const FADE_MS = 600;
/** ...which then grows into place. */
const GROW_MS = 500;
/** A tray piece lifted by a tap is drawn this much bigger. */
const LIFT = 1.25;
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Where one piece is drawn: its body (without tabs) on screen, and what it's doing. */
export interface PieceSpot {
  id: number;
  body: Rect;
  where: 'tray' | 'placed' | 'loose' | 'table';
  /** The tray place it sits in, shrunk to fit (where = 'tray'). */
  slot?: Rect;
}

export interface JigsawViewState {
  style: JigsawStyle;
  count: PieceCount;
  picture: Picture | null;
  /** The loaded picture, or null while it loads (then no pieces are drawn). */
  image: HTMLImageElement | null;
  shapes: readonly PieceShape[];
  /** A piece's body size: board-sized, or smaller on the table. */
  pieceSize: { w: number; h: number };
  /** Every piece, bottom first. */
  pieces: readonly PieceSpot[];
  /** The piece lifted by a tap, waiting for a tap on its spot. */
  lifted: number | null;
}

/** A piece's element: its body plus its tabs and the room for its edge on every side. */
const outer = (body: Rect, tab: number): Rect => {
  const room = tab + EDGE_ROOM;
  return { x: body.x - room, y: body.y - room, w: body.w + 2 * room, h: body.h + 2 * room };
};
/** Shown as "at-tray", "at-placed"… classes: a plain "tray" is the yellow tray backing (and the board gets "style-tray"). */
const WHERE = ['tray', 'placed', 'loose', 'table'] as const;

/** Draws Jigsaw and plays its animations. Knows nothing about rules. */
export class JigsawView {
  private layout!: JigsawLayout;
  private board: HTMLElement | null = null;
  private hintButton: HTMLElement | null = null;
  private readonly pieces = new Map<number, HTMLElement>();
  private canvases: HTMLCanvasElement[] = [];
  private cutKey = '';
  private tab = 0;

  /** Buttons and pieces are drawn here but touched through the touch tracker, which works with a resting thumb. */
  constructor(private readonly layer: HTMLElement) {}

  render(layout: JigsawLayout, state: JigsawViewState, animateIn: boolean): void {
    this.layout = layout;
    const board = document.createElement('div');
    board.className = `board jigsaw style-${state.style}`;
    this.layer.replaceChildren(board);
    this.board = board;

    this.hintButton = this.button(board, 'button hint', `${HINT_ICON}<span>Hint</span>`, layout.hintButton);
    this.button(board, 'button pictures', `${PICTURES_ICON}<span>Pictures</span>`, layout.picturesButton);
    JIGSAW_STYLES.forEach((style, i) => this.choice(board, STYLE_LABELS[style], style === state.style, layout.styleButtons[i]));
    PIECE_COUNTS.forEach((count, i) => this.choice(board, String(count), count === state.count, layout.countButtons[i]));
    place(el('div', 'tray', board), layout.tray);
    if (state.style !== 'table') this.drawBoard(board, state);
    else if (state.picture) {
      const lid = el('img', 'jigsaw-lid', board);
      lid.alt = '';
      lid.src = state.picture.src;
      place(lid, layout.lid);
    }

    this.cut(state);
    this.pieces.clear();
    this.update(state, false);
    if (animateIn) {
      board.classList.add('entering');
      void board.offsetWidth;
      board.classList.remove('entering');
    }
  }

  /**
   * Puts every piece where it is now; pieces that moved glide there (the CSS transition). Held pieces are left alone.
   * A piece seen for the first time (the next one sliding into the tray) is made here, fading in unless it's a redraw.
   */
  update(state: JigsawViewState, fadeIn = true): void {
    state.pieces.forEach((spot, i) => {
      const piece = this.pieces.get(spot.id) ?? this.addPiece(spot.id, fadeIn);
      if (!piece || piece.classList.contains('held')) return;
      const rect = outer(spot.body, this.tab);
      place(piece, rect);
      // Stacked with z-index rather than page order: moving an element in the page would stop its glide.
      piece.style.zIndex = String(i + 1);
      // Shrunk to fit its tray place; a lifted one grows a little, as its glow is tiny at that size.
      const lift = state.lifted === spot.id ? LIFT : 1;
      piece.style.transform = spot.slot ? `scale(${lift * Math.min(spot.slot.w / rect.w, spot.slot.h / rect.h)})` : '';
      for (const where of WHERE) piece.classList.toggle(`at-${where}`, where === spot.where);
      piece.classList.toggle('lifted', state.lifted === spot.id);
    });
  }

  /** She picked these pieces up: full size, above everything, following her finger. */
  hold(ids: readonly number[]): void {
    for (const id of ids) {
      const piece = this.pieces.get(id);
      if (!piece) continue;
      piece.classList.add('held');
      piece.classList.remove('lifted');
      piece.style.transform = '';
    }
  }

  moveHeld(spots: ReadonlyArray<{ id: number; body: Rect }>): void {
    for (const { id, body } of spots) {
      const piece = this.pieces.get(id);
      if (piece) place(piece, outer(body, this.tab));
    }
  }

  /** She let go: the next update glides them to wherever they belong. */
  release(): void {
    for (const piece of this.pieces.values()) piece.classList.remove('held');
  }

  /** A piece clicks in (or joins others). */
  pop(id: number): void {
    const piece = this.pieces.get(id);
    if (piece) restartAnimation(piece, 'pop');
  }

  /** A table piece she tapped: a little wiggle shows it can be moved. */
  wiggle(id: number): void {
    const piece = this.pieces.get(id);
    if (piece) restartAnimation(piece, 'wiggle');
  }

  /** The hint star flies from Hint to `target`. Resolves when it lands. */
  async flyStar(target: Rect): Promise<void> {
    const board = this.board;
    const hint = this.hintButton;
    if (!board || !hint) return;
    const spot = el('div', 'jigsaw-star-target', board);
    place(spot, target);
    await flyHintStar(hint, spot);
    spot.remove();
  }

  /** The hinted piece lands with a bounce. */
  land(id: number): void {
    const piece = this.pieces.get(id);
    if (piece) landHintLetter(piece);
  }

  setHintPulse(on: boolean): void {
    this.hintButton?.classList.toggle('pulse', on);
  }

  /** The seams fade into the whole photo, which grows into place with its caption under it. */
  async finish(picture: Picture, assembled: Rect): Promise<void> {
    const board = this.board;
    if (!board) return;
    const photo = el('img', 'jigsaw-photo', board);
    photo.alt = '';
    photo.src = picture.src;
    place(photo, assembled);
    void photo.offsetWidth;
    photo.classList.add('shown');
    await wait(FADE_MS);
    for (const piece of this.pieces.values()) piece.remove();
    board.classList.add('done');
    place(photo, this.layout.finished);
    if (picture.caption) {
      const caption = el('div', 'jigsaw-caption', board);
      caption.textContent = picture.caption;
      place(caption, this.layout.caption);
    }
    await wait(GROW_MS);
  }

  private addPiece(id: number, fadeIn: boolean): HTMLElement | null {
    const canvas = this.canvases[id];
    if (!this.board || !canvas) return null;
    const piece = el('div', fadeIn ? 'piece appear' : 'piece', this.board);
    piece.appendChild(canvas);
    this.pieces.set(id, piece);
    return piece;
  }

  private button(parent: HTMLElement, className: string, html: string, rect: Rect): HTMLButtonElement {
    const button = el('button', className, parent);
    button.type = 'button';
    button.innerHTML = html;
    place(button, rect);
    return button;
  }

  /** A style or piece-count button, in the level buttons' look. */
  private choice(parent: HTMLElement, label: string, on: boolean, rect: Rect): void {
    this.button(parent, on ? 'level on' : 'level', `${on ? CHECK_ICON : ''}<span>${label}</span>`, rect);
  }

  /** The board: the picture faintly, with thin lines along the piece edges. */
  private drawBoard(board: HTMLElement, state: JigsawViewState): void {
    const back = el('div', 'jigsaw-board', board);
    place(back, this.layout.board);
    if (!state.picture) return;
    const faint = el('img', 'jigsaw-faint', back);
    faint.alt = '';
    faint.src = state.picture.src;
    if (state.shapes.length === 0) return;
    const { w, h } = state.pieceSize;
    const tab = tabFor(w, h);
    const lines = document.createElementNS(SVG_NS, 'svg');
    lines.setAttribute('class', 'jigsaw-lines');
    for (const shape of state.shapes) {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', piecePath(shape, w, h, tab));
      path.setAttribute('transform', `translate(${shape.col * w - tab} ${shape.row * h - tab})`);
      lines.appendChild(path);
    }
    back.appendChild(lines);
  }

  /** Cuts the picture into piece images once per picture, piece count and size. */
  private cut(state: JigsawViewState): void {
    const { image, picture, shapes, pieceSize } = state;
    this.tab = tabFor(pieceSize.w, pieceSize.h);
    if (!image || !picture || shapes.length === 0) {
      this.canvases = [];
      this.cutKey = '';
      return;
    }
    const key = `${picture.src}|${shapes.length}|${pieceSize.w.toFixed(2)}x${pieceSize.h.toFixed(2)}`;
    if (key === this.cutKey) return;
    const cols = Math.max(...shapes.map((s) => s.col)) + 1;
    const rows = Math.max(...shapes.map((s) => s.row)) + 1;
    this.canvases = drawPieces(image, shapes, cols, rows, pieceSize.w, pieceSize.h);
    this.cutKey = key;
  }
}
