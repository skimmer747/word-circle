export interface PointerInput {
  type: 'down' | 'move' | 'up' | 'cancel';
  id: number;
  x: number;
  y: number;
}

export interface TileGeometry {
  x: number;
  y: number;
  r: number;
}

export interface TracerGeometry {
  screenWidth: number;
  safeZoneWidth: number;
  tiles: TileGeometry[];
}

export interface TracerCallbacks {
  letterAdded(tile: number): void;
  letterRemoved(tile: number): void;
  wordSubmitted(tiles: number[]): void;
  selectionCleared(): void;
}

/** A word may start slightly outside a tile's drawn edge. */
export const START_HIT_FACTOR = 1.15;
const MIN_TRACE_LENGTH = 3;

/** Turns finger movement into letter selections, ignoring the safe zones and extra fingers. */
export class LetterTracer {
  private geometry: TracerGeometry = { screenWidth: 0, safeZoneWidth: 0, tiles: [] };
  private activeId: number | null = null;
  private selected: number[] = [];
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
    const { screenWidth, safeZoneWidth } = this.geometry;
    return x < safeZoneWidth || x > screenWidth - safeZoneWidth;
  }

  handle(input: PointerInput): void {
    switch (input.type) {
      case 'down':
        this.onDown(input);
        return;
      case 'move':
        if (input.id === this.activeId) this.onMove(input);
        return;
      case 'up':
        this.onEnd(input, true);
        return;
      case 'cancel':
        this.onEnd(input, false);
        return;
    }
  }

  private onDown({ id, x, y }: PointerInput): void {
    if (!this.enabled || this.activeId !== null || this.isInSafeZone(x)) return;
    const tile = this.tileAt(x, y, START_HIT_FACTOR);
    if (tile === null) return;
    this.activeId = id;
    this.selected = [tile];
    this.callbacks.letterAdded(tile);
  }

  private onMove({ x, y }: PointerInput): void {
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

  private onEnd({ id }: PointerInput, submit: boolean): void {
    if (id !== this.activeId) return;
    const tiles = this.selected;
    this.reset();
    if (submit && tiles.length >= MIN_TRACE_LENGTH) this.callbacks.wordSubmitted(tiles);
    else this.callbacks.selectionCleared();
  }

  private reset(): void {
    this.activeId = null;
    this.selected = [];
  }

  private tileAt(x: number, y: number, factor: number): number | null {
    const { tiles } = this.geometry;
    for (let i = 0; i < tiles.length; i++) {
      if (Math.hypot(x - tiles[i].x, y - tiles[i].y) <= tiles[i].r * factor) return i;
    }
    return null;
  }
}
