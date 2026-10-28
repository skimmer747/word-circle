import type { ClockFace, UpcomingEvent } from '../clock/clock';
import { el, place } from '../ui/dom';
import { fitFontScale } from '../ui/fit';
import { ARROW_ICON, CHECK_ICON, CLOCK_ICON, CLOSE_ICON, EVENT_ICON, GAMES_ICON, SHARE_ICON, STAR_ICON } from '../ui/icons';
import type { GameId } from './games';
import type { FrameLayout, Rect } from './layout';

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

/** A card telling her something, with a Close button. */
export interface NoticeCard {
  /** Shown beside the title. */
  icon: string;
  title: string;
  /** Short sentences, one paragraph each. */
  lines: string[];
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
/** The least space between the "Well done!" card's last line and its buttons. */
const CARD_BUTTON_GAP = 16;
const ICON_ATTRS =
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
/** Solid triangles: easier for her to spot than thin chevrons. */
const MORE_DOWN_ICON = `<svg ${ICON_ATTRS}><path d="M4 7h16l-8 11z" fill="currentColor"/></svg>`;
const MORE_UP_ICON = `<svg ${ICON_ATTRS}><path d="M4 17h16l-8 -11z" fill="currentColor"/></svg>`;

const SIDEWAYS_IPAD =`<svg width="240" height="170" viewBox="0 0 240 170" aria-hidden="true"><rect x="10" y="10" width="220" height="150" rx="18" fill="#fff" stroke="#141414" stroke-width="8"/><circle cx="208" cy="85" r="6" fill="#141414"/></svg>`;

/** The widest game picture, in picture units (Word Guess's five squares and their gaps)... */
const PICTURE_UNITS = 36;
/** ...and the room a game card's padding and border take from its width. */
const PICTURE_MARGIN = 40;

const pictureRow = (letters: string, looks: readonly string[]) =>
  [...letters].map((letter, i) => `<span class="${looks[i]}">${letter.trim()}</span>`).join('');

/** A finished little Word Grid: its letters, with thick lines around each section and thin ones inside. */
function gridPicture(rows: readonly string[], sections: readonly string[]): string {
  const sectionAt = (r: number, c: number) => sections[r]?.[c] ?? '.';
  return rows
    .map((row, r) =>
      [...row]
        .map((letter, c) => {
          const section = sectionAt(r, c);
          if (section === '.') return '<span class="gap"></span>';
          const side = (rr: number, cc: number) => (sectionAt(rr, cc) === section ? '1px' : '3px');
          return `<span style="border-width:${side(r - 1, c)} ${side(r, c + 1)} ${side(r + 1, c)} ${side(r, c - 1)}">${letter}</span>`;
        })
        .join(''),
    )
    .join('');
}

/** A small picture of each game for its card in the Games pop-up. */
const GAME_PICTURES: Record<GameId, string> = {
  circle: `<span class="pic-circle">${[...'STONE'].map((letter, i) => `<b style="--i:${i}">${letter}</b>`).join('')}</span>`,
  guess: `<span class="pic-guess">${pictureRow('STARE', ['right', 'present', 'right', 'absent', 'right'])}${pictureRow(
    'SLATE',
    ['right', 'right', 'right', 'right', 'right'],
  )}${pictureRow('     ', ['', '', '', '', ''])}</span>`,
  grid: `<span class="pic-grid">${gridPicture(['GNAT', 'NO.A', 'ANTS', 'WE.K'], ['aabb', 'aa.c', 'dddc', 'ee.c'])}</span>`,
};

/** Draws what every game shares: the top-right buttons, the pop-ups and the "Well done!" card. */
export class FrameView {
  /** The game on screen draws itself in here. */
  readonly gameLayer: HTMLElement;
  /** Her stats pop-up draws itself in here. */
  readonly statsLayer: HTMLElement;
  private readonly corner: HTMLElement;
  private readonly celebrate: HTMLElement;
  private readonly clockPopup: HTMLElement;
  private readonly gamesPopup: HTMLElement;
  private readonly noticePopup: HTMLElement;
  private readonly rotate: HTMLElement;

  /** Buttons are drawn here but tapped through the touch tracker, which works with a resting thumb. */
  constructor(root: HTMLElement) {
    this.gameLayer = el('div', 'game-layer', root);
    this.corner = el('div', 'corner', root);
    this.celebrate = el('div', 'celebrate', root);
    this.clockPopup = el('div', 'clock-popup', root);
    this.gamesPopup = el('div', 'games-popup', root);
    this.noticePopup = el('div', 'notice-popup', root);
    this.statsLayer = el('div', 'stats-layer', root);
    this.rotate = el('div', 'rotate', root);
    this.rotate.innerHTML = `${SIDEWAYS_IPAD}<div>Please turn the iPad sideways</div>`;
  }

