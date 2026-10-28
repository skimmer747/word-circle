import { puzzleEvent, track } from '../analytics';
import { clockFace, upcomingEvents } from '../clock/clock';
import { cachedSchedule, refreshSchedule } from '../clock/loader';
import { parseSchedule, type ScheduledEvent } from '../clock/schedule';
import { LetterTracer, type ButtonGeometry, type PointerInput, type TileGeometry } from '../input/touch';
import { dayKey, recordPlayDay as countPlayDay, type PlayDays } from '../shared/days';
import { wellDoneTitle } from '../settings/name';
import type { ScheduleSetting } from '../settings/settings';
import type { KeyValueStore } from '../shared/store';
import { CARD_COUNT, herStats, loadSeen, saveSeen, seenAfter, type HerStats, type HerStatsInput } from '../stats/her-stats';
import { HerStatsView } from '../stats/her-view';
import { addPlay, loadLifetime, loadLog, type PlayRecord } from '../stats/log';
import type { FrameHost, GameId, GameScreen, GameTargets } from './games';
import { computeFrameLayout, type FrameLayout, type Thumb } from './layout';
import { loadSavedFrame, saveSavedFrame, type SavedFrame } from './storage';
import { FrameView, type CelebrationCard, type NoticeCard } from './view';

/** The clock pop-up closes by itself after this long. */
const CLOCK_OPEN_MS = 60_000;
/** The Games pop-up closes by itself after this long. */
const GAMES_OPEN_MS = 60_000;
/** The countdown list scrolls, so it can hold everything coming up this week. */
const CLOCK_MAX_EVENTS = 20;
/** How often to check the online schedule for changes. */
const SCHEDULE_REFRESH_MS = 5 * 60_000;
/** Holding the clock this long opens the settings page... */
const HOLD_OPEN_MS = 3000;
/** ...and a ring starts filling around it after this long, so a quick tap looks just as before. */
const HOLD_RING_MS = 500;
/** A notice closes by itself after this long. */
const NOTICE_OPEN_MS = 30_000;
/** Her stats close by themselves after this long untouched. */
const STATS_OPEN_MS = 120_000;
/** Looking back at a finished puzzle moves on to the next one by itself after this long. */
const REVIEW_MS = 60_000;

/** What this iPad's settings tell the frame. */
export interface FrameOptions {
  /** Her first name, for the card and the clock greeting; '' for none. */
  name: string;
  /** Which side gets the wider safe zone. */
  thumb: Thumb;
  /** schedule.txt from the site (Mom's iPad), or events typed on this iPad. */
  schedule: ScheduleSetting;
  /** Shows the settings page. It calls `closed` on Cancel; Done reloads the app. */
  openSettings(closed: () => void): void;
}

export interface Updates {
  /** Applies a waiting update (reloading the page). Returns true if it did. */
  applyIfPending(): boolean;
}

interface Celebrating {
  card: CelebrationCard;
  done: () => void;
  timeout: number;
  /** She tapped Back to puzzle: the card is gone and only its Next button is left over the finished puzzle. */
  reviewing: boolean;
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
  private settingsOpen = false;
  private noticeOpen = false;
  private noticeAutoClose = 0;
  private holdRing = 0;
  private holdOpen = 0;
  private statsOpen = false;
  private statsCard = 0;
  private statsAutoClose = 0;
  private statsInput: HerStatsInput | null = null;
  private stats: HerStats | null = null;
  private readonly statsView: HerStatsView;
  private readonly view: FrameView;
  private readonly tracer: LetterTracer;

