import type { FrameLayout } from '../frame/layout';
import { el, place } from '../ui/dom';
import {
  ARROW_ICON,
  CALENDAR_ICON,
  CLOSE_ICON,
  CROWN_ICON,
  SPARKLE_ICON,
  STAR_ICON,
  SUN_ICON,
  TARGET_ICON,
  TROPHY_ICON,
} from '../ui/icons';
import { CARD_COUNT, type HerStats, type StatIcon, type StatLine } from './her-stats';

const ICONS: Record<StatIcon, string> = { sun: SUN_ICON, calendar: CALENDAR_ICON, trophy: TROPHY_ICON, target: TARGET_ICON, rocket: STAR_ICON };
/** Soft confetti, in the games' own fills. */
const CONFETTI_COLORS = ['#f6e09c', '#f4c0d1', '#cdeccf', '#b5d4f4', '#ffe9d6', '#e07b24'];
const CONFETTI_PIECES = 40;
const COUNT_UP_MS = 1500;
/** Her longest word's tiles are at most this many card-height percent wide (smaller for a long word). */
const TILE_UNITS = 9;

/** True when the iPad is set to Reduce Motion: then nothing moves. */
function reducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function title(card: HTMLElement, text: string): void {
  el('div', 'stats-title', card).textContent = text;
}

function newBadge(parent: HTMLElement): void {
  el('span', 'stats-new', parent).textContent = 'New!';
}

function lines(parent: HTMLElement, items: readonly StatLine[], className = 'stats-lines'): void {
  if (items.length === 0) return;
  const box = el('div', className, parent);
  for (const item of items) {
    const row = el('div', `stats-line icon-${item.icon}`, box);
    row.innerHTML = `${ICONS[item.icon]}<span></span>`;
    row.querySelector('span')!.textContent = item.text;
    if (item.isNew) newBadge(row);
  }
}

/** Little sparkles that twinkle once: [left, top, delay in seconds]. */
function sparkles(parent: HTMLElement, spots: readonly (readonly [string, string, number])[]): void {
  for (const [left, top, delay] of spots) {
    const sparkle = el('span', 'stats-sparkle', parent);
    sparkle.innerHTML = SPARKLE_ICON;
    sparkle.style.left = left;
    sparkle.style.top = top;
    sparkle.style.animationDelay = `${delay}s`;
  }
}

function totalCard(card: HTMLElement, s: HerStats): void {
  title(card, "You've solved");
  const wrap = el('div', 'stats-big-wrap', card);
  el('div', 'stats-big', wrap).textContent = s.total.value.toLocaleString('en-US');
  sparkles(wrap, [
    ['-14%', '0%', 1.7],
    ['104%', '35%', 1.9],
    ['45%', '-28%', 2.1],
  ]);
  const label = el('div', 'stats-label', card);
  label.textContent = s.total.label;
  if (s.total.isNew) newBadge(label);
  lines(card, s.total.lines, 'stats-lines row');
}

function podiumCard(card: HTMLElement, s: HerStats): void {
  title(card, 'Your favorite game');
  const row = el('div', 'stats-podium', card);
  const most = Math.max(1, ...s.podium.entries.map((e) => e.solved));
  s.podium.entries.forEach((entry, i) => {
    const col = el('div', entry.top ? 'stats-col top' : 'stats-col', row);
    if (entry.top) el('span', 'stats-crown', col).innerHTML = CROWN_ICON;
    el('div', 'stats-col-name', col).textContent = entry.title;
    const bar = el('div', `stats-bar ${entry.id}`, col);
    bar.style.setProperty('--h', String(Math.round(30 + (70 * entry.solved) / most)));
    bar.style.animationDelay = `${0.2 * i}s`;
    bar.textContent = entry.solved.toLocaleString('en-US');
  });
  if (s.podium.note) el('div', 'stats-note', card).textContent = s.podium.note;
}

function bestsCard(card: HTMLElement, s: HerStats): void {
  title(card, 'Your bests');
  const cols = el('div', 'stats-bests', card);
  const { fastest, others, tries, triesNote, fewestTriesIsNew } = s.bests;
  if (fastest.length > 0 || others.length > 0) {
    const left = el('div', 'stats-bests-col', cols);
    if (fastest.length > 0) el('div', 'stats-sub', left).textContent = 'Word Circle, fastest';
    lines(left, fastest);
    lines(left, others);
    left.querySelectorAll<HTMLElement>('.icon-trophy').forEach((row, i) => sparkles(row, [['-8%', '-30%', 0.6 + 0.3 * i]]));
  }
  if (tries || triesNote) {
    const right = el('div', 'stats-bests-col', cols);
    const sub = el('div', 'stats-sub', right);
    sub.textContent = 'Word Guess, got it in';
    if (fewestTriesIsNew) newBadge(sub);
    if (tries) {
      const chart = el('div', 'stats-tries', right);
      const most = Math.max(1, ...tries.map((t) => t.count));
      tries.forEach((t, i) => {
        const row = el('div', 'stats-try', chart);
        el('span', 'stats-try-label', row).textContent = t.label;
        const bar = el('span', t.top ? 'stats-try-bar top' : 'stats-try-bar', row);
        bar.style.width = `${Math.max(8, (85 * t.count) / most)}%`;
        bar.style.animationDelay = `${0.15 * i}s`;
        bar.textContent = t.count.toLocaleString('en-US');
      });
    } else {
      el('div', 'stats-note', right).textContent = triesNote;
    }
  }
  if (cols.childElementCount === 0) el('div', 'stats-note', card).textContent = 'Your bests appear as you play.';
}

