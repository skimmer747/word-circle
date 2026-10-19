/** A stretch without touches counts for at most this long, so putting the iPad down doesn't spoil a record. */
export const IDLE_CAP_MS = 60_000;

/** Measures active play time on one puzzle. Times are in ms from any steady clock (performance.now()). */
export class PlayTimer {
  private last: number | null = null;
  private paused = false;

  constructor(private elapsed = 0) {}

  get elapsedMs(): number {
    return this.elapsed;
  }

  /** A touch, or the puzzle appearing. */
  activity(now: number): void {
    if (this.paused) return;
    if (this.last !== null) this.elapsed += Math.min(Math.max(0, now - this.last), IDLE_CAP_MS);
    this.last = now;
  }

  /** The iPad went to sleep or the app was closed. */
  pause(): void {
    this.paused = true;
    this.last = null;
  }

  resume(now: number): void {
    this.paused = false;
    this.last = now;
  }
}
