import type { ClockFace, UpcomingEvent } from '../clock/clock';
import { el, place } from '../ui/dom';
import { fitFontScale } from '../ui/fit';
import { ARROW_ICON, CHECK_ICON, CLOCK_ICON, CLOSE_ICON, EVENT_ICON, GAMES_ICON, SHARE_ICON } from '../ui/icons';
import type { GameId } from './games';
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
  /** Shown in green squares under "Well done!" (Word Guess). */
  word?: string;
  lines: CelebrationLine[];
  /** "Next puzzle" or "Next word". */
  nextLabel: string;
  /** The card moves on by itself after this long. */
  timeoutMs: number;
  /** Puts a Share button beside the Next button. The card waits while the share sheet is open. */
  share?: () => Promise<void>;
}

/** A game's card in the Games pop-up. */
export interface GameEntry {
  id: GameId;
  title: string;
  /** An extra line under the name, e.g. "Today's Wordle is ready". */
  note: string | null;
}

/** Text doesn't shrink exactly in proportion to its size, so a line that has to shrink gets 2% to spare. */
const FIT_SPARE = 0.98;
const ICON_ATTRS =
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
/** Solid triangles: easier for her to spot than thin chevrons. */
const MORE_DOWN_ICON = `<svg ${ICON_ATTRS}><path d="M4 7h16l-8 11z" fill="currentColor"/></svg>`;
const MORE_UP_ICON = `<svg ${ICON_ATTRS}><path d="M4 17h16l-8 -11z" fill="currentColor"/></svg>`;

const SIDEWAYS_IPAD =`<svg width="240" height="170" viewBox="0 0 240 170" aria-hidden="true"><rect x="10" y="10" width="220" height="150" rx="18" fill="#fff" stroke="#141414" stroke-width="8"/><circle cx="208" cy="85" r="6" fill="#141414"/></svg>`;

const pictureRow = (letters: string, looks: readonly string[]) =>
  [...letters].map((letter, i) => `<span class="${looks[i]}">${letter.trim()}</span>`).join('');

/** A small picture of each game for its card in the Games pop-up. */
const GAME_PICTURES: Record<GameId, string> = {
  circle: `<span class="pic-circle">${[...'STONE'].map((letter, i) => `<b style="--i:${i}">${letter}</b>`).join('')}</span>`,
  guess: `<span class="pic-guess">${pictureRow('STARE', ['right', 'present', 'right', 'absent', 'right'])}${pictureRow(
    'SLATE',
    ['right', 'right', 'right', 'right', 'right'],
  )}${pictureRow('     ', ['', '', '', '', ''])}</span>`,
};

/** Draws what every game shares: the top-right buttons, the pop-ups and the "Well done!" card. */
export class FrameView {
  /** The game on screen draws itself in here. */
  readonly gameLayer: HTMLElement;
  private readonly corner: HTMLElement;
  private readonly celebrate: HTMLElement;
  private readonly clockPopup: HTMLElement;
  private readonly gamesPopup: HTMLElement;
  private readonly rotate: HTMLElement;

  /** Buttons are drawn here but tapped through the touch tracker, which works with a resting thumb. */
  constructor(root: HTMLElement) {
    this.gameLayer = el('div', 'game-layer', root);
    this.corner = el('div', 'corner', root);
    this.celebrate = el('div', 'celebrate', root);
    this.clockPopup = el('div', 'clock-popup', root);
    this.gamesPopup = el('div', 'games-popup', root);
    this.rotate = el('div', 'rotate', root);
    this.rotate.innerHTML = `${SIDEWAYS_IPAD}<div>Please turn the iPad sideways</div>`;
  }

  /** The Games and Clock buttons in the top-right corner. */
  renderCorner(layout: FrameLayout): void {
    this.corner.replaceChildren();
    const games = el('button', 'games-button', this.corner);
    games.type = 'button';
    games.innerHTML = `${GAMES_ICON}<span>Games</span>`;
    place(games, layout.gamesButton);
    const clock = el('button', 'clock-button', this.corner);
    clock.type = 'button';
    clock.setAttribute('aria-label', 'Clock');
    clock.innerHTML = CLOCK_ICON;
    place(clock, layout.clockButton);
  }

  showRotate(on: boolean): void {
    this.rotate.classList.toggle('visible', on);
  }

