import { GAME_TITLES, type FrameHost, type GameScreen, type GameSummary, type GameTargets } from '../frame/games';
import type { FrameLayout } from '../frame/layout';
import type { CelebrationCard } from '../frame/view';
import { NOTHING_AVOIDED, type AvoidCheck } from '../shared/avoid';
import { dayKey } from '../shared/days';
import type { KeyValueStore } from '../shared/store';
import { PlayTimer } from '../shared/timer';
import { guessRecord } from '../stats/records';
import { guessLines } from './celebration';
import { cachedDailyWords, dailyFor, finishWord, refreshDailyWords, swapInDaily, type DailyWord } from './daily';
import { computeGuessLayout, type GuessLayout } from './layout';
import { firstVisibleGuess, GuessGame, VISIBLE_ROWS } from './rules';
import { shareText } from './share';
import { loadSavedGuess, recordGuessSolve, saveSavedGuess, type SavedGuess } from './storage';
import { GuessView, type DailyMode, type SquareView } from './view';
import { acceptedChecker, type GuessWords } from './words';

/** The Hint button starts to pulse after this long without a guess. */
const IDLE_HINT_MS = 120_000;
/** The "Well done!" card moves on by itself after this long... */
const CELEBRATION_MS = 15_000;
/** ...or this long on today's Wordle, to leave time for sharing. */
const DAILY_CELEBRATION_MS = 60_000;
/** How often to check for a new daily Wordle word. */
const DAILY_REFRESH_MS = 5 * 60_000;

export interface GuessOptions {
  /** Fetches daily-word.txt. */
  fetchDaily: () => Promise<string>;
  /** Opens the iPad's share sheet with the text (straight from her tap), or null if there is none. */
  share: ((text: string) => Promise<void>) | null;
  /** Words she should never see: never an answer (not even today's Wordle) and not accepted as guesses. */
  avoided?: AvoidCheck;
  /** The current time; tests can pass a fixed one. */
  now?: () => Date;
}

const emptyRow = (): SquareView[] => Array.from({ length: 5 }, () => ({ letter: '', look: 'empty' as const }));

/** Word Guess: Wordle in big print, with no losing, and the real daily Wordle word once a day. */
export class GuessScreen implements GameScreen {
  readonly id = 'guess';
  readonly title = GAME_TITLES.guess;
  /** True while a guess is coloring in, the rows are sliding, or she's celebrating. */
  busy = false;
  private host!: FrameHost;
  private saved!: SavedGuess;
  private game!: GuessGame;
  private view: GuessView | null = null;
  private layout: GuessLayout | null = null;
  private dailyWords: DailyWord[] = [];
  private allLetters = false;
  /** While the hint star flies: the square it's flying to (hidden until it lands), and how many guesses she had. */
  private hiddenHint: { guesses: number; position: number } | null = null;
  private shown = false;
  private idleTimer = 0;
  private timer = new PlayTimer();
  private readonly isAccepted: (word: string) => boolean;
  private readonly avoided: AvoidCheck;
  private readonly now: () => Date;

  constructor(
    private readonly words: GuessWords,
    private readonly store: KeyValueStore,
    private readonly options: GuessOptions,
  ) {
    this.avoided = options.avoided ?? NOTHING_AVOIDED;
    const accepted = acceptedChecker(words);
    this.isAccepted = (word) => accepted(word) && !this.avoided(word);
    this.now = options.now ?? (() => new Date());
  }

