import { formatDuration } from '../circle/stats';
import type { GameId } from '../frame/games';
import { el } from '../ui/dom';
import { niceMax, shortDay, type FamilyStats, type Series } from './family-stats';

/** Word Circle, Word Guess, Word Grid: the reference palette's first three slots, validated as a set. */
const COLORS: Record<GameId, string> = { circle: '#2a78d6', guess: '#eb6834', grid: '#1baf7a' };
const NS = 'http://www.w3.org/2000/svg';
/** The chart box in SVG units; the plot runs from L to R across and T to B down. */
const W = 600;
const H = 200;
const L = 48;
const R = 520;
const T = 12;
const B = 168;

interface Chart {
  plot: SVGSVGElement;
  /** Shows a tapped mark's exact value under the chart. */
  show(text: string): void;
}

function svg<K extends keyof SVGElementTagNameMap>(parent: Element, tag: K, attrs: Record<string, string | number>, text?: string): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  if (text !== undefined) node.textContent = text;
  parent.appendChild(node);
  return node;
}

function chart(parent: HTMLElement, heading: string, note: string): Chart {
  const box = el('div', 'family-chart', parent);
  el('h3', '', box).textContent = heading;
  el('p', 'settings-note', box).textContent = note;
  const plot = svg(box, 'svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': heading });
  const value = el('p', 'family-value', box);
  value.textContent = 'Tap a point or bar for its number.';
  return { plot, show: (text) => (value.textContent = text) };
}

function axes(plot: SVGSVGElement, max: number, label: (value: number) => string): void {
  for (const f of [0, 0.5, 1]) {
    const y = B - (B - T) * f;
    svg(plot, 'line', { x1: L, x2: R, y1: y, y2: y, class: 'family-grid' });
    svg(plot, 'text', { x: L - 6, y: y + 4, 'text-anchor': 'end', class: 'family-axis' }, label(max * f));
  }
}

function xLabels(plot: SVGSVGElement, first: string, last: string): void {
  svg(plot, 'text', { x: L, y: H - 8, class: 'family-axis' }, first);
  svg(plot, 'text', { x: R, y: H - 8, 'text-anchor': 'end', class: 'family-axis' }, last);
}

