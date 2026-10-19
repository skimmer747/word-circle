export interface PointerInput {
  type: 'down' | 'move' | 'up' | 'cancel';
  id: number;
  x: number;
  y: number;
  /** Event time in ms; used to ignore a thumb that rests on a button and lifts much later. */
  time?: number;
}

export interface TileGeometry {
  x: number;
  y: number;
  r: number;
}

export interface ButtonGeometry {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TracerGeometry {
  screenWidth: number;
  safeZoneLeft: number;
  safeZoneRight: number;
  tiles: TileGeometry[];
  buttons: ButtonGeometry[];
  /** Areas a finger can drag up and down to scroll (buttons inside still tap). */
  scrollAreas?: ButtonGeometry[];
}

export interface TracerCallbacks {
  letterAdded(tile: number): void;
  letterRemoved(tile: number): void;
  wordSubmitted(tiles: number[]): void;
  selectionCleared(): void;
  buttonTapped(id: string): void;
  /** A scrolling finger moved; `dy` is positive when it moved up, to show what is further down. */
  scrolled?(id: string, dy: number): void;
}

/** A word may start slightly outside a tile's drawn edge. */
export const START_HIT_FACTOR = 1.15;
const MIN_TRACE_LENGTH = 3;
/** Distance between checks along the line between two touch samples (Safari merges samples when busy). */
const SAMPLE_SPACING = 10;
/** A press longer than this is a resting thumb, not a tap. */
const MAX_TAP_MS = 2000;

interface Press {
  button: string;
  time?: number;
}

/**
 * Turns finger movement into letter selections, button taps and scrolling, ignoring the safe zones.
 * Every finger is tracked separately, so a resting thumb never blocks another finger
 * (iPadOS drops ordinary click events while another finger is on the screen).
 */
export class LetterTracer {
  private geometry: TracerGeometry = { screenWidth: 0, safeZoneLeft: 0, safeZoneRight: 0, tiles: [], buttons: [] };
  private activeId: number | null = null;
  private selected: number[] = [];
  private last = { x: 0, y: 0 };
  private readonly presses = new Map<number, Press>();
  private scrolling: { id: number; area: string; y: number } | null = null;
  private enabled = true;

  constructor(private readonly callbacks: TracerCallbacks) {}

  get selection(): readonly number[] {
    return this.selected;
  }

  get isTracing(): boolean {
    return this.activeId !== null;
  }

  setGeometry(geometry: TracerGeometry): void {
    this.reset();
    this.geometry = geometry;
  }

  setEnabled(enabled: boolean): void {
    if (!enabled) this.reset();
    this.enabled = enabled;
  }

  isInSafeZone(x: number): boolean {
    const { screenWidth, safeZoneLeft, safeZoneRight } = this.geometry;
    return x < safeZoneLeft || x > screenWidth - safeZoneRight;
  }

  handle(input: PointerInput): void {
    switch (input.type) {
      case 'down':
        this.onDown(input);
        return;
      case 'move':
        if (input.id === this.activeId) this.onMove(input);
        else if (input.id === this.scrolling?.id) this.onScroll(input);
        return;
      case 'up':
        this.onEnd(input, true);
        return;
      case 'cancel':
        this.onEnd(input, false);
        return;
    }
  }

  private onDown({ id, x, y, time }: PointerInput): void {
    if (!this.enabled || this.activeId !== null || this.isInSafeZone(x)) return;
    const button = this.buttonAt(x, y);
    if (button !== null) {
      this.presses.set(id, { button, time });
      return;
    }
    const tile = this.tileAt(x, y, START_HIT_FACTOR);
    if (tile === null) {
      const area = this.scrollAreaAt(x, y);
      if (area !== null && this.scrolling === null) this.scrolling = { id, area, y };
      return;
    }
    this.activeId = id;
    this.selected = [tile];
    this.last = { x, y };
    this.callbacks.letterAdded(tile);
  }

  /** Checks every point along the line from the previous sample, so no crossed letter is skipped. */
  private onMove({ x, y }: PointerInput): void {
    const from = this.last;
    const steps = Math.max(1, Math.ceil(Math.hypot(x - from.x, y - from.y) / SAMPLE_SPACING));
    for (let i = 1; i <= steps; i++) {
      this.visit(from.x + ((x - from.x) * i) / steps, from.y + ((y - from.y) * i) / steps);
    }
    this.last = { x, y };
  }

  private onScroll({ y }: PointerInput): void {
    const scrolling = this.scrolling!;
    const dy = scrolling.y - y;
    scrolling.y = y;
    if (dy !== 0) this.callbacks.scrolled?.(scrolling.area, dy);
  }

  private visit(x: number, y: number): void {
    const tile = this.tileAt(x, y, 1);
    if (tile === null) return;
    const count = this.selected.length;
    if (count >= 2 && tile === this.selected[count - 2]) {
      const removed = this.selected.pop()!;
      this.callbacks.letterRemoved(removed);
      return;
    }
    if (this.selected.includes(tile)) return;
    this.selected.push(tile);
    this.callbacks.letterAdded(tile);
  }

  private onEnd({ id, x, y, time }: PointerInput, submit: boolean): void {
    const press = this.presses.get(id);
    if (press) {
      this.presses.delete(id);
      const quick = press.time === undefined || time === undefined || time - press.time <= MAX_TAP_MS;
      if (submit && quick && this.buttonAt(x, y) === press.button) this.callbacks.buttonTapped(press.button);
      return;
    }
    if (id === this.scrolling?.id) {
      this.scrolling = null;
      return;
    }
    if (id !== this.activeId) return;
    const tiles = this.selected;
    this.reset();
    if (submit && tiles.length >= MIN_TRACE_LENGTH) this.callbacks.wordSubmitted(tiles);
    else this.callbacks.selectionCleared();
  }

  private reset(): void {
    this.activeId = null;
    this.selected = [];
    this.presses.clear();
    this.scrolling = null;
  }

  private buttonAt(x: number, y: number): string | null {
    const button = this.geometry.buttons.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
    return button ? button.id : null;
  }

  private scrollAreaAt(x: number, y: number): string | null {
    const area = this.geometry.scrollAreas?.find((a) => x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h);
    return area ? area.id : null;
  }

  private tileAt(x: number, y: number, factor: number): number | null {
    const { tiles } = this.geometry;
    for (let i = 0; i < tiles.length; i++) {
      if (Math.hypot(x - tiles[i].x, y - tiles[i].y) <= tiles[i].r * factor) return i;
    }
    return null;
  }
}
