import type { Rect } from '../frame/layout';
import { el, place, restartAnimation, wait } from '../ui/dom';
import { CHECK_ICON, HINT_ICON } from '../ui/icons';
import { trayTiles, type GridLayout } from './layout';
import type { GridShape } from './puzzle';
import type { TrayLetter } from './rules';
import { GRID_LEVELS, type GridLevel } from './types';

export interface GridViewState {
  level: GridLevel;
  shape: GridShape;
  /** The letter in each square of the box ('' for none). */
  letters: readonly string[];
  hinted: ReadonlySet<number>;
  selected: number;
  /** The selected section's letters, for the tray. */
  tray: readonly TrayLetter[];
  /** Every section's letters, printed small in its first square. */
  corners: readonly TrayLetter[][];
  /** The squares of each full run that isn't a real word. */
  badRuns: readonly number[][];
}

const LEVEL_LABELS: Record<GridLevel, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
/** Each square draws its share of a line: thin inside a section, half of a thick line between sections, all of it on the outside. */
const THIN = 1;
const HALF = 3;
const EDGE = 6;
/** Words turn green one at a time when she finishes. */
const WORD_MS = 250;
/** A letter glides back this long (matches the CSS). */
const GLIDE_MS = 250;
/** A picked-up letter is this much bigger than a tray tile. */
const LIFT = 1.1;
const SVG_NS = 'http://www.w3.org/2000/svg';

interface Cell {
  cell: HTMLElement;
  letter: HTMLElement;
  corner: HTMLElement | null;
}

/** Draws Word Grid and plays its animations. Knows nothing about rules. */
export class GridView {
  private layout!: GridLayout;
  private board: HTMLElement | null = null;
  private readonly cells = new Map<number, Cell>();
  private tiles: HTMLElement[] = [];
  private traySection = -1;
  private squiggles: SVGSVGElement | null = null;
  private shownBad = new Set<string>();
  private ghost: HTMLElement | null = null;
  private ghostTimer = 0;
  private dragSource: string | null = null;
  private hintButton: HTMLElement | null = null;

  /** Buttons and letters are drawn here but touched through the touch tracker, which works with a resting thumb. */
  constructor(private readonly layer: HTMLElement) {}

  render(layout: GridLayout, state: GridViewState, animateIn: boolean): void {
    this.layout = layout;
    this.dragSource = null;
    this.traySection = -1;
    this.shownBad = new Set();
    const board = document.createElement('div');
    board.className = 'board grid';
    this.layer.replaceChildren(board);
    this.board = board;

    GRID_LEVELS.forEach((level, i) => {
      const on = level === state.level;
      const button = el('button', on ? 'level on' : 'level', board);
      button.type = 'button';
      button.innerHTML = `${on ? CHECK_ICON : ''}<span>${LEVEL_LABELS[level]}</span>`;
      place(button, layout.levels[i]);
    });
    const hint = el('button', 'button hint', board);
    hint.type = 'button';
    hint.innerHTML = `${HINT_ICON}<span>Hint</span>`;
    place(hint, layout.hintButton);
    this.hintButton = hint;
    place(el('div', 'tray', board), layout.tray);

    this.cells.clear();
    const { shape } = state;
    const firsts = new Set(shape.sections.map((squares) => squares[0]));
    for (const square of shape.squares) {
      const cell = el('div', 'cell', board);
      place(cell, layout.squares[square]);
      const sides = this.sides(shape, square);
      cell.style.borderWidth = sides.map(([width]) => `${width}px`).join(' ');
      cell.style.borderColor = sides.map(([, color]) => color).join(' ');
      const letter = el('span', 'cell-letter', cell);
      letter.style.fontSize = `${layout.squareFont}px`;
      let corner: HTMLElement | null = null;
      if (firsts.has(square)) {
        corner = el('span', 'cell-corner', cell);
        corner.style.fontSize = `${layout.cornerFont}px`;
      }
      this.cells.set(square, { cell, letter, corner });
    }

    const squiggles = document.createElementNS(SVG_NS, 'svg');
    squiggles.setAttribute('class', 'squiggles');
    board.appendChild(squiggles);
    this.squiggles = squiggles;
    this.tiles = [];
    this.ghost = el('div', 'tile ghost', board);

    this.update(state);
    if (animateIn) {
      board.classList.add('entering');
      void board.offsetWidth;
      board.classList.remove('entering');
    }
  }

  /** Brings every square, the corner letters, the tray and the squiggles up to date. */
  update(state: GridViewState): void {
    const { shape } = state;
    const section = shape.sectionOf[state.selected];
    for (const [square, { cell, letter, corner }] of this.cells) {
      letter.textContent = state.letters[square].toUpperCase();
      cell.classList.toggle('hinted', state.hinted.has(square));
      cell.classList.toggle('in-section', shape.sectionOf[square] === section);
      cell.classList.toggle('selected', square === state.selected);
      cell.classList.toggle('lifted', this.dragSource === `square:${square}`);
      if (corner) {
        corner.innerHTML = state.corners[shape.sectionOf[square]]
          .map(({ letter: l, used }) => `<span${used ? ' class="used"' : ''}>${l.toUpperCase()}</span>`)
          .join('');
      }
    }
    this.renderTray(state.tray, section);
    this.renderSquiggles(state.badRuns);
  }

