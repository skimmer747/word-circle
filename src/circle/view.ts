import type { ClockFace } from '../clock/clock';
import { fitFontScale } from '../ui/fit';
import { formatDuration, type Celebration } from './stats';
import { LEVELS, type Level, type Puzzle } from './types';
import type { Layout, Rect } from './layout';

export interface RowState {
  found: boolean;
  revealed: number[];
}

/** Everything about the current puzzle that the screen shows. */
export interface ScreenState {
  /** ringOrder[slot] is the letter index shown in that ring slot. */
  ringOrder: readonly number[];
  rows: readonly RowState[];
  extras: readonly string[];
  level: Level;
}

const LEVEL_LABELS: Record<Level, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

const SVG_NS = 'http://www.w3.org/2000/svg';
const FLY_MS = 600;
const BAR_MESSAGE_MS = 1200;
const WIGGLE_MS = 400;
const BAR_LETTER_SCALE = 0.62;
const BAR_TEXT_SCALE = 0.42;
const SLOT_LETTER_SCALE = 0.62;

const ICON_ATTRS =
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const SHUFFLE_ICON = `<svg ${ICON_ATTRS}><path d="M18 4l3 3l-3 3"/><path d="M18 20l3 -3l-3 -3"/><path d="M3 7h3a5 5 0 0 1 5 5a5 5 0 0 0 5 5h5"/><path d="M21 7h-5a4.978 4.978 0 0 0 -3 1m-4 8a4.984 4.984 0 0 1 -3 1h-3"/></svg>`;
const HINT_ICON = `<svg ${ICON_ATTRS}><path d="M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7"/><path d="M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3"/><path d="M9.7 17l4.6 0"/></svg>`;
const CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10"/></svg>`;
const TROPHY_ICON = `<svg ${ICON_ATTRS}><path d="M8 21l8 0"/><path d="M12 17l0 4"/><path d="M7 4l10 0"/><path d="M17 4v8a5 5 0 0 1 -10 0v-8"/><path d="M5 9m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M19 9m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/></svg>`;
const CALENDAR_ICON = `<svg ${ICON_ATTRS}><path d="M11.5 21h-5.5a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v6"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M4 11h16"/><path d="M15 19l2 2l4 -4"/></svg>`;
const SUN_ICON = `<svg ${ICON_ATTRS}><path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/><path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7"/></svg>`;
const STAR_ICON = `<svg ${ICON_ATTRS}><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z"/></svg>`;
const ARROW_ICON = `<svg ${ICON_ATTRS}><path d="M5 12l14 0"/><path d="M13 18l6 -6"/><path d="M13 6l6 6"/></svg>`;
const CLOCK_ICON = `<svg ${ICON_ATTRS}><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 7v5l3 3"/></svg>`;
const CLOSE_ICON = `<svg ${ICON_ATTRS}><path d="M18 6l-12 12"/><path d="M6 6l12 12"/></svg>`;
const EVENT_ICON = `<svg ${ICON_ATTRS}><path d="M12 13m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"/><path d="M12 10l0 3l2 0"/><path d="M7 4l-2.75 2"/><path d="M17 4l2.75 2"/></svg>`;

/** The good news to show, as [row style, icon, text, highlighted]. Days in a row appears from day two. */
function celebrationRows(c: Celebration): Array<[string, string, string, boolean]> {
  const rows: Array<[string, string, string, boolean]> = [];
  if (c.recordMs !== null) rows.push(['row-record', TROPHY_ICON, `New record! ${formatDuration(c.recordMs)}`, true]);
  if (c.streakDays >= 2) rows.push(['row-streak', CALENDAR_ICON, `${c.streakDays} days in a row`, false]);
  rows.push(['row-today', SUN_ICON, `${c.todaySolved} ${c.todaySolved === 1 ? 'puzzle' : 'puzzles'} today`, false]);
  rows.push(['row-number', STAR_ICON, `Puzzle number ${c.puzzleNumber}${c.milestone ? '!' : ''}`, c.milestone]);
  return rows;
}
const SIDEWAYS_IPAD = `<svg width="240" height="170" viewBox="0 0 240 170" aria-hidden="true"><rect x="10" y="10" width="220" height="150" rx="18" fill="#fff" stroke="#141414" stroke-width="8"/><circle cx="208" cy="85" r="6" fill="#141414"/></svg>`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent: HTMLElement): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  parent.appendChild(node);
  return node;
}