  /** The Games button (or, with one game, a Stats button) and the Clock button in the top-right corner. */
  renderCorner(layout: FrameLayout, corner: 'games' | 'stats'): void {
    this.corner.replaceChildren();
    const left = el('button', 'games-button', this.corner);
    left.type = 'button';
    left.innerHTML = corner === 'games' ? `${GAMES_ICON}<span>Games</span>` : `${STAR_ICON}<span>Stats</span>`;
    place(left, layout.gamesButton);
    const clock = el('button', 'clock-button', this.corner);
    clock.type = 'button';
    clock.setAttribute('aria-label', 'Clock');
    clock.innerHTML = CLOCK_ICON;
    place(clock, layout.clockButton);
  }

  /** A ring that fills around the clock over `ms` while it's held; the settings page opens when it's full. */
  showHoldRing(layout: FrameLayout, ms: number): void {
    this.hideHoldRing();
    const ring = el('div', 'hold-ring', this.corner);
    ring.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" pathLength="100"/></svg>';
    ring.style.setProperty('--hold-ms', `${ms}ms`);
    place(ring, layout.clockButton);
  }

  hideHoldRing(): void {
    this.corner.querySelector('.hold-ring')?.remove();
  }

  showRotate(on: boolean): void {
    this.rotate.classList.toggle('visible', on);
  }

  /** The "Well done!" card with her good news. Its buttons are tapped through the touch tracker. */
  showCelebration(card: CelebrationCard, layout: FrameLayout, title: string): void {
    this.celebrate.replaceChildren();
    el('div', 'celebrate-dim', this.celebrate);
    const box = el('div', card.word ? 'card with-word' : 'card', this.celebrate);
    el('div', 'card-title', box).textContent = title;
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
    const back = el('button', 'next small back', this.celebrate);
    back.type = 'button';
    back.innerHTML = `${ARROW_ICON}<span>Back to puzzle</span>`;
    const stats = el('button', 'next small stats', this.celebrate);
    stats.type = 'button';
    stats.innerHTML = `${STAR_ICON}<span>Your stats</span>`;
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
    const back = this.celebrate.querySelector<HTMLElement>('.back');
    if (back) place(back, layout.backButton);
    const stats = this.celebrate.querySelector<HTMLElement>('.stats');
    if (stats) place(stats, layout.cardStatsButton);
    this.fitCelebrationHeight(layout);
    this.fitCelebrationRows();
    this.fitCelebrationTitle();
  }

  /** Back to puzzle: the card goes so she can see the finished puzzle, leaving its Next button at `next`. */
  showReview(next: Rect): void {
    for (const node of this.celebrate.querySelectorAll('.celebrate-dim, .card, .share, .back, .stats')) node.remove();
    const button = this.celebrate.querySelector<HTMLElement>('.forward');
    if (button) {
      button.classList.add('review');
      place(button, next);
    }
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
    const stats = el('button', 'next stats', this.gamesPopup);
    stats.type = 'button';
    stats.innerHTML = `${STAR_ICON}<span>Your stats</span>`;
    this.gamesPopup.classList.add('visible');
    this.placeGames(layout);
  }