  /** `seed` is Word Circle's days in a row, carried over the first time. */
  constructor(
    root: HTMLElement,
    private readonly store: KeyValueStore,
    private readonly updates: Updates,
    private readonly games: readonly GameScreen[],
    private readonly seed: PlayDays,
    private readonly options: FrameOptions,
  ) {
    this.view = new FrameView(root);
    this.statsView = new HerStatsView(this.view.statsLayer);
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
      dragStarted: (id, x, y) => this.game.dragStarted?.(id, x, y),
      dragMoved: (id, x, y) => this.game.dragMoved?.(id, x, y),
      dragEnded: (id, x, y) => this.game.dragEnded?.(id, x, y),
      dragCancelled: (id) => this.game.dragCancelled?.(id),
      holdStarted: (id) => this.holdStarted(id),
      holdEnded: (id) => this.holdEnded(id),
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
    const { schedule } = this.options;
    this.schedule = schedule.source === 'web' ? cachedSchedule(this.store) : parseSchedule(schedule.lines.join('\n'));
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
      this.celebration = { card, done, timeout: window.setTimeout(done, card.timeoutMs), reviewing: false };
      if (this.layout) this.view.showCelebration(card, this.layout, wellDoneTitle(this.options.name));
      this.updateTouchTargets();
    });
  }

  notice(card: NoticeCard): void {
    if (this.blocked() || !this.layout) return;
    this.noticeOpen = true;
    this.view.showNotice(card, this.layout);
    this.noticeAutoClose = window.setTimeout(() => this.closeNotice(), NOTICE_OPEN_MS);
    this.updateTouchTargets();
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

  logPlay(record: PlayRecord): void {
    addPlay(this.store, record);
    track('puzzle_finished', puzzleEvent(record));
  }

  private scrolled(id: string, dy: number): void {
    if (id !== 'clock' || !this.clockOpen) return;
    this.view.scrollClock(dy);
    this.keepClockOpen();
  }

  private buttonTapped(id: string): void {
    if (id === 'next') this.celebration?.done();
    else if (id === 'share') this.shareCelebration();
    else if (id === 'back') this.reviewPuzzle();
    else if (id === 'card-stats') this.openStatsFromCard();
    else if (id === 'clock') this.openClock();
    else if (id === 'close') this.closeClock();
    else if (id === 'games') this.openGames();
    else if (id === 'games-close') this.closeGames();
    else if (id.startsWith('game:')) this.chooseGame(id.slice('game:'.length) as GameId);
    else if (id === 'stats') this.openStats();
    else if (id === 'games-stats') this.openStatsFromGames();
    else if (id === 'stats-next') this.nextStatsCard();
    else if (id === 'stats-close') this.closeStats();
    else if (id === 'notice-close') this.closeNotice();
    else this.game.buttonTapped(id);
  }

  /** Pop-ups wait while she's tracing a word or holding a letter, the game is busy, or another pop-up is up. */
  private blocked(): boolean {
    return (
      this.celebration !== null ||
      this.settingsOpen ||
      this.statsOpen ||
      this.clockOpen ||
      this.gamesOpen ||
      this.noticeOpen ||
      this.game.busy ||
      this.tracer.isTracing ||
      this.tracer.isDragging ||
      !this.layout
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

  /** Back to puzzle: the card goes so she can look at what she finished, with Next left over it. */
  private reviewPuzzle(): void {
    const celebrating = this.celebration;
    if (!celebrating || celebrating.reviewing || this.sharing) return;
    celebrating.reviewing = true;
    window.clearTimeout(celebrating.timeout);
    celebrating.timeout = window.setTimeout(celebrating.done, REVIEW_MS);
    this.view.showReview(this.reviewButton());
    this.updateTouchTargets();
  }

  private reviewButton() {
    return this.targets.reviewButton ?? this.layout!.nextButton;
  }

  private closeNotice(): void {
    if (!this.noticeOpen) return;
    window.clearTimeout(this.noticeAutoClose);
    this.noticeOpen = false;
    this.view.hideNotice();
    this.updateTouchTargets();
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
    track('game_switched', { game: id });
    saveSavedFrame(this.store, this.saved);
    this.relayout(true);
    this.game.resume();
  }

  private openStatsFromGames(): void {
    this.closeGames();
    this.openStats();
  }

  /** Her stats: the game pauses (looking isn't play time), and the pop-up opens on its first card. */
  private openStats(): void {
    if (this.blocked() || !this.layout) return;
    this.game.pause();
    this.showStats();
  }

  /** Her stats from the "Well done!" card, with the puzzle she just finished counted. The card waits underneath. */
  private openStatsFromCard(): void {
    const celebrating = this.celebration;
    if (!celebrating || celebrating.reviewing || this.sharing || this.statsOpen || !this.layout) return;
    // The game is already stopped while it celebrates.
    window.clearTimeout(celebrating.timeout);
    this.showStats();
  }

  private showStats(): void {
    this.statsOpen = true;
    track('stats_opened');
    this.statsInput = {
      games: this.games.map((game) => ({ id: game.id, title: game.title, ...game.summary() })),
      streak: this.saved,
      log: loadLog(this.store),
      lifetime: loadLifetime(this.store),
      today: dayKey(new Date()),
      seen: loadSeen(this.store),
    };
    this.stats = herStats(this.statsInput);
    this.statsCard = 0;
    this.showStatsCard();
    this.updateTouchTargets();
  }

  private showStatsCard(): void {
    if (!this.stats || !this.statsInput || !this.layout) return;
    this.statsView.show(this.stats, this.statsCard, this.layout);
    // Something new is celebrated once: remember what this card showed.
    saveSeen(this.store, seenAfter(loadSeen(this.store), this.statsInput, this.statsCard));
    window.clearTimeout(this.statsAutoClose);
    this.statsAutoClose = window.setTimeout(() => this.closeStats(), STATS_OPEN_MS);
  }

  private nextStatsCard(): void {
    if (!this.statsOpen) return;
    this.statsCard = (this.statsCard + 1) % CARD_COUNT;
    this.showStatsCard();
  }

  private closeStats(): void {
    if (!this.statsOpen) return;
    window.clearTimeout(this.statsAutoClose);
    this.statsOpen = false;
    this.stats = null;
    this.statsInput = null;
    this.statsView.hide();
    // Opened from the card: back to the card, which starts its time again.
    const celebrating = this.celebration;
    if (celebrating) celebrating.timeout = window.setTimeout(celebrating.done, celebrating.card.timeoutMs);
    else this.game.resume();
    this.updateTouchTargets();
  }

  /** Picks up changes to the online schedule; keeps the last copy when offline. */
  private async refreshSchedule(): Promise<void> {
    // Only Mom's iPad reads schedule.txt; others have their events typed in.
    if (this.options.schedule.source !== 'web') return;
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
    this.view.showClock(clockFace(new Date(), this.options.name), upcomingEvents(this.schedule, new Date(), CLOCK_MAX_EVENTS), this.layout);
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
    this.view.updateClock(clockFace(now, this.options.name), upcomingEvents(this.schedule, now, CLOCK_MAX_EVENTS));
  }

  private closeClock(): void {
    if (!this.clockOpen) return;
    window.clearInterval(this.clockTick);
    window.clearTimeout(this.clockAutoClose);
    this.clockOpen = false;
    this.view.hideClock();
    this.updateTouchTargets();
  }

  /** A finger came down on the clock: after a moment a ring fills, and when it's full the settings page opens. */
  private holdStarted(id: string): void {
    if (id !== 'clock') return;
    this.cancelHold();
    this.holdRing = window.setTimeout(() => {
      if (this.layout) this.view.showHoldRing(this.layout, HOLD_OPEN_MS - HOLD_RING_MS);
    }, HOLD_RING_MS);
    this.holdOpen = window.setTimeout(() => this.openSettings(), HOLD_OPEN_MS);
  }

  private holdEnded(id: string): void {
    if (id === 'clock') this.cancelHold();
  }

  private cancelHold(): void {
    window.clearTimeout(this.holdRing);
    window.clearTimeout(this.holdOpen);
    this.view.hideHoldRing();
  }

  /** Pauses the game and hands the screen to the settings page until it's cancelled (Done reloads the app). */
  private openSettings(): void {
    this.cancelHold();
    if (this.blocked()) return;
    this.settingsOpen = true;
    track('settings_opened');
    this.tracer.setEnabled(false);
    this.game.pause();
    this.options.openSettings(() => this.settingsClosed());
  }

  private settingsClosed(): void {
    this.settingsOpen = false;
    this.game.resume();
    this.updateTouchTargets();
  }

  private listen(): void {
    const forward = (type: PointerInput['type']) => (event: PointerEvent) => {
      if (this.settingsOpen) return;
      if (type === 'down') this.interacted = true;
      if (type !== 'move') this.game.activity?.();
      this.tracer.handle({ type, id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp });
    };
    window.addEventListener('pointerdown', forward('down'));
    window.addEventListener('pointermove', forward('move'));
    window.addEventListener('pointerup', forward('up'));
    window.addEventListener('pointercancel', forward('cancel'));

    const block = (event: Event) => event.preventDefault();
    // The settings page scrolls; nothing else does.
    document.addEventListener(
      'touchmove',
      (event) => {
        if (!this.settingsOpen) event.preventDefault();
      },
      { passive: false },
    );
    document.addEventListener('gesturestart', block);
    document.addEventListener('contextmenu', block);
    document.addEventListener('dblclick', block);

    // Timers stop while the iPad sleeps or the app is closed.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.game.pause();
      } else {
        if (!this.settingsOpen && !this.statsOpen) this.game.resume();
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
    // The finished puzzle would be redrawn as the next one: looking back ends, as if she'd tapped Next.
    if (this.celebration?.reviewing) this.celebration.done();
    const layout = computeFrameLayout(width, height, this.games.length, this.options.thumb);
    this.layout = layout;
    this.view.renderCorner(layout, this.games.length > 1 ? 'games' : 'stats');
    this.targets = this.game.render(this.view.gameLayer, layout, animateIn);
    this.updateTouchTargets();
  }

  /**
   * What the touch tracker listens for: only a pop-up's buttons while one is open (her stats can open over the card),
   * only the card's buttons while celebrating, otherwise the game and the top-right buttons.
   */
  private updateTouchTargets(): void {
    const layout = this.layout;
    if (!layout) return;
    let tiles: TileGeometry[] = [];
    let draggables: ButtonGeometry[] = [];
    let buttons: ButtonGeometry[];
    if (this.statsOpen) {
      buttons = [
        { id: 'stats-close', ...layout.shareButton },
        { id: 'stats-next', ...layout.nextWordButton },
      ];
    } else if (this.celebration?.reviewing) {
      buttons = [{ id: 'next', ...this.reviewButton() }];
    } else if (this.celebration) {
      buttons = this.celebration.card.share
        ? [
            { id: 'share', ...layout.shareButton },
            { id: 'next', ...layout.nextWordButton },
          ]
        : [{ id: 'next', ...layout.nextButton }];
      buttons.push({ id: 'back', ...layout.backButton }, { id: 'card-stats', ...layout.cardStatsButton });
    } else if (this.clockOpen) {
      buttons = [{ id: 'close', ...layout.closeButton }];
    } else if (this.noticeOpen) {
      buttons = [{ id: 'notice-close', ...layout.closeButton }];
    } else if (this.gamesOpen) {
      buttons = [
        ...this.games.map((game, i) => ({ id: `game:${game.id}`, ...layout.gameCards[i] })),
        { id: 'games-close', ...layout.shareButton },
        { id: 'games-stats', ...layout.nextWordButton },
      ];
    } else {
      tiles = this.targets.tiles;
      draggables = this.targets.draggables ?? [];
      buttons = [...this.targets.buttons, { id: 'clock', ...layout.clockButton }];
      // With one game, the Games button's place holds Stats.
      buttons.push({ id: this.games.length > 1 ? 'games' : 'stats', ...layout.gamesButton });
    }
    this.tracer.setGeometry({
      screenWidth: layout.width,
      safeZoneLeft: layout.safeZoneLeft,
      safeZoneRight: layout.safeZoneRight,
      tiles,
      buttons,
      draggables,
      holdButtons: ['clock'],
      // A finger dragged anywhere on the clock card scrolls its countdowns.
      scrollAreas: this.clockOpen ? [{ id: 'clock', ...layout.card }] : [],
    });
    if (this.celebration && !this.celebration.reviewing) this.view.placeCelebration(layout);
    if (this.clockOpen) this.view.placeClock(layout);
    if (this.gamesOpen) this.view.placeGames(layout);
    if (this.noticeOpen) this.view.placeNotice(layout);
    if (this.statsOpen) this.statsView.place(layout);
    this.tracer.setEnabled(!this.settingsOpen);
  }
}