function place(node: HTMLElement, rect: Rect): void {
  node.style.left = `${rect.x}px`;
  node.style.top = `${rect.y}px`;
  node.style.width = `${rect.w}px`;
  node.style.height = `${rect.h}px`;
}

function restartAnimation(node: HTMLElement, className: string): void {
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
}

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/** Draws the game screen and plays its animations. Knows nothing about rules. */
export class View {
  private board: HTMLElement | null = null;
  private puzzle!: Puzzle;
  private layout!: Layout;
  private ringOrder: number[] = [];
  private tiles: HTMLElement[] = [];
  private rows: HTMLElement[][] = [];
  private extras!: HTMLElement;
  private chips!: HTMLElement;
  private bar!: HTMLElement;
  private line!: SVGPolylineElement;
  private hintButton!: HTMLButtonElement;
  private message!: HTMLElement;
  private messageToken = 0;
  private barTimer = 0;
  private readonly celebrate: HTMLElement;
  private readonly clockPopup: HTMLElement;
  private readonly rotate: HTMLElement;

  /** Buttons are drawn here but tapped through the touch tracer, which works with a resting thumb. */
  constructor(private readonly root: HTMLElement) {
    this.celebrate = el('div', 'celebrate', root);
    this.clockPopup = el('div', 'clock-popup', root);
    this.rotate = el('div', 'rotate', root);
    this.rotate.innerHTML = `${SIDEWAYS_IPAD}<div>Please turn the iPad sideways</div>`;
  }

  /** Builds the whole screen. */
  render(puzzle: Puzzle, layout: Layout, state: ScreenState, animateIn: boolean): void {
    this.puzzle = puzzle;
    this.layout = layout;
    this.ringOrder = [...state.ringOrder];
    window.clearTimeout(this.barTimer);
    this.messageToken++;
    this.board?.remove();
    const board = document.createElement('div');
    board.className = 'board';
    this.root.insertBefore(board, this.celebrate);
    this.board = board;

    LEVELS.forEach((level, i) => {
      const button = el('button', level === state.level ? 'level on' : 'level', board);
      button.type = 'button';
      button.innerHTML = `${level === state.level ? CHECK_ICON : ''}<span>${LEVEL_LABELS[level]}</span>`;
      place(button, layout.levels[i]);
    });

    this.rows = puzzle.words.map((word, i) => this.buildRow(board, word, layout.rows[i]));
    state.rows.forEach((row, i) => this.setRow(i, row));
    this.buildButton(board, 'shuffle', 'Shuffle', SHUFFLE_ICON, layout.shuffleButton);
    this.hintButton = this.buildButton(board, 'hint', 'Hint', HINT_ICON, layout.hintButton);

    const clockButton = el('button', 'clock-button', board);
    clockButton.type = 'button';
    clockButton.setAttribute('aria-label', 'Clock');
    clockButton.innerHTML = CLOCK_ICON;
    place(clockButton, layout.clockButton);

    this.extras = el('div', 'extras', board);
    place(this.extras, layout.extras);
    el('div', 'extras-label', this.extras).textContent = 'Extra words';
    this.chips = el('div', 'chips', this.extras);
    this.setExtras(state.extras);

    const { backing } = layout;
    place(el('div', 'backing', board), {
      x: backing.x - backing.r,
      y: backing.y - backing.r,
      w: backing.r * 2,
      h: backing.r * 2,
    });
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'lines');
    svg.setAttribute('width', String(layout.width));
    svg.setAttribute('height', String(layout.height));
    this.line = document.createElementNS(SVG_NS, 'polyline');
    svg.appendChild(this.line);
    board.appendChild(svg);

    const diameter = layout.tiles[0].r * 2;
    this.tiles = puzzle.letters.map((letter) => {
      const tile = el('div', 'tile', board);
      tile.style.width = `${diameter}px`;
      tile.style.height = `${diameter}px`;
      tile.style.fontSize = `${layout.letterFontSize}px`;
      tile.textContent = letter.toUpperCase();
      return tile;
    });
    this.positionTiles(false);

    this.bar = el('div', 'bar', board);
    place(this.bar, layout.bar);
    this.message = el('div', 'message', board);

