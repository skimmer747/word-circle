import { clockFace, upcomingEvents } from '../clock/clock';
import { cachedSchedule, refreshSchedule } from '../clock/loader';
import type { ScheduledEvent } from '../clock/schedule';
import { LetterTracer, type ButtonGeometry, type PointerInput, type TileGeometry } from '../input/touch';
import { dayKey, recordPlayDay as countPlayDay, type PlayDays } from '../shared/days';
import type { KeyValueStore } from '../shared/store';
import type { FrameHost, GameId, GameScreen, GameTargets } from './games';
import { computeFrameLayout, type FrameLayout } from './layout';
import { loadSavedFrame, saveSavedFrame, type SavedFrame } from './storage';
import { FrameView, type CelebrationCard } from './view';

/** The clock pop-up closes by itself after this long. */
const CLOCK_OPEN_MS = 60_000;
/** The Games pop-up closes by itself after this long. */
const GAMES_OPEN_MS = 60_000;
/** The countdown list scrolls, so it can hold everything coming up this week. */
const CLOCK_MAX_EVENTS = 20;
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
 * What every game shares: touch handling with the thumb safe zones, the Games and Clock buttons and their
 * pop-ups, the "Well done!" card, the shared days in a row and applying updates. Shows one game at a time.
 */
export class Frame implements FrameHost {
  /** True once she has touched the screen in this session. */
  interacted = false;
  private game: GameScreen;
  private saved: SavedFrame;
  private layout: FrameLayout | null = null;
  private targets: GameTargets = { tiles: [], buttons: [] };
  private celebration: Celebrating | null = null;
  private sharing = false;
  private schedule: ScheduledEvent[] = [];
  private clockOpen = false;
  private clockTick = 0;
  private clockAutoClose = 0;
  private gamesOpen = false;
  private gamesAutoClose = 0;
  private readonly view: FrameView;
  private readonly tracer: LetterTracer;

  /** `seed` is Word Circle's days in a row, carried over the first time. */
  constructor(
    root: HTMLElement,
    private readonly store: KeyValueStore,
    private readonly updates: Updates,
    private readonly games: readonly GameScreen[],
    private readonly seed: PlayDays,
  ) {
    this.view = new FrameView(root);
    this.game = games[0];
    this.saved = { current: games[0].id, ...seed };
    this.tracer = new LetterTracer({
      letterAdded: () => this.game.letterAdded?.(),
      letterRemoved: () => this.game.letterRemoved?.(),
      selectionCleared: () => this.game.selectionCleared?.(),
      wordSubmitted: (tiles) => this.game.wordSubmitted?.(tiles),
      buttonTapped: (id) => this.buttonTapped(id),
      buttonPressed: (id) => this.game.buttonPressed?.(id),
      buttonReleased: (id) => this.game.buttonReleased?.(id),
      scrolled: (id, dy) => this.scrolled(id, dy),
    });
  }

  get isTracing(): boolean {
    return this.tracer.isTracing;
  }

  get selection(): readonly number[] {
    return this.tracer.selection;
  }

  start(): void {
    this.saved = loadSavedFrame(this.store, this.seed);
    this.game = this.games.find((game) => game.id === this.saved.current) ?? this.games[0];
    this.schedule = cachedSchedule(this.store);
    for (const game of this.games) game.start(this);
    // Only the game on screen runs its timers.
    for (const game of this.games) if (game !== this.game) game.pause();
    this.relayout(false);
    this.listen();
    this.game.resume();
    void this.refreshSchedule();
    window.setInterval(() => {
      if (!document.hidden) void this.refreshSchedule();
    }, SCHEDULE_REFRESH_MS);
  }

  /** Shows the "Well done!" card until she taps Next, or for the card's time (paused while she's sharing). */
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

  updateTargets(targets: GameTargets): void {
    this.targets = targets;
    this.updateTouchTargets();
  }

  recordPlayDay(): number {
    const days = countPlayDay(this.saved, dayKey(new Date()));
    this.saved = { ...this.saved, ...days };
    saveSavedFrame(this.store, this.saved);
    return days.streakDays;
  }

  private scrolled(id: string, dy: number): void {
    if (id !== 'clock' || !this.clockOpen) return;
    this.view.scrollClock(dy);
    this.keepClockOpen();
  }

  private buttonTapped(id: string): void {
    if (id === 'next') this.celebration?.done();
    else if (id === 'share') this.shareCelebration();
    else if (id === 'clock') this.openClock();
    else if (id === 'close') this.closeClock();
    else if (id === 'games') this.openGames();
    else if (id === 'games-close') this.closeGames();
    else if (id.startsWith('game:')) this.chooseGame(id.slice('game:'.length) as GameId);
    else this.game.buttonTapped(id);
  }

