# Word Circle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Word Circle, a calm, large-print, Word Cookies–style word game that a 92-year-old with low vision and dementia plays in landscape on her iPad, installed as a Home Screen web app hosted on GitHub Pages.

**Architecture:** A single-screen TypeScript web app with no UI framework. Pure, unit-tested modules hold the game rules (`src/game`), the touch and safe-zone rules (`src/input`) and the screen geometry (`src/ui/layout.ts`). A thin DOM view (`src/ui/view.ts`) and controller (`src/app.ts`) sit on top. Puzzles are generated offline from the SCOWL word lists by a Node script and bundled into the app. A service worker makes it work offline and applies updates only between puzzles.

**Tech Stack:** TypeScript 5.6, Vite 5.4, Vitest 2.1, vite-plugin-pwa 0.21 (Workbox), tsx (runs the puzzle script), @fontsource/atkinson-hyperlegible, @vite-pwa/assets-generator (icons), GitHub Actions and GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-19-word-circle-design.md`

**Working directory:** `/Users/toddanderson/Dev/Moms Word Game`. The path has spaces, so always quote it in shell commands. All commands below run from this directory.

---

## File structure

| File | Responsibility |
|---|---|
| `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html` | Project setup, build, test and PWA configuration |
| `src/main.ts` | Entry point: loads font, styles and puzzles, starts `App` |
| `src/app.ts` | Controller: connects game rules, touch tracer, layout and view; idle hint timer; puzzle transitions |
| `src/pwa.ts` | Service worker registration; applies updates only before first touch or between puzzles |
| `src/styles.css` | All visual styling (colors, tiles, slots, bar, animations) |
| `src/shared/random.ts` | Seeded random numbers and shuffle (used by app and puzzle script) |
| `src/game/types.ts` | `Puzzle` and `Progress` types |
| `src/game/state.ts` | `Game`: checks words, tracks found words, picks hints |
| `src/game/storage.ts` | Save/load progress; choose the starting puzzle |
| `src/input/touch.ts` | `LetterTracer`: pointer events → letter added/removed, word submitted (safe zones, one finger) |
| `src/ui/layout.ts` | Pure geometry for every element, from screen size |
| `src/ui/ring.ts` | Circle letter order helpers (shuffle) |
| `src/ui/view.ts` | Draws and animates the screen |
| `src/data/puzzles.json` | Generated puzzles (committed) |
| `scripts/puzzle-lib.ts` | Pure puzzle generation and validation |
| `scripts/scowl.ts` | Reads SCOWL word lists and the never-use list |
| `scripts/sample-page.ts` | Renders the puzzle review page |
| `scripts/build-puzzles.ts` | CLI: builds, validates and writes puzzles plus the sample page |
| `words/blocklist.txt` | Never-use word list (owner-editable) |
| `words/scowl/` | Vendored SCOWL lists and license |
| `public/icon.svg` and generated PNGs | Home Screen icons |
| `tests/*.test.ts` | Vitest unit tests |
| `docs/setup-her-ipad.md`, `README.md` | Owner instructions |
| `.github/workflows/deploy.yml` | Build, test and deploy to GitHub Pages |
| `.claude/launch.json` | Dev server config for the Claude browser pane |

Every commit message in this plan ends with the trailer line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (passed as a second `-m`).

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "word-circle",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "puzzles": "tsx scripts/build-puzzles.ts",
    "icons": "pwa-assets-generator --preset minimal-2023 public/icon.svg"
  }
}
```

- [ ] **Step 2: Install dependencies (exact versions)**

Run:
```bash
npm install --save-exact @fontsource/atkinson-hyperlegible@5.1.0
npm install --save-exact -D vite@5.4.21 vitest@2.1.9 typescript@5.6.3 tsx@4.19.2 @types/node@20.17.6 vite-plugin-pwa@0.21.2 workbox-window@7.3.0 @vite-pwa/assets-generator@0.2.6
```
Expected: both finish with `added N packages`, and `package-lock.json` exists.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "strict": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "tests", "scripts", "vite.config.ts"]
}
```

- [ ] **Step 4: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/word-circle/',
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
    />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Word Circle" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="theme-color" content="#fbf5e6" />
    <title>Word Circle</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: Create placeholder `src/main.ts`**

```ts
document.getElementById('app')!.textContent = 'Word Circle';
```

- [ ] **Step 7: Verify type-check and build**

Run: `npm run build`
Expected: no TypeScript errors; Vite prints `✓ built in …` and `dist/index.html` exists.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src/main.ts
git commit -m "chore: scaffold Vite + TypeScript project" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Seeded random and shuffle

**Files:**
- Create: `src/shared/random.ts`
- Test: `tests/random.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/random.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { seededRandom, shuffle } from '../src/shared/random';

describe('seededRandom', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('produces numbers in [0, 1)', () => {
    const random = seededRandom(7);
    for (let i = 0; i < 1000; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('differs between seeds', () => {
    expect(seededRandom(1)()).not.toBe(seededRandom(2)());
  });
});

describe('shuffle', () => {
  it('returns a permutation without changing the input', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const output = shuffle(input, seededRandom(3));
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...output].sort()).toEqual(input);
  });

  it('is reproducible with the same seed', () => {
    expect(shuffle([1, 2, 3, 4, 5, 6], seededRandom(9))).toEqual(shuffle([1, 2, 3, 4, 5, 6], seededRandom(9)));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/random.test.ts`
Expected: FAIL with an error that `../src/shared/random` cannot be resolved.

- [ ] **Step 3: Write the implementation** — `src/shared/random.ts`

```ts
/** Deterministic pseudo-random numbers in [0, 1) (mulberry32). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Returns a shuffled copy (Fisher–Yates). */
export function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/random.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/random.ts tests/random.test.ts
git commit -m "feat: add seeded random and shuffle" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Game rules

**Files:**
- Create: `src/game/types.ts`, `src/game/state.ts`
- Test: `tests/game-state.test.ts`

- [ ] **Step 1: Create the shared types** — `src/game/types.ts`

```ts
export interface Puzzle {
  /** Sorted letters, e.g. "enost". Unique per puzzle. */
  id: string;
  /** Letters in their starting circle order, lowercase. */
  letters: string[];
  /** Answer words in slot order (length, then alphabetical). */
  words: string[];
  /** Other real words that earn "Good word!". */
  bonus: string[];
}

export interface Progress {
  puzzleIndex: number;
  puzzleId: string;
  found: string[];
  revealed: Record<string, number[]>;
}
```

- [ ] **Step 2: Write the failing test** — `tests/game-state.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/state';
import type { Puzzle } from '../src/game/types';

const PUZZLE: Puzzle = {
  id: 'enost',
  letters: ['n', 's', 'e', 'o', 't'],
  words: ['net', 'not', 'one', 'note', 'notes', 'stone'],
  bonus: ['eon', 'nest', 'onset', 'son', 'ten', 'toe', 'ton', 'tone', 'tones'],
};

describe('Game.tryWord', () => {
  it('accepts an answer word once', () => {
    const game = new Game(PUZZLE);
    expect(game.tryWord('one')).toEqual({ kind: 'answer', word: 'one' });
    expect(game.isFound('one')).toBe(true);
    expect(game.tryWord('one')).toEqual({ kind: 'alreadyFound', word: 'one' });
  });

  it('ignores letter case', () => {
    expect(new Game(PUZZLE).tryWord('NOTE')).toEqual({ kind: 'answer', word: 'note' });
  });

  it('recognises bonus words without marking anything found', () => {
    const game = new Game(PUZZLE);
    expect(game.tryWord('tone')).toEqual({ kind: 'bonus', word: 'tone' });
    expect(game.foundWords()).toEqual([]);
  });

  it('rejects non-words and short attempts', () => {
    const game = new Game(PUZZLE);
    expect(game.tryWord('tse').kind).toBe('notAWord');
    expect(game.tryWord('no').kind).toBe('tooShort');
  });
});

describe('Game.hint', () => {
  it('reveals the leftmost letter of the shortest unfound word', () => {
    const game = new Game(PUZZLE);
    expect(game.hint()).toEqual({ word: 'net', index: 0, completedWord: false });
    expect(game.hint()).toEqual({ word: 'net', index: 1, completedWord: false });
    expect(game.revealedIndices('net')).toEqual([0, 1]);
  });

  it('counts a word as found once every letter is revealed', () => {
    const game = new Game(PUZZLE);
    game.hint();
    game.hint();
    expect(game.hint()).toEqual({ word: 'net', index: 2, completedWord: true });
    expect(game.isFound('net')).toBe(true);
    expect(game.hint()).toEqual({ word: 'not', index: 0, completedWord: false });
  });

  it('skips words she already found', () => {
    const game = new Game(PUZZLE);
    game.tryWord('net');
    expect(game.hint()?.word).toBe('not');
  });

  it('returns null when the puzzle is complete', () => {
    const game = new Game(PUZZLE, PUZZLE.words);
    expect(game.isComplete()).toBe(true);
    expect(game.hint()).toBeNull();
  });
});

describe('Game progress', () => {
  it('reports completion only when every word is found', () => {
    const game = new Game(PUZZLE);
    for (const word of PUZZLE.words.slice(0, -1)) game.tryWord(word);
    expect(game.isComplete()).toBe(false);
    game.tryWord('stone');
    expect(game.isComplete()).toBe(true);
  });

  it('restores found words and revealed letters, dropping anything invalid', () => {
    const game = new Game(PUZZLE, ['one', 'zebra'], { note: [2, 0], zebra: [1], net: [7] });
    expect(game.foundWords()).toEqual(['one']);
    expect(game.revealedIndices('note')).toEqual([0, 2]);
    expect(game.revealedRecord()).toEqual({ note: [0, 2] });
  });

  it('lists found words in slot order', () => {
    const game = new Game(PUZZLE);
    game.tryWord('stone');
    game.tryWord('net');
    expect(game.foundWords()).toEqual(['net', 'stone']);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/game-state.test.ts`
Expected: FAIL with an error that `../src/game/state` cannot be resolved.

- [ ] **Step 4: Write the implementation** — `src/game/state.ts`