function gardenCard(card: HTMLElement, s: HerStats): void {
  title(card, 'Your garden');
  const grid = el('div', 'stats-garden', card);
  const last = s.garden.flowers.length - 1;
  s.garden.flowers.forEach((size, i) => {
    const plot = el('div', 'stats-plot', grid);
    if (size === 0) {
      el('div', 'stats-soil', plot);
      return;
    }
    const flower = el('div', `stats-flower s${size}${i % 3 === 0 ? ' pink' : ''}`, plot);
    flower.style.animationDelay = `${0.05 * i}s, ${1.6 + 0.03 * i}s`;
    if (i === last) sparkles(plot, [['70%', '-10%', 1.8]]);
  });
  el('div', 'stats-caption', card).textContent = s.garden.caption;
}

function factsCard(card: HTMLElement, s: HerStats): void {
  title(card, 'Did you know?');
  const { word, wordIsNew, fact, empty } = s.facts;
  if (word) {
    const sub = el('div', 'stats-sub', card);
    sub.textContent = 'Your longest word so far';
    if (wordIsNew) newBadge(sub);
    const tiles = el('div', 'stats-tiles', card);
    [...word].forEach((letter, i) => {
      const tile = el('span', 'stats-tile', tiles);
      tile.textContent = letter;
      tile.style.animationDelay = `${0.12 * i}s`;
    });
  }
  if (fact) el('div', 'stats-fact', card).textContent = fact;
  if (empty) el('div', 'stats-note', card).textContent = empty;
}

const CARDS = [totalCard, podiumCard, bestsCard, gardenCard, factsCard];

/** A short burst of soft confetti falling once over the card. */
function confetti(card: HTMLElement): void {
  for (let i = 0; i < CONFETTI_PIECES; i++) {
    const piece = el('span', 'stats-confetti', card);
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    piece.style.animationDelay = `${Math.random() * 0.4}s`;
    piece.style.setProperty('--spin', `${Math.round(Math.random() * 720 - 360)}deg`);
  }
}

/** Her stats pop-up: one big card at a time, with Close and Next tapped through the touch tracker. */
export class HerStatsView {
  private readonly root: HTMLElement;
  private countUp = 0;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'stats-popup', parent);
  }

  /** Shows card `index` (0–4), animating it in; confetti if it has something new. */
  show(stats: HerStats, index: number, layout: FrameLayout): void {
    cancelAnimationFrame(this.countUp);
    this.root.replaceChildren();
    el('div', 'celebrate-dim', this.root);
    const card = el('div', 'stats-card', this.root);
    CARDS[index % CARD_COUNT](card, stats);
    const close = el('button', 'next close', this.root);
    close.type = 'button';
    close.innerHTML = `${CLOSE_ICON}<span>Close</span>`;
    const next = el('button', 'next forward', this.root);
    next.type = 'button';
    next.innerHTML = `<span>Next</span>${ARROW_ICON}`;
    this.root.classList.add('visible');
    this.place(layout);
    if (reducedMotion()) return;
    if (index === 0) this.countUpTo(card, stats.total.value);
    const isNew = [stats.total.isNew, false, stats.bests.isNew, false, stats.facts.wordIsNew][index];
    if (isNew) confetti(card);
  }

  place(layout: FrameLayout): void {
    const u = layout.card.h / 100;
    this.root.style.setProperty('--u', `${u}px`);
    const card = this.root.querySelector<HTMLElement>('.stats-card');
    if (card) place(card, layout.card);
    const tiles = this.root.querySelector<HTMLElement>('.stats-tiles');
    if (tiles) tiles.style.setProperty('--tile', `${Math.min(TILE_UNITS * u, (layout.card.w * 0.85) / tiles.childElementCount - 8)}px`);
    const close = this.root.querySelector<HTMLElement>('.close');
    if (close) place(close, layout.shareButton);
    const next = this.root.querySelector<HTMLElement>('.forward');
    if (next) place(next, layout.nextWordButton);
  }

  hide(): void {
    cancelAnimationFrame(this.countUp);
    this.root.classList.remove('visible');
    this.root.replaceChildren();
  }

  /** The total counts up from 0, easing out, over COUNT_UP_MS. */
  private countUpTo(card: HTMLElement, total: number): void {
    const node = card.querySelector<HTMLElement>('.stats-big');
    if (!node) return;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / COUNT_UP_MS);
      node.textContent = Math.round(total * (1 - (1 - p) ** 3)).toLocaleString('en-US');
      if (p < 1) this.countUp = requestAnimationFrame(step);
    };
    node.textContent = '0';
    this.countUp = requestAnimationFrame(step);
  }
}