  start(host: FrameHost): void {
    this.host = host;
    this.saved = loadSavedGuess(this.store, this.words, this.avoided);
    this.dailyWords = cachedDailyWords(this.store);
    const untouched = this.saved.guesses.length === 0 && this.saved.hinted.length === 0;
    this.saved = swapInDaily(this.saved, this.today(), untouched) ?? this.saved;
    this.loadWord();
    this.save();
    void this.refreshDaily();
    window.setInterval(() => {
      if (!document.hidden) void this.refreshDaily();
    }, DAILY_REFRESH_MS);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) void this.refreshDaily();
    });
  }

  render(layer: HTMLElement, frame: FrameLayout, animateIn: boolean): GameTargets {
    if (!this.view) this.view = new GuessView(layer);
    this.layout = computeGuessLayout(frame);
    this.view.render(
      this.layout,
      { rows: this.boardRows(), keys: this.game.keyStates(), allLetters: this.allLetters, daily: this.dailyMode() },
      animateIn,
    );
    return this.targets();
  }

  buttonTapped(id: string): void {
    if (this.busy) return;
    if (id.startsWith('key:')) this.key(id.slice('key:'.length));
    else if (id === 'hint') void this.hint();
    else if (id === 'all-letters') this.toggleAllLetters();
    else if (id === 'share-today') this.shareToday();
  }

  buttonPressed(id: string): void {
    if (id.startsWith('key:')) this.view?.setPressed(id, true);
  }

  buttonReleased(id: string): void {
    if (id.startsWith('key:')) this.view?.setPressed(id, false);
  }

  pause(): void {
    this.timer.pause();
    this.shown = false;
    window.clearTimeout(this.idleTimer);
    this.view?.setHintPulse(false);
    this.save();
  }

  resume(): void {
    this.timer.resume(performance.now());
    this.shown = true;
    if (!this.busy) this.resetIdle();
  }

  activity(): void {
    this.timer.activity(performance.now());
  }

  summary(): GameSummary {
    return { solved: this.saved.stats.totalSolved };
  }

  /** "Today's Wordle is ready" in the Games pop-up until she has finished it. */
  note(): string | null {
    const today = this.today();
    return today && this.saved.dailyDone?.date !== today.date ? "Today's Wordle is ready" : null;
  }

  /** Today's Wordle, unless it's a word she should never see (then she gets list words, as with the blocklist). */
  private today(): DailyWord | null {
    const today = dailyFor(this.dailyWords, dayKey(this.now()));
    return today && !this.avoided(today.word) ? today : null;
  }

  private loadWord(): void {
    this.game = new GuessGame(this.saved.word, this.saved.guesses, this.saved.hinted, this.isAccepted);
    this.allLetters = false;
    this.timer = new PlayTimer(this.saved.elapsedMs ?? 0);
    if (document.hidden) this.timer.pause();
    else this.timer.activity(performance.now());
  }

  private save(): void {
    this.saved = { ...this.saved, guesses: [...this.game.guesses], hinted: [...this.game.hinted], elapsedMs: this.timer.elapsedMs };
    saveSavedGuess(this.store, this.saved);
  }

  /** Picks up a new daily word; brings it in only if she hasn't touched her current word. */
  private async refreshDaily(): Promise<void> {
    const list = await refreshDailyWords(this.options.fetchDaily, this.store);
    if (!list) return;
    this.dailyWords = list;
    if (this.busy) return;
    const swapped = swapInDaily(this.saved, this.today(), this.game.untouched);
    if (!swapped) return;
    this.saved = swapped;
    this.loadWord();
    this.save();
    if (this.shown) this.host.redraw(true);
  }

  private dailyMode(): DailyMode {
    const day = dayKey(this.now());
    if (this.saved.daily?.date === day) return 'label';
    if (this.saved.dailyDone?.date === day && this.saved.dailyDone.share && this.options.share) return 'share';
    return 'none';
  }

  private targets(): GameTargets {
    const layout = this.layout;
    if (!layout) return { tiles: [], buttons: [] };
    const states = this.game.keyStates();
    const keys = layout.keys.filter(({ id }) => this.allLetters || states.get(id.slice('key:'.length)) !== 'absent');
    const buttons = [
      ...keys.map(({ id, rect }) => ({ id, ...rect })),
      { id: 'hint', ...layout.hintButton },
      { id: 'all-letters', ...layout.allLettersButton },
    ];
    if (this.dailyMode() === 'share') buttons.push({ id: 'share-today', ...layout.dailyButton });
    return { tiles: [], buttons };
  }

  /** The six rows on the board: the last checked guesses, the row she's typing, then empty rows. */
  private boardRows(): SquareView[][] {
    const { guesses } = this.game;
    const rows = guesses.slice(firstVisibleGuess(guesses.length)).map((guess) => this.guessRow(guess));
    if (!this.game.solved) rows.push(this.currentRow());
    while (rows.length < VISIBLE_ROWS) rows.push(emptyRow());
    return rows;
  }

  private guessRow(guess: string): SquareView[] {
    const marks = this.game.marks(guess);
    return [...guess].map((letter, i) => ({ letter, look: marks[i] }));
  }

  private currentRow(): SquareView[] {
    const next = this.game.nextSquare();
    const hidden = this.hiddenHint?.guesses === this.game.guesses.length ? this.hiddenHint.position : -1;
    return this.game.row.map((square, i) =>
      i === hidden
        ? { letter: '', look: 'empty' }
        : { letter: square.letter, look: square.locked ? 'right' : square.letter ? 'typed' : i === next ? 'cursor' : 'empty' },
    );
  }

  /** Where the row she's typing sits on the board. */
  private currentRowIndex(): number {
    const count = this.game.guesses.length;
    return count - firstVisibleGuess(count);
  }

  private key(key: string): void {
    if (key === 'enter') {
      void this.enter();
      return;
    }
    const row = this.currentRowIndex();
    if (key === 'back') {
      if (this.game.back()) this.view?.setRow(row, this.currentRow());
      return;
    }
    const square = this.game.nextSquare();
    if (!this.game.type(key)) return;
    this.view?.setRow(row, this.currentRow());
    this.view?.popSquare(row, square);
  }

  private async enter(): Promise<void> {
    const row = this.currentRowIndex();
    const result = this.game.enter();
    if (result === 'incomplete' || result === 'notAWord') {
      this.view?.wiggleRow(row);
      return;
    }
    this.busy = true;
    this.save();
    this.resetIdle();
    const guess = this.game.guesses[this.game.guesses.length - 1];
    await this.view?.reveal(row, this.guessRow(guess));
    this.refreshKeys();
    if (result === 'solved') {
      await this.finish();
      return;
    }
    if (this.game.guesses.length >= VISIBLE_ROWS) await this.view?.slideUp(this.boardRows());
    else this.view?.setRow(row + 1, this.currentRow());
    this.busy = false;
  }

  private async hint(): Promise<void> {
    // One star at a time, so a double tap doesn't use two hints.
    if (this.hiddenHint) return;
    const result = this.game.hint();
    if (!result) return;
    this.save();
    this.resetIdle();
    // A hint that finishes the word: nothing more to do until "Well done!".
    if (result.solved) this.busy = true;
    const guesses = this.game.guesses.length;
    const row = this.currentRowIndex();
    this.hiddenHint = { guesses, position: result.position };
    this.view?.setRow(row, this.currentRow());
    await this.view?.flyStar(row, result.position);
    this.hiddenHint = null;
    this.refreshKeys();
    // She checked a guess while the star flew: that row already shows the letter.
    if (this.game.guesses.length !== guesses) return;
    this.view?.setRow(row, this.currentRow());
    this.view?.landSquare(row, result.position);
    if (result.solved) void this.finish();
  }

  private toggleAllLetters(): void {
    this.allLetters = !this.allLetters;
    this.view?.setAllLetters(this.allLetters);
    this.refreshKeys();
  }

  /** Recolors the keys and tells the touch tracker which keys can be tapped. */
  private refreshKeys(): void {
    this.view?.setKeys(this.game.keyStates(), this.allLetters);
    this.host.updateTargets(this.targets());
  }

  /** Called straight from her tap, so the iPad allows the share sheet. */
  private shareToday(): void {
    const text = this.saved.dailyDone?.share;
    if (text && this.options.share) void this.options.share(text);
  }

  private async finish(): Promise<void> {
    this.busy = true;
    window.clearTimeout(this.idleTimer);
    this.view?.setHintPulse(false);
    this.timer.activity(performance.now());
    const day = dayKey(this.now());
    const { answer, guesses, solvedByGuess } = this.game;
    const daily = this.saved.daily?.date === day ? this.saved.daily : null;
    const share = daily ? shareText(daily.number, answer, guesses, !solvedByGuess) : '';
    this.saved = { ...this.saved, stats: recordGuessSolve(this.saved.stats, day) };
    const streakDays = this.host.recordPlayDay();
    this.host.logPlay(
      guessRecord({
        answer,
        guesses,
        hinted: this.game.hinted,
        typed: solvedByGuess,
        daily: daily !== null,
        ms: this.timer.elapsedMs,
        now: this.now(),
      }),
    );
    // Save the next word as her place now, so closing the app mid-celebration loses nothing.
    this.saved = finishWord(this.saved, this.words, day, share, this.today(), this.avoided);
    this.loadWord();
    this.timer.pause();
    this.save();
    const card: CelebrationCard = {
      word: answer,
      lines: guessLines({
        tries: guesses.length,
        typed: solvedByGuess,
        daily: daily !== null,
        streakDays,
        todaySolved: this.saved.stats.todaySolved,
        wordNumber: this.saved.stats.totalSolved,
      }),
      nextLabel: 'Next word',
      timeoutMs: daily ? DAILY_CELEBRATION_MS : CELEBRATION_MS,
    };
    const shareSheet = this.options.share;
    if (daily && shareSheet) card.share = () => shareSheet(share);
    await this.host.celebrate(card);
    this.timer.resume(performance.now());
    this.busy = false;
    this.host.redraw(true);
    this.resetIdle();
  }

  private resetIdle(): void {
    window.clearTimeout(this.idleTimer);
    this.view?.setHintPulse(false);
    this.idleTimer = window.setTimeout(() => this.view?.setHintPulse(true), IDLE_HINT_MS);
  }
}
