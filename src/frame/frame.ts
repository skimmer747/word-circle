import { clockFace, upcomingLines } from '../clock/clock';
import { cachedSchedule, refreshSchedule } from '../clock/loader';
import type { ScheduledEvent } from '../clock/schedule';
import { LetterTracer, type ButtonGeometry, type PointerInput, type TileGeometry } from '../input/touch';
import type { KeyValueStore } from '../shared/store';
import type { FrameHost, GameScreen, GameTargets } from './games';
import { computeFrameLayout, type FrameLayout } from './layout';
import { FrameView, type CelebrationCard } from './view';

/** The clock pop-up closes by itself after this long. */
const CLOCK_OPEN_MS = 60_000;
/** With the clock's very large text, three events fit on every iPad. */
const CLOCK_MAX_EVENTS = 3;
/** How often to check the online schedule for changes. */
const SCHEDULE_REFRESH_MS = 5 * 60_000;

export interface Updates {
  /** Applies a waiting update (reloading the page). Returns true if it did. */
  applyIfPending(): boolean;
}

interface Celebrating {
  card: CelebrationCard;
  done: () => void;
  timeout: number;
}

/**
 * What every game shares: touch handling with the thumb safe zones, the clock, the "Well done!" card and
 * applying updates. Shows one game at a time.
 */
export class Frame implements FrameHost {
  /** True once she has touched the screen in this session. */
  interacted = false;
  private game: GameScreen;
  private layout: FrameLayout | null = null;
  private targets: GameTargets = { tiles: [], buttons: [] };
  private celebration: Celebrating | null = null;
  private schedule: ScheduledEvent[] = [];
  private clockOpen = false;
  private clockTick = 0;
  private clockAutoClose = 0;
  private readonly view: FrameView;
  private readonly tracer: LetterTracer;

  constructor(
    root: HTMLElement,
    private readonly store: KeyValueStore,
    private readonly updates: Updates,
    private readonly games: readonly GameScreen[],
  ) {
    this.view = new FrameView(root);
    this.game = games[0];
    this.tracer = new LetterTracer({
      letterAdded: () => this.game.letterAdded?.(),
      letterRemoved: () => this.game.letterRemoved?.(),
      selectionCleared: () => this.game.selectionCleared?.(),
      wordSubmitted: (tiles) => this.game.wordSubmitted?.(tiles),
      buttonTapped: (id) => this.buttonTapped(id),
    });
  }

  get isTracing(): boolean {
    return this.tracer.isTracing;
  }

  get selection(): readonly number[] {
    return this.tracer.selection;
  }

  start(): void {
    this.schedule = cachedSchedule(this.store);
    for (const game of this.games) game.start(this);
    this.relayout(false);
    this.listen();
    this.game.resume();
    void this.refreshSchedule();
    window.setInterval(() => {
      if (!document.hidden) void this.refreshSchedule();
    }, SCHEDULE_REFRESH_MS);
  }

  /** Shows the "Well done!" card until she taps its button, or for the card's time. */
  celebrate(card: CelebrationCard): Promise<void> {
    return new Promise((resolve) => {
      const done = () => {
        if (!this.celebration) return;
        window.clearTimeout(this.celebration.timeout);
        this.celebration = null;
        this.view.hideCelebration();
        // A waiting update reloads the page now; the game saved its next puzzle before the card appeared.
        if (this.updates.applyIfPending()) return;
        resolve();
      };
      this.celebration = { card, done, timeout: window.setTimeout(done, card.timeoutMs) };
      if (this.layout) this.view.showCelebration(card, this.layout);
      this.updateTouchTargets();
    });
  }

  redraw(animateIn: boolean): void {
    this.relayout(animateIn);
  }

  private buttonTapped(id: string): void {
    if (id === 'next') this.celebration?.done();
    else if (id === 'clock') this.openClock();
    else if (id === 'close') this.closeClock();
    else this.game.buttonTapped(id);
  }