    if (animateIn) {
      board.classList.add('entering');
      void board.offsetWidth;
      board.classList.remove('entering');
    }
  }

  setRingOrder(ringOrder: readonly number[]): void {
    this.ringOrder = [...ringOrder];
    this.positionTiles(true);
  }

  /** Highlights the selected ring slots, draws the line and shows the letters in the bar. */
  showSelection(slots: readonly number[]): void {
    window.clearTimeout(this.barTimer);
    const chosen = new Set(slots.map((slot) => this.ringOrder[slot]));
    this.tiles.forEach((tile, letter) => tile.classList.toggle('selected', chosen.has(letter)));
    this.line.setAttribute('points', slots.map((s) => `${this.layout.tiles[s].x},${this.layout.tiles[s].y}`).join(' '));
    if (slots.length === 0) {
      this.hideBar();
      return;
    }
    this.bar.classList.remove('wiggle');
    this.bar.style.fontSize = `${Math.round(this.layout.bar.h * BAR_LETTER_SCALE)}px`;
    this.bar.replaceChildren(
      ...slots.map((slot) => {
        const span = document.createElement('span');
        span.textContent = this.puzzle.letters[this.ringOrder[slot]].toUpperCase();
        return span;
      }),
    );
    this.bar.classList.add('visible');
  }

  /** Un-highlights tiles and removes the line, keeping the bar's letters. */
  releaseTiles(): void {
    this.tiles.forEach((tile) => tile.classList.remove('selected'));
    this.line.setAttribute('points', '');
  }

  hideBar(): void {
    window.clearTimeout(this.barTimer);
    this.bar.classList.remove('visible');
  }

  barMessage(text: string): void {
    window.clearTimeout(this.barTimer);
    this.bar.style.fontSize = `${Math.round(this.layout.bar.h * BAR_TEXT_SCALE)}px`;
    this.bar.textContent = text;
    this.bar.classList.add('visible');
    this.barTimer = window.setTimeout(() => this.hideBar(), BAR_MESSAGE_MS);
  }

  wiggleBar(): void {
    window.clearTimeout(this.barTimer);
    restartAnimation(this.bar, 'wiggle');
    this.barTimer = window.setTimeout(() => this.hideBar(), WIGGLE_MS);
  }

  /** Glides the bar's letters into the given word row. */
  async flyToRow(row: number): Promise<void> {
    const board = this.board;
    if (!board) return;
    const spans = [...this.bar.querySelectorAll('span')];
    const targets = this.rows[row];
    const fontSize = getComputedStyle(this.bar).fontSize;
    const flyers = spans.slice(0, targets.length).map((span, i) => {
      const from = span.getBoundingClientRect();
      const to = targets[i].getBoundingClientRect();
      const size = Math.max(from.width, from.height);
      const flyer = el('div', 'flyer', board);
      flyer.textContent = span.textContent;
      flyer.style.fontSize = fontSize;
      flyer.style.width = `${size}px`;
      flyer.style.height = `${size}px`;
      flyer.style.transform = `translate(${from.left + from.width / 2 - size / 2}px, ${from.top + from.height / 2 - size / 2}px)`;
      return { flyer, to };
    });
    this.hideBar();
    void board.offsetWidth;
    for (const { flyer, to } of flyers) {
      flyer.classList.add('landing');
      flyer.style.width = `${to.width}px`;
      flyer.style.height = `${to.height}px`;
      flyer.style.fontSize = `${Math.round(to.height * SLOT_LETTER_SCALE)}px`;
      flyer.style.transform = `translate(${to.left}px, ${to.top}px)`;
    }
    await wait(FLY_MS);
    flyers.forEach(({ flyer }) => flyer.remove());
  }

  setRow(row: number, state: RowState): void {
    const word = this.puzzle.words[row];
    this.rows[row].forEach((slot, i) => {
      slot.textContent = state.found || state.revealed.includes(i) ? word[i].toUpperCase() : '';
      slot.classList.toggle('found', state.found);
    });
  }

  pulseRow(row: number): void {
    this.rows[row].forEach((slot) => restartAnimation(slot, 'pulse'));
  }

  /** Shows extra words as chips, oldest first; drops the oldest when they don't fit. Pops in `newest`. */
  setExtras(words: readonly string[], newest?: string): void {
    this.chips.replaceChildren(
      ...words.map((word) => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.dataset.word = word;
        chip.textContent = word.toUpperCase();
        return chip;
      }),
    );
    this.extras.classList.toggle('empty', words.length === 0);
    while (this.chips.childElementCount > 1 && this.chips.scrollHeight > this.chips.clientHeight) {
      this.chips.firstElementChild!.remove();
    }
    const chip = newest ? this.chipFor(newest) : undefined;
    if (chip) restartAnimation(chip, 'pop');
  }

  /** Pulses an extra word's chip. Returns false if that chip isn't on screen. */
  pulseExtra(word: string): boolean {
    const chip = this.chipFor(word);
    if (chip) restartAnimation(chip, 'pulse');
    return chip !== undefined;
  }

  /** Shows a large message over the circle or the whole screen, then fades it. */
  async showMessage(text: string, where: 'circle' | 'screen', ms: number): Promise<void> {
    const token = ++this.messageToken;
    const { layout, message } = this;
    const center = where === 'circle' ? layout.backing : { x: layout.width / 2, y: layout.height / 2 };
    message.textContent = text;
    message.style.left = `${center.x}px`;
    message.style.top = `${center.y}px`;
    message.style.fontSize = where === 'circle' ? '88px' : '120px';
    message.classList.add('visible');
    await wait(ms);
    if (token === this.messageToken) message.classList.remove('visible');
  }

  hideMessage(): void {
    this.messageToken++;
    this.message?.classList.remove('visible');
  }

  setHintPulse(on: boolean): void {
    this.hintButton?.classList.toggle('pulse', on);
  }

  showRotate(on: boolean): void {
    this.rotate.classList.toggle('visible', on);
  }

  /** The "Well done!" card with her stats. Its Next puzzle button is tapped through the touch tracer. */
  showCelebration(celebration: Celebration, layout: Layout): void {
    this.celebrate.replaceChildren();
    el('div', 'celebrate-dim', this.celebrate);
    const card = el('div', 'card', this.celebrate);
    el('div', 'card-title', card).textContent = 'Well done!';
    const rows = el('div', 'card-rows', card);
    for (const [kind, icon, text, highlight] of celebrationRows(celebration)) {
      const row = el('div', `card-row ${kind}${highlight ? ' highlight' : ''}`, rows);
      row.innerHTML = `${icon}<span></span>`;
      row.querySelector('span')!.textContent = text;
    }
    const next = el('button', 'next', this.celebrate);
    next.type = 'button';
    next.innerHTML = `<span>Next puzzle</span>${ARROW_ICON}`;
    // Visible first, so the rows can be measured when they're fitted.
    this.celebrate.classList.add('visible');
    this.placeCelebration(layout);
  }

  placeCelebration(layout: Layout): void {
    const card = this.celebrate.querySelector<HTMLElement>('.card');
    const next = this.celebrate.querySelector<HTMLElement>('.next');
    if (card) {
      place(card, layout.celebration);
      // Text sizes in the stylesheet are multiples of 1% of the card's height.
      card.style.setProperty('--u', `${layout.celebration.h / 100}px`);
    }
    if (next) place(next, layout.nextButton);
    this.fitCelebrationRows();
  }

  /** Shrinks the stat rows together if the widest is too wide for one line, so their icons stay lined up. */
  private fitCelebrationRows(): void {
    const card = this.celebrate.querySelector<HTMLElement>('.card');
    const list = this.celebrate.querySelector<HTMLElement>('.card-rows');
    if (!card || !list) return;
    list.style.fontSize = '';
    const cardStyle = getComputedStyle(card);
    const room = card.clientWidth - parseFloat(cardStyle.paddingLeft) - parseFloat(cardStyle.paddingRight) - 1;
    const rows = [...list.children] as HTMLElement[];
    const widest = Math.max(0, ...rows.map((row) => row.scrollWidth + (row.offsetWidth - row.clientWidth)));
    const scale = fitFontScale(widest, room);
    if (scale < 1) list.style.fontSize = `${parseFloat(getComputedStyle(list).fontSize) * scale}px`;
  }

  hideCelebration(): void {
    this.celebrate.classList.remove('visible');
    this.celebrate.replaceChildren();
  }

  /** The big clock pop-up. Its Close button is tapped through the touch tracer. */
  showClock(face: ClockFace, events: readonly string[], layout: Layout): void {
    this.clockPopup.replaceChildren();
    el('div', 'celebrate-dim', this.clockPopup);
    const card = el('div', 'clock-card', this.clockPopup);
    el('div', 'clock-time', card);
    el('div', 'clock-part', card);
    el('div', 'clock-date', card);
    el('div', 'clock-events', card);
    const close = el('button', 'next close', this.clockPopup);
    close.type = 'button';
    close.innerHTML = `${CLOSE_ICON}<span>Close</span>`;
    // Visible first, so the event lines can be measured when they're fitted.
    this.clockPopup.classList.add('visible');
    this.updateClock(face, events);
    this.placeClock(layout);
  }

  /** Refreshes the time and countdowns while the pop-up is open. */
  updateClock(face: ClockFace, events: readonly string[]): void {
    const set = (selector: string, text: string) => {
      const node = this.clockPopup.querySelector(selector);
      if (node && node.textContent !== text) node.textContent = text;
    };
    set('.clock-time', face.time);
    set('.clock-part', face.part);
    set('.clock-date', face.date);
    const list = this.clockPopup.querySelector<HTMLElement>('.clock-events');
    if (!list) return;
    const current = [...list.children].map((row) => row.textContent).join('\n');
    if (current === events.join('\n')) return;
    list.style.display = events.length === 0 ? 'none' : '';
    list.replaceChildren(
      ...events.map((text) => {
        const row = document.createElement('div');
        row.className = text.startsWith('Time for ') ? 'clock-event now' : 'clock-event';
        row.innerHTML = `${EVENT_ICON}<span></span>`;
        row.querySelector('span')!.textContent = text;
        return row;
      }),
    );
    this.fitClockEvents();
  }

  /** Shrinks any event line too wide for one line, and drops events that still don't fit rather than cut them off. */
  private fitClockEvents(): void {
    const list = this.clockPopup.querySelector<HTMLElement>('.clock-events');
    if (!list) return;
    const rows = [...list.children] as HTMLElement[];
    rows.forEach((row) => (row.style.fontSize = ''));
    for (const row of rows) {
      // Room for the text and padding: the list's width less the row's own border, and 1px for rounding.
      const room = list.clientWidth - (row.offsetWidth - row.clientWidth) - 1;
      const scale = fitFontScale(row.scrollWidth, room);
      if (scale < 1) row.style.fontSize = `${parseFloat(getComputedStyle(row).fontSize) * scale}px`;
    }
    while (list.children.length > 1 && list.scrollHeight > list.clientHeight + 1) list.lastElementChild!.remove();
  }

  placeClock(layout: Layout): void {
    const card = this.clockPopup.querySelector<HTMLElement>('.clock-card');
    const close = this.clockPopup.querySelector<HTMLElement>('.next');
    if (card) {
      place(card, layout.clockCard);
      // Text sizes in the stylesheet are multiples of 1% of the card's height.
      card.style.setProperty('--u', `${layout.clockCard.h / 100}px`);
    }
    if (close) place(close, layout.closeButton);
    this.fitClockEvents();
  }

  hideClock(): void {
    this.clockPopup.classList.remove('visible');
    this.clockPopup.replaceChildren();
  }

  private chipFor(word: string): HTMLElement | undefined {
    return [...this.chips.children].find((chip) => (chip as HTMLElement).dataset.word === word) as HTMLElement | undefined;
  }

  private buildRow(board: HTMLElement, word: string, rect: Rect): HTMLElement[] {
    const { slotSize, slotGap } = this.layout;
    return [...word].map((_, i) => {
      const slot = el('div', 'slot', board);
      place(slot, { x: rect.x + i * (slotSize + slotGap), y: rect.y, w: slotSize, h: slotSize });
      slot.style.fontSize = `${Math.round(slotSize * SLOT_LETTER_SCALE)}px`;
      return slot;
    });
  }

  private buildButton(board: HTMLElement, kind: string, label: string, icon: string, rect: Rect): HTMLButtonElement {
    const button = el('button', `button ${kind}`, board);
    button.type = 'button';
    button.innerHTML = `${icon}<span>${label}</span>`;
    place(button, rect);
    return button;
  }

  private positionTiles(animate: boolean): void {
    this.ringOrder.forEach((letter, slot) => {
      const tile = this.tiles[letter];
      const { x, y, r } = this.layout.tiles[slot];
      if (!animate) tile.style.transition = 'none';
      tile.style.transform = `translate(${x - r}px, ${y - r}px)`;
      if (!animate) {
        void tile.offsetWidth;
        tile.style.transition = '';
      }
    });
  }
}
