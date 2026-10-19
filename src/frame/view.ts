import type { ClockFace } from '../clock/clock';
import { el, place } from '../ui/dom';
import { fitFontScale } from '../ui/fit';
import { ARROW_ICON, CLOCK_ICON, CLOSE_ICON, EVENT_ICON } from '../ui/icons';
import type { FrameLayout } from './layout';

/** One line of good news on the "Well done!" card. */
export interface CelebrationLine {
  /** CSS class that colors the line's icon, e.g. "row-streak". */
  kind: string;
  icon: string;
  text: string;
  /** Orange highlight, for records and milestones. */
  highlight: boolean;
}

/** What a game puts on the "Well done!" card. */
export interface CelebrationCard {
  lines: CelebrationLine[];
  /** "Next puzzle" or "Next word". */
  nextLabel: string;
  /** The card moves on by itself after this long. */
  timeoutMs: number;
}

const SIDEWAYS_IPAD = `<svg width="240" height="170" viewBox="0 0 240 170" aria-hidden="true"><rect x="10" y="10" width="220" height="150" rx="18" fill="#fff" stroke="#141414" stroke-width="8"/><circle cx="208" cy="85" r="6" fill="#141414"/></svg>`;

/** Draws what every game shares: the top-right buttons, the pop-ups and the "Well done!" card. */
export class FrameView {
  /** The game on screen draws itself in here. */
  readonly gameLayer: HTMLElement;
  private readonly corner: HTMLElement;
  private readonly celebrate: HTMLElement;
  private readonly clockPopup: HTMLElement;
  private readonly rotate: HTMLElement;

  /** Buttons are drawn here but tapped through the touch tracker, which works with a resting thumb. */
  constructor(root: HTMLElement) {
    this.gameLayer = el('div', 'game-layer', root);
    this.corner = el('div', 'corner', root);
    this.celebrate = el('div', 'celebrate', root);
    this.clockPopup = el('div', 'clock-popup', root);
    this.rotate = el('div', 'rotate', root);
    this.rotate.innerHTML = `${SIDEWAYS_IPAD}<div>Please turn the iPad sideways</div>`;
  }

  /** The buttons in the top-right corner. */
  renderCorner(layout: FrameLayout): void {
    this.corner.replaceChildren();
    const clock = el('button', 'clock-button', this.corner);
    clock.type = 'button';
    clock.setAttribute('aria-label', 'Clock');
    clock.innerHTML = CLOCK_ICON;
    place(clock, layout.clockButton);
  }

  showRotate(on: boolean): void {
    this.rotate.classList.toggle('visible', on);
  }

  /** The "Well done!" card with her good news. Its button is tapped through the touch tracker. */
  showCelebration(card: CelebrationCard, layout: FrameLayout): void {
    this.celebrate.replaceChildren();
    el('div', 'celebrate-dim', this.celebrate);
    const box = el('div', 'card', this.celebrate);
    el('div', 'card-title', box).textContent = 'Well done!';
    const rows = el('div', 'card-rows', box);
    for (const line of card.lines) {
      const row = el('div', `card-row ${line.kind}${line.highlight ? ' highlight' : ''}`, rows);
      row.innerHTML = `${line.icon}<span></span>`;
      row.querySelector('span')!.textContent = line.text;
    }
    const next = el('button', 'next', this.celebrate);
    next.type = 'button';
    next.innerHTML = `<span></span>${ARROW_ICON}`;
    next.querySelector('span')!.textContent = card.nextLabel;
    // Visible first, so the rows can be measured when they're fitted.
    this.celebrate.classList.add('visible');
    this.placeCelebration(layout);
  }

  placeCelebration(layout: FrameLayout): void {
    const box = this.celebrate.querySelector<HTMLElement>('.card');
    const next = this.celebrate.querySelector<HTMLElement>('.next');
    if (box) {
      place(box, layout.card);
      // Text sizes in the stylesheet are multiples of 1% of the card's height.
      box.style.setProperty('--u', `${layout.card.h / 100}px`);
    }
    if (next) place(next, layout.nextButton);
    this.fitCelebrationRows();
  }

  hideCelebration(): void {
    this.celebrate.classList.remove('visible');
    this.celebrate.replaceChildren();
  }

  /** The big clock pop-up. Its Close button is tapped through the touch tracker. */
  showClock(face: ClockFace, events: readonly string[], layout: FrameLayout): void {
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

  placeClock(layout: FrameLayout): void {
    const card = this.clockPopup.querySelector<HTMLElement>('.clock-card');
    const close = this.clockPopup.querySelector<HTMLElement>('.next');
    if (card) {
      place(card, layout.card);
      // Text sizes in the stylesheet are multiples of 1% of the card's height.
      card.style.setProperty('--u', `${layout.card.h / 100}px`);
    }
    if (close) place(close, layout.closeButton);
    this.fitClockEvents();
  }

  hideClock(): void {
    this.clockPopup.classList.remove('visible');
    this.clockPopup.replaceChildren();
  }

  /** Shrinks the stat rows together if the widest is too wide for one line, so their icons stay lined up. */
  private fitCelebrationRows(): void {
    const box = this.celebrate.querySelector<HTMLElement>('.card');
    const list = this.celebrate.querySelector<HTMLElement>('.card-rows');
    if (!box || !list) return;
    list.style.fontSize = '';
    const boxStyle = getComputedStyle(box);
    const room = box.clientWidth - parseFloat(boxStyle.paddingLeft) - parseFloat(boxStyle.paddingRight) - 1;
    const rows = [...list.children] as HTMLElement[];
    const widest = Math.max(0, ...rows.map((row) => row.scrollWidth + (row.offsetWidth - row.clientWidth)));
    const scale = fitFontScale(widest, room);
    if (scale < 1) list.style.fontSize = `${parseFloat(getComputedStyle(list).fontSize) * scale}px`;
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
}