  /** The "Well done!" card with her good news. Its buttons are tapped through the touch tracker. */
  showCelebration(card: CelebrationCard, layout: FrameLayout): void {
    this.celebrate.replaceChildren();
    el('div', 'celebrate-dim', this.celebrate);
    const box = el('div', card.word ? 'card with-word' : 'card', this.celebrate);
    el('div', 'card-title', box).textContent = 'Well done!';
    if (card.word) {
      const word = el('div', 'card-word', box);
      for (const letter of card.word) el('span', '', word).textContent = letter.toUpperCase();
    }
    const rows = el('div', 'card-rows', box);
    for (const line of card.lines) {
      const row = el('div', `card-row ${line.kind}${line.highlight ? ' highlight' : ''}`, rows);
      row.innerHTML = `${line.icon}<span></span>`;
      row.querySelector('span')!.textContent = line.text;
    }
    if (card.share) {
      const share = el('button', 'next share', this.celebrate);
      share.type = 'button';
      share.innerHTML = `${SHARE_ICON}<span>Share</span>`;
    }
    const next = el('button', 'next forward', this.celebrate);
    next.type = 'button';
    next.innerHTML = `<span></span>${ARROW_ICON}`;
    next.querySelector('span')!.textContent = card.nextLabel;
    // Visible first, so the rows can be measured when they're fitted.
    this.celebrate.classList.add('visible');
    this.placeCelebration(layout);
  }

  placeCelebration(layout: FrameLayout): void {
    const box = this.celebrate.querySelector<HTMLElement>('.card');
    const share = this.celebrate.querySelector<HTMLElement>('.share');
    const next = this.celebrate.querySelector<HTMLElement>('.forward');
    if (box) {
      place(box, layout.card);
      // Text sizes in the stylesheet are multiples of 1% of the card's height.
      box.style.setProperty('--u', `${layout.card.h / 100}px`);
    }
    if (share) place(share, layout.shareButton);
    if (next) place(next, share ? layout.nextWordButton : layout.nextButton);
    this.fitCelebrationRows();
  }

  hideCelebration(): void {
    this.celebrate.classList.remove('visible');
    this.celebrate.replaceChildren();
  }

  /** The "Pick a game" pop-up: a big card per game, the one she's in marked. Tapped through the touch tracker. */
  showGames(entries: readonly GameEntry[], current: GameId, layout: FrameLayout): void {
    this.gamesPopup.replaceChildren();
    el('div', 'celebrate-dim', this.gamesPopup);
    const card = el('div', 'games-card', this.gamesPopup);
    el('div', 'games-title', card).textContent = 'Pick a game';
    for (const entry of entries) {
      const on = entry.id === current;
      const choice = el('button', on ? 'game-choice on' : 'game-choice', this.gamesPopup);
      choice.type = 'button';
      choice.innerHTML = `${on ? `<span class="game-check">${CHECK_ICON}</span>` : ''}${GAME_PICTURES[entry.id]}<span class="game-name"></span>`;
      choice.querySelector('.game-name')!.textContent = entry.title;
      if (entry.note) el('span', 'game-note', choice).textContent = entry.note;
    }
    const close = el('button', 'next close', this.gamesPopup);
    close.type = 'button';
    close.innerHTML = `${CLOSE_ICON}<span>Close</span>`;
    this.gamesPopup.classList.add('visible');
    this.placeGames(layout);
  }

  placeGames(layout: FrameLayout): void {
    // Text and pictures are multiples of 1% of the card's height.
    this.gamesPopup.style.setProperty('--u', `${layout.card.h / 100}px`);
    const card = this.gamesPopup.querySelector<HTMLElement>('.games-card');
    if (card) place(card, layout.card);
    this.gamesPopup.querySelectorAll<HTMLElement>('.game-choice').forEach((choice, i) => place(choice, layout.gameCards[i]));
    const close = this.gamesPopup.querySelector<HTMLElement>('.next');
    if (close) place(close, layout.closeButton);
  }

  hideGames(): void {
    this.gamesPopup.classList.remove('visible');
    this.gamesPopup.replaceChildren();
  }