```ts
import type { Puzzle } from './types';

export const MIN_WORD_LENGTH = 3;

export type WordResultKind = 'answer' | 'alreadyFound' | 'bonus' | 'notAWord' | 'tooShort';

export interface WordResult {
  kind: WordResultKind;
  word: string;
}

export interface HintResult {
  word: string;
  index: number;
  completedWord: boolean;
}

export class Game {
  private readonly found = new Set<string>();
  private readonly revealed = new Map<string, Set<number>>();

  constructor(
    readonly puzzle: Puzzle,
    found: readonly string[] = [],
    revealed: Record<string, number[]> = {},
  ) {
    for (const word of found) {
      if (puzzle.words.includes(word)) this.found.add(word);
    }
    for (const [word, indices] of Object.entries(revealed)) {
      if (!puzzle.words.includes(word)) continue;
      const valid = indices.filter((i) => Number.isInteger(i) && i >= 0 && i < word.length);
      if (valid.length > 0) this.revealed.set(word, new Set(valid));
    }
  }

  tryWord(input: string): WordResult {
    const word = input.toLowerCase();
    if (word.length < MIN_WORD_LENGTH) return { kind: 'tooShort', word };
    if (this.puzzle.words.includes(word)) {
      if (this.found.has(word)) return { kind: 'alreadyFound', word };
      this.found.add(word);
      return { kind: 'answer', word };
    }
    if (this.puzzle.bonus.includes(word)) return { kind: 'bonus', word };
    return { kind: 'notAWord', word };
  }

  /** Reveals the leftmost hidden letter of the shortest unfound word. */
  hint(): HintResult | null {
    const remaining = this.puzzle.words.filter((w) => !this.found.has(w));
    if (remaining.length === 0) return null;
    const shortest = Math.min(...remaining.map((w) => w.length));
    const word = remaining.find((w) => w.length === shortest)!;
    const shown = this.revealed.get(word) ?? new Set<number>();
    let index = 0;
    while (shown.has(index)) index++;
    shown.add(index);
    this.revealed.set(word, shown);
    const completedWord = shown.size === word.length;
    if (completedWord) this.found.add(word);
    return { word, index, completedWord };
  }

  isFound(word: string): boolean {
    return this.found.has(word);
  }

  revealedIndices(word: string): number[] {
    return [...(this.revealed.get(word) ?? [])].sort((a, b) => a - b);
  }

  isComplete(): boolean {
    return this.puzzle.words.every((w) => this.found.has(w));
  }

  foundWords(): string[] {
    return this.puzzle.words.filter((w) => this.found.has(w));
  }

  revealedRecord(): Record<string, number[]> {
    const record: Record<string, number[]> = {};
    for (const word of this.revealed.keys()) record[word] = this.revealedIndices(word);
    return record;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/game-state.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 6: Commit**

```bash
git add src/game/types.ts src/game/state.ts tests/game-state.test.ts
git commit -m "feat: add game rules for words, hints and completion" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Saving progress

**Files:**
- Create: `src/game/storage.ts`
- Test: `tests/storage.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/storage.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import {
  STORAGE_KEY,
  loadProgress,
  nextIndex,
  resolveStart,
  saveProgress,
  type KeyValueStore,
} from '../src/game/storage';
import type { Progress, Puzzle } from '../src/game/types';

class MemoryStore implements KeyValueStore {
  data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

const puzzle = (id: string): Puzzle => ({ id, letters: [...id], words: [], bonus: [] });
const PUZZLES = [puzzle('abcde'), puzzle('fghij'), puzzle('klmno')];
const PROGRESS: Progress = { puzzleIndex: 1, puzzleId: 'fghij', found: ['hi'], revealed: { fig: [0] } };

describe('saving and loading progress', () => {
  it('round-trips progress', () => {
    const store = new MemoryStore();
    saveProgress(store, PROGRESS);
    expect(loadProgress(store)).toEqual(PROGRESS);
  });

  it('returns null when nothing is saved', () => {
    expect(loadProgress(new MemoryStore())).toBeNull();
  });

  it('returns null for corrupt or malformed data', () => {
    const store = new MemoryStore();
    store.setItem(STORAGE_KEY, '{not json');
    expect(loadProgress(store)).toBeNull();
    store.setItem(STORAGE_KEY, JSON.stringify({ puzzleIndex: -1, puzzleId: 'x', found: [], revealed: {} }));
    expect(loadProgress(store)).toBeNull();
    store.setItem(STORAGE_KEY, JSON.stringify({ puzzleIndex: 0, puzzleId: 'x', found: [3], revealed: {} }));
    expect(loadProgress(store)).toBeNull();
  });

  it('keeps playing when storage refuses to save', () => {
    const store: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(() => saveProgress(store, PROGRESS)).not.toThrow();
  });
});

describe('resolveStart', () => {
  it('starts at the first puzzle with nothing saved', () => {
    expect(resolveStart(PUZZLES, null)).toEqual({ index: 0, found: [], revealed: {} });
  });

  it('restores the saved puzzle when it still matches', () => {
    expect(resolveStart(PUZZLES, PROGRESS)).toEqual({ index: 1, found: ['hi'], revealed: { fig: [0] } });
  });

  it('starts the saved position fresh when the puzzles changed', () => {
    expect(resolveStart(PUZZLES, { ...PROGRESS, puzzleId: 'zzzzz' })).toEqual({ index: 1, found: [], revealed: {} });
  });

  it('wraps a saved position past the end of the list', () => {
    expect(resolveStart(PUZZLES, { ...PROGRESS, puzzleIndex: 4 })).toEqual({
      index: 1,
      found: ['hi'],
      revealed: { fig: [0] },
    });
  });
});

describe('nextIndex', () => {
  it('moves forward and wraps around', () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/storage.test.ts`
Expected: FAIL with an error that `../src/game/storage` cannot be resolved.

- [ ] **Step 3: Write the implementation** — `src/game/storage.ts`

```ts
import type { Progress, Puzzle } from './types';

export const STORAGE_KEY = 'word-circle:v1';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface StartPoint {
  index: number;
  found: string[];
  revealed: Record<string, number[]>;
}

function isProgress(value: unknown): value is Progress {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    Number.isInteger(p.puzzleIndex) &&
    (p.puzzleIndex as number) >= 0 &&
    typeof p.puzzleId === 'string' &&
    Array.isArray(p.found) &&
    p.found.every((w) => typeof w === 'string') &&
    typeof p.revealed === 'object' &&
    p.revealed !== null &&
    Object.values(p.revealed).every((v) => Array.isArray(v) && v.every((n) => Number.isInteger(n)))
  );
}

export function loadProgress(store: KeyValueStore): Progress | null {
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isProgress(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveProgress(store: KeyValueStore, progress: Progress): void {
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage full or unavailable: keep playing; progress just won't survive a restart.
  }
}

/** Where to start: the saved puzzle if it still matches, otherwise that position fresh. */
export function resolveStart(puzzles: readonly Puzzle[], saved: Progress | null): StartPoint {
  if (!saved) return { index: 0, found: [], revealed: {} };
  const index = saved.puzzleIndex % puzzles.length;
  if (puzzles[index].id !== saved.puzzleId) return { index, found: [], revealed: {} };
  return { index, found: saved.found, revealed: saved.revealed };
}

export function nextIndex(index: number, count: number): number {
  return (index + 1) % count;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/storage.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/storage.ts tests/storage.test.ts
git commit -m "feat: save and restore progress" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Circle order helpers

**Files:**
- Create: `src/ui/ring.ts`
- Test: `tests/ring.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/ring.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { seededRandom } from '../src/shared/random';
import { identityOrder, shuffleRing } from '../src/ui/ring';

