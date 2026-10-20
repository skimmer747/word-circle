import { reduceMotion, wait } from './dom';
import { STAR_ICON } from './icons';

export interface Point {
  x: number;
  y: number;
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface StarPath {
  start: Point;
  /** The curve bends toward this point; the star flies just below it. */
  control: Point;
  end: Point;
}

/** How far above the higher end the star's curve bends. */
const ARC_RISE = 80;
/** The star's flight from Hint to the square. */
const FLY_MS = 700;
/** The sparkles' burst when it lands. */
const BURST_MS = 400;
/** The hinted letter's bounce when it lands. */
const LAND_MS = 400;
const SPARKS = 10;
const SPARK_REACH = 60;

const center = (box: Box): Point => ({ x: box.left + box.width / 2, y: box.top + box.height / 2 });

/** From the center of `from` to the center of `to`, bending up halfway across, never above the top of the screen. */
export function starPath(from: Box, to: Box): StarPath {
  const start = center(from);
  const end = center(to);
  const control = { x: (start.x + end.x) / 2, y: Math.max(0, Math.min(start.y, end.y) - ARC_RISE) };
  return { start, control, end };
}

/** The path as CSS `offset-path` wants it. */
export function starPathD({ start, control, end }: StarPath): string {
  return `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;
}

/** Where each sparkle ends up, relative to where the star landed: evenly around a circle. */
export function sparkOffsets(count = SPARKS, reach = SPARK_REACH): Point[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * 2 * Math.PI;
    return { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach };
  });
}

/**
 * A gold star flies from the Hint button to the square, spinning, then bursts into sparkles.
 * Resolves when the star lands (the sparkles finish by themselves). With Reduce Motion, resolves at once. Never throws.
 */
export async function flyHintStar(from: HTMLElement, to: HTMLElement): Promise<void> {
  if (reduceMotion()) return;
  // Older iPads (iPadOS 15) can't fly an element along a path: skip the star there.
  if (typeof CSS === 'undefined' || !CSS.supports('offset-path', 'path("M 0 0")')) return;
  let layer: HTMLElement | null = null;
  try {
    from.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.9)' }, { transform: 'scale(1)' }], { duration: 200, easing: 'ease-out' });
    const path = starPath(from.getBoundingClientRect(), to.getBoundingClientRect());
    layer = document.createElement('div');
    layer.className = 'hint-star-layer';
    document.body.appendChild(layer);

    const star = document.createElement('div');
    star.className = 'hint-star';
    star.innerHTML = STAR_ICON;
    star.style.setProperty('offset-path', `path("${starPathD(path)}")`);
    layer.appendChild(star);
    const flight = star.animate(
      [
        { offsetDistance: '0%', transform: 'scale(0.6) rotate(0turn)' },
        { offsetDistance: '50%', transform: 'scale(1.3) rotate(0.5turn)' },
        { offsetDistance: '100%', transform: 'scale(1) rotate(1turn)' },
      ],
      { duration: FLY_MS, easing: 'ease-in-out', fill: 'forwards' },
    );
    // A cancelled flight rejects, and a page in the background may never finish it: land anyway.
    await Promise.race([flight.finished.catch(() => undefined), wait(FLY_MS + 250)]);
    star.remove();

    const { end } = path;
    for (const offset of sparkOffsets()) {
      const spark = document.createElement('div');
      spark.className = 'hint-spark';
      layer.appendChild(spark);
      spark.animate(
        [
          { transform: `translate(${end.x}px, ${end.y}px) translate(-50%, -50%) scale(1)`, opacity: 1 },
          { transform: `translate(${end.x + offset.x}px, ${end.y + offset.y}px) translate(-50%, -50%) scale(0.3)`, opacity: 0 },
        ],
        { duration: BURST_MS, easing: 'ease-out', fill: 'forwards' },
      );
    }
    const done = layer;
    window.setTimeout(() => done.remove(), BURST_MS);
  } catch {
    // Something went wrong drawing the star: land the letter anyway.
    layer?.remove();
  }
}

/** The hinted letter lands with a bounce (a small pop with Reduce Motion). Pass the element that shows the letter. */
export function landHintLetter(letter: HTMLElement): void {
  if (reduceMotion()) letter.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 150, easing: 'ease-out' });
  else letter.animate([{ transform: 'scale(0.4)' }, { transform: 'scale(1.25)', offset: 0.6 }, { transform: 'scale(1)' }], { duration: LAND_MS, easing: 'ease-out' });
}