  /** The big clock pop-up. Its Close button is tapped through the touch tracker. */
  showClock(face: ClockFace, events: readonly UpcomingEvent[], layout: FrameLayout): void {
    this.clockPopup.replaceChildren();
    el('div', 'celebrate-dim', this.clockPopup);
    const card = el('div', 'clock-card', this.clockPopup);
    el('div', 'clock-time', card);
    el('div', 'clock-part', card);
    el('div', 'clock-date', card);
    // The list scrolls; its rows sit in one block so their icons and text line up on the left.
    el('div', 'clock-rows', el('div', 'clock-events', card));
    // Arrows in the card's side margins, beside the list, showing there are more countdowns that way.
    el('div', 'clock-more up', card).innerHTML = MORE_UP_ICON + MORE_UP_ICON;
    el('div', 'clock-more down', card).innerHTML = MORE_DOWN_ICON + MORE_DOWN_ICON;
    const close = el('button', 'next close', this.clockPopup);
    close.type = 'button';
    close.innerHTML = `${CLOSE_ICON}<span>Close</span>`;
    // Visible first, so the event lines can be measured when they're fitted.
    this.clockPopup.classList.add('visible');
    this.updateClock(face, events);
    this.placeClock(layout);
  }

  /** Refreshes the time and countdowns while the pop-up is open. */
  updateClock(face: ClockFace, events: readonly UpcomingEvent[]): void {
    const set = (selector: string, text: string) => {
      const node = this.clockPopup.querySelector(selector);
      if (node && node.textContent !== text) node.textContent = text;
    };
    set('.clock-time', face.time);
    set('.clock-part', face.part);
    set('.clock-date', face.date);
    const list = this.clockPopup.querySelector<HTMLElement>('.clock-events');
    const rows = list?.querySelector<HTMLElement>('.clock-rows');
    if (!list || !rows) return;
    const key = (event: UpcomingEvent) => `${event.text}\n${event.when}`;
    const current = [...rows.children].map((row) => (row as HTMLElement).dataset.key).join('\n\n');
    if (current === events.map(key).join('\n\n')) {
      this.showClockScrollFades(list);
      return;
    }
    list.style.display = events.length === 0 ? 'none' : '';
    rows.replaceChildren(
      ...events.map((event) => {
        // The countdown, with its day and time on a smaller line underneath.
        const row = document.createElement('div');
        row.className = event.now ? 'clock-event now' : 'clock-event';
        row.dataset.key = key(event);
        row.innerHTML = `${EVENT_ICON}<div class="clock-lines"><span class="clock-what"></span><span class="clock-when"></span></div>`;
        row.querySelector('.clock-what')!.textContent = event.text;
        row.querySelector('.clock-when')!.textContent = event.when;
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
    if (scale < 1) list.style.fontSize = `${parseFloat(getComputedStyle(list).fontSize) * scale * FIT_SPARE}px`;
  }

  /** Shrinks any event line too wide for one line. Events that don't all fit are scrolled to. */
  private fitClockEvents(): void {
    const list = this.clockPopup.querySelector<HTMLElement>('.clock-events');
    if (!list) return;
    const rows = [...list.querySelectorAll<HTMLElement>('.clock-event')];
    rows.forEach((row) => (row.style.fontSize = ''));
    for (const row of rows) {
      // Room for the text and padding: the list's width less the row's own border, and 1px for rounding.
      const room = list.clientWidth - (row.offsetWidth - row.clientWidth) - 1;
      const scale = fitFontScale(row.scrollWidth, room);
      if (scale < 1) row.style.fontSize = `${parseFloat(getComputedStyle(row).fontSize) * scale * FIT_SPARE}px`;
    }
    this.showClockScrollFades(list);
  }

  /** Scrolls the countdowns by `dy` pixels (positive shows what is further down). */
  scrollClock(dy: number): void {
    const list = this.clockPopup.querySelector<HTMLElement>('.clock-events');
    if (!list) return;
    list.scrollTop += dy;
    this.showClockScrollFades(list);
  }

  /** Fades the edge of the list and shows arrows where more countdowns are hidden, so she can tell there are more. */
  private showClockScrollFades(list: HTMLElement): void {
    const above = list.scrollTop > 1;
    const below = list.scrollTop + list.clientHeight < list.scrollHeight - 1;
    list.classList.toggle('more-above', above);
    list.classList.toggle('more-below', below);
    const card = list.parentElement!;
    card.classList.toggle('more-above', above);
    card.classList.toggle('more-below', below);
    card.style.setProperty('--list-top', `${list.offsetTop}px`);
    card.style.setProperty('--list-bottom', `${list.offsetTop + list.offsetHeight}px`);
  }
}