  /** Pop-ups wait while she's tracing a word, the game is busy, or another pop-up is up. */
  private blocked(): boolean {
    return this.celebration !== null || this.clockOpen || this.game.busy || this.tracer.isTracing || !this.layout;
  }

  /** Picks up changes to the online schedule; keeps the last copy when offline. */
  private async refreshSchedule(): Promise<void> {
    const url = `${import.meta.env.BASE_URL}schedule.txt?v=${Date.now()}`;
    const events = await refreshSchedule(async () => {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Schedule not available (${response.status})`);
      return response.text();
    }, this.store);
    if (!events) return;
    this.schedule = events;
    if (this.clockOpen) this.updateClock();
  }

  private openClock(): void {
    if (this.blocked() || !this.layout) return;
    this.clockOpen = true;
    this.view.showClock(clockFace(new Date()), upcomingLines(this.schedule, new Date(), CLOCK_MAX_EVENTS), this.layout);
    this.clockTick = window.setInterval(() => this.updateClock(), 1000);
    this.clockAutoClose = window.setTimeout(() => this.closeClock(), CLOCK_OPEN_MS);
    this.updateTouchTargets();
    void this.refreshSchedule();
  }

  private updateClock(): void {
    const now = new Date();
    this.view.updateClock(clockFace(now), upcomingLines(this.schedule, now, CLOCK_MAX_EVENTS));
  }

  private closeClock(): void {
    if (!this.clockOpen) return;
    window.clearInterval(this.clockTick);
    window.clearTimeout(this.clockAutoClose);
    this.clockOpen = false;
    this.view.hideClock();
    this.updateTouchTargets();
  }

  private listen(): void {
    const forward = (type: PointerInput['type']) => (event: PointerEvent) => {
      if (type === 'down') this.interacted = true;
      if (type !== 'move') this.game.activity?.();
      this.tracer.handle({ type, id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp });
    };
    window.addEventListener('pointerdown', forward('down'));
    window.addEventListener('pointermove', forward('move'));
    window.addEventListener('pointerup', forward('up'));
    window.addEventListener('pointercancel', forward('cancel'));

    const block = (event: Event) => event.preventDefault();
    document.addEventListener('touchmove', block, { passive: false });
    document.addEventListener('gesturestart', block);
    document.addEventListener('contextmenu', block);
    document.addEventListener('dblclick', block);

    // Timers stop while the iPad sleeps or the app is closed.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.game.pause();
      } else {
        this.game.resume();
        void this.refreshSchedule();
      }
    });

    let frame = 0;
    window.addEventListener('resize', () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => this.relayout(false));
    });
  }

  private relayout(animateIn: boolean): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const portrait = height > width;
    this.view.showRotate(portrait);
    if (portrait) {
      this.tracer.setEnabled(false);
      return;
    }
    const layout = computeFrameLayout(width, height);
    this.layout = layout;
    this.view.renderCorner(layout);
    this.targets = this.game.render(this.view.gameLayer, layout, animateIn);
    this.updateTouchTargets();
  }

  /**
   * What the touch tracker listens for: only the card's button while celebrating, only Close while the clock is
   * open, otherwise the game and the top-right buttons.
   */
  private updateTouchTargets(): void {
    const layout = this.layout;
    if (!layout) return;
    let tiles: TileGeometry[] = [];
    let buttons: ButtonGeometry[];
    if (this.celebration) buttons = [{ id: 'next', ...layout.nextButton }];
    else if (this.clockOpen) buttons = [{ id: 'close', ...layout.closeButton }];
    else {
      tiles = this.targets.tiles;
      buttons = [...this.targets.buttons, { id: 'clock', ...layout.clockButton }];
    }
    this.tracer.setGeometry({
      screenWidth: layout.width,
      safeZoneLeft: layout.safeZoneLeft,
      safeZoneRight: layout.safeZoneRight,
      tiles,
      buttons,
    });
    if (this.celebration) this.view.placeCelebration(layout);
    if (this.clockOpen) this.view.placeClock(layout);
    this.tracer.setEnabled(true);
  }
}