function lineChart(
  c: Chart,
  series: readonly Series[],
  weekStarts: readonly string[],
  axisLabel: (value: number) => string,
  tapText: (s: Series, value: number, weekStart: string) => string,
): void {
  const values = series.flatMap((s) => s.points.filter((p): p is number => p !== null));
  const max = niceMax(Math.max(0, ...values));
  axes(c.plot, max, axisLabel);
  const x = (i: number) => L + ((R - L) * i) / (weekStarts.length - 1);
  const y = (v: number) => B - ((B - T) * v) / max;
  for (const s of series) {
    let d = '';
    let drawing = false;
    s.points.forEach((p, i) => {
      if (p === null) {
        drawing = false;
        return;
      }
      d += `${drawing ? 'L' : 'M'}${x(i)} ${y(p)} `;
      drawing = true;
    });
    svg(c.plot, 'path', { d, fill: 'none', stroke: COLORS[s.game], 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
    let last = -1;
    s.points.forEach((p, i) => {
      if (p === null) return;
      last = i;
      svg(c.plot, 'circle', { cx: x(i), cy: y(p), r: 4, fill: COLORS[s.game] });
      const hit = svg(c.plot, 'circle', { cx: x(i), cy: y(p), r: 14, class: 'family-hit' });
      hit.addEventListener('click', () => c.show(tapText(s, p, weekStarts[i])));
    });
    if (last >= 0) svg(c.plot, 'text', { x: x(last) + 8, y: y(s.points[last]!) + 5, class: 'family-label' }, s.label);
  }
  xLabels(c.plot, '12 weeks ago', 'This week');
}

function dayBars(c: Chart, perDay: readonly number[], days: readonly string[]): void {
  const max = niceMax(Math.max(0, ...perDay));
  axes(c.plot, max, (v) => String(Math.round(v)));
  const w = (R - L) / perDay.length;
  perDay.forEach((n, i) => {
    const h = ((B - T) * n) / max;
    if (n > 0) svg(c.plot, 'rect', { x: L + i * w + 1, y: B - h, width: w - 2, height: h, rx: 2, fill: COLORS.circle });
    const hit = svg(c.plot, 'rect', { x: L + i * w, y: T, width: w, height: B - T, class: 'family-hit' });
    hit.addEventListener('click', () => c.show(`${shortDay(days[i])}: ${n} ${n === 1 ? 'puzzle' : 'puzzles'}`));
  });
  xLabels(c.plot, '4 weeks ago', 'Today');
}

function partBars(c: Chart, parts: FamilyStats['timeOfDay']): void {
  parts.forEach((part, i) => {
    const y = T + 8 + i * 40;
    svg(c.plot, 'text', { x: 110, y: y + 19, 'text-anchor': 'end', class: 'family-label' }, part.label);
    const w = ((R - 130) * part.share) / 100;
    if (part.share > 0) svg(c.plot, 'rect', { x: 120, y, width: w, height: 26, rx: 4, fill: COLORS.circle });
    svg(c.plot, 'text', { x: 128 + w, y: y + 19, class: 'family-axis' }, `${part.share}%`);
  });
}

function gameBars(c: Chart, games: FamilyStats['games'], weekStarts: readonly string[]): void {
  const totals = weekStarts.map((_, i) => games.reduce((n, g) => n + g.counts[i], 0));
  const max = niceMax(Math.max(0, ...totals));
  axes(c.plot, max, (v) => String(Math.round(v)));
  const w = (R - L) / weekStarts.length;
  weekStarts.forEach((start, i) => {
    let base = B;
    for (const g of games) {
      const n = g.counts[i];
      if (n === 0) continue;
      const h = ((B - T) * n) / max;
      const bar = svg(c.plot, 'rect', { x: L + i * w + 3, y: base - h + 1, width: w - 6, height: Math.max(h - 2, 1), rx: 2, fill: COLORS[g.game] });
      bar.addEventListener('click', () => c.show(`${g.label}, week of ${shortDay(start)}: ${n}`));
      base -= h;
    }
  });
  games.forEach((g, i) => {
    svg(c.plot, 'rect', { x: R + 12, y: T + i * 22, width: 12, height: 12, rx: 3, fill: COLORS[g.game] });
    svg(c.plot, 'text', { x: R + 30, y: T + 11 + i * 22, class: 'family-axis' }, g.label.replace('Word ', ''));
  });
  xLabels(c.plot, '12 weeks ago', 'This week');
}

/** Minutes on an axis: "30s", "1.5m", "12m". */
function minutes(v: number): string {
  if (v < 1) return `${Math.round(v * 60)}s`;
  return `${v < 10 ? v.toFixed(1) : Math.round(v)}m`;
}

/** The family's honest weekly view: a comparison table, then the charts. */
export function renderFamily(parent: HTMLElement, stats: FamilyStats): void {
  if (!stats.ready) {
    el('p', 'settings-note', parent).textContent = stats.since
      ? `Charts appear after about 2 weeks of play (since ${shortDay(stats.since)}).`
      : 'Charts appear after about 2 weeks of play.';
    return;
  }
  if (stats.table.length > 0) {
    const table = el('table', 'family-table', parent);
    const head = el('tr', '', table);
    for (const text of ['', 'Last 4 weeks', '4 weeks before']) el('th', '', head).textContent = text;
    for (const row of stats.table) {
      const tr = el('tr', '', table);
      for (const text of [row.label, row.last, row.before]) el('td', '', tr).textContent = text;
    }
  }
  const week = (start: string) => `week of ${shortDay(start)}`;
  if (stats.speed.length > 0) {
    lineChart(chart(parent, 'Speed', 'Average active time per puzzle, each week, at the level played most'), stats.speed, stats.weekStarts, minutes, (s, v, start) =>
      `${s.label}, ${week(start)}: ${formatDuration(v * 60_000)} per puzzle`);
  }
  if (stats.hints.length > 0) {
    lineChart(chart(parent, 'Hints per puzzle', 'Letters revealed by Hint, each week'), stats.hints, stats.weekStarts, (v) => v.toFixed(1), (s, v, start) =>
      `${s.label}, ${week(start)}: ${v.toFixed(1)} hints per puzzle`);
  }
  if (stats.tries) {
    lineChart(chart(parent, 'Word Guess: tries per word', 'Lower means the word was found sooner'), [stats.tries], stats.weekStarts, (v) => v.toFixed(1), (_, v, start) =>
      `${week(start)}: ${v.toFixed(1)} tries per word`);
  }
  dayBars(chart(parent, 'Puzzles per day', 'The last 4 weeks'), stats.perDay, stats.days);
  partBars(chart(parent, 'Time of day', 'When puzzles were finished, the last 4 weeks'), stats.timeOfDay);
  if (stats.games.length > 0) gameBars(chart(parent, 'Games', 'Puzzles per week, by game'), stats.games, stats.weekStarts);
}