  /** A letter pops into its square. */
  popSquare(square: number): void {
    const cell = this.cells.get(square)?.cell;
    if (cell) restartAnimation(cell, 'pop');
  }

  setPressed(id: string, on: boolean): void {
    if (id.startsWith('tray:')) this.tiles[Number(id.slice('tray:'.length))]?.classList.toggle('pressed', on);
  }

  setHintPulse(on: boolean): void {
    this.hintButton?.classList.toggle('pulse', on);
  }

  /** She picked up a letter from `source` ("tray:i" or "square:n"): it follows her finger. */
  startDrag(letter: string, source: string): void {
    const ghost = this.ghost;
    if (!ghost) return;
    window.clearTimeout(this.ghostTimer);
    this.dragSource = source;
    const size = this.layout.tileSize * LIFT;
    ghost.textContent = letter.toUpperCase();
    ghost.style.transition = 'none';
    ghost.style.width = `${size}px`;
    ghost.style.height = `${size}px`;
    ghost.style.fontSize = `${Math.round(this.layout.tileFont * LIFT)}px`;
    ghost.classList.add('visible');
    if (source.startsWith('tray:')) this.tiles[Number(source.slice('tray:'.length))]?.classList.add('lifted');
    else this.cells.get(Number(source.slice('square:'.length)))?.cell.classList.add('lifted');
  }

  moveDrag(x: number, y: number): void {
    const ghost = this.ghost;
    if (!ghost) return;
    const size = this.layout.tileSize * LIFT;
    ghost.style.left = `${x - size / 2}px`;
    ghost.style.top = `${y - size / 2}px`;
  }

  /** She let go: the letter glides to `to` (back to the tray or its square), or simply vanishes once placed. */
  dropDrag(to: Rect | null): void {
    const ghost = this.ghost;
    this.dragSource = null;
    for (const tile of this.tiles) tile.classList.remove('lifted');
    for (const { cell } of this.cells.values()) cell.classList.remove('lifted');
    if (!ghost) return;
    if (!to) {
      ghost.classList.remove('visible');
      return;
    }
    ghost.style.transition = '';
    place(ghost, to);
    this.ghostTimer = window.setTimeout(() => ghost.classList.remove('visible'), GLIDE_MS);
  }

  /** The words turn green one at a time. */
  async finish(runs: readonly number[][]): Promise<void> {
    for (const run of runs) {
      for (const square of run) this.cells.get(square)?.cell.classList.add('done');
      await wait(WORD_MS);
    }
  }

  private renderTray(tray: readonly TrayLetter[], section: number): void {
    const board = this.board;
    if (!board) return;
    for (const tile of this.tiles) tile.remove();
    const fresh = section !== this.traySection;
    this.traySection = section;
    this.tiles = trayTiles(this.layout, tray.length).map((rect, i) => {
      const tile = el('div', tray[i].used ? 'tile used' : 'tile', board);
      tile.textContent = tray[i].letter.toUpperCase();
      tile.style.fontSize = `${this.layout.tileFont}px`;
      if (fresh) tile.classList.add('appear');
      if (this.dragSource === `tray:${i}`) tile.classList.add('lifted');
      place(tile, rect);
      return tile;
    });
    // The picked-up letter stays above the tray.
    if (this.ghost) board.appendChild(this.ghost);
  }

  /** A soft wavy line through each full run that isn't a word; new ones fade in. */
  private renderSquiggles(runs: readonly number[][]): void {
    const svg = this.squiggles;
    if (!svg) return;
    const keys = runs.map((run) => run.join(','));
    svg.replaceChildren(
      ...runs.map((run, i) => {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', this.wave(run));
        path.setAttribute('class', this.shownBad.has(keys[i]) ? 'squiggle' : 'squiggle appear');
        return path;
      }),
    );
    this.shownBad = new Set(keys);
  }

  private wave(run: readonly number[]): string {
    const size = this.layout.squareSize;
    const first = this.layout.squares[run[0]];
    const last = this.layout.squares[run[run.length - 1]];
    const across = first.y === last.y;
    const inset = size * 0.15;
    const length = (across ? last.x - first.x : last.y - first.y) + size - 2 * inset;
    const steps = Math.max(2, Math.round(length / (size * 0.25)));
    const step = length / steps;
    const bend = size * 0.2;
    let d = across ? `M ${first.x + inset} ${first.y + size / 2}` : `M ${first.x + size / 2} ${first.y + inset}`;
    for (let i = 0; i < steps; i++) {
      const out = i % 2 === 0 ? -bend : bend;
      d += across ? ` q ${step / 2} ${out} ${step} 0` : ` q ${out} ${step / 2} 0 ${step}`;
    }
    return d;
  }

  /** Width and color of each side (top, right, bottom, left) of a square. */
  private sides(shape: GridShape, square: number): Array<[number, string]> {
    const { size, sectionOf } = shape;
    const row = Math.floor(square / size);
    const col = square % size;
    const mine = sectionOf[square];
    const at = (r: number, c: number) => (r < 0 || c < 0 || r >= size || c >= size ? -1 : sectionOf[r * size + c]);
    return [at(row - 1, col), at(row, col + 1), at(row + 1, col), at(row, col - 1)].map((next) =>
      next === mine ? [THIN, 'var(--grid-line)'] : next < 0 ? [EDGE, 'var(--navy)'] : [HALF, 'var(--navy)'],
    );
  }
}