  placeGames(layout: FrameLayout): void {
    // Text and pictures are multiples of 1% of the card's height...
    const u = layout.card.h / 100;
    this.gamesPopup.style.setProperty('--u', `${u}px`);
    // ...but three cards can be narrower than the pictures, so the pictures (not the names) shrink to fit.
    const cardWidth = layout.gameCards[0]?.w ?? 0;
    this.gamesPopup.style.setProperty('--pu', `${Math.min(u, (cardWidth - PICTURE_MARGIN) / PICTURE_UNITS)}px`);
    const card = this.gamesPopup.querySelector<HTMLElement>('.games-card');
    if (card) place(card, layout.card);
    this.gamesPopup.querySelectorAll<HTMLElement>('.game-choice').forEach((choice, i) => place(choice, layout.gameCards[i]));
    const close = this.gamesPopup.querySelector<HTMLElement>('.close');
    if (close) place(close, layout.shareButton);
    const stats = this.gamesPopup.querySelector<HTMLElement>('.stats');
    if (stats) place(stats, layout.nextWordButton);
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
    el('div', 'clock-greeting', card);
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
    set('.clock-greeting', face.greeting);
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

  /** A card telling her something. Its Close button is tapped through the touch tracker. */
  showNotice(notice: NoticeCard, layout: FrameLayout): void {
    this.noticePopup.replaceChildren();
    el('div', 'celebrate-dim', this.noticePopup);
    const card = el('div', 'notice-card', this.noticePopup);
    const title = el('div', 'notice-title', card);
    title.innerHTML = `${notice.icon}<span></span>`;
    title.querySelector('span')!.textContent = notice.title;
    for (const line of notice.lines) el('p', 'notice-line', card).textContent = line;
    const close = el('button', 'next close', this.noticePopup);
    close.type = 'button';
    close.innerHTML = `${CLOSE_ICON}<span>Close</span>`;
    this.noticePopup.classList.add('visible');
    this.placeNotice(layout);
  }

  placeNotice(layout: FrameLayout): void {
    const card = this.noticePopup.querySelector<HTMLElement>('.notice-card');
    const close = this.noticePopup.querySelector<HTMLElement>('.close');
    if (close) place(close, layout.closeButton);
    if (!card) return;
    place(card, layout.card);
    // Text sizes in the stylesheet are multiples of 1% of the card's height, shrunk together if they'd run into Close.
    let u = layout.card.h / 100;
    card.style.setProperty('--u', `${u}px`);
    const last = card.lastElementChild as HTMLElement | null;
    if (!last) return;
    for (let i = 0; i < 3; i++) {
      const top = parseFloat(getComputedStyle(card).paddingTop);
      const room = layout.closeButton.y - CARD_BUTTON_GAP - layout.card.y - card.clientTop - top;
      const used = last.offsetTop + last.offsetHeight - top;
      if (used <= room) break;
      u *= (room / used) * FIT_SPARE;
      card.style.setProperty('--u', `${u}px`);
    }
    // The title stays on one line beside its icon, shrinking if it's too wide.
    const title = card.querySelector<HTMLElement>('.notice-title');
    if (!title) return;
    title.style.fontSize = '';
    const style = getComputedStyle(card);
    const width = card.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 1;
    const scale = fitFontScale(title.scrollWidth, width, 0.4);
    if (scale < 1) title.style.fontSize = `${parseFloat(getComputedStyle(title).fontSize) * scale * FIT_SPARE}px`;
  }

  hideNotice(): void {
    this.noticePopup.classList.remove('visible');
    this.noticePopup.replaceChildren();
  }

  /** Shrinks everything on the card together if it would run into its buttons (a long Word Guess card). */
  private fitCelebrationHeight(layout: FrameLayout): void {
    const box = this.celebrate.querySelector<HTMLElement>('.card');
    const last = box?.lastElementChild as HTMLElement | null | undefined;
    if (!box || !last) return;
    // Measured at full size: the row and title fits that follow shrink only across.
    for (const node of box.querySelectorAll<HTMLElement>('.card-rows, .card-title')) node.style.fontSize = '';
    let u = layout.card.h / 100;
    // Text doesn't shrink exactly in proportion, so it gets a few tries. Offsets, not screen positions: the card
    // is still scaling in.
    for (let i = 0; i < 3; i++) {
      const top = parseFloat(getComputedStyle(box).paddingTop);
      const room = layout.backButton.y - CARD_BUTTON_GAP - layout.card.y - box.clientTop - top;
      const used = last.offsetTop + last.scrollHeight - top;
      if (used <= room) break;
      u *= (room / used) * FIT_SPARE;
      box.style.setProperty('--u', `${u}px`);
    }
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

  /** Shrinks "Well done, …!" to one line if her name makes it too wide. */
  private fitCelebrationTitle(): void {
    const box = this.celebrate.querySelector<HTMLElement>('.card');
    const title = this.celebrate.querySelector<HTMLElement>('.card-title');
    if (!box || !title) return;
    title.style.fontSize = '';
    const boxStyle = getComputedStyle(box);
    const room = box.clientWidth - parseFloat(boxStyle.paddingLeft) - parseFloat(boxStyle.paddingRight) - 1;
    const scale = fitFontScale(title.scrollWidth, room, 0.4);
    if (scale < 1) title.style.fontSize = `${parseFloat(getComputedStyle(title).fontSize) * scale * FIT_SPARE}px`;
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