  /** Pop-ups wait while she's tracing a word, the game is busy, or another pop-up is up. */
  private blocked(): boolean {
    return (
      this.celebration !== null || this.clockOpen || this.gamesOpen || this.game.busy || this.tracer.isTracing || !this.layout
    );
  }

  /** Opens the share sheet from the card; the card waits until it closes. */
  private shareCelebration(): void {
    const celebrating = this.celebration;
    const share = celebrating?.card.share;
    if (!celebrating || !share || this.sharing) return;
    this.sharing = true;
    window.clearTimeout(celebrating.timeout);
    void share().finally(() => {
      this.sharing = false;
      if (this.celebration === celebrating) celebrating.timeout = window.setTimeout(celebrating.done, celebrating.card.timeoutMs);
    });
  }

  private openGames(): void {
    if (this.blocked() || !this.layout) return;
    this.gamesOpen = true;
    const entries = this.games.map((game) => ({ id: game.id, title: game.title, note: game.note?.() ?? null }));
    this.view.showGames(entries, this.game.id, this.layout);
    this.gamesAutoClose = window.setTimeout(() => this.closeGames(), GAMES_OPEN_MS);
    this.updateTouchTargets();
  }

  private closeGames(): void {
    if (!this.gamesOpen) return;
    window.clearTimeout(this.gamesAutoClose);
    this.gamesOpen = false;
    this.view.hideGames();
    this.updateTouchTargets();
  }

  /** Each game keeps its own place, so switching never loses anything. */
  private chooseGame(id: GameId): void {
    this.closeGames();
    const next = this.games.find((game) => game.id === id);
    if (!next || next === this.game) return;
    this.game.pause();
    this.game = next;
    this.saved = { ...this.saved, current: id };
    saveSavedFrame(this.store, this.saved);
    this.relayout(true);
    this.game.resume();
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
    this.view.showClock(clockFace(new Date()), upcomingEvents(this.schedule, new Date(), CLOCK_MAX_EVENTS), this.layout);
    this.clockTick = window.setInterval(() => this.updateClock(), 1000);
    this.keepClockOpen();
    this.updateTouchTargets();
    void this.refreshSchedule();
  }

  /** (Re)starts the countdown to closing the clock by itself, so it stays open while she scrolls. */
  private keepClockOpen(): void {
    window.clearTimeout(this.clockAutoClose);
    this.clockAutoClose = window.setTimeout(() => this.closeClock(), CLOCK_OPEN_MS);
  }

  private updateClock(): void {
    const now = new Date();
    this.view.updateClock(clockFace(now), upcomingEvents(this.schedule, now, CLOCK_MAX_EVENTS));
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
    const layout = computeFrameLayout(width, height, this.games.length);
    this.layout = layout;
    this.view.renderCorner(layout);
    this.targets = this.game.render(this.view.gameLayer, layout, animateIn);
    this.updateTouchTargets();
  }

  /**
   * What the touch tracker listens for: only the card's buttons while celebrating, only a pop-up's buttons while
   * one is open, otherwise the game and the top-right buttons.
   */
  private updateTouchTargets(): void {
    const layout = this.layout;
    if (!layout) return;
    let tiles: TileGeometry[] = [];
    let buttons: ButtonGeometry[];
    if (this.celebration) {
      buttons = this.celebration.card.share
        ? [
            { id: 'share', ...layout.shareButton },
            { id: 'next', ...layout.nextWordButton },
          ]
        : [{ id: 'next', ...layout.nextButton }];
    } else if (this.clockOpen) {
      buttons = [{ id: 'close', ...layout.closeButton }];
    } else if (this.gamesOpen) {
      buttons = [
        ...this.games.map((game, i) => ({ id: `game:${game.id}`, ...layout.gameCards[i] })),
        { id: 'games-close', ...layout.closeButton },
      ];
    } else {
      tiles = this.targets.tiles;
      buttons = [...this.targets.buttons, { id: 'games', ...layout.gamesButton }, { id: 'clock', ...layout.clockButton }];
    }
    this.tracer.setGeometry({
      screenWidth: layout.width,
      safeZoneLeft: layout.safeZoneLeft,
      safeZoneRight: layout.safeZoneRight,
      tiles,
      buttons,
      // A finger dragged anywhere on the clock card scrolls its countdowns.
      scrollAreas: this.clockOpen ? [{ id: 'clock', ...layout.card }] : [],
    });
    if (this.celebration) this.view.placeCelebration(layout);
    if (this.clockOpen) this.view.placeClock(layout);
    if (this.gamesOpen) this.view.placeGames(layout);
    this.tracer.setEnabled(true);
  }
}