describe('identityOrder', () => {
  it('lists ring slots in order', () => {
    expect(identityOrder(5)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('shuffleRing', () => {
  const letters = ['s', 't', 'o', 'n', 'e'];

  it('returns a permutation whose letters read differently', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const order = [0, 1, 2, 3, 4];
      const next = shuffleRing(order, letters, seededRandom(seed));
      expect([...next].sort()).toEqual(order);
      expect(next.map((i) => letters[i]).join('')).not.toBe('stone');
    }
  });

  it('gives up gracefully when every letter is the same', () => {
    const next = shuffleRing([0, 1, 2], ['a', 'a', 'a'], seededRandom(1));
    expect([...next].sort()).toEqual([0, 1, 2]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ring.test.ts`
Expected: FAIL with an error that `../src/ui/ring` cannot be resolved.

- [ ] **Step 3: Write the implementation** — `src/ui/ring.ts`

```ts
import { shuffle } from '../shared/random';

/** Ring slot i shows letter order[i]. */
export function identityOrder(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i);
}

/** A new circle order whose letters read differently from the current one. */
export function shuffleRing(order: readonly number[], letters: readonly string[], random: () => number): number[] {
  const spelled = (o: readonly number[]) => o.map((i) => letters[i]).join('');
  const current = spelled(order);
  let next = shuffle(order, random);
  for (let attempt = 0; attempt < 20 && spelled(next) === current; attempt++) {
    next = shuffle(order, random);
  }
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ring.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/ring.ts tests/ring.test.ts
git commit -m "feat: add circle shuffle helpers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Touch tracer and safe zones

Implements spec §2 rules 1–8. The tracer takes normalized events, so it is tested without a browser.

**Files:**
- Create: `src/input/touch.ts`
- Test: `tests/touch.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/touch.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { LetterTracer, type PointerInput, type TracerGeometry } from '../src/input/touch';

const GEOMETRY: TracerGeometry = {
  screenWidth: 1180,
  safeZoneWidth: 130,
  tiles: [
    { x: 600, y: 300, r: 50 },
    { x: 720, y: 300, r: 50 },
    { x: 840, y: 300, r: 50 },
    { x: 720, y: 450, r: 50 },
  ],
};

function setup() {
  const events: string[] = [];
  const tracer = new LetterTracer({
    letterAdded: (tile) => events.push(`add ${tile}`),
    letterRemoved: (tile) => events.push(`remove ${tile}`),
    wordSubmitted: (tiles) => events.push(`submit ${tiles.join(',')}`),
    selectionCleared: () => events.push('clear'),
  });
  tracer.setGeometry(GEOMETRY);
  const send = (type: PointerInput['type'], id: number, x: number, y: number) => tracer.handle({ type, id, x, y });
  const at = (i: number) => [GEOMETRY.tiles[i].x, GEOMETRY.tiles[i].y] as const;
  return { tracer, events, send, at };
}

describe('LetterTracer', () => {
  it('traces a word across three letters and submits it on lift', () => {
    const { events, send, at } = setup();
    send('down', 1, ...at(0));
    send('move', 1, ...at(1));
    send('move', 1, ...at(2));
    send('up', 1, ...at(2));
    expect(events).toEqual(['add 0', 'add 1', 'add 2', 'submit 0,1,2']);
  });

  it('ignores a touch that starts in the left safe zone, even when it slides onto letters', () => {
    const { events, send, at } = setup();
    send('down', 1, 60, 300);
    send('move', 1, ...at(0));
    send('move', 1, ...at(1));
    send('move', 1, ...at(2));
    send('up', 1, ...at(2));
    expect(events).toEqual([]);
  });

  it('ignores a touch that starts in the right safe zone', () => {
    const { events, send, at } = setup();
    send('down', 1, 1120, 300);
    send('move', 1, ...at(2));
    send('up', 1, ...at(2));
    expect(events).toEqual([]);
  });

  it('lets her finger play while her thumb rests in the safe zone', () => {
    const { events, send, at } = setup();
    send('down', 1, 60, 500);
    send('down', 2, ...at(0));
    send('move', 2, ...at(1));
    send('move', 1, 70, 510);
    send('move', 2, ...at(2));
    send('up', 2, ...at(2));
    send('up', 1, 70, 510);
    expect(events).toEqual(['add 0', 'add 1', 'add 2', 'submit 0,1,2']);
  });

  it('does nothing when a touch starts on the background', () => {
    const { events, send, at } = setup();
    send('down', 1, 400, 600);
    send('move', 1, ...at(0));
    send('move', 1, ...at(1));
    send('up', 1, ...at(1));
    expect(events).toEqual([]);
  });

  it('starts a word from just outside a letter edge', () => {
    const { events, send } = setup();
    send('down', 1, 655, 300);
    expect(events).toEqual(['add 0']);
  });

  it('only adds a letter while sliding when the finger is on its tile', () => {
    const { events, send, at } = setup();
    send('down', 1, ...at(0));
    send('move', 1, 665, 300);
    expect(events).toEqual(['add 0']);
  });

  it('ignores a second finger while a word is being traced', () => {
    const { events, send, at } = setup();
    send('down', 1, ...at(0));
    send('down', 2, ...at(1));
    send('move', 2, ...at(2));
    send('move', 1, ...at(1));
    send('move', 1, ...at(3));
    send('up', 2, ...at(2));
    send('up', 1, ...at(3));
    expect(events).toEqual(['add 0', 'add 1', 'add 3', 'submit 0,1,3']);
  });

  it('removes the last letter when sliding back onto the previous one', () => {
    const { tracer, events, send, at } = setup();
    send('down', 1, ...at(0));
    send('move', 1, ...at(1));
    send('move', 1, ...at(2));
    send('move', 1, ...at(1));
    expect(events).toEqual(['add 0', 'add 1', 'add 2', 'remove 2']);
    expect(tracer.selection).toEqual([0, 1]);
  });

  it('ignores sliding onto an earlier letter that is not the previous one', () => {
    const { tracer, events, send, at } = setup();
    send('down', 1, ...at(0));
    send('move', 1, ...at(1));
    send('move', 1, ...at(2));
    send('move', 1, ...at(0));
    expect(events).toEqual(['add 0', 'add 1', 'add 2']);
    expect(tracer.selection).toEqual([0, 1, 2]);
  });

  it('does not repeat a letter while the finger stays on it', () => {
    const { events, send, at } = setup();
    send('down', 1, ...at(0));
    send('move', 1, 605, 305);
    send('move', 1, 598, 296);
    expect(events).toEqual(['add 0']);
  });

  it('keeps the word when the finger wanders off the circle', () => {
    const { events, send, at } = setup();
    send('down', 1, ...at(0));
    send('move', 1, ...at(1));
    send('move', 1, ...at(2));
    send('move', 1, 1150, 700);
    send('up', 1, 1150, 700);
    expect(events).toEqual(['add 0', 'add 1', 'add 2', 'submit 0,1,2']);
  });

  it('clears silently when lifted after fewer than three letters', () => {
    const { events, send, at } = setup();
    send('down', 1, ...at(0));
    send('move', 1, ...at(1));
    send('up', 1, ...at(1));
    expect(events).toEqual(['add 0', 'add 1', 'clear']);
  });

  it('clears without submitting when the touch is cancelled', () => {
    const { events, send, at } = setup();
    send('down', 1, ...at(0));
    send('move', 1, ...at(1));
    send('move', 1, ...at(2));
    send('cancel', 1, ...at(2));
    expect(events).toEqual(['add 0', 'add 1', 'add 2', 'clear']);
  });

  it('ignores touches while disabled and drops a word in progress', () => {
    const { tracer, events, send, at } = setup();
    send('down', 1, ...at(0));
    send('move', 1, ...at(1));
    tracer.setEnabled(false);
    send('move', 1, ...at(2));
    send('up', 1, ...at(2));
    send('down', 2, ...at(0));
    expect(events).toEqual(['add 0', 'add 1']);
    tracer.setEnabled(true);
    send('down', 3, ...at(3));
    expect(events).toEqual(['add 0', 'add 1', 'add 3']);
  });

  it('reports whether a word is being traced', () => {
    const { tracer, send, at } = setup();
    expect(tracer.isTracing).toBe(false);
    send('down', 1, ...at(0));
    expect(tracer.isTracing).toBe(true);
    send('up', 1, ...at(0));
    expect(tracer.isTracing).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/touch.test.ts`
Expected: FAIL with an error that `../src/input/touch` cannot be resolved.

- [ ] **Step 3: Write the implementation** — `src/input/touch.ts`

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/touch.test.ts`
Expected: PASS (16 tests).

- [ ] **Step 5: Commit**

```bash
git add src/input/touch.ts tests/touch.test.ts
git commit -m "feat: add letter tracer with thumb safe zones" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Screen layout geometry

Implements spec §1 sizing as a pure function, tested on every current iPad landscape size.

**Files:**
- Create: `src/ui/layout.ts`
- Test: `tests/layout.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/layout.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { computeLayout, SAFE_ZONE_WIDTH, type Circle, type Layout, type Rect } from '../src/ui/layout';

const SCREENS: Array<[number, number]> = [
  [1024, 768],
  [1080, 810],
  [1133, 744],
  [1180, 820],
  [1194, 834],
  [1366, 1024],
  [1376, 1032],
];

const PUZZLE_SHAPES = [
  { letterCount: 5, wordLengths: [3, 3, 3, 4, 4, 5] },
  { letterCount: 6, wordLengths: [3, 4, 5, 6, 6, 6] },
  { letterCount: 5, wordLengths: [3, 4, 4, 5] },
];

const circleRect = (c: Circle): Rect => ({ x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 });

function inPlayArea(rect: Rect, layout: Layout): boolean {
  return (
    rect.x >= SAFE_ZONE_WIDTH &&
    rect.x + rect.w <= layout.width - SAFE_ZONE_WIDTH &&
    rect.y >= 0 &&
    rect.y + rect.h <= layout.height
  );
}

describe.each(SCREENS)('layout on a %i×%i screen', (width, height) => {
  describe.each(PUZZLE_SHAPES)('with $letterCount letters and words $wordLengths', (shape) => {
    const layout = computeLayout({ width, height, ...shape });

    it('keeps everything out of the safe zones and on screen', () => {
      const rects = [
        layout.bar,
        layout.shuffleButton,
        layout.hintButton,
        ...layout.rows,
        circleRect(layout.backing),
        ...layout.tiles.map(circleRect),
      ];
      for (const rect of rects) expect(inPlayArea(rect, layout), JSON.stringify(rect)).toBe(true);
    });

    it('makes letter tiles at least 110 px across', () => {
      for (const tile of layout.tiles) expect(tile.r * 2).toBeGreaterThanOrEqual(110);
    });

    it('keeps tiles inside the circle and far enough apart that start areas never overlap', () => {
      const { backing, tiles } = layout;
      for (const t of tiles) {
        expect(Math.hypot(t.x - backing.x, t.y - backing.y) + t.r).toBeLessThanOrEqual(backing.r + 0.001);
      }
      tiles.forEach((a, i) => {
        const b = tiles[(i + 1) % tiles.length];
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r * 2 * 1.15);
      });
    });

    it('sizes word slots between 48 and 72 px', () => {
      expect(layout.slotSize).toBeGreaterThanOrEqual(48);
      expect(layout.slotSize).toBeLessThanOrEqual(72);
    });

    it('stacks word rows above the buttons without overlapping', () => {
      layout.rows.forEach((row, i) => {
        if (i > 0) expect(row.y).toBeGreaterThanOrEqual(layout.rows[i - 1].y + layout.rows[i - 1].h);
      });
      const last = layout.rows[layout.rows.length - 1];
      expect(last.y + last.h).toBeLessThanOrEqual(layout.shuffleButton.y);
    });

    it('keeps the left column clear of the word bar and letter circle', () => {
      const rightColumnStart = Math.min(layout.bar.x, layout.backing.x - layout.backing.r);
      for (const rect of [...layout.rows, layout.shuffleButton, layout.hintButton]) {
        expect(rect.x + rect.w).toBeLessThanOrEqual(rightColumnStart);
      }
    });

    it('makes buttons at least 90 px tall', () => {
      expect(layout.shuffleButton.h).toBeGreaterThanOrEqual(90);
      expect(layout.hintButton.h).toBeGreaterThanOrEqual(90);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/layout.test.ts`
Expected: FAIL with an error that `../src/ui/layout` cannot be resolved.

- [ ] **Step 3: Write the implementation** — `src/ui/layout.ts`

```ts
/** Width of each thumb safe zone on the left and right edges (about an inch). */
export const SAFE_ZONE_WIDTH = 130;

const MARGIN = 16;
const COLUMN_GAP = 24;
const LEFT_SHARE = 0.45;
const BAR_HEIGHT = 96;
const BAR_MAX_WIDTH = 420;
const BAR_GAP = 16;
const MIN_TILE_DIAMETER = 110;
const BACKING_PADDING = 8;
const SLOT_GAP = 6;
const ROW_GAP = 12;
const MIN_SLOT = 48;
const MAX_SLOT = 72;
const BUTTON_HEIGHT = 96;
const BUTTON_GAP = 16;
const BUTTONS_TOP_GAP = 32;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Circle {
  x: number;
  y: number;
  r: number;
}

export interface LayoutInput {
  width: number;
  height: number;
  letterCount: number;
  wordLengths: number[];
}

export interface Layout {
  width: number;
  height: number;
  safeZoneWidth: number;
  /** Current-word bar above the circle. */
  bar: Rect;
  /** Pale circle behind the letters. */
  backing: Circle;
  /** Letter tile positions by ring slot. */
  tiles: Circle[];
  letterFontSize: number;
  slotSize: number;
  slotGap: number;
  /** One rect per answer word, in slot order. */
  rows: Rect[];
  shuffleButton: Rect;
  hintButton: Rect;
}

export function computeLayout({ width, height, letterCount, wordLengths }: LayoutInput): Layout {
  const playLeft = SAFE_ZONE_WIDTH + MARGIN;
  const playRight = width - SAFE_ZONE_WIDTH - MARGIN;
  const columnsWidth = playRight - playLeft - COLUMN_GAP;
  const leftWidth = columnsWidth * LEFT_SHARE;
  const rightWidth = columnsWidth - leftWidth;
  const rightLeft = playLeft + leftWidth + COLUMN_GAP;
  const rightCenter = rightLeft + rightWidth / 2;

  const barWidth = Math.min(rightWidth, BAR_MAX_WIDTH);
  const bar: Rect = { x: rightCenter - barWidth / 2, y: MARGIN, w: barWidth, h: BAR_HEIGHT };

  const circleTop = bar.y + bar.h + BAR_GAP;
  const circleSpace = height - MARGIN - circleTop;
  const diameter = Math.min(rightWidth, circleSpace);
  const backing: Circle = { x: rightCenter, y: circleTop + circleSpace / 2, r: diameter / 2 };

  const tileShare = letterCount <= 5 ? 0.3 : 0.27;
  const tileR = Math.max(diameter * tileShare, MIN_TILE_DIAMETER) / 2;
  const ringR = backing.r - tileR - BACKING_PADDING;
  const tiles: Circle[] = Array.from({ length: letterCount }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / letterCount;
    return { x: backing.x + ringR * Math.cos(angle), y: backing.y + ringR * Math.sin(angle), r: tileR };
  });

  const buttonsY = height - MARGIN - BUTTON_HEIGHT;
  const buttonWidth = (leftWidth - BUTTON_GAP) / 2;
  const shuffleButton: Rect = { x: playLeft, y: buttonsY, w: buttonWidth, h: BUTTON_HEIGHT };
  const hintButton: Rect = { x: playLeft + buttonWidth + BUTTON_GAP, y: buttonsY, w: buttonWidth, h: BUTTON_HEIGHT };

  const rowCount = wordLengths.length;
  const longest = Math.max(...wordLengths);
  const slotsSpace = buttonsY - BUTTONS_TOP_GAP - MARGIN;
  const byWidth = (leftWidth - (longest - 1) * SLOT_GAP) / longest;
  const byHeight = (slotsSpace - (rowCount - 1) * ROW_GAP) / rowCount;
  const slotSize = Math.min(MAX_SLOT, Math.max(MIN_SLOT, Math.floor(Math.min(byWidth, byHeight))));
  const blockHeight = rowCount * slotSize + (rowCount - 1) * ROW_GAP;
  const blockTop = MARGIN + (slotsSpace - blockHeight) / 2;
  const leftCenter = playLeft + leftWidth / 2;
  const rows: Rect[] = wordLengths.map((length, i) => {
    const w = length * slotSize + (length - 1) * SLOT_GAP;
    return { x: leftCenter - w / 2, y: blockTop + i * (slotSize + ROW_GAP), w, h: slotSize };
  });

  return {
    width,
    height,
    safeZoneWidth: SAFE_ZONE_WIDTH,
    bar,
    backing,
    tiles,
    letterFontSize: Math.round(tileR * 2 * 0.6),
    slotSize,
    slotGap: SLOT_GAP,
    rows,
    shuffleButton,
    hintButton,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/layout.test.ts`
Expected: PASS (147 tests: 7 screens × 3 shapes × 7 checks).

- [ ] **Step 5: Commit**

```bash
git add src/ui/layout.ts tests/layout.test.ts
git commit -m "feat: add screen layout geometry" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Puzzle generation library

Implements spec §4 generation rules as pure functions.

**Files:**
- Create: `scripts/puzzle-lib.ts`
- Test: `tests/puzzle-lib.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/puzzle-lib.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import type { Puzzle } from '../src/game/types';
import { seededRandom } from '../src/shared/random';
import {
  buildPuzzles,
  canForm,
  letterCounts,
  pickWords,
  scrambleLetters,
  spellsClockwise,
  validatePuzzle,
  type BuildOptions,
} from '../scripts/puzzle-lib';

const ANSWERS = new Map<string, number>([
  ['stone', 10], ['notes', 20], ['tones', 20], ['onset', 35],
  ['one', 10], ['ten', 10], ['toe', 10], ['net', 10], ['not', 10], ['note', 10], ['tone', 10],
  ['nest', 20], ['son', 20], ['ton', 20], ['eon', 35], ['snot', 35],
  ['plant', 10], ['plan', 10], ['ant', 10], ['pan', 10], ['tan', 10], ['lap', 10], ['pat', 10],
  ['planet', 10], ['plane', 10], ['plate', 10], ['lane', 10], ['late', 10], ['pale', 20],
  ['quiz', 10], ['jazz', 10], ['fizzy', 20],
]);
const ACCEPTED = new Set([...ANSWERS.keys(), 'pelt', 'leant', 'tenon']);
const BLOCKLIST = new Set(['snot']);

const options = (overrides: Partial<BuildOptions> = {}): BuildOptions => ({
  answers: ANSWERS,
  accepted: ACCEPTED,
  blocklist: BLOCKLIST,
  random: seededRandom(1),
  fiveLetterTarget: 10,
  sixLetterTarget: 10,
  ...overrides,
});

describe('letter helpers', () => {
  it('checks whether a word can be made from the letters', () => {
    const stone = letterCounts('stone');
    expect(canForm('note', stone)).toBe(true);
    expect(canForm('noon', stone)).toBe(false);
    expect(canForm('tess', stone)).toBe(false);
  });

  it('detects a word spelled clockwise from any starting letter', () => {
    expect(spellsClockwise(['n', 'e', 's', 't', 'o'], 'stone')).toBe(true);
    expect(spellsClockwise(['s', 'o', 't', 'n', 'e'], 'stone')).toBe(false);
  });

  it('scrambles letters without spelling any full-length answer clockwise', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const letters = scrambleLetters('stone', ['stone', 'notes'], seededRandom(seed));
      expect([...letters].sort()).toEqual([...'stone'].sort());
      expect(spellsClockwise(letters, 'stone')).toBe(false);
      expect(spellsClockwise(letters, 'notes')).toBe(false);
    }
  });
});

describe('pickWords', () => {
  it('keeps the base word, covers each length, then the most common words, up to 6', () => {
    const formable: Array<[string, number]> = [
      ['stone', 10], ['notes', 20], ['tones', 20], ['onset', 35], ['one', 10], ['ten', 10], ['toe', 10],
      ['net', 10], ['not', 10], ['note', 10], ['tone', 10], ['nest', 20], ['son', 20], ['ton', 20], ['eon', 35],
    ];
    expect(pickWords('stone', formable)).toEqual(['net', 'not', 'one', 'note', 'notes', 'stone']);
  });
});

describe('buildPuzzles', () => {
  const puzzles = buildPuzzles(options());

  it('makes one puzzle per letter set and skips sets with fewer than 4 words', () => {
    expect(puzzles.map((p) => p.id).sort()).toEqual(['aelnp', 'aelnpt', 'aelpt', 'alnpt', 'enost']);
  });

  it('produces puzzles that pass validation', () => {
    for (const puzzle of puzzles) expect(validatePuzzle(puzzle, BLOCKLIST)).toEqual([]);
  });

  it('never uses never-use words', () => {
    for (const puzzle of puzzles) expect([...puzzle.words, ...puzzle.bonus]).not.toContain('snot');
  });

  it('turns extra common words into bonus words', () => {
    const plant = puzzles.find((p) => p.id === 'alnpt')!;
    expect(plant.words).toEqual(['ant', 'lap', 'pan', 'pat', 'plan', 'plant']);
    expect(plant.bonus).toContain('tan');
  });

  it('gives credit for accepted words that are not answers', () => {
    const planet = puzzles.find((p) => p.id === 'aelnpt')!;
    expect(planet.bonus).toEqual(expect.arrayContaining(['leant', 'pelt']));
    expect(planet.bonus).not.toContain('tenon');
  });

  it('respects the per-length targets', () => {
    const limited = buildPuzzles(options({ fiveLetterTarget: 1, sixLetterTarget: 0 }));
    expect(limited).toHaveLength(1);
    expect(limited[0].letters).toHaveLength(5);
  });

  it('is reproducible for the same seed', () => {
    expect(buildPuzzles(options())).toEqual(buildPuzzles(options()));
  });
});

describe('validatePuzzle', () => {
  const GOOD: Puzzle = {
    id: 'enost',
    letters: ['n', 's', 'e', 'o', 't'],
    words: ['net', 'not', 'one', 'note', 'notes', 'stone'],
    bonus: ['eon', 'nest', 'onset', 'son', 'ten', 'toe', 'ton', 'tone', 'tones'],
  };
  const problemsFor = (puzzle: Puzzle) => validatePuzzle(puzzle, BLOCKLIST).join('\n');

  it('accepts a good puzzle', () => {
    expect(validatePuzzle(GOOD, BLOCKLIST)).toEqual([]);
  });

  it('flags each kind of problem', () => {
    expect(problemsFor({ ...GOOD, words: ['net', 'not', 'stone'] })).toContain('has 3 words');
    expect(problemsFor({ ...GOOD, bonus: [...GOOD.bonus, 'noon'] })).toContain('"noon" cannot be made');
    expect(problemsFor({ ...GOOD, bonus: [...GOOD.bonus, 'snot'] })).toContain('"snot" is on the never-use list');
    expect(problemsFor({ ...GOOD, letters: ['s', 't', 'o', 'n', 'e'] })).toContain('circle spells "stone"');
    expect(problemsFor({ ...GOOD, words: ['note', 'net', 'not', 'one', 'notes', 'stone'] })).toContain('slot order');
    expect(problemsFor({ ...GOOD, id: 'abcde' })).toContain('does not match');
    expect(problemsFor({ ...GOOD, words: ['net', 'not', 'one', 'note'] })).toContain('no word uses every letter');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/puzzle-lib.test.ts`
Expected: FAIL with an error that `../scripts/puzzle-lib` cannot be resolved.

- [ ] **Step 3: Write the implementation** — `scripts/puzzle-lib.ts`

```ts
import type { Puzzle } from '../src/game/types';
import { shuffle } from '../src/shared/random';

export const MIN_WORDS = 4;
export const MAX_WORDS = 6;
export const MIN_LENGTH = 3;
export const MAX_LENGTH = 6;

export type LetterCounts = Map<string, number>;

export function letterCounts(word: string): LetterCounts {
  const counts: LetterCounts = new Map();
  for (const ch of word) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  return counts;
}

export function canForm(word: string, available: LetterCounts): boolean {
  const used: LetterCounts = new Map();
  for (const ch of word) {
    const count = (used.get(ch) ?? 0) + 1;
    if (count > (available.get(ch) ?? 0)) return false;
    used.set(ch, count);
  }
  return true;
}

export function sortedLetters(word: string): string {
  return [...word].sort().join('');
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Slot order: shortest first, then alphabetical. */
export function sortForSlots(words: readonly string[]): string[] {
  return [...words].sort((a, b) => a.length - b.length || compare(a, b));
}

/** True if reading the circle clockwise from some letter spells the word. */
export function spellsClockwise(letters: readonly string[], word: string): boolean {
  for (let start = 0; start < letters.length; start++) {
    if ([...letters.slice(start), ...letters.slice(0, start)].join('') === word) return true;
  }
  return false;
}

export function scrambleLetters(base: string, avoid: readonly string[], random: () => number): string[] {
  for (let attempt = 0; attempt < 100; attempt++) {
    const letters = shuffle([...base], random);
    if (!avoid.some((word) => spellsClockwise(letters, word))) return letters;
  }
  throw new Error(`Could not scramble "${base}" without spelling ${avoid.join(', ')}`);
}

/** Base word plus up to 5 others: one of each length first, then the most common. */
export function pickWords(base: string, formable: ReadonlyArray<readonly [string, number]>): string[] {
  const others = formable
    .filter(([word]) => word !== base)
    .sort((a, b) => a[1] - b[1] || compare(a[0], b[0]))
    .map(([word]) => word);
  const chosen: string[] = [];
  const lengths = new Set<number>();
  for (const word of others) {
    if (chosen.length === MAX_WORDS - 1) break;
    if (!lengths.has(word.length)) {
      chosen.push(word);
      lengths.add(word.length);
    }
  }
  for (const word of others) {
    if (chosen.length === MAX_WORDS - 1) break;
    if (!chosen.includes(word)) chosen.push(word);
  }
  return sortForSlots([base, ...chosen]);
}

export interface BuildOptions {
  /** Common words (3–6 letters) mapped to their SCOWL size. */
  answers: ReadonlyMap<string, number>;
  /** Every word that earns credit (includes the answers). */
  accepted: ReadonlySet<string>;
  blocklist: ReadonlySet<string>;
  random: () => number;
  fiveLetterTarget: number;
  sixLetterTarget: number;
}

export function buildPuzzles(options: BuildOptions): Puzzle[] {
  const { blocklist, random } = options;
  const answers = [...options.answers].filter(([word]) => !blocklist.has(word));
  const accepted = [...options.accepted].filter((word) => !blocklist.has(word));
  const bases = answers
    .filter(([word]) => word.length === 5 || word.length === 6)
    .map(([word, size]) => ({ word, size, tiebreak: random() }))
    .sort((a, b) => a.size - b.size || a.tiebreak - b.tiebreak);

  const seen = new Set<string>();
  const byLength: Record<5 | 6, Puzzle[]> = { 5: [], 6: [] };
  const targets: Record<5 | 6, number> = { 5: options.fiveLetterTarget, 6: options.sixLetterTarget };
  for (const { word: base } of bases) {
    const length = base.length as 5 | 6;
    if (byLength[length].length >= targets[length]) continue;
    const id = sortedLetters(base);
    if (seen.has(id)) continue;
    seen.add(id);
    const counts = letterCounts(base);
    const formable = answers.filter(([word]) => canForm(word, counts));
    if (formable.length < MIN_WORDS) continue;
    const words = pickWords(base, formable);
    const chosen = new Set(words);
    const bonus = accepted.filter((word) => !chosen.has(word) && canForm(word, counts)).sort();
    const fullLength = words.filter((word) => word.length === base.length);
    byLength[length].push({ id, letters: scrambleLetters(base, fullLength, random), words, bonus });
  }
  return shuffle([...byLength[5], ...byLength[6]], random);
}

export function validatePuzzle(puzzle: Puzzle, blocklist: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  const letters = puzzle.letters.join('');
  const label = letters.toUpperCase();
  const counts = letterCounts(letters);
  const report = (message: string) => problems.push(`${label}: ${message}`);

  if (puzzle.words.length < MIN_WORDS || puzzle.words.length > MAX_WORDS) {
    report(`has ${puzzle.words.length} words (needs ${MIN_WORDS}–${MAX_WORDS})`);
  }
  if (puzzle.id !== sortedLetters(letters)) report(`id "${puzzle.id}" does not match its letters`);
  if (!puzzle.words.some((word) => word.length === puzzle.letters.length)) report('no word uses every letter');
  if (puzzle.words.join(',') !== sortForSlots(puzzle.words).join(',')) report('words are not in slot order');
  for (const word of [...puzzle.words, ...puzzle.bonus]) {
    if (!canForm(word, counts)) report(`"${word}" cannot be made from the letters`);
    if (word.length < MIN_LENGTH || word.length > MAX_LENGTH) report(`"${word}" is not 3–6 letters`);
    if (blocklist.has(word)) report(`"${word}" is on the never-use list`);
  }
  for (const word of puzzle.words) {
    if (word.length === puzzle.letters.length && spellsClockwise(puzzle.letters, word)) {
      report(`circle spells "${word}"`);
    }
  }
  return problems;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/puzzle-lib.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/puzzle-lib.ts tests/puzzle-lib.test.ts
git commit -m "feat: add puzzle generation and validation library" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Word lists and the puzzle script

**Files:**
- Create: `scripts/scowl.ts`, `scripts/sample-page.ts`, `scripts/build-puzzles.ts`, `words/blocklist.txt`, `words/scowl/` (vendored)
- Generated: `src/data/puzzles.json`, `docs/puzzle-sample.html`
- Test: `tests/scowl.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/scowl.test.ts`

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readBlocklist, readScowl } from '../scripts/scowl';

function tempDir(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'word-circle-'));
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text, 'latin1');
  return dir;
}

describe('readScowl', () => {
  it('keeps lowercase 3–6 letter words with the first size they appear at', () => {
    const dir = tempDir({
      'english-words.10': "cat\nDog\nit\nbanana\nbananas\ncan't\ncafé\n",
      'american-words.10': 'color\n',
      'english-words.20': 'cat\nrobin\n',
      'american-words.20': '',
    });
    expect([...readScowl(dir, 20)]).toEqual([
      ['cat', 10],
      ['banana', 10],
      ['color', 10],
      ['robin', 20],
    ]);
  });

  it('stops at the requested size', () => {
    const dir = tempDir({ 'english-words.10': 'cat\n', 'american-words.10': '' });
    expect([...readScowl(dir, 10).keys()]).toEqual(['cat']);
  });

  it('fails loudly when a list file is missing', () => {
    const dir = tempDir({ 'english-words.10': 'cat\n' });
    expect(() => readScowl(dir, 10)).toThrow();
  });
});

describe('readBlocklist', () => {
  it('reads one word per line, skipping blanks and comments', () => {
    const dir = tempDir({ 'blocklist.txt': '# comment\nDead\n\n  grave  \n' });
    expect([...readBlocklist(path.join(dir, 'blocklist.txt'))]).toEqual(['dead', 'grave']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/scowl.test.ts`
Expected: FAIL with an error that `../scripts/scowl` cannot be resolved.

- [ ] **Step 3: Write the implementation** — `scripts/scowl.ts`

```ts
import fs from 'node:fs';
import path from 'node:path';

export const SCOWL_LEVELS = [10, 20, 35, 40, 50, 55, 60] as const;
const CATEGORIES = ['english-words', 'american-words'];
const WORD_PATTERN = /^[a-z]{3,6}$/;

/** Words of 3–6 lowercase letters up to the given SCOWL size, mapped to the size they first appear at. */
export function readScowl(dir: string, maxSize: number): Map<string, number> {
  const words = new Map<string, number>();
  for (const level of SCOWL_LEVELS) {
    if (level > maxSize) break;
    for (const category of CATEGORIES) {
      const text = fs.readFileSync(path.join(dir, `${category}.${level}`), 'latin1');
      for (const line of text.split(/\r?\n/)) {
        const word = line.trim();
        if (WORD_PATTERN.test(word) && !words.has(word)) words.set(word, level);
      }
    }
  }
  return words;
}

export function readBlocklist(file: string): Set<string> {
  const words = new Set<string>();
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const word = line.trim().toLowerCase();
    if (word && !word.startsWith('#')) words.add(word);
  }
  return words;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/scowl.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Vendor the SCOWL lists**

Run:
```bash
TMP=$(mktemp -d)
curl -sSL -o "$TMP/scowl.tar.gz" https://downloads.sourceforge.net/project/wordlist/SCOWL/2020.12.07/scowl-2020.12.07.tar.gz
tar -xzf "$TMP/scowl.tar.gz" -C "$TMP" scowl-2020.12.07/final scowl-2020.12.07/Copyright
mkdir -p words/scowl/final
for level in 10 20 35 40 50 55 60; do
  for category in english-words american-words; do
    cp "$TMP/scowl-2020.12.07/final/$category.$level" words/scowl/final/
  done
done
cp "$TMP/scowl-2020.12.07/Copyright" words/scowl/Copyright
ls words/scowl/final | wc -l
```
Expected: `14`.

- [ ] **Step 6: Create the never-use list** — `words/blocklist.txt`

```text
# Words Word Circle must never use, one per line. Lines starting with # are ignored.
# After editing, run: npm run puzzles

# Crude, sexual or offensive
anal
anus
arse
ass
bitch
bloody
boob
boobs
butt
chink
cock
coon
crap
cunt
damn
dick
dildo
dyke
fag
fart
fuck
gook
hell
homo
horny
jap
kike
nazi
negro
nude
nudes
paki
penis
piss
poop
porn
prick
pube
puke
pussy
queer
rape
raped
retard
semen
sex
sexy
shit
slut
spaz
spic
spunk
tit
tits
turd
twat
vomit
wank
whore
wop

# Upsetting
bomb
bombs
burial
buried
bury
cancer
coffin
corpse
dead
death
die
died
dies
dying
grave
graves
gun
guns
hearse
kill
killed
kills
morgue
murder
orphan
shoot
slain
slay
stab
stabs
tomb
tombs
tumor
widow
widows
```

- [ ] **Step 7: Create the sample page renderer** — `scripts/sample-page.ts`

```ts
import type { Puzzle } from '../src/game/types';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escape = (text: string) => text.replace(/[&<>"]/g, (ch) => ESCAPES[ch]);

export function renderSamplePage(puzzles: readonly Puzzle[]): string {
  const rows = puzzles
    .map(
      (p, i) =>
        `<tr><td>${i + 1}</td><td class="letters">${escape(p.letters.join(' ').toUpperCase())}</td>` +
        `<td>${escape(p.words.join(', '))}</td><td class="bonus">${escape(p.bonus.join(', '))}</td></tr>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Word Circle puzzle sample</title>
<style>
body { font-family: system-ui, sans-serif; margin: 24px; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; vertical-align: top; }
.letters { font-weight: 700; letter-spacing: 0.1em; white-space: nowrap; }
.bonus { color: #555; }
</style>
</head>
<body>
<h1>Word Circle puzzle sample</h1>
<p>The first ${puzzles.length} puzzles in play order. To keep a word from ever appearing, add it to
<code>words/blocklist.txt</code> and run <code>npm run puzzles</code>.</p>
<table>
<thead><tr><th>#</th><th>Letters</th><th>Words to find</th><th>Also accepted ("Good word!")</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</body>
</html>
`;
}
```

- [ ] **Step 8: Create the CLI** — `scripts/build-puzzles.ts`

```ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seededRandom } from '../src/shared/random';
import { buildPuzzles, validatePuzzle } from './puzzle-lib';
import { renderSamplePage } from './sample-page';
import { readBlocklist, readScowl } from './scowl';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCOWL_DIR = path.join(ROOT, 'words/scowl/final');
const BLOCKLIST_FILE = path.join(ROOT, 'words/blocklist.txt');
const OUTPUT_FILE = path.join(ROOT, 'src/data/puzzles.json');
const SAMPLE_FILE = path.join(ROOT, 'docs/puzzle-sample.html');

const SEED = 20261019;
const ANSWER_MAX_SIZE = 35;
const ACCEPTED_MAX_SIZE = 60;
const FIVE_LETTER_TARGET = 1125;
const SIX_LETTER_TARGET = 375;
const MINIMUM_PUZZLES = 800;
const SAMPLE_SIZE = 60;

const blocklist = readBlocklist(BLOCKLIST_FILE);
const puzzles = buildPuzzles({
  answers: readScowl(SCOWL_DIR, ANSWER_MAX_SIZE),
  accepted: new Set(readScowl(SCOWL_DIR, ACCEPTED_MAX_SIZE).keys()),
  blocklist,
  random: seededRandom(SEED),
  fiveLetterTarget: FIVE_LETTER_TARGET,
  sixLetterTarget: SIX_LETTER_TARGET,
});

const problems = puzzles.flatMap((puzzle) => validatePuzzle(puzzle, blocklist));
if (new Set(puzzles.map((p) => p.id)).size !== puzzles.length) problems.push('Two puzzles share the same letters');
if (puzzles.length < MINIMUM_PUZZLES) {
  problems.push(`Only ${puzzles.length} puzzles could be made (need at least ${MINIMUM_PUZZLES})`);
}
if (problems.length > 0) {
  console.error(problems.slice(0, 50).join('\n'));
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, `[\n${puzzles.map((p) => JSON.stringify(p)).join(',\n')}\n]\n`);
fs.writeFileSync(SAMPLE_FILE, renderSamplePage(puzzles.slice(0, SAMPLE_SIZE)));

const five = puzzles.filter((p) => p.letters.length === 5).length;
console.log(`Wrote ${puzzles.length} puzzles (${five} five-letter, ${puzzles.length - five} six-letter) to src/data/puzzles.json`);
console.log('Sample page: docs/puzzle-sample.html');
```

- [ ] **Step 9: Generate the puzzles**

Run: `npm run puzzles`
Expected: `Wrote 1500 puzzles (1125 five-letter, 375 six-letter) to src/data/puzzles.json` and `Sample page: docs/puzzle-sample.html`. If it exits with problems, read them, fix the cause (not the check), and re-run.

- [ ] **Step 10: Spot-check the output**

Run: `head -c 600 src/data/puzzles.json && echo && wc -l src/data/puzzles.json`
Expected: lines like `{"id":"…","letters":[…],"words":[…],"bonus":[…]}` and about 1502 lines.

- [ ] **Step 11: Run all tests and type-check**

Run: `npm test && npx tsc`
Expected: all tests pass; no type errors.

- [ ] **Step 12: Commit**

```bash
git add scripts/scowl.ts scripts/sample-page.ts scripts/build-puzzles.ts tests/scowl.test.ts words src/data/puzzles.json docs/puzzle-sample.html
git commit -m "feat: generate 1,500 puzzles from SCOWL with a never-use list" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 13: Owner review checkpoint (non-blocking)**

Send `docs/puzzle-sample.html` to the owner (SendUserFile, display `render`) and ask them to list any words they want blocked. Continue with the next tasks; if they name words, add them to `words/blocklist.txt`, re-run Steps 9–12, and commit with `fix: block words requested by owner`. Deployment (Task 15) waits for the owner's OK on the sample.

---

### Task 10: Styles and view

The DOM layer. It has no unit tests; it's verified in the browser in Task 11.

**Files:**
- Create: `src/styles.css`, `src/ui/view.ts`

- [ ] **Step 1: Create `src/styles.css`**

```css
:root {
  --bg: #fbf5e6;
  --ink: #141414;
  --navy: #1b3a6b;
  --green: #2f6b2f;
  --slot-border: #6b6b6b;
  --backing: #efe6cf;
}

html,
body {
  margin: 0;
  height: 100%;
  overflow: hidden;
  background: var(--bg);
}

body {
  position: fixed;
  inset: 0;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
  overscroll-behavior: none;
  font-family: 'Atkinson Hyperlegible', system-ui, sans-serif;
  font-weight: 700;
  color: var(--ink);
}

#app,
.board {
  position: absolute;
  inset: 0;
}

.board {
  transition: opacity 500ms ease, transform 500ms ease;
}

.board.entering {
  opacity: 0;
  transform: translateX(80px);
}

.slot {
  position: absolute;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: #fff;
  border: 3px solid var(--slot-border);
  color: var(--navy);
}

.slot.found {
  background: var(--green);
  border-color: var(--green);
  color: #fff;
}

.slot.pulse {
  animation: pulse 400ms ease-in-out 2;
}

@keyframes pulse {
  50% {
    transform: scale(1.15);
  }
}

.button {
  position: absolute;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0;
  border-radius: 18px;
  background: #fff;
  border: 3px solid var(--ink);
  color: var(--ink);
  font: inherit;
  font-size: 30px;
  -webkit-appearance: none;
  appearance: none;
}

.button svg {
  width: 40px;
  height: 40px;
}

.button.pulse {
  animation: hint-pulse 4s ease-in-out infinite;
}

@keyframes hint-pulse {
  0%,
  20%,
  100% {
    transform: scale(1);
  }
  10% {
    transform: scale(1.12);
  }
}

.backing {
  position: absolute;
  border-radius: 50%;
  background: var(--backing);
}

.lines {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
}

.lines polyline {
  fill: none;
  stroke: var(--navy);
  stroke-width: 14;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.tile {
  position: absolute;
  left: 0;
  top: 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #fff;
  border: 4px solid var(--ink);
  transition: transform 500ms ease-in-out;
}

.tile.selected {
  background: var(--navy);
  border-color: var(--navy);
  color: #fff;
}

.bar {
  position: absolute;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 0.08em;
  white-space: nowrap;
  border-radius: 999px;
  background: var(--navy);
  color: #fff;
  opacity: 0;
  transition: opacity 300ms ease;
  pointer-events: none;
}

.bar.visible {
  opacity: 1;
}

.bar.wiggle {
  animation: wiggle 400ms ease-in-out;
}

@keyframes wiggle {
  20% {
    transform: translateX(-14px);
  }
  40% {
    transform: translateX(14px);
  }
  60% {
    transform: translateX(-8px);
  }
  80% {
    transform: translateX(8px);
  }
}

.flyer {
  position: absolute;
  left: 0;
  top: 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--navy);
  color: #fff;
  pointer-events: none;
  transition:
    transform 600ms ease-in-out,
    width 600ms ease-in-out,
    height 600ms ease-in-out,
    font-size 600ms ease-in-out,
    background-color 600ms ease-in-out;
}

.flyer.landing {
  background: var(--green);
}

.message {
  position: absolute;
  transform: translate(-50%, -50%);
  padding: 12px 44px;
  white-space: nowrap;
  border-radius: 28px;
  background: var(--bg);
  border: 4px solid var(--navy);
  color: var(--navy);
  opacity: 0;
  transition: opacity 300ms ease;
  pointer-events: none;
}

.message.visible {
  opacity: 1;
}

.rotate {
  position: absolute;
  inset: 0;
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
  padding: 48px;
  background: var(--bg);
  font-size: 52px;
  text-align: center;
}

.rotate.visible {
  display: flex;
}
```

- [ ] **Step 2: Create `src/ui/view.ts`**

```ts
import type { Puzzle } from '../game/types';
import type { Layout, Rect } from './layout';

export interface RowState {
  found: boolean;
  revealed: number[];
}

export interface ViewHandlers {
  onShuffle(): void;
  onHint(): void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const FLY_MS = 600;
const BAR_MESSAGE_MS = 1200;
const WIGGLE_MS = 400;
const BAR_LETTER_SCALE = 0.62;
const BAR_TEXT_SCALE = 0.42;
const SLOT_LETTER_SCALE = 0.62;

const ICON_ATTRS =
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const SHUFFLE_ICON = `<svg ${ICON_ATTRS}><path d="M18 4l3 3l-3 3"/><path d="M18 20l3 -3l-3 -3"/><path d="M3 7h3a5 5 0 0 1 5 5a5 5 0 0 0 5 5h5"/><path d="M21 7h-5a4.978 4.978 0 0 0 -3 1m-4 8a4.984 4.984 0 0 1 -3 1h-3"/></svg>`;
const HINT_ICON = `<svg ${ICON_ATTRS}><path d="M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7"/><path d="M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3"/><path d="M9.7 17l4.6 0"/></svg>`;
const SIDEWAYS_IPAD = `<svg width="240" height="170" viewBox="0 0 240 170" aria-hidden="true"><rect x="10" y="10" width="220" height="150" rx="18" fill="#fff" stroke="#141414" stroke-width="8"/><circle cx="208" cy="85" r="6" fill="#141414"/></svg>`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent: HTMLElement): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  parent.appendChild(node);
  return node;
}

function place(node: HTMLElement, rect: Rect): void {
  node.style.left = `${rect.x}px`;
  node.style.top = `${rect.y}px`;
  node.style.width = `${rect.w}px`;
  node.style.height = `${rect.h}px`;
}

function restartAnimation(node: HTMLElement, className: string): void {
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
}

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/** Draws the game screen and plays its animations. Knows nothing about rules. */
export class View {
  private board: HTMLElement | null = null;
  private puzzle!: Puzzle;
  private layout!: Layout;
  private ringOrder: number[] = [];
  private tiles: HTMLElement[] = [];
  private rows: HTMLElement[][] = [];
  private bar!: HTMLElement;
  private line!: SVGPolylineElement;
  private hintButton!: HTMLButtonElement;
  private message!: HTMLElement;
  private messageToken = 0;
  private barTimer = 0;
  private readonly rotate: HTMLElement;

  constructor(
    private readonly root: HTMLElement,
    private readonly handlers: ViewHandlers,
  ) {
    this.rotate = el('div', 'rotate', root);
    this.rotate.innerHTML = `${SIDEWAYS_IPAD}<div>Please turn the iPad sideways</div>`;
  }

  /** Builds the whole screen. ringOrder[slot] is the letter index shown in that ring slot. */
  render(puzzle: Puzzle, layout: Layout, ringOrder: readonly number[], rows: readonly RowState[], animateIn: boolean): void {
    this.puzzle = puzzle;
    this.layout = layout;
    this.ringOrder = [...ringOrder];
    window.clearTimeout(this.barTimer);
    this.messageToken++;
    this.board?.remove();
    const board = document.createElement('div');
    board.className = 'board';
    this.root.insertBefore(board, this.rotate);
    this.board = board;

    this.rows = puzzle.words.map((word, i) => this.buildRow(board, word, layout.rows[i]));
    rows.forEach((state, i) => this.setRow(i, state));
    this.buildButton(board, 'Shuffle', SHUFFLE_ICON, layout.shuffleButton, () => this.handlers.onShuffle());
    this.hintButton = this.buildButton(board, 'Hint', HINT_ICON, layout.hintButton, () => this.handlers.onHint());

    const { backing } = layout;
    place(el('div', 'backing', board), {
      x: backing.x - backing.r,
      y: backing.y - backing.r,
      w: backing.r * 2,
      h: backing.r * 2,
    });
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'lines');
    svg.setAttribute('width', String(layout.width));
    svg.setAttribute('height', String(layout.height));
    this.line = document.createElementNS(SVG_NS, 'polyline');
    svg.appendChild(this.line);
    board.appendChild(svg);

    const diameter = layout.tiles[0].r * 2;
    this.tiles = puzzle.letters.map((letter) => {
      const tile = el('div', 'tile', board);
      tile.style.width = `${diameter}px`;
      tile.style.height = `${diameter}px`;
      tile.style.fontSize = `${layout.letterFontSize}px`;
      tile.textContent = letter.toUpperCase();
      return tile;
    });
    this.positionTiles(false);

    this.bar = el('div', 'bar', board);
    place(this.bar, layout.bar);
    this.message = el('div', 'message', board);

    if (animateIn) {
      board.classList.add('entering');
      void board.offsetWidth;
      board.classList.remove('entering');
    }
  }

  setRingOrder(ringOrder: readonly number[]): void {
    this.ringOrder = [...ringOrder];
    this.positionTiles(true);
  }

  /** Highlights the selected ring slots, draws the line and shows the letters in the bar. */
  showSelection(slots: readonly number[]): void {
    window.clearTimeout(this.barTimer);
    const chosen = new Set(slots.map((slot) => this.ringOrder[slot]));
    this.tiles.forEach((tile, letter) => tile.classList.toggle('selected', chosen.has(letter)));
    this.line.setAttribute('points', slots.map((s) => `${this.layout.tiles[s].x},${this.layout.tiles[s].y}`).join(' '));
    if (slots.length === 0) {
      this.hideBar();
      return;
    }
    this.bar.classList.remove('wiggle');
    this.bar.style.fontSize = `${Math.round(this.layout.bar.h * BAR_LETTER_SCALE)}px`;
    this.bar.replaceChildren(
      ...slots.map((slot) => {
        const span = document.createElement('span');
        span.textContent = this.puzzle.letters[this.ringOrder[slot]].toUpperCase();
        return span;
      }),
    );
    this.bar.classList.add('visible');
  }

  /** Un-highlights tiles and removes the line, keeping the bar's letters. */
  releaseTiles(): void {
    this.tiles.forEach((tile) => tile.classList.remove('selected'));
    this.line.setAttribute('points', '');
  }

  hideBar(): void {
    window.clearTimeout(this.barTimer);
    this.bar.classList.remove('visible');
  }

  barMessage(text: string): void {
    window.clearTimeout(this.barTimer);
    this.bar.style.fontSize = `${Math.round(this.layout.bar.h * BAR_TEXT_SCALE)}px`;
    this.bar.textContent = text;
    this.bar.classList.add('visible');
    this.barTimer = window.setTimeout(() => this.hideBar(), BAR_MESSAGE_MS);
  }

  wiggleBar(): void {
    window.clearTimeout(this.barTimer);
    restartAnimation(this.bar, 'wiggle');
    this.barTimer = window.setTimeout(() => this.hideBar(), WIGGLE_MS);
  }

  /** Glides the bar's letters into the given word row. */
  async flyToRow(row: number): Promise<void> {
    const board = this.board;
    if (!board) return;
    const spans = [...this.bar.querySelectorAll('span')];
    const targets = this.rows[row];
    const fontSize = getComputedStyle(this.bar).fontSize;
    const flyers = spans.slice(0, targets.length).map((span, i) => {
      const from = span.getBoundingClientRect();
      const to = targets[i].getBoundingClientRect();
      const size = Math.max(from.width, from.height);
      const flyer = el('div', 'flyer', board);
      flyer.textContent = span.textContent;
      flyer.style.fontSize = fontSize;
      flyer.style.width = `${size}px`;
      flyer.style.height = `${size}px`;
      flyer.style.transform = `translate(${from.left + from.width / 2 - size / 2}px, ${from.top + from.height / 2 - size / 2}px)`;
      return { flyer, to };
    });
    this.hideBar();
    void board.offsetWidth;
    for (const { flyer, to } of flyers) {
      flyer.classList.add('landing');
      flyer.style.width = `${to.width}px`;
      flyer.style.height = `${to.height}px`;
      flyer.style.fontSize = `${Math.round(to.height * SLOT_LETTER_SCALE)}px`;
      flyer.style.transform = `translate(${to.left}px, ${to.top}px)`;
    }
    await wait(FLY_MS);
    flyers.forEach(({ flyer }) => flyer.remove());
  }

  setRow(row: number, state: RowState): void {
    const word = this.puzzle.words[row];
    this.rows[row].forEach((slot, i) => {
      slot.textContent = state.found || state.revealed.includes(i) ? word[i].toUpperCase() : '';
      slot.classList.toggle('found', state.found);
    });
  }

  pulseRow(row: number): void {
    this.rows[row].forEach((slot) => restartAnimation(slot, 'pulse'));
  }

  /** Shows a large message over the circle or the whole screen, then fades it. */
  async showMessage(text: string, where: 'circle' | 'screen', ms: number): Promise<void> {
    const token = ++this.messageToken;
    const { layout, message } = this;
    const center = where === 'circle' ? layout.backing : { x: layout.width / 2, y: layout.height / 2 };
    message.textContent = text;
    message.style.left = `${center.x}px`;
    message.style.top = `${center.y}px`;
    message.style.fontSize = where === 'circle' ? '88px' : '120px';
    message.classList.add('visible');
    await wait(ms);
    if (token === this.messageToken) message.classList.remove('visible');
  }

  hideMessage(): void {
    this.messageToken++;
    this.message?.classList.remove('visible');
  }

  setHintPulse(on: boolean): void {
    this.hintButton?.classList.toggle('pulse', on);
  }

  showRotate(on: boolean): void {
    this.rotate.classList.toggle('visible', on);
  }

  private buildRow(board: HTMLElement, word: string, rect: Rect): HTMLElement[] {
    const { slotSize, slotGap } = this.layout;
    return [...word].map((_, i) => {
      const slot = el('div', 'slot', board);
      place(slot, { x: rect.x + i * (slotSize + slotGap), y: rect.y, w: slotSize, h: slotSize });
      slot.style.fontSize = `${Math.round(slotSize * SLOT_LETTER_SCALE)}px`;
      return slot;
    });
  }

  private buildButton(board: HTMLElement, label: string, icon: string, rect: Rect, onClick: () => void): HTMLButtonElement {
    const button = el('button', 'button', board);
    button.type = 'button';
    button.innerHTML = `${icon}<span>${label}</span>`;
    place(button, rect);
    button.addEventListener('click', onClick);
    return button;
  }

  private positionTiles(animate: boolean): void {
    this.ringOrder.forEach((letter, slot) => {
      const tile = this.tiles[letter];
      const { x, y, r } = this.layout.tiles[slot];
      if (!animate) tile.style.transition = 'none';
      tile.style.transform = `translate(${x - r}px, ${y - r}px)`;
      if (!animate) {
        void tile.offsetWidth;
        tile.style.transition = '';
      }
    });
  }
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/styles.css src/ui/view.ts
git commit -m "feat: add game screen view and styles" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: App controller and entry point

**Files:**
- Create: `src/app.ts`, `.claude/launch.json`
- Modify: `src/main.ts` (replace placeholder)

- [ ] **Step 1: Create `src/app.ts`**

```ts
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
```

- [ ] **Step 2: Replace `src/main.ts`**

```ts
import '@fontsource/atkinson-hyperlegible/700.css';
import './styles.css';
import { App } from './app';
import puzzleData from './data/puzzles.json';
import type { Puzzle } from './game/types';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');

const app = new App(root, puzzleData as Puzzle[], window.localStorage, { applyIfPending: () => false });
app.start();
```

- [ ] **Step 3: Type-check and build**

Run: `npm run build`
Expected: no TypeScript errors; `✓ built`.

- [ ] **Step 4: Create `.claude/launch.json`** (dev server for the Claude browser pane)

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "word-circle",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 5173
    }
  ]
}
```

- [ ] **Step 5: Verify in the browser pane**

1. Start the server with `preview_start` (name `word-circle`), navigate to `http://localhost:5173/word-circle/`, and set the viewport with `resize_window` width 1180, height 820.
2. Screenshot. Expected: cream screen, word slots on the left, Shuffle and Hint buttons below them, the letter circle on the right, nothing within 130 px of the left or right edge, and no console errors (`read_console_messages` with `onlyErrors`).
3. Find the first puzzle's answer: `node -p "JSON.stringify(require('./src/data/puzzles.json')[0])"`. Note its first word (call it WORD).
4. Trace WORD with synthetic pointer events (`javascript_tool`), replacing `WORD` with the uppercase word:

```js
const word = 'WORD';
const tiles = [...document.querySelectorAll('.tile')].map((t) => {
  const r = t.getBoundingClientRect();
  return { letter: t.textContent, x: r.left + r.width / 2, y: r.top + r.height / 2, used: false };
});
const path = [...word].map((ch) => { const t = tiles.find((t) => t.letter === ch && !t.used); t.used = true; return t; });
const fire = (type, p) => window.dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: p.x, clientY: p.y }));
fire('pointerdown', path[0]);
path.slice(1).forEach((p) => fire('pointermove', p));
fire('pointerup', path[path.length - 1]);
```

   Wait 1 second, then screenshot. Expected: the word's row is green with white letters and "Good!" is fading over the circle.
5. Run the same script with a non-word made from the first three tiles in ring order (read their letters from the screenshot). Expected: the bar wiggles and fades, and no row changes.
6. Safe-zone check: fire `pointerdown` at `clientX: 60` (any `clientY`), then `pointermove` to each tile center and `pointerup`. Expected: no tile turns navy and the bar stays hidden.
7. Click Hint (`left_click`). Expected: one navy letter appears in the shortest unfound row.
8. Click Shuffle. Expected: tiles glide to new positions.
9. Reload the page. Expected: found words and hinted letters are still shown.
10. `resize_window` width 820, height 1180. Expected: "Please turn the iPad sideways" screen. Then `resize_window` width 1024, height 768 and screenshot. Expected: everything fits with nothing clipped.
11. Reset the viewport with `resize_window` preset `desktop`.

If anything is wrong, use superpowers:systematic-debugging before changing code.

- [ ] **Step 6: Commit**

```bash
git add src/app.ts src/main.ts .claude/launch.json
git commit -m "feat: wire up the game controller" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Offline support, icons and safe updates

**Files:**
- Create: `public/icon.svg`, generated icons in `public/`, `src/pwa.ts`
- Modify: `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.ts`

- [ ] **Step 1: Create the icon** — `public/icon.svg`

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#fbf5e6"/>
  <circle cx="256" cy="256" r="200" fill="#efe6cf"/>
  <polyline points="256,126 380,216 332,361" fill="none" stroke="#1b3a6b" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="256" cy="126" r="58" fill="#1b3a6b"/>
  <circle cx="380" cy="216" r="58" fill="#1b3a6b"/>
  <circle cx="332" cy="361" r="58" fill="#1b3a6b"/>
  <circle cx="180" cy="361" r="58" fill="#ffffff" stroke="#141414" stroke-width="10"/>
  <circle cx="132" cy="216" r="58" fill="#ffffff" stroke="#141414" stroke-width="10"/>
</svg>
```

- [ ] **Step 2: Generate PNG icons**

Run: `npm run icons && ls public`
Expected: `apple-touch-icon-180x180.png`, `favicon.ico`, `icon.svg`, `maskable-icon-512x512.png`, `pwa-192x192.png`, `pwa-512x512.png`, `pwa-64x64.png`.

- [ ] **Step 3: Replace `vite.config.ts`**

```ts
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/word-circle/',
  plugins: [
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Word Circle',
        short_name: 'Word Circle',
        description: 'A calm, large-print word game',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#fbf5e6',
        theme_color: '#fbf5e6',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,ico,svg}'],
      },
    }),
  ],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Add the PWA client types to `tsconfig.json`**

Change the `types` line to:
```json
    "types": ["vite/client", "node", "vite-plugin-pwa/client"]
```

- [ ] **Step 5: Add icon links to `index.html`**

Insert these two lines directly after the `<meta name="theme-color" content="#fbf5e6" />` line:
```html
    <link rel="icon" href="/favicon.ico" />
    <link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />
```

- [ ] **Step 6: Create `src/pwa.ts`**

```ts
import { registerSW } from 'virtual:pwa-register';
import type { Updates } from './app';

const UPDATE_CHECK_MS = 60 * 60 * 1000;

/** Applies new versions only before she has touched anything, or between puzzles. */
export function setupUpdates(hasInteracted: () => boolean): Updates {
  let pending = false;
  const updateSW = registerSW({
    onNeedRefresh() {
      if (hasInteracted()) pending = true;
      else void updateSW(true);
    },
    onRegisteredSW(_url, registration) {
      if (registration) window.setInterval(() => void registration.update(), UPDATE_CHECK_MS);
    },
  });
  return {
    applyIfPending() {
      if (!pending) return false;
      void updateSW(true);
      return true;
    },
  };
}
```

- [ ] **Step 7: Use it in `src/main.ts`** (replace the file)

```ts
import '@fontsource/atkinson-hyperlegible/700.css';
import './styles.css';
import { App } from './app';
import puzzleData from './data/puzzles.json';
import type { Puzzle } from './game/types';
import { setupUpdates } from './pwa';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');

let app: App | undefined;
const updates = setupUpdates(() => app?.interacted ?? false);
app = new App(root, puzzleData as Puzzle[], window.localStorage, updates);
app.start();
```

- [ ] **Step 8: Build and check the output**

Run: `npm run build && ls dist && grep -c 'rel="manifest"' dist/index.html && grep -o 'woff2' dist/sw.js | head -1`
Expected: `dist` contains `sw.js`, `manifest.webmanifest`, `workbox-*.js` and the icons; the grep prints `1`; and `sw.js` mentions `woff2` (the font is precached).

- [ ] **Step 9: Run all tests**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add public src/pwa.ts src/main.ts vite.config.ts tsconfig.json index.html
git commit -m "feat: work offline, add Home Screen icons, update only between puzzles" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: iPad Simulator check

Verifies real touch behavior on iPadOS Safari, with the built app installed to the Home Screen.

**Files:** none (verification only; fix and commit any bugs found)

- [ ] **Step 1: Serve the production build**

Run in the background: `npm run build && npx vite preview --port 4173 --strictPort`
Expected: `Local: http://localhost:4173/word-circle/`.

- [ ] **Step 2: Boot the simulator and open the panel**

Run: `xcrun simctl boot "iPad Pro 13-inch (M4)" 2>/dev/null; open -a Simulator`
Then call the simulator `attach` action. Then `open_url` with `http://localhost:4173/word-circle/`.

- [ ] **Step 3: Rotate to landscape**

Run: `osascript -e 'tell application "Simulator" to activate' -e 'delay 0.5' -e 'tell application "System Events" to key code 123 using command down'`
If this fails because of accessibility permissions, ask the owner to press ⌘← in the Simulator window. Screenshot. Expected: the game in landscape.

- [ ] **Step 4: Install to the Home Screen**

Using screenshots to find each control: tap Safari's Share button (or the ••• menu first if Share isn't visible), tap **Add to Home Screen**, then **Add**. Go to the Home Screen (`button` action `HOME`) and tap the **Word Circle** icon. Expected: the game opens full-screen with no Safari toolbar.

- [ ] **Step 5: Touch checks** (screenshot after each; find tile centers from the screenshot)

1. `touch_path` through the tiles of a real answer word (from `src/data/puzzles.json[0].words`). Expected: the letters turn navy while dragging and the row turns green on release.
2. `touch_path` starting at x = 40 (inside the left safe zone) and sliding across three tiles. Expected: nothing is selected.
3. `touch2_path`: finger 1 held still at x = 40, y = 500 for the whole gesture while finger 2 traces another answer word. Expected: the word is accepted.
4. Trace three tiles, then slide back onto the second. Expected: the third tile un-highlights.
5. Trace a non-word. Expected: the bar wiggles; no penalty.
6. Tap Shuffle, then Hint. Expected: tiles glide; one letter appears in a row.
7. Tap Hint repeatedly until the puzzle completes. Expected: "Well done!" for about 3.5 s, then the next puzzle slides in.
8. Swipe the app away in the app switcher and reopen it from the Home Screen. Expected: the same puzzle, with progress kept.

- [ ] **Step 6: Clean up**

Stop the preview server. Leave the simulator running for the owner.

- [ ] **Step 7: Fix anything that failed**

For each failure, use superpowers:systematic-debugging, add a failing unit test where the logic is testable, fix it, re-run `npm test`, and commit with a `fix:` message. Re-run the failed check.

---

### Task 14: Owner documentation

**Files:**
- Create: `docs/setup-her-ipad.md`, `README.md`

- [ ] **Step 1: Create `docs/setup-her-ipad.md`**

```markdown
# Setting up Word Circle on her iPad

You'll need her iPad, Wi-Fi, and about 10 minutes. You only do this once.

## 1. Put Word Circle on the Home Screen

1. Open **Safari** and go to **https://skimmer747.github.io/word-circle/**
2. Wait until the puzzle appears, then wait 10 more seconds. It's saving itself so it works without Wi-Fi.
3. Tap the **Share** button (a square with an arrow pointing up). If you don't see it, tap the **•••** button first.
4. Tap **Add to Home Screen**, then tap **Add**.
5. Close Safari. From now on, always open **Word Circle** from its Home Screen icon.

## 2. Lock the screen sideways

1. Turn the iPad sideways, the way she holds it.
2. Swipe down from the top-right corner to open Control Center.
3. Tap **Rotation Lock** (a padlock inside a circular arrow) so it's highlighted.

## 3. Turn on Guided Access

Guided Access keeps the iPad inside Word Circle, so swipes from the edges can't take her to the Home Screen or notifications.

1. Open **Settings › Accessibility › Guided Access** and turn it **on**.
2. Tap **Passcode Settings › Set Guided Access Passcode** and choose a passcode only you know.
3. Tap **Display Auto-Lock** and choose **15 Minutes**. The iPad still sleeps if she puts it down, but not in the middle of a puzzle.
4. Open **Word Circle** from the Home Screen.
5. Quickly press the **top button** three times. Tap **Options**, make sure **Touch** is on, tap **Done**, then tap **Start**.

To leave Guided Access later, press the top button three times, enter your passcode, and tap **End**.
On an iPad with a round Home button, triple-click the Home button instead.

## Updates

New versions arrive by themselves whenever the iPad has Wi-Fi. They're applied right after she finishes a puzzle, never in the middle of one.

## If something looks wrong

1. Press the top button three times, enter your passcode, and tap **End**.
2. Swipe up from the bottom and pause to see open apps, then swipe Word Circle away.
3. Open Word Circle from the Home Screen again. Her progress is kept.
4. Start Guided Access again (section 3, step 5).
```

- [ ] **Step 2: Create `README.md`**

````markdown
# Word Circle

A calm, large-print word game for Mom's iPad, in the style of Word Cookies.

- Design: `docs/superpowers/specs/2026-10-19-word-circle-design.md`
- Setting up her iPad: `docs/setup-her-ipad.md`
- Live app: https://skimmer747.github.io/word-circle/

## Commands

```bash
npm install
```

```bash
npm run dev
```
Opens at http://localhost:5173/word-circle/

```bash
npm test
```

```bash
npm run build
```

## Changing the words

1. Add any word she shouldn't see to `words/blocklist.txt` (one per line).
2. Run `npm run puzzles`. This rebuilds `src/data/puzzles.json` and `docs/puzzle-sample.html`.
3. Look over `docs/puzzle-sample.html`, then commit and push. GitHub Pages republishes automatically, and her iPad picks up the change after her next finished puzzle.

Regenerating puzzles can change their order, so she may start a fresh puzzle at her current position.

## Word list credit

Words come from SCOWL (Spell Checker Oriented Word Lists) by Kevin Atkinson; see `words/scowl/Copyright`.
````

- [ ] **Step 3: Commit**

```bash
git add docs/setup-her-ipad.md README.md
git commit -m "docs: add iPad setup guide and README" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Publish to GitHub Pages

Outward-facing: **ask the owner before Step 2** (it creates a public repository under `skimmer747`) and confirm they've approved the puzzle sample from Task 9.

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create `.github/workflows/deploy.yml` and commit**

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: build, test and deploy to GitHub Pages" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 2: Create the repository (after the owner's OK)**

Run: `gh repo create skimmer747/word-circle --public --source . --remote origin`
Expected: `✓ Created repository skimmer747/word-circle on GitHub` and `✓ Added remote`.

- [ ] **Step 3: Turn on Pages with GitHub Actions as the source**

Run: `gh api -X POST repos/skimmer747/word-circle/pages -f build_type=workflow`
Expected: JSON containing `"build_type": "workflow"`.

- [ ] **Step 4: Push and watch the deploy**

Run: `git push -u origin main`, then `gh run watch --exit-status $(gh run list --workflow deploy.yml --limit 1 --json databaseId -q '.[0].databaseId')`
Expected: the `build` and `deploy` jobs both succeed.

- [ ] **Step 5: Verify the live site**

Run: `curl -sI https://skimmer747.github.io/word-circle/ | head -1 && curl -s https://skimmer747.github.io/word-circle/manifest.webmanifest | head -c 200`
Expected: `HTTP/2 200` and manifest JSON with `"name":"Word Circle"`.

- [ ] **Step 6: Hand off to the owner**

Tell the owner the live URL and point them to `docs/setup-her-ipad.md`. The final check is theirs: try it on her iPad, held the way she holds it.
