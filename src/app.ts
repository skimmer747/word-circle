import { Game } from './game/state';
import { loadProgress, nextIndex, resolveStart, saveProgress, type KeyValueStore } from './game/storage';
import type { Puzzle } from './game/types';
import { LetterTracer, type PointerInput } from './input/touch';
import { computeLayout } from './ui/layout';
import { identityOrder, shuffleRing } from './ui/ring';
import { View, type RowState } from './ui/view';

const IDLE_HINT_MS = 120_000;
const GOOD_MS = 1200;
const WELL_DONE_MS = 3500;

export interface Updates {
  /** Applies a waiting update (reloading the page). Returns true if it did. */
  applyIfPending(): boolean;
}

export class App {
  /** True once she has touched the screen in this session. */
  interacted = false;
  private index = 0;
  private game!: Game;
  private ringOrder: number[] = [];
  private busy = false;
  private idleTimer = 0;
  private readonly view: View;
  private readonly tracer: LetterTracer;

  constructor(
    root: HTMLElement,
    private readonly puzzles: readonly Puzzle[],
    private readonly store: KeyValueStore,
    private readonly updates: Updates,
  ) {
    this.view = new View(root, { onShuffle: () => this.shuffle(), onHint: () => this.hint() });
    this.tracer = new LetterTracer({
      letterAdded: () => this.showSelection(),
      letterRemoved: () => this.showSelection(),
      selectionCleared: () => this.view.showSelection([]),
      wordSubmitted: (tiles) => void this.submit(tiles),
    });
  }

  start(): void {
    const start = resolveStart(this.puzzles, loadProgress(this.store));
    this.loadPuzzle(start.index, start.found, start.revealed);
    this.relayout(false);
    this.listen();
    this.resetIdle();
  }

  private loadPuzzle(index: number, found: string[] = [], revealed: Record<string, number[]> = {}): void {
    this.index = index;
    this.game = new Game(this.puzzles[index], found, revealed);
    this.ringOrder = identityOrder(this.game.puzzle.letters.length);
    this.save();
  }

  private listen(): void {
    const forward = (type: PointerInput['type']) => (event: PointerEvent) => {
      if (type === 'down') this.interacted = true;
      this.tracer.handle({ type, id: event.pointerId, x: event.clientX, y: event.clientY });
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
    const { puzzle } = this.game;
    const layout = computeLayout({
      width,
      height,
      letterCount: puzzle.letters.length,
      wordLengths: puzzle.words.map((w) => w.length),
    });
    this.tracer.setGeometry({ screenWidth: width, safeZoneWidth: layout.safeZoneWidth, tiles: layout.tiles });
    this.view.render(puzzle, layout, this.ringOrder, this.rowStates(), animateIn);
    this.tracer.setEnabled(!this.busy);
  }

  private rowStates(): RowState[] {
    return this.game.puzzle.words.map((word) => this.rowState(word));
  }

  private rowState(word: string): RowState {
    return { found: this.game.isFound(word), revealed: this.game.revealedIndices(word) };
  }

  private showSelection(): void {
    this.view.hideMessage();
    this.view.showSelection(this.tracer.selection);
  }

  private async submit(tiles: readonly number[]): Promise<void> {
    const { puzzle } = this.game;
    const word = tiles.map((tile) => puzzle.letters[this.ringOrder[tile]]).join('');
    this.view.releaseTiles();
    const result = this.game.tryWord(word);
    const row = puzzle.words.indexOf(result.word);
    switch (result.kind) {
      case 'answer':
        this.save();
        this.resetIdle();
        await this.view.flyToRow(row);
        this.view.setRow(row, this.rowState(result.word));
        await this.afterWordFound();
        return;
      case 'alreadyFound':
        this.view.hideBar();
        this.view.pulseRow(row);
        return;
      case 'bonus':
        this.view.barMessage('Good word!');
        return;
      case 'notAWord':
        this.view.wiggleBar();
        return;
      case 'tooShort':
        this.view.hideBar();
        return;
    }
  }

  private async afterWordFound(): Promise<void> {
    if (this.game.isComplete()) await this.finishPuzzle();
    else void this.view.showMessage('Good!', 'circle', GOOD_MS);
  }

  private async finishPuzzle(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.tracer.setEnabled(false);
    this.view.showSelection([]);
    window.clearTimeout(this.idleTimer);
    this.view.setHintPulse(false);
    await this.view.showMessage('Well done!', 'screen', WELL_DONE_MS);
    this.loadPuzzle(nextIndex(this.index, this.puzzles.length));
    if (this.updates.applyIfPending()) return; // the reload opens the new puzzle
    this.busy = false;
    this.relayout(true);
    this.resetIdle();
  }

  private hint(): void {
    if (this.busy || this.tracer.isTracing) return;
    const result = this.game.hint();
    if (!result) return;
    this.save();
    this.resetIdle();
    const row = this.game.puzzle.words.indexOf(result.word);
    this.view.setRow(row, this.rowState(result.word));
    if (result.completedWord) void this.afterWordFound();
  }

  private shuffle(): void {
    if (this.busy || this.tracer.isTracing) return;
    this.ringOrder = shuffleRing(this.ringOrder, this.game.puzzle.letters, Math.random);
    this.view.setRingOrder(this.ringOrder);
  }

  private resetIdle(): void {
    window.clearTimeout(this.idleTimer);
    this.view.setHintPulse(false);
    this.idleTimer = window.setTimeout(() => this.view.setHintPulse(true), IDLE_HINT_MS);
  }

  private save(): void {
    saveProgress(this.store, {
      puzzleIndex: this.index,
      puzzleId: this.game.puzzle.id,
      found: this.game.foundWords(),
      revealed: this.game.revealedRecord(),
    });
  }
}
