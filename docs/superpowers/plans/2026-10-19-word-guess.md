# Word Guess and the Games Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Word Guess (a big-print Wordle with no losing, plus the real daily Wordle word and NYT-style sharing) and a Games button to switch between it and Word Circle.

**Architecture:** First move everything the games share (touch tracker wiring, clock, "Well done!" card, updates) out of `src/app.ts` into a small frame (`src/frame/`), and move Word Circle's own code into `src/circle/` unchanged. Then add Word Guess as a second self-contained game in `src/guess/` (pure rules, pure layout, a view and a controller) that plugs into the frame through a `GameScreen` interface. A scheduled GitHub Actions run fetches the daily Wordle word into `daily-word.txt` on the live site.

**Tech Stack:** TypeScript, Vite 5, Vitest 2, vite-plugin-pwa, DOM + CSS (no framework), Node 20 scripts run with tsx, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-19-word-guess-design.md`

**House rules for whoever runs this plan:**
- `npm test` and `npm run build` must pass at the end of every task.
- Test in the browser on `http://127.0.0.1:5173/word-circle/` (not `localhost`), so the owner's own saved progress isn't touched. iPad sizes: 1024×768, 1133×744, 1180×820, 1366×1024.
- Commit after every task with a message ending in `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commit only files you changed. Never push without asking the owner. Never force-push.
- Each **Stage** ends with a **Checkpoint**: stop and show the owner before going on.

---

## File map

```
src/
  main.ts                  wires the frame and both games (modified)
  pwa.ts                   imports Updates from frame/frame (modified)
  styles.css               frame, Word Circle and Word Guess styles (modified)
  app.ts                   DELETED (split into frame/frame.ts and circle/screen.ts)
  shared/store.ts          NEW  KeyValueStore interface
  shared/days.ts           NEW  dayKey, previousDay, isMilestone, recordPlayDay
  ui/dom.ts                NEW  el, place, restartAnimation, wait
  ui/icons.ts              NEW  every SVG icon
  ui/fit.ts                unchanged
  input/touch.ts           adds buttonPressed / buttonReleased callbacks
  clock/loader.ts          imports KeyValueStore from shared/store
  frame/
    layout.ts              NEW  safe zones, play area, top-right buttons, pop-up cards and buttons
    view.ts                NEW  top-right buttons, clock pop-up, Games pop-up, "Well done!" card, portrait message
    games.ts               NEW  GameScreen / FrameHost interfaces, game ids
    storage.ts             NEW  word-games:v1
    frame.ts               NEW  controller
  circle/                  MOVED from src/game/* and src/ui/{layout,view,ring}.ts
    state.ts stats.ts storage.ts timer.ts types.ts ring.ts   moved as-is
    layout.ts              takes the frame's layout; loses the frame's parts
    view.ts                draws only the Word Circle board
    celebration.ts         NEW  Word Circle's lines of good news
    screen.ts              NEW  Word Circle's controller (from app.ts)
  guess/
    words.ts               NEW  GuessWords type, acceptedChecker
    rules.ts               NEW  markGuess, GuessGame, firstVisibleGuess
    storage.ts             NEW  word-guess:v1
    daily.ts               NEW  daily-word.txt, swapInDaily, finishWord
    share.ts               NEW  the NYT-style share text
    celebration.ts         NEW  Word Guess's lines of good news
    layout.ts              NEW  board, keyboard, left buttons
    view.ts                NEW  draws and animates Word Guess
    screen.ts              NEW  Word Guess's controller
  data/guess-words.json    NEW  generated
scripts/
  scowl.ts                 adds readNeverUse
  build-puzzles.ts         also builds guess-words.json and the review list
  sample-page.ts           adds the Word Guess answers to the review page
  guess-lib.ts             NEW  buildGuessWords, validateGuessWords
  daily-lib.ts             NEW  parseNytReply, datesAround, formatDailyFile
  daily-word.ts            NEW  fetches the daily Wordle words into public/daily-word.txt
tests/
  screens.ts memory-store.ts                       NEW helpers (not test files)
  layout.test.ts           RENAMED to circle-layout.test.ts and rewritten
  frame-layout.test.ts circle-celebration.test.ts days.test.ts frame-storage.test.ts
  guess-words.test.ts guess-lib.test.ts guess-rules.test.ts guess-storage.test.ts guess-daily.test.ts
  guess-share.test.ts guess-celebration.test.ts guess-layout.test.ts daily-lib.test.ts   NEW
.github/workflows/deploy.yml   daily schedule + fetch step
.gitignore                     public/daily-word.txt
```

---

# Stage 1 — The frame (Word Circle unchanged)

Goal of the stage: the same app, reorganized. Nothing she sees changes, except that the clock button no longer slides with the board when she changes level.

### Task 1: Move Word Circle's files into `src/circle/`

**Files:**
- Move: `src/game/*` → `src/circle/`, `src/ui/layout.ts` → `src/circle/layout.ts`, `src/ui/view.ts` → `src/circle/view.ts`, `src/ui/ring.ts` → `src/circle/ring.ts`
- Create: `src/shared/store.ts`
- Modify: `src/circle/storage.ts`, `src/app.ts`, `src/main.ts`, `src/clock/loader.ts`, `src/circle/view.ts`, `scripts/*.ts`, `tests/*.ts`

- [ ] **Step 1: Move the files with git**

```bash
cd "/Users/toddanderson/Dev/Moms Word Game"
git mv src/game src/circle
git mv src/ui/layout.ts src/circle/layout.ts
git mv src/ui/view.ts src/circle/view.ts
git mv src/ui/ring.ts src/circle/ring.ts
```

- [ ] **Step 2: Create `src/shared/store.ts`**

```ts
/** The part of localStorage the app uses, so tests can pass an in-memory store. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
```

- [ ] **Step 3: Use it in `src/circle/storage.ts`**

Delete this block from `src/circle/storage.ts`:

```ts
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
```

and add these two lines after the existing imports at the top of the file:

```ts
import type { KeyValueStore } from '../shared/store';

export type { KeyValueStore };
```

- [ ] **Step 4: Fix every import path**

```bash
cd "/Users/toddanderson/Dev/Moms Word Game"
sed -i '' -e "s#'\./game/#'./circle/#g" -e "s#'\./ui/layout'#'./circle/layout'#g" -e "s#'\./ui/ring'#'./circle/ring'#g" -e "s#'\./ui/view'#'./circle/view'#g" src/app.ts src/main.ts
sed -i '' -e "s#'\.\./game/stats'#'./stats'#g" -e "s#'\.\./game/types'#'./types'#g" -e "s#'\./fit'#'../ui/fit'#g" src/circle/view.ts
sed -i '' -e "s#'\.\./game/storage'#'../shared/store'#g" src/clock/loader.ts
sed -i '' -e "s#'\.\./src/game/#'../src/circle/#g" -e "s#'\.\./src/ui/layout'#'../src/circle/layout'#g" -e "s#'\.\./src/ui/ring'#'../src/circle/ring'#g" tests/*.ts scripts/*.ts
grep -rn "game/\|ui/layout\|ui/ring\|ui/view" src scripts tests || echo "no old paths left"
```

Expected: `no old paths left`.

- [ ] **Step 5: Check types, tests and build**

```bash
npx tsc --noEmit && npm test && npm run build
```

Expected: no type errors; `Test Files  15 passed (15)`, `Tests  495 passed (495)`; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add -A src scripts tests
git commit -m "refactor: move Word Circle's code into src/circle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: Frame layout

**Files:**
- Create: `src/frame/layout.ts`, `tests/screens.ts`, `tests/frame-layout.test.ts`

- [ ] **Step 1: Create the shared test helpers `tests/screens.ts`**

```ts
import type { Rect } from '../src/frame/layout';

/** Every current iPad in landscape, in CSS px. */
export const SCREENS: Array<[number, number]> = [
  [1024, 768],
  [1080, 810],
  [1133, 744],
  [1180, 820],
  [1194, 834],
  [1366, 1024],
  [1376, 1032],
];

export interface Zones {
  width: number;
  height: number;
  safeZoneLeft: number;
  safeZoneRight: number;
}

/** Clear of both thumb safe zones and on screen. */
export function inPlayArea(rect: Rect, zones: Zones): boolean {
  return (
    rect.x >= zones.safeZoneLeft &&
    rect.x + rect.w <= zones.width - zones.safeZoneRight + 0.001 &&
    rect.y >= 0 &&
    rect.y + rect.h <= zones.height + 0.001
  );
}

/** True if the two rectangles share any area (touching edges is fine). */
export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w - 0.001 && b.x < a.x + a.w - 0.001 && a.y < b.y + b.h - 0.001 && b.y < a.y + a.h - 0.001;
}
```

- [ ] **Step 2: Write the failing test `tests/frame-layout.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { computeFrameLayout, SAFE_ZONE_LEFT_MIN, SAFE_ZONE_LEFT_TARGET, SAFE_ZONE_RIGHT } from '../src/frame/layout';
import { SCREENS, inPlayArea } from './screens';

describe.each(SCREENS)('frame layout on a %i×%i screen', (width, height) => {
  const frame = computeFrameLayout(width, height);

  it('gives her left thumb a wider safe zone where the screen has room', () => {
    expect(frame.safeZoneRight).toBe(SAFE_ZONE_RIGHT);
    expect(frame.safeZoneLeft).toBeGreaterThanOrEqual(SAFE_ZONE_LEFT_MIN);
    expect(frame.safeZoneLeft).toBeLessThanOrEqual(SAFE_ZONE_LEFT_TARGET);
    if (width >= 1133) expect(frame.safeZoneLeft).toBe(SAFE_ZONE_LEFT_TARGET);
  });

  it('makes the play area the space between the safe zones, inside a 16 px margin', () => {
    const { play } = frame;
    expect(play.x).toBe(frame.safeZoneLeft + 16);
    expect(play.x + play.w).toBe(width - frame.safeZoneRight - 16);
    expect(play.y).toBe(16);
    expect(play.y + play.h).toBe(height - 16);
  });

  it('puts the clock button at the top right of the play area, inside the corner', () => {
    const { clockButton, corner, play } = frame;
    expect(inPlayArea(clockButton, frame)).toBe(true);
    expect(clockButton.w).toBeGreaterThanOrEqual(64);
    expect(clockButton.h).toBeGreaterThanOrEqual(64);
    expect(clockButton.x + clockButton.w).toBeCloseTo(play.x + play.w, 5);
    expect(clockButton.y).toBe(16);
    expect(corner.x).toBeLessThanOrEqual(clockButton.x);
    expect(corner.x + corner.w).toBeGreaterThanOrEqual(clockButton.x + clockButton.w);
  });

  it('fills almost the whole screen with the pop-up card', () => {
    const { card } = frame;
    expect(card.x).toBeGreaterThanOrEqual(0);
    expect(card.y).toBeGreaterThanOrEqual(0);
    expect(card.x + card.w).toBeLessThanOrEqual(width);
    expect(card.y + card.h).toBeLessThanOrEqual(height);
    expect(card.w).toBeGreaterThanOrEqual(width - 40);
    expect(card.h).toBeGreaterThanOrEqual(height - 40);
  });

  it('puts a big Next button at the bottom of the card, clear of the safe zones', () => {
    const { card, nextButton } = frame;
    expect(inPlayArea(nextButton, frame)).toBe(true);
    expect(nextButton.h).toBeGreaterThanOrEqual(96);
    expect(nextButton.w).toBeGreaterThanOrEqual(400);
    expect(Math.abs(nextButton.x + nextButton.w / 2 - width / 2)).toBeLessThan(1);
    expect(nextButton.y + nextButton.h).toBeLessThanOrEqual(card.y + card.h);
  });

  it('gives the clock pop-up a big Close button clear of the safe zones', () => {
    const { card, closeButton } = frame;
    expect(inPlayArea(closeButton, frame)).toBe(true);
    expect(closeButton.h).toBeGreaterThanOrEqual(96);
    expect(closeButton.w).toBeGreaterThanOrEqual(340);
    expect(closeButton.y + closeButton.h).toBeLessThanOrEqual(card.y + card.h);
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run tests/frame-layout.test.ts`
Expected: FAIL, `Failed to resolve import "../src/frame/layout"`.

- [ ] **Step 4: Create `src/frame/layout.ts`**

```ts
/** Right-edge thumb safe zone (about an inch). */
export const SAFE_ZONE_RIGHT = 130;
/** Her left thumb rests on the screen, so the left safe zone grows to about 1.5 inches where there's room... */
export const SAFE_ZONE_LEFT_TARGET = 200;
/** ...and never shrinks below an inch. */
export const SAFE_ZONE_LEFT_MIN = 130;
/** Play-area width needed for a Hard Word Circle puzzle at the smallest allowed tile and slot sizes. */
const MIN_PLAY_WIDTH = 760;
/** Space between the play area and the safe zones and screen edges. */
export const MARGIN = 16;

const CORNER_SIZE = 72;
const NEXT_WIDTH = 420;
const NEXT_HEIGHT = 100;
const CARD_PADDING = 24;
const CLOSE_WIDTH = 360;
const CLOSE_HEIGHT = 100;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What every game shares: the safe zones, the play area, the top-right buttons and the pop-up cards. */
export interface FrameLayout {
  width: number;
  height: number;
  safeZoneLeft: number;
  safeZoneRight: number;
  /** The space between the safe zones, inside the margins. Games draw only in here. */
  play: Rect;
  clockButton: Rect;
  /** Everything in the top-right corner; games keep clear of it. */
  corner: Rect;
  /** The "Well done!" card and the pop-ups fill almost the whole screen so their text can be as big as possible. */
  card: Rect;
  /** A card's single button (Next puzzle). */
  nextButton: Rect;
  /** The clock pop-up's Close button. */
  closeButton: Rect;
}

export function computeFrameLayout(width: number, height: number): FrameLayout {
  const safeZoneLeft = Math.min(
    SAFE_ZONE_LEFT_TARGET,
    Math.max(SAFE_ZONE_LEFT_MIN, width - SAFE_ZONE_RIGHT - MIN_PLAY_WIDTH),
  );
  const play: Rect = {
    x: safeZoneLeft + MARGIN,
    y: MARGIN,
    w: width - safeZoneLeft - SAFE_ZONE_RIGHT - 2 * MARGIN,
    h: height - 2 * MARGIN,
  };
  const clockButton: Rect = { x: play.x + play.w - CORNER_SIZE, y: MARGIN, w: CORNER_SIZE, h: CORNER_SIZE };
  const card: Rect = { x: MARGIN, y: MARGIN, w: width - 2 * MARGIN, h: height - 2 * MARGIN };
  const nextButton: Rect = {
    x: width / 2 - NEXT_WIDTH / 2,
    y: card.y + card.h - CARD_PADDING - NEXT_HEIGHT,
    w: NEXT_WIDTH,
    h: NEXT_HEIGHT,
  };
  const closeButton: Rect = {
    x: width / 2 - CLOSE_WIDTH / 2,
    y: card.y + card.h - CARD_PADDING - CLOSE_HEIGHT,
    w: CLOSE_WIDTH,
    h: CLOSE_HEIGHT,
  };
  return {
    width,
    height,
    safeZoneLeft,
    safeZoneRight: SAFE_ZONE_RIGHT,
    play,
    clockButton,
    corner: { ...clockButton },
    card,
    nextButton,
    closeButton,
  };
}
```

- [ ] **Step 5: Run it to see it pass**

Run: `npx vitest run tests/frame-layout.test.ts`
Expected: PASS (42 tests).

- [ ] **Step 6: Commit**

```bash
git add src/frame/layout.ts tests/screens.ts tests/frame-layout.test.ts
git commit -m "feat: add the frame's layout (safe zones, play area, corner, pop-up card)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: Word Circle's layout uses the frame's layout

**Files:**
- Modify: `src/circle/layout.ts` (replace whole file)
- Move + rewrite: `tests/layout.test.ts` → `tests/circle-layout.test.ts`

- [ ] **Step 1: Rename the test and replace it with `tests/circle-layout.test.ts`**

```bash
git mv tests/layout.test.ts tests/circle-layout.test.ts
```

Replace the whole file with:

```ts
import { describe, expect, it } from 'vitest';
import { computeLayout, type Circle, type Rect } from '../src/circle/layout';
import { computeFrameLayout } from '../src/frame/layout';
import { SCREENS, inPlayArea } from './screens';

const PUZZLE_SHAPES = [
  { letterCount: 4, wordLengths: [3, 3, 4, 4] },
  { letterCount: 5, wordLengths: [3, 3, 3, 4, 4, 5] },
  { letterCount: 6, wordLengths: [3, 4, 5, 6, 6, 6] },
  { letterCount: 5, wordLengths: [3, 4, 4, 5] },
];

const circleRect = (c: Circle): Rect => ({ x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 });

describe.each(SCREENS)('Word Circle layout on a %i×%i screen', (width, height) => {
  describe.each(PUZZLE_SHAPES)('with $letterCount letters and words $wordLengths', (shape) => {
    const layout = computeLayout(computeFrameLayout(width, height), shape);
    const { frame } = layout;

    it('keeps everything out of the safe zones and on screen', () => {
      const rects = [
        ...layout.levels,
        layout.extras,
        layout.bar,
        layout.shuffleButton,
        layout.hintButton,
        ...layout.rows,
        circleRect(layout.backing),
        ...layout.tiles.map(circleRect),
      ];
      for (const rect of rects) expect(inPlayArea(rect, frame), JSON.stringify(rect)).toBe(true);
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

    it('puts Extra words at the top right, above the word bar and letter circle', () => {
      const { extras, bar, backing } = layout;
      expect(extras.h).toBeGreaterThanOrEqual(120);
      expect(extras.y + extras.h).toBeLessThanOrEqual(bar.y);
      expect(bar.y + bar.h).toBeLessThanOrEqual(backing.y - backing.r);
      expect(extras.x + extras.w).toBeGreaterThan(backing.x);
    });

    it('keeps Extra words and the word bar clear of the top-right buttons', () => {
      expect(layout.extras.x + layout.extras.w).toBeLessThanOrEqual(frame.corner.x);
      expect(frame.corner.y + frame.corner.h).toBeLessThanOrEqual(layout.bar.y);
    });

    it('puts three small level buttons in a row at the top left, above the word slots', () => {
      const { levels, rows } = layout;
      expect(levels).toHaveLength(3);
      levels.forEach((button, i) => {
        expect(button.h).toBeGreaterThanOrEqual(44);
        expect(button.w).toBeLessThanOrEqual(120);
        expect(button.y + button.h).toBeLessThanOrEqual(rows[0].y);
        if (i > 0) expect(button.x).toBeGreaterThanOrEqual(levels[i - 1].x + levels[i - 1].w);
      });
    });

    it('keeps the left column clear of the right column', () => {
      const rightColumnStart = Math.min(layout.extras.x, layout.bar.x, layout.backing.x - layout.backing.r);
      for (const rect of [...layout.levels, ...layout.rows, layout.shuffleButton, layout.hintButton]) {
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

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/circle-layout.test.ts`
Expected: FAIL (`computeLayout` still takes `{ width, height, ... }`, so `layout.frame` is undefined).

- [ ] **Step 3: Replace `src/circle/layout.ts`**

```ts
import { MARGIN, type FrameLayout, type Rect } from '../frame/layout';

export type { Rect };

const COLUMN_GAP = 24;
const LEFT_SHARE = 0.45;
/** Room for the "Extra words" label and two rows of word chips. */
const EXTRAS_HEIGHT = 130;
const EXTRAS_GAP = 8;
/** Space between Extra words and the buttons in the top-right corner. */
const CORNER_GAP = 12;
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
const LEVEL_HEIGHT = 48;
const LEVEL_MAX_WIDTH = 120;
const LEVEL_GAP = 8;
const LEVELS_BOTTOM_GAP = 16;
const LEVEL_COUNT = 3;

export interface Circle {
  x: number;
  y: number;
  r: number;
}

/** How many letters are in the circle, and how long each answer word is. */
export interface CircleShape {
  letterCount: number;
  wordLengths: number[];
}

export interface Layout {
  /** The frame's geometry: safe zones, play area, top-right buttons and pop-up cards. */
  frame: FrameLayout;
  /** Easy, Medium and Hard buttons at the top left. */
  levels: Rect[];
  /** "Extra words" list at the top right. */
  extras: Rect;
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

export function computeLayout(frame: FrameLayout, { letterCount, wordLengths }: CircleShape): Layout {
  const { height } = frame;
  const playLeft = frame.play.x;
  const columnsWidth = frame.play.w - COLUMN_GAP;
  const leftWidth = columnsWidth * LEFT_SHARE;
  const rightWidth = columnsWidth - leftWidth;
  const rightLeft = playLeft + leftWidth + COLUMN_GAP;
  const rightCenter = rightLeft + rightWidth / 2;

  const extras: Rect = { x: rightLeft, y: MARGIN, w: frame.corner.x - CORNER_GAP - rightLeft, h: EXTRAS_HEIGHT };
  const barWidth = Math.min(rightWidth, BAR_MAX_WIDTH);
  const bar: Rect = { x: rightCenter - barWidth / 2, y: extras.y + extras.h + EXTRAS_GAP, w: barWidth, h: BAR_HEIGHT };

  const circleTop = bar.y + bar.h + BAR_GAP;
  const circleSpace = height - MARGIN - circleTop;
  const diameter = Math.min(rightWidth, circleSpace);
  const backing: Circle = { x: rightCenter, y: circleTop + circleSpace / 2, r: diameter / 2 };

  const tileShare = letterCount <= 4 ? 0.34 : letterCount === 5 ? 0.3 : 0.27;
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

  const leftCenter = playLeft + leftWidth / 2;
  const levelWidth = Math.min(LEVEL_MAX_WIDTH, (leftWidth - (LEVEL_COUNT - 1) * LEVEL_GAP) / LEVEL_COUNT);
  const levelsLeft = leftCenter - (LEVEL_COUNT * levelWidth + (LEVEL_COUNT - 1) * LEVEL_GAP) / 2;
  const levels: Rect[] = Array.from({ length: LEVEL_COUNT }, (_, i) => ({
    x: levelsLeft + i * (levelWidth + LEVEL_GAP),
    y: MARGIN,
    w: levelWidth,
    h: LEVEL_HEIGHT,
  }));

  const rowCount = wordLengths.length;
  const longest = Math.max(...wordLengths);
  const slotsTop = MARGIN + LEVEL_HEIGHT + LEVELS_BOTTOM_GAP;
  const slotsSpace = buttonsY - BUTTONS_TOP_GAP - slotsTop;
  const byWidth = (leftWidth - (longest - 1) * SLOT_GAP) / longest;
  const byHeight = (slotsSpace - (rowCount - 1) * ROW_GAP) / rowCount;
  const slotSize = Math.min(MAX_SLOT, Math.max(MIN_SLOT, Math.floor(Math.min(byWidth, byHeight))));
  const blockHeight = rowCount * slotSize + (rowCount - 1) * ROW_GAP;
  const blockTop = slotsTop + (slotsSpace - blockHeight) / 2;
  const rows: Rect[] = wordLengths.map((length, i) => {
    const w = length * slotSize + (length - 1) * SLOT_GAP;
    return { x: leftCenter - w / 2, y: blockTop + i * (slotSize + ROW_GAP), w, h: slotSize };
  });

  return {
    frame,
    levels,
    extras,
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

- [ ] **Step 4: Run the layout tests**

Run: `npx vitest run tests/circle-layout.test.ts tests/frame-layout.test.ts`
Expected: PASS. (`src/app.ts` and `src/circle/view.ts` don't compile against the new layout yet; Tasks 5 and 6 replace them. Don't run `tsc` until Task 6.)

- [ ] **Step 5: Commit**

```bash
git add src/circle/layout.ts tests/circle-layout.test.ts
git commit -m "refactor: Word Circle's layout builds on the frame's layout

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: Shared DOM helpers, icons, and Word Circle's lines of good news

**Files:**
- Create: `src/ui/dom.ts`, `src/ui/icons.ts`, `src/circle/celebration.ts`, `tests/circle-celebration.test.ts`

- [ ] **Step 1: Create `src/ui/dom.ts`**

```ts
import type { Rect } from '../frame/layout';

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent: HTMLElement): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  parent.appendChild(node);
  return node;
}

export function place(node: HTMLElement, rect: Rect): void {
  node.style.left = `${rect.x}px`;
  node.style.top = `${rect.y}px`;
  node.style.width = `${rect.w}px`;
  node.style.height = `${rect.h}px`;
}

/** Plays a CSS animation again from the start. */
export function restartAnimation(node: HTMLElement, className: string): void {
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
}

export const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));
```

- [ ] **Step 2: Create `src/ui/icons.ts`** (the icons now in `src/circle/view.ts`, moved and exported)

```ts
const ICON_ATTRS =
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

export const SHUFFLE_ICON = `<svg ${ICON_ATTRS}><path d="M18 4l3 3l-3 3"/><path d="M18 20l3 -3l-3 -3"/><path d="M3 7h3a5 5 0 0 1 5 5a5 5 0 0 0 5 5h5"/><path d="M21 7h-5a4.978 4.978 0 0 0 -3 1m-4 8a4.984 4.984 0 0 1 -3 1h-3"/></svg>`;
export const HINT_ICON = `<svg ${ICON_ATTRS}><path d="M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7"/><path d="M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3"/><path d="M9.7 17l4.6 0"/></svg>`;
export const CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5l10 -10"/></svg>`;
export const TROPHY_ICON = `<svg ${ICON_ATTRS}><path d="M8 21l8 0"/><path d="M12 17l0 4"/><path d="M7 4l10 0"/><path d="M17 4v8a5 5 0 0 1 -10 0v-8"/><path d="M5 9m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M19 9m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/></svg>`;
export const CALENDAR_ICON = `<svg ${ICON_ATTRS}><path d="M11.5 21h-5.5a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v6"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M4 11h16"/><path d="M15 19l2 2l4 -4"/></svg>`;
export const SUN_ICON = `<svg ${ICON_ATTRS}><path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/><path d="M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7"/></svg>`;
export const STAR_ICON = `<svg ${ICON_ATTRS}><path d="M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873z"/></svg>`;
export const ARROW_ICON = `<svg ${ICON_ATTRS}><path d="M5 12l14 0"/><path d="M13 18l6 -6"/><path d="M13 6l6 6"/></svg>`;
export const CLOCK_ICON = `<svg ${ICON_ATTRS}><path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0"/><path d="M12 7v5l3 3"/></svg>`;
export const CLOSE_ICON = `<svg ${ICON_ATTRS}><path d="M18 6l-12 12"/><path d="M6 6l12 12"/></svg>`;
export const EVENT_ICON = `<svg ${ICON_ATTRS}><path d="M12 13m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0"/><path d="M12 10l0 3l2 0"/><path d="M7 4l-2.75 2"/><path d="M17 4l2.75 2"/></svg>`;
```

- [ ] **Step 3: Write the failing test `tests/circle-celebration.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { circleLines } from '../src/circle/celebration';

const BASE = { recordMs: null, streakDays: 1, todaySolved: 1, puzzleNumber: 7, milestone: false };

describe("Word Circle's good news", () => {
  it('always shows puzzles today and the puzzle number', () => {
    expect(circleLines(BASE).map((line) => line.text)).toEqual(['1 puzzle today', 'Puzzle number 7']);
  });

  it('puts a new record first, highlighted', () => {
    const lines = circleLines({ ...BASE, recordMs: 112_000 });
    expect(lines[0]).toMatchObject({ kind: 'row-record', text: 'New record! 1 min 52 sec', highlight: true });
  });

  it('shows days in a row from the second day', () => {
    const lines = circleLines({ ...BASE, streakDays: 5, todaySolved: 3 });
    expect(lines.map((line) => line.text)).toEqual(['5 days in a row', '3 puzzles today', 'Puzzle number 7']);
  });

  it('highlights milestones', () => {
    const lines = circleLines({ ...BASE, puzzleNumber: 50, milestone: true });
    expect(lines[lines.length - 1]).toMatchObject({ text: 'Puzzle number 50!', highlight: true });
  });
});
```

Run: `npx vitest run tests/circle-celebration.test.ts`
Expected: FAIL, cannot resolve `../src/circle/celebration`.

- [ ] **Step 4: Create `src/circle/celebration.ts`**

(`CelebrationLine` is defined in `src/frame/view.ts`, created in Task 5. The import is type-only, so Vitest runs this now; `tsc` checks it in Task 6.)

```ts
import type { CelebrationLine } from '../frame/view';
import { CALENDAR_ICON, STAR_ICON, SUN_ICON, TROPHY_ICON } from '../ui/icons';
import { formatDuration, type Celebration } from './stats';

/** The good news after a puzzle. Days in a row appears from day two. */
export function circleLines(c: Celebration): CelebrationLine[] {
  const lines: CelebrationLine[] = [];
  if (c.recordMs !== null) {
    lines.push({ kind: 'row-record', icon: TROPHY_ICON, text: `New record! ${formatDuration(c.recordMs)}`, highlight: true });
  }
  if (c.streakDays >= 2) {
    lines.push({ kind: 'row-streak', icon: CALENDAR_ICON, text: `${c.streakDays} days in a row`, highlight: false });
  }
  lines.push({
    kind: 'row-today',
    icon: SUN_ICON,
    text: `${c.todaySolved} ${c.todaySolved === 1 ? 'puzzle' : 'puzzles'} today`,
    highlight: false,
  });
  lines.push({
    kind: 'row-number',
    icon: STAR_ICON,
    text: `Puzzle number ${c.puzzleNumber}${c.milestone ? '!' : ''}`,
    highlight: c.milestone,
  });
  return lines;
}
```

- [ ] **Step 5: Run the test and commit**

Run: `npx vitest run tests/circle-celebration.test.ts`
Expected: PASS (4 tests).

```bash
git add src/ui/dom.ts src/ui/icons.ts src/circle/celebration.ts tests/circle-celebration.test.ts
git commit -m "refactor: share DOM helpers and icons; Word Circle's good news as data

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: Frame view and the slimmed Word Circle view

**Files:**
- Create: `src/frame/view.ts`
- Modify: `src/circle/view.ts` (replace whole file), `src/styles.css`

- [ ] **Step 1: Create `src/frame/view.ts`**

```ts
import type { ClockFace } from '../clock/clock';
import { el, place } from '../ui/dom';
import { fitFontScale } from '../ui/fit';
import { ARROW_ICON, CLOCK_ICON, CLOSE_ICON, EVENT_ICON } from '../ui/icons';
import type { FrameLayout } from './layout';

/** One line of good news on the "Well done!" card. */
export interface CelebrationLine {
  /** CSS class that colors the line's icon, e.g. "row-streak". */
  kind: string;
  icon: string;
  text: string;
  /** Orange highlight, for records and milestones. */
  highlight: boolean;
}

/** What a game puts on the "Well done!" card. */
export interface CelebrationCard {
  lines: CelebrationLine[];
  /** "Next puzzle" or "Next word". */
  nextLabel: string;
  /** The card moves on by itself after this long. */
  timeoutMs: number;
}

const SIDEWAYS_IPAD = `<svg width="240" height="170" viewBox="0 0 240 170" aria-hidden="true"><rect x="10" y="10" width="220" height="150" rx="18" fill="#fff" stroke="#141414" stroke-width="8"/><circle cx="208" cy="85" r="6" fill="#141414"/></svg>`;

/** Draws what every game shares: the top-right buttons, the pop-ups and the "Well done!" card. */
export class FrameView {
  /** The game on screen draws itself in here. */
  readonly gameLayer: HTMLElement;
  private readonly corner: HTMLElement;
  private readonly celebrate: HTMLElement;
  private readonly clockPopup: HTMLElement;
  private readonly rotate: HTMLElement;

  /** Buttons are drawn here but tapped through the touch tracker, which works with a resting thumb. */
  constructor(root: HTMLElement) {
    this.gameLayer = el('div', 'game-layer', root);
    this.corner = el('div', 'corner', root);
    this.celebrate = el('div', 'celebrate', root);
    this.clockPopup = el('div', 'clock-popup', root);
    this.rotate = el('div', 'rotate', root);
    this.rotate.innerHTML = `${SIDEWAYS_IPAD}<div>Please turn the iPad sideways</div>`;
  }

  /** The buttons in the top-right corner. */
  renderCorner(layout: FrameLayout): void {
    this.corner.replaceChildren();
    const clock = el('button', 'clock-button', this.corner);
    clock.type = 'button';
    clock.setAttribute('aria-label', 'Clock');
    clock.innerHTML = CLOCK_ICON;
    place(clock, layout.clockButton);
  }

  showRotate(on: boolean): void {
    this.rotate.classList.toggle('visible', on);
  }

  /** The "Well done!" card with her good news. Its button is tapped through the touch tracker. */
  showCelebration(card: CelebrationCard, layout: FrameLayout): void {
    this.celebrate.replaceChildren();
    el('div', 'celebrate-dim', this.celebrate);
    const box = el('div', 'card', this.celebrate);
    el('div', 'card-title', box).textContent = 'Well done!';
    const rows = el('div', 'card-rows', box);
    for (const line of card.lines) {
      const row = el('div', `card-row ${line.kind}${line.highlight ? ' highlight' : ''}`, rows);
      row.innerHTML = `${line.icon}<span></span>`;
      row.querySelector('span')!.textContent = line.text;
    }
    const next = el('button', 'next', this.celebrate);
    next.type = 'button';
    next.innerHTML = `<span></span>${ARROW_ICON}`;
    next.querySelector('span')!.textContent = card.nextLabel;
    // Visible first, so the rows can be measured when they're fitted.
    this.celebrate.classList.add('visible');
    this.placeCelebration(layout);
  }

  placeCelebration(layout: FrameLayout): void {
    const box = this.celebrate.querySelector<HTMLElement>('.card');
    const next = this.celebrate.querySelector<HTMLElement>('.next');
    if (box) {
      place(box, layout.card);
      // Text sizes in the stylesheet are multiples of 1% of the card's height.
      box.style.setProperty('--u', `${layout.card.h / 100}px`);
    }
    if (next) place(next, layout.nextButton);
    this.fitCelebrationRows();
  }

  hideCelebration(): void {
    this.celebrate.classList.remove('visible');
    this.celebrate.replaceChildren();
  }

  /** The big clock pop-up. Its Close button is tapped through the touch tracker. */
  showClock(face: ClockFace, events: readonly string[], layout: FrameLayout): void {
    this.clockPopup.replaceChildren();
    el('div', 'celebrate-dim', this.clockPopup);
    const card = el('div', 'clock-card', this.clockPopup);
    el('div', 'clock-time', card);
    el('div', 'clock-part', card);
    el('div', 'clock-date', card);
    el('div', 'clock-events', card);
    const close = el('button', 'next close', this.clockPopup);
    close.type = 'button';
    close.innerHTML = `${CLOSE_ICON}<span>Close</span>`;
    // Visible first, so the event lines can be measured when they're fitted.
    this.clockPopup.classList.add('visible');
    this.updateClock(face, events);
    this.placeClock(layout);
  }

  /** Refreshes the time and countdowns while the pop-up is open. */
  updateClock(face: ClockFace, events: readonly string[]): void {
    const set = (selector: string, text: string) => {
      const node = this.clockPopup.querySelector(selector);
      if (node && node.textContent !== text) node.textContent = text;
    };
    set('.clock-time', face.time);
    set('.clock-part', face.part);
    set('.clock-date', face.date);
    const list = this.clockPopup.querySelector<HTMLElement>('.clock-events');
    if (!list) return;
    const current = [...list.children].map((row) => row.textContent).join('\n');
    if (current === events.join('\n')) return;
    list.style.display = events.length === 0 ? 'none' : '';
    list.replaceChildren(
      ...events.map((text) => {
        const row = document.createElement('div');
        row.className = text.startsWith('Time for ') ? 'clock-event now' : 'clock-event';
        row.innerHTML = `${EVENT_ICON}<span></span>`;
        row.querySelector('span')!.textContent = text;
        return row;
      }),
    );
    this.fitClockEvents();
  }

  placeClock(layout: FrameLayout): void {
    const card = this.clockPopup.querySelector<HTMLElement>('.clock-card');
    const close = this.clockPopup.querySelector<HTMLElement>('.next');
    if (card) {
      place(card, layout.card);
      // Text sizes in the stylesheet are multiples of 1% of the card's height.
      card.style.setProperty('--u', `${layout.card.h / 100}px`);
    }
    if (close) place(close, layout.closeButton);
    this.fitClockEvents();
  }

  hideClock(): void {
    this.clockPopup.classList.remove('visible');
    this.clockPopup.replaceChildren();
  }

  /** Shrinks the stat rows together if the widest is too wide for one line, so their icons stay lined up. */
  private fitCelebrationRows(): void {
    const box = this.celebrate.querySelector<HTMLElement>('.card');
    const list = this.celebrate.querySelector<HTMLElement>('.card-rows');
    if (!box || !list) return;
    list.style.fontSize = '';
    const boxStyle = getComputedStyle(box);
    const room = box.clientWidth - parseFloat(boxStyle.paddingLeft) - parseFloat(boxStyle.paddingRight) - 1;
    const rows = [...list.children] as HTMLElement[];
    const widest = Math.max(0, ...rows.map((row) => row.scrollWidth + (row.offsetWidth - row.clientWidth)));
    const scale = fitFontScale(widest, room);
    if (scale < 1) list.style.fontSize = `${parseFloat(getComputedStyle(list).fontSize) * scale}px`;
  }

  /** Shrinks any event line too wide for one line, and drops events that still don't fit rather than cut them off. */
  private fitClockEvents(): void {
    const list = this.clockPopup.querySelector<HTMLElement>('.clock-events');
    if (!list) return;
    const rows = [...list.children] as HTMLElement[];
    rows.forEach((row) => (row.style.fontSize = ''));
    for (const row of rows) {
      // Room for the text and padding: the list's width less the row's own border, and 1px for rounding.
      const room = list.clientWidth - (row.offsetWidth - row.clientWidth) - 1;
      const scale = fitFontScale(row.scrollWidth, room);
      if (scale < 1) row.style.fontSize = `${parseFloat(getComputedStyle(row).fontSize) * scale}px`;
    }
    while (list.children.length > 1 && list.scrollHeight > list.clientHeight + 1) list.lastElementChild!.remove();
  }
}
```

- [ ] **Step 2: Replace `src/circle/view.ts`** (the same drawing code, minus the parts the frame now owns)

```ts
import { el, place, restartAnimation, wait } from '../ui/dom';
import { CHECK_ICON, HINT_ICON, SHUFFLE_ICON } from '../ui/icons';
import type { Layout, Rect } from './layout';
import { LEVELS, type Level, type Puzzle } from './types';

export interface RowState {
  found: boolean;
  revealed: number[];
}

/** Everything about the current puzzle that the screen shows. */
export interface ScreenState {
  /** ringOrder[slot] is the letter index shown in that ring slot. */
  ringOrder: readonly number[];
  rows: readonly RowState[];
  extras: readonly string[];
  level: Level;
}

const LEVEL_LABELS: Record<Level, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

const SVG_NS = 'http://www.w3.org/2000/svg';
const FLY_MS = 600;
const BAR_MESSAGE_MS = 1200;
const WIGGLE_MS = 400;
const BAR_LETTER_SCALE = 0.62;
const BAR_TEXT_SCALE = 0.42;
const SLOT_LETTER_SCALE = 0.62;

/** Draws the Word Circle screen and plays its animations. Knows nothing about rules. */
export class View {
  private board: HTMLElement | null = null;
  private puzzle!: Puzzle;
  private layout!: Layout;
  private ringOrder: number[] = [];
  private tiles: HTMLElement[] = [];
  private rows: HTMLElement[][] = [];
  private extras!: HTMLElement;
  private chips!: HTMLElement;
  private bar!: HTMLElement;
  private line!: SVGPolylineElement;
  private hintButton!: HTMLButtonElement;
  private message!: HTMLElement;
  private messageToken = 0;
  private barTimer = 0;

  /** Draws into `layer`. Buttons are drawn here but tapped through the touch tracker, which works with a resting thumb. */
  constructor(private readonly layer: HTMLElement) {}

  /** Builds the whole screen. */
  render(puzzle: Puzzle, layout: Layout, state: ScreenState, animateIn: boolean): void {
    this.puzzle = puzzle;
    this.layout = layout;
    this.ringOrder = [...state.ringOrder];
    window.clearTimeout(this.barTimer);
    this.messageToken++;
    const board = document.createElement('div');
    board.className = 'board';
    this.layer.replaceChildren(board);
    this.board = board;

    LEVELS.forEach((level, i) => {
      const button = el('button', level === state.level ? 'level on' : 'level', board);
      button.type = 'button';
      button.innerHTML = `${level === state.level ? CHECK_ICON : ''}<span>${LEVEL_LABELS[level]}</span>`;
      place(button, layout.levels[i]);
    });

    this.rows = puzzle.words.map((word, i) => this.buildRow(board, word, layout.rows[i]));
    state.rows.forEach((row, i) => this.setRow(i, row));
    this.buildButton(board, 'shuffle', 'Shuffle', SHUFFLE_ICON, layout.shuffleButton);
    this.hintButton = this.buildButton(board, 'hint', 'Hint', HINT_ICON, layout.hintButton);

    this.extras = el('div', 'extras', board);
    place(this.extras, layout.extras);
    el('div', 'extras-label', this.extras).textContent = 'Extra words';
    this.chips = el('div', 'chips', this.extras);
    this.setExtras(state.extras);

    const { backing } = layout;
    place(el('div', 'backing', board), {
      x: backing.x - backing.r,
      y: backing.y - backing.r,
      w: backing.r * 2,
      h: backing.r * 2,
    });
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'lines');
    svg.setAttribute('width', String(layout.frame.width));
    svg.setAttribute('height', String(layout.frame.height));
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

  /** Shows extra words as chips, oldest first; drops the oldest when they don't fit. Pops in `newest`. */
  setExtras(words: readonly string[], newest?: string): void {
    this.chips.replaceChildren(
      ...words.map((word) => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        chip.dataset.word = word;
        chip.textContent = word.toUpperCase();
        return chip;
      }),
    );
    this.extras.classList.toggle('empty', words.length === 0);
    while (this.chips.childElementCount > 1 && this.chips.scrollHeight > this.chips.clientHeight) {
      this.chips.firstElementChild!.remove();
    }
    const chip = newest ? this.chipFor(newest) : undefined;
    if (chip) restartAnimation(chip, 'pop');
  }

  /** Pulses an extra word's chip. Returns false if that chip isn't on screen. */
  pulseExtra(word: string): boolean {
    const chip = this.chipFor(word);
    if (chip) restartAnimation(chip, 'pulse');
    return chip !== undefined;
  }

  /** Shows a large message over the circle or the whole screen, then fades it. */
  async showMessage(text: string, where: 'circle' | 'screen', ms: number): Promise<void> {
    const token = ++this.messageToken;
    const { layout, message } = this;
    const center = where === 'circle' ? layout.backing : { x: layout.frame.width / 2, y: layout.frame.height / 2 };
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

  private chipFor(word: string): HTMLElement | undefined {
    return [...this.chips.children].find((chip) => (chip as HTMLElement).dataset.word === word) as HTMLElement | undefined;
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

  private buildButton(board: HTMLElement, kind: string, label: string, icon: string, rect: Rect): HTMLButtonElement {
    const button = el('button', `button ${kind}`, board);
    button.type = 'button';
    button.innerHTML = `${icon}<span>${label}</span>`;
    place(button, rect);
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

- [ ] **Step 3: Add the frame's layers to `src/styles.css`**

Replace:

```css
#app,
.board {
  position: absolute;
  inset: 0;
}
```

with:

```css
#app,
.game-layer,
.corner,
.board {
  position: absolute;
  inset: 0;
}
```

(Task 6 compiles and commits these together with the controller.)

### Task 6: The frame controller, Word Circle's screen, and wiring

**Files:**
- Create: `src/frame/games.ts`, `src/frame/frame.ts`, `src/circle/screen.ts`
- Modify: `src/main.ts` (replace whole file), `src/pwa.ts`
- Delete: `src/app.ts`

- [ ] **Step 1: Create `src/frame/games.ts`**

```ts
import type { ButtonGeometry, TileGeometry } from '../input/touch';
import type { FrameLayout } from './layout';
import type { CelebrationCard } from './view';

export type GameId = 'circle';

/** What the touch tracker listens for in a game: its letter tiles (for tracing words) and its buttons. */
export interface GameTargets {
  tiles: TileGeometry[];
  buttons: ButtonGeometry[];
}

/** What the frame lends the game on screen. */
export interface FrameHost {
  /** True while she's tracing a word through letter tiles. */
  readonly isTracing: boolean;
  /** The tiles traced so far. */
  readonly selection: readonly number[];
  /** Shows the "Well done!" card until she taps its button or it moves on by itself. */
  celebrate(card: CelebrationCard): Promise<void>;
  /** Redraws the game (and tells the touch tracker about its new targets). */
  redraw(animateIn: boolean): void;
}

/** A game the frame can show. Button ids "next", "clock" and "close" belong to the frame. */
export interface GameScreen {
  readonly id: GameId;
  /** True while it's animating or celebrating: pop-ups wait. */
  readonly busy: boolean;
  /** Loads its saved progress. Called once, before the first render. */
  start(host: FrameHost): void;
  /** Draws itself into `layer` and returns what the touch tracker should listen for. */
  render(layer: HTMLElement, frame: FrameLayout, animateIn: boolean): GameTargets;
  buttonTapped(id: string): void;
  letterAdded?(): void;
  letterRemoved?(): void;
  selectionCleared?(): void;
  wordSubmitted?(tiles: readonly number[]): void;
  /** A finger touched down or lifted (for play time). */
  activity?(): void;
  /** She left it: the app went to the background (later: or she picked another game). Save and stop timers. */
  pause(): void;
  /** She's back. */
  resume(): void;
}
```

- [ ] **Step 2: Create `src/frame/frame.ts`**

```ts
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
```

- [ ] **Step 3: Create `src/circle/screen.ts`** (Word Circle's part of the old `src/app.ts`)

```ts
import type { FrameHost, GameScreen, GameTargets } from '../frame/games';
import type { FrameLayout } from '../frame/layout';
import type { KeyValueStore } from '../shared/store';
import { circleLines } from './celebration';
import { computeLayout, type Layout } from './layout';
import { identityOrder, shuffleRing } from './ring';
import { Game } from './state';
import { dayKey, emptyStats, recordSolve } from './stats';
import { loadSavedGame, nextIndex, resolveStart, saveSavedGame, type SavedGame, type StartPoint } from './storage';
import { PlayTimer } from './timer';
import { LEVELS, type Level, type PuzzleSet } from './types';
import { View, type RowState } from './view';

const IDLE_HINT_MS = 120_000;
const GOOD_MS = 1200;
/** The celebration moves on by itself after this long if she doesn't tap Next puzzle. */
const CELEBRATION_MS = 15_000;

/** Word Circle: slide across a circle of letters to fill the word slots. */
export class CircleScreen implements GameScreen {
  readonly id = 'circle';
  /** True from finishing a puzzle until the next one is on screen. */
  busy = false;
  private host!: FrameHost;
  private saved: SavedGame = { level: 'medium', levels: {}, stats: emptyStats() };
  private level: Level = 'medium';
  private index = 0;
  private game!: Game;
  private timer = new PlayTimer();
  private ringOrder: number[] = [];
  private idleTimer = 0;
  private layout: Layout | null = null;
  /** Created on the first render; taps and words can only arrive after that. */
  private view!: View;

  constructor(
    private readonly puzzles: PuzzleSet,
    private readonly store: KeyValueStore,
  ) {}

  start(host: FrameHost): void {
    this.host = host;
    this.saved = loadSavedGame(this.store);
    this.openLevel(this.saved.level);
  }

  render(layer: HTMLElement, frame: FrameLayout, animateIn: boolean): GameTargets {
    if (!this.view) this.view = new View(layer);
    const { puzzle } = this.game;
    const layout = computeLayout(frame, {
      letterCount: puzzle.letters.length,
      wordLengths: puzzle.words.map((w) => w.length),
    });
    this.layout = layout;
    this.view.render(
      puzzle,
      layout,
      { ringOrder: this.ringOrder, rows: this.rowStates(), extras: this.game.foundBonus(), level: this.level },
      animateIn,
    );
    return {
      tiles: layout.tiles,
      buttons: [
        { id: 'shuffle', ...layout.shuffleButton },
        { id: 'hint', ...layout.hintButton },
        ...LEVELS.map((level, i) => ({ id: `level:${level}`, ...layout.levels[i] })),
      ],
    };
  }

  buttonTapped(id: string): void {
    if (id === 'shuffle') this.shuffle();
    else if (id === 'hint') this.hint();
    else if (id.startsWith('level:')) this.chooseLevel(id.slice('level:'.length) as Level);
  }

  letterAdded(): void {
    this.showSelection();
  }

  letterRemoved(): void {
    this.showSelection();
  }

  selectionCleared(): void {
    this.view.showSelection([]);
  }

  wordSubmitted(tiles: readonly number[]): void {
    void this.submit(tiles);
  }

  activity(): void {
    this.timer.activity(performance.now());
  }

  /** Play time stops while she's away. */
  pause(): void {
    this.timer.pause();
    window.clearTimeout(this.idleTimer);
    this.view?.setHintPulse(false);
    this.save();
  }

  resume(): void {
    this.timer.resume(performance.now());
    if (!this.busy) this.resetIdle();
  }

  /** Switches to a level's saved place (or its first puzzle). */
  private openLevel(level: Level): void {
    this.level = level;
    this.loadPuzzle(resolveStart(this.puzzles[level], this.saved.levels[level]));
  }

  private loadPuzzle(start: StartPoint): void {
    this.index = start.index;
    this.game = new Game(this.puzzles[this.level][start.index], start.found, start.revealed, start.bonusFound);
    this.ringOrder = identityOrder(this.game.puzzle.letters.length);
    this.timer = new PlayTimer(start.elapsedMs);
    if (document.hidden) this.timer.pause();
    else this.timer.activity(performance.now());
    this.save();
  }

  /** Each level keeps its own place, so switching never loses anything. */
  private chooseLevel(level: Level): void {
    if (this.busy || this.host.isTracing || level === this.level) return;
    this.openLevel(level);
    this.host.redraw(true);
    this.resetIdle();
  }

  private rowStates(): RowState[] {
    return this.game.puzzle.words.map((word) => this.rowState(word));
  }

  private rowState(word: string): RowState {
    return { found: this.game.isFound(word), revealed: this.game.revealedIndices(word) };
  }

  private showSelection(): void {
    this.view.hideMessage();
    this.view.showSelection(this.host.selection);
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
        this.save();
        this.view.barMessage('Good word!');
        this.view.setExtras(this.game.foundBonus(), result.word);
        return;
      case 'bonusAgain':
        this.view.hideBar();
        if (!this.view.pulseExtra(result.word)) this.view.barMessage('Good word!');
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
    this.view.showSelection([]);
    window.clearTimeout(this.idleTimer);
    this.view.setHintPulse(false);
    this.timer.activity(performance.now());
    const { stats, celebration } = recordSolve(this.saved.stats, this.level, this.timer.elapsedMs, dayKey(new Date()));
    this.saved.stats = stats;
    // Save the next puzzle as her place now, so closing the app mid-celebration loses nothing.
    this.loadPuzzle({
      index: nextIndex(this.index, this.puzzles[this.level].length),
      found: [],
      revealed: {},
      bonusFound: [],
      elapsedMs: 0,
    });
    this.timer.pause();
    await this.host.celebrate({ lines: circleLines(celebration), nextLabel: 'Next puzzle', timeoutMs: CELEBRATION_MS });
    this.timer.resume(performance.now());
    this.busy = false;
    this.host.redraw(true);
    this.resetIdle();
  }

  private hint(): void {
    if (this.busy || this.host.isTracing) return;
    const result = this.game.hint();
    if (!result) return;
    this.save();
    this.resetIdle();
    const row = this.game.puzzle.words.indexOf(result.word);
    this.view.setRow(row, this.rowState(result.word));
    if (result.completedWord) void this.afterWordFound();
  }

  private shuffle(): void {
    if (this.busy || this.host.isTracing) return;
    this.ringOrder = shuffleRing(this.ringOrder, this.game.puzzle.letters, Math.random);
    this.view.setRingOrder(this.ringOrder);
  }

  private resetIdle(): void {
    window.clearTimeout(this.idleTimer);
    this.view?.setHintPulse(false);
    this.idleTimer = window.setTimeout(() => this.view?.setHintPulse(true), IDLE_HINT_MS);
  }

  private save(): void {
    this.saved.level = this.level;
    this.saved.levels[this.level] = {
      puzzleIndex: this.index,
      puzzleId: this.game.puzzle.id,
      found: this.game.foundWords(),
      revealed: this.game.revealedRecord(),
      bonusFound: this.game.foundBonus(),
      elapsedMs: this.timer.elapsedMs,
    };
    saveSavedGame(this.store, this.saved);
  }
}
```

- [ ] **Step 4: Replace `src/main.ts`**

```ts
import '@fontsource/atkinson-hyperlegible/700.css';
import './styles.css';
import { CircleScreen } from './circle/screen';
import type { PuzzleSet } from './circle/types';
import puzzleData from './data/puzzles.json';
import { Frame } from './frame/frame';
import { setupUpdates } from './pwa';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');
const store = window.localStorage;

let frame: Frame | undefined;
const updates = setupUpdates(() => frame?.interacted ?? false);
frame = new Frame(root, store, updates, [new CircleScreen(puzzleData as PuzzleSet, store)]);
frame.start();
```

- [ ] **Step 5: Point `src/pwa.ts` at the frame and delete the old controller**

In `src/pwa.ts` replace `import type { Updates } from './app';` with `import type { Updates } from './frame/frame';`. Then:

```bash
git rm src/app.ts
```

- [ ] **Step 6: Check types, tests and build**

```bash
npx tsc --noEmit && npm test && npm run build
```

Expected: no type errors; all test files pass (16 files: the 15 before, minus `layout.test.ts`, plus `circle-layout`, `frame-layout`, `circle-celebration`); build succeeds.

- [ ] **Step 7: Commit**

```bash
git add -A src tests
git commit -m "refactor: split the controller into a shared frame and Word Circle's screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 7: Check Word Circle in the browser

- [ ] **Step 1: Start the dev server and open the app on 127.0.0.1**

Use the preview tools: `preview_start` with name `word-circle`, then `navigate` to `http://127.0.0.1:5173/word-circle/`. Check `read_console_messages` (no errors) and `preview_logs` (no build errors).

- [ ] **Step 2: Check each iPad size**

For each of 1024×768, 1133×744, 1180×820, 1366×1024: `resize_window` to that size, reload, take a screenshot. Expected, as before the refactor: level buttons, word slots, Shuffle and Hint on the left; Extra words, the clock button and the letter circle on the right; nothing in the thumb bands.

- [ ] **Step 3: Exercise it with pointer events** (this origin's storage is separate from the owner's)

With `javascript_tool`, tap buttons by dispatching pointer events at their centers, for example:

```js
const tap = (selector) => {
  const r = document.querySelector(selector).getBoundingClientRect();
  const at = { pointerId: 7, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, bubbles: true };
  window.dispatchEvent(new PointerEvent('pointerdown', at));
  window.dispatchEvent(new PointerEvent('pointerup', at));
};
tap('.clock-button');
```

Check: the clock pop-up opens and Close closes it; Hint fills a letter; Medium/Hard switch levels; tapping Hint until the puzzle is complete shows the "Well done!" card, and Next puzzle moves on.

- [ ] **Step 4: Reset the window** with `resize_window` preset `desktop`.

## Checkpoint 1 (stop here)

Tell the owner: Word Circle has been reorganized into a shared frame and its own folder, with no visible change (except that the clock button stays still when she changes level), and all tests pass. Ask them to try it at `http://127.0.0.1:5173/word-circle/` if they like before going on.

---

# Stage 2 — Word Guess's word lists

### Task 8: Build and check the Word Guess lists

**Files:**
- Create: `src/guess/words.ts`, `scripts/guess-lib.ts`, `tests/guess-words.test.ts`, `tests/guess-lib.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/guess-words.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { acceptedChecker } from '../src/guess/words';

describe('accepted guesses', () => {
  it('accepts only words on the accepted list', () => {
    const accepted = acceptedChecker({ answers: ['crane'], accepted: ['cares', 'crane'] });
    expect(accepted('cares')).toBe(true);
    expect(accepted('crane')).toBe(true);
    expect(accepted('xxxxx')).toBe(false);
  });
});
```

`tests/guess-lib.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildGuessWords, validateGuessWords } from '../scripts/guess-lib';
import { seededRandom } from '../src/shared/random';

const ANSWERS = new Map([
  ['house', 10],
  ['plant', 10],
  ['crane', 20],
  ['slate', 20],
  ['abbey', 35],
  ['zebra', 35],
  ['nasty', 35],
  ['cat', 10],
]);
const ACCEPTED = new Set([...ANSWERS.keys(), 'cares', 'slats', 'tones', 'things']);
const BLOCKLIST = new Set(['nasty', 'tones']);
const build = () => buildGuessWords({ answers: ANSWERS, accepted: ACCEPTED, blocklist: BLOCKLIST, random: seededRandom(1) });

describe('building the Word Guess lists', () => {
  it('uses only five-letter answers that are not blocked', () => {
    expect([...build().answers].sort()).toEqual(['abbey', 'crane', 'house', 'plant', 'slate', 'zebra']);
  });

  it('plays the most common words first', () => {
    const { answers } = build();
    expect(answers.slice(0, 2).sort()).toEqual(['house', 'plant']);
    expect(answers.slice(2, 4).sort()).toEqual(['crane', 'slate']);
    expect(answers.slice(4).sort()).toEqual(['abbey', 'zebra']);
  });

  it('comes out the same every build', () => {
    expect(build()).toEqual(build());
  });

  it('accepts every answer and every other unblocked five-letter word, in order', () => {
    expect(build().accepted).toEqual(['abbey', 'cares', 'crane', 'house', 'plant', 'slate', 'slats', 'zebra']);
  });
});

describe('checking the Word Guess lists', () => {
  it('passes good lists', () => {
    expect(validateGuessWords({ answers: ['crane'], accepted: ['crane'] }, new Set(), new Set())).toEqual([]);
  });

  it('reports every kind of bad answer', () => {
    const problems = validateGuessWords(
      { answers: ['crane', 'crane', 'nasty', 'cats', 'cares'], accepted: ['cares', 'crane', 'nasty'] },
      new Set(['nasty']),
      new Set(['cares']),
    );
    expect(problems).toEqual([
      'Word Guess: "crane" is in the answers twice',
      'Word Guess: "nasty" is on the never-use list',
      'Word Guess: "cats" is not five letters a–z',
      'Word Guess: "cats" is not an accepted guess',
      'Word Guess: "cares" is a plural or other ending',
    ]);
  });
});
```

Run: `npx vitest run tests/guess-words.test.ts tests/guess-lib.test.ts`
Expected: FAIL, cannot resolve `../src/guess/words` and `../scripts/guess-lib`.

- [ ] **Step 2: Create `src/guess/words.ts`**

```ts
/** Word Guess's word lists, generated by `npm run puzzles` into src/data/guess-words.json. */
export interface GuessWords {
  /** Answers in play order. */
  answers: string[];
  /** Every word accepted as a guess (including every answer), sorted. */
  accepted: string[];
}

/** A quick check for whether a guess is a real word she may use. */
export function acceptedChecker(words: GuessWords): (word: string) => boolean {
  const accepted = new Set(words.accepted);
  return (word) => accepted.has(word);
}
```

- [ ] **Step 3: Create `scripts/guess-lib.ts`**

```ts
import type { GuessWords } from '../src/guess/words';
import { shuffle } from '../src/shared/random';

const FIVE = /^[a-z]{5}$/;

export interface GuessSources {
  /** Plain answer words, mapped to the SCOWL size they first appear at. */
  answers: ReadonlyMap<string, number>;
  /** Every word that counts as a real word. */
  accepted: ReadonlySet<string>;
  blocklist: ReadonlySet<string>;
  random: () => number;
}

/** Answers in play order (most common SCOWL size first, each size shuffled) and every accepted guess, sorted. */
export function buildGuessWords({ answers, accepted, blocklist, random }: GuessSources): GuessWords {
  const bySize = new Map<number, string[]>();
  for (const [word, size] of answers) {
    if (!FIVE.test(word) || blocklist.has(word)) continue;
    const group = bySize.get(size) ?? [];
    group.push(word);
    bySize.set(size, group);
  }
  const sizes = [...bySize.keys()].sort((a, b) => a - b);
  const answerList = sizes.flatMap((size) => shuffle(bySize.get(size)!.sort(), random));
  const acceptedSet = new Set(answerList);
  for (const word of accepted) if (FIVE.test(word) && !blocklist.has(word)) acceptedSet.add(word);
  return { answers: answerList, accepted: [...acceptedSet].sort() };
}

/** Everything wrong with the answers; empty when they're fine. */
export function validateGuessWords(words: GuessWords, blocklist: ReadonlySet<string>, inflected: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  const accepted = new Set(words.accepted);
  const seen = new Set<string>();
  for (const word of words.answers) {
    const say = (problem: string) => problems.push(`Word Guess: "${word}" ${problem}`);
    if (seen.has(word)) say('is in the answers twice');
    seen.add(word);
    if (blocklist.has(word)) say('is on the never-use list');
    if (!FIVE.test(word)) say('is not five letters a–z');
    if (!accepted.has(word)) say('is not an accepted guess');
    if (inflected.has(word)) say('is a plural or other ending');
  }
  return problems;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/guess-words.test.ts tests/guess-lib.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/guess/words.ts scripts/guess-lib.ts tests/guess-words.test.ts tests/guess-lib.test.ts
git commit -m "feat: build and check Word Guess's answer and guess lists

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 9: Generate `guess-words.json` and add the answers to the review page

**Files:**
- Modify: `scripts/build-puzzles.ts`, `scripts/sample-page.ts` (replace whole file)
- Generate: `src/data/guess-words.json`, `docs/puzzle-sample.html`

- [ ] **Step 1: Replace `scripts/sample-page.ts`**

```ts
import type { Puzzle } from '../src/circle/types';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escape = (text: string) => text.replace(/[&<>"]/g, (ch) => ESCAPES[ch]);

export interface SampleSection {
  title: string;
  puzzles: readonly Puzzle[];
}

function renderTable(puzzles: readonly Puzzle[]): string {
  const rows = puzzles
    .map(
      (p, i) =>
        `<tr><td>${i + 1}</td><td class="letters">${escape(p.letters.join(' ').toUpperCase())}</td>` +
        `<td>${escape(p.words.join(', '))}</td><td class="bonus">${escape(p.bonus.join(', '))}</td></tr>`,
    )
    .join('\n');
  return `<table>
<thead><tr><th>#</th><th>Letters</th><th>Words to find</th><th>Also accepted ("Good word!")</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>`;
}

function renderGuessAnswers(answers: readonly string[]): string {
  if (answers.length === 0) return '';
  const items = answers.map((word) => `<li>${escape(word)}</li>`).join('');
  return `<h2>Word Guess answers, in play order</h2>
<ol class="answers">${items}</ol>`;
}

export function renderSamplePage(sections: readonly SampleSection[], guessAnswers: readonly string[] = []): string {
  const body = sections.map((s) => `<h2>${escape(s.title)}</h2>\n${renderTable(s.puzzles)}`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Word Circle puzzle sample</title>
<style>
body { font-family: system-ui, sans-serif; margin: 24px; }
table { border-collapse: collapse; width: 100%; margin-bottom: 32px; }
th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; vertical-align: top; }
.letters { font-weight: 700; letter-spacing: 0.1em; white-space: nowrap; }
.bonus { color: #555; }
.answers { columns: 8 120px; font-size: 15px; }
</style>
</head>
<body>
<h1>Word Circle puzzle sample</h1>
<p>The first puzzles of each Word Circle level, and every Word Guess answer, in play order. To keep a word
from ever appearing, add it to <code>words/blocklist.txt</code> and run <code>npm run puzzles</code>.</p>
${body}
${renderGuessAnswers(guessAnswers)}
</body>
</html>
`;
}
```

- [ ] **Step 2: Build the Word Guess lists in `scripts/build-puzzles.ts`**

Add the import after the `./puzzle-lib` import:

```ts
import { buildGuessWords, validateGuessWords } from './guess-lib';
```

After `const SAMPLE_FILE = path.join(ROOT, 'docs/puzzle-sample.html');` add:

```ts
const GUESS_OUTPUT_FILE = path.join(ROOT, 'src/data/guess-words.json');
```

After `const SAMPLE_SIZE = 20;` add:

```ts
/** Fail the build if Word Guess has fewer answers than this, so the word-list rules can be revisited. */
const GUESS_MINIMUM = 1500;
```

Replace:

```ts
  set[level] = puzzles;
});
if (problems.length > 0) {
```

with:

```ts
  set[level] = puzzles;
});

// Word Guess uses its own seed, so its lists never change the Word Circle puzzles.
const guess = buildGuessWords({ answers, accepted, blocklist, random: seededRandom(SEED + 100) });
problems.push(...validateGuessWords(guess, blocklist, inflected));
if (guess.answers.length < GUESS_MINIMUM) {
  problems.push(`Word Guess: only ${guess.answers.length} answers could be found (need at least ${GUESS_MINIMUM})`);
}
if (problems.length > 0) {
```

Replace:

```ts
      puzzles: set[level].slice(0, SAMPLE_SIZE),
    })),
  ),
);
```

with:

```ts
      puzzles: set[level].slice(0, SAMPLE_SIZE),
    })),
    guess.answers,
  ),
);
fs.writeFileSync(
  GUESS_OUTPUT_FILE,
  `{\n"answers": ${JSON.stringify(guess.answers)},\n"accepted": ${JSON.stringify(guess.accepted)}\n}\n`,
);
```

and add this as the last line of the file:

```ts
console.log(`Wrote ${guess.answers.length} Word Guess answers and ${guess.accepted.length} accepted words to src/data/guess-words.json`);
```

- [ ] **Step 3: Run the generator and check Word Circle's puzzles didn't change**

```bash
npm run puzzles
git diff --stat src/data/puzzles.json
```

Expected: the log ends `Wrote 19xx Word Guess answers and 50xx accepted words to src/data/guess-words.json`; `git diff --stat src/data/puzzles.json` prints nothing.

- [ ] **Step 4: Check tests and build**

```bash
npm test && npm run build
```

Expected: all pass; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-puzzles.ts scripts/sample-page.ts src/data/guess-words.json docs/puzzle-sample.html
git commit -m "feat: generate Word Guess's word lists and list the answers on the review page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Checkpoint 2 (stop here)

Tell the owner how many answers and accepted words there are, and ask them to skim the "Word Guess answers, in play order" section of `docs/puzzle-sample.html` (open it from the repository folder) and list any word she shouldn't see. Add those to `words/blocklist.txt`, run `npm run puzzles`, check `git diff --stat src/data/puzzles.json` (Word Circle puzzles may shift if a blocked word was in them; that's expected), then `npm test`, and commit `words/blocklist.txt`, `src/data/*.json` and `docs/puzzle-sample.html` with a message like `words: never use <words>`.

---

# Stage 3 — Word Guess

The app's side of the daily Wordle is built in this stage, but nothing about it shows until a `daily-word.txt` exists (Stage 4).

### Task 10: Shared days in a row

**Files:**
- Create: `src/shared/days.ts`, `tests/days.test.ts`
- Modify: `src/circle/stats.ts`, `src/circle/screen.ts`, `tests/stats.test.ts`

- [ ] **Step 1: Write the failing test `tests/days.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { isMilestone, recordPlayDay } from '../src/shared/days';

describe('days in a row across both games', () => {
  it('starts at one on the first day', () => {
    expect(recordPlayDay({ streakDays: 0, lastPlayedDay: null }, '2026-10-19')).toEqual({ streakDays: 1, lastPlayedDay: '2026-10-19' });
  });

  it('stays the same for more puzzles or words on the same day', () => {
    expect(recordPlayDay({ streakDays: 3, lastPlayedDay: '2026-10-19' }, '2026-10-19')).toEqual({ streakDays: 3, lastPlayedDay: '2026-10-19' });
  });

  it('grows by one on the next day', () => {
    expect(recordPlayDay({ streakDays: 3, lastPlayedDay: '2026-10-19' }, '2026-10-20')).toEqual({ streakDays: 4, lastPlayedDay: '2026-10-20' });
  });

  it('quietly starts over after a missed day', () => {
    expect(recordPlayDay({ streakDays: 3, lastPlayedDay: '2026-10-19' }, '2026-10-21')).toEqual({ streakDays: 1, lastPlayedDay: '2026-10-21' });
  });

  it('carries across a year end', () => {
    expect(recordPlayDay({ streakDays: 9, lastPlayedDay: '2026-12-31' }, '2027-01-01').streakDays).toBe(10);
  });
});

describe('milestones', () => {
  it('celebrates 10, 25, 50, 100, 250, 500, 750 and 1,000, then every 500', () => {
    expect([10, 25, 50, 100, 250, 500, 750, 1000, 1500, 2000].every(isMilestone)).toBe(true);
    expect([1, 9, 11, 24, 99, 1001, 1250].some(isMilestone)).toBe(false);
  });
});
```

Run: `npx vitest run tests/days.test.ts`
Expected: FAIL, cannot resolve `../src/shared/days`.

- [ ] **Step 2: Create `src/shared/days.ts`** (`dayKey`, `previousDay` and the milestones move here from `src/circle/stats.ts`)

```ts
/** Days are local calendar dates as "YYYY-MM-DD". */
export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The calendar day before `day` ("YYYY-MM-DD"), worked out in UTC so clock changes don't matter. */
export function previousDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const before = new Date(Date.UTC(y, m - 1, d) - 24 * 60 * 60 * 1000);
  return before.toISOString().slice(0, 10);
}

const MILESTONES = [10, 25, 50, 100, 250, 500, 750, 1000];
/** After 1,000, every 500th is a milestone too. */
const LATE_MILESTONE_EVERY = 500;

export function isMilestone(n: number): boolean {
  return MILESTONES.includes(n) || (n > 1000 && n % LATE_MILESTONE_EVERY === 0);
}

/** Days in a row on which she finished something, in either game. */
export interface PlayDays {
  streakDays: number;
  lastPlayedDay: string | null;
}

/** Marks `day` as played. A missed day quietly starts the count over; nothing ever says a streak was lost. */
export function recordPlayDay(days: PlayDays, day: string): PlayDays {
  if (days.lastPlayedDay === day) return { streakDays: Math.max(1, days.streakDays), lastPlayedDay: day };
  const streakDays = days.lastPlayedDay === previousDay(day) ? days.streakDays + 1 : 1;
  return { streakDays, lastPlayedDay: day };
}
```

- [ ] **Step 3: Use it from Word Circle**

In `src/circle/stats.ts`: delete the `MILESTONES` and `LATE_MILESTONE_EVERY` constants and the `dayKey`, `previousDay` and `isMilestone` functions, and add at the top:

```ts
import { isMilestone, previousDay } from '../shared/days';
```

In `src/circle/screen.ts` replace `import { dayKey, emptyStats, recordSolve } from './stats';` with:

```ts
import { dayKey } from '../shared/days';
import { emptyStats, recordSolve } from './stats';
```

In `tests/stats.test.ts` replace `import { dayKey, emptyStats, formatDuration, previousDay, recordSolve, type Stats } from '../src/circle/stats';` with:

```ts
import { emptyStats, formatDuration, recordSolve, type Stats } from '../src/circle/stats';
import { dayKey, previousDay } from '../src/shared/days';
```

- [ ] **Step 4: Run all tests and the type check**

```bash
npx tsc --noEmit && npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/days.ts src/circle/stats.ts src/circle/screen.ts tests/days.test.ts tests/stats.test.ts
git commit -m "feat: shared days-in-a-row and milestones for both games

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 11: Pressed look for buttons in the touch tracker

**Files:**
- Modify: `src/input/touch.ts`, `tests/touch.test.ts`

- [ ] **Step 1: Write the failing tests** — append to `tests/touch.test.ts`:

```ts
describe('pressed buttons', () => {
  function pressSetup() {
    const events: string[] = [];
    const tracer = new LetterTracer({
      letterAdded: () => {},
      letterRemoved: () => {},
      wordSubmitted: () => {},
      selectionCleared: () => {},
      buttonTapped: (id) => events.push(`tap ${id}`),
      buttonPressed: (id) => events.push(`press ${id}`),
      buttonReleased: (id) => events.push(`release ${id}`),
    });
    tracer.setGeometry(GEOMETRY);
    return { tracer, events };
  }

  it('reports the press, its release, then the tap', () => {
    const { tracer, events } = pressSetup();
    tracer.handle({ type: 'down', id: 1, x: 390, y: 745 });
    tracer.handle({ type: 'up', id: 1, x: 390, y: 745 });
    expect(events).toEqual(['press hint', 'release hint', 'tap hint']);
  });

  it('releases without a tap when the touch is cancelled', () => {
    const { tracer, events } = pressSetup();
    tracer.handle({ type: 'down', id: 1, x: 390, y: 745 });
    tracer.handle({ type: 'cancel', id: 1, x: 390, y: 745 });
    expect(events).toEqual(['press hint', 'release hint']);
  });

  it('releases a held button when the screen changes', () => {
    const { tracer, events } = pressSetup();
    tracer.handle({ type: 'down', id: 1, x: 390, y: 745 });
    tracer.setGeometry(GEOMETRY);
    expect(events).toEqual(['press hint', 'release hint']);
  });

  it('ignores presses that start in a safe zone', () => {
    const { tracer, events } = pressSetup();
    tracer.handle({ type: 'down', id: 1, x: 60, y: 745 });
    tracer.handle({ type: 'up', id: 1, x: 60, y: 745 });
    expect(events).toEqual([]);
  });
});
```

Run: `npx vitest run tests/touch.test.ts`
Expected: FAIL (`buttonPressed` is not in `TracerCallbacks`, and no press/release events).

- [ ] **Step 2: Add the callbacks in `src/input/touch.ts`**

In `interface TracerCallbacks`, after `buttonTapped(id: string): void;` add:

```ts
  /** A finger came down on a button (so it can show its pressed look). */
  buttonPressed?(id: string): void;
  /** That finger lifted or was cancelled, or the screen changed under it. */
  buttonReleased?(id: string): void;
```

In `onDown`, replace:

```ts
    if (button !== null) {
      this.presses.set(id, { button, time });
      return;
    }
```

with:

```ts
    if (button !== null) {
      this.presses.set(id, { button, time });
      this.callbacks.buttonPressed?.(button);
      return;
    }
```

In `onEnd`, replace:

```ts
    if (press) {
      this.presses.delete(id);
```

with:

```ts
    if (press) {
      this.presses.delete(id);
      this.callbacks.buttonReleased?.(press.button);
```

Replace `reset()` with:

```ts
  private reset(): void {
    this.activeId = null;
    this.selected = [];
    for (const press of this.presses.values()) this.callbacks.buttonReleased?.(press.button);
    this.presses.clear();
  }
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run tests/touch.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/input/touch.ts tests/touch.test.ts
git commit -m "feat: tell the screen when a button is pressed and released

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 12: Word Guess rules

**Files:**
- Create: `src/guess/rules.ts`, `tests/guess-rules.test.ts`

- [ ] **Step 1: Write the failing test `tests/guess-rules.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { GuessGame, firstVisibleGuess, markGuess } from '../src/guess/rules';

const ACCEPTED = new Set(['stare', 'crane', 'pious', 'eerie', 'slate', 'slave', 'tales', 'house']);
const game = (answer = 'slate', guesses: string[] = [], hinted: number[] = []) =>
  new GuessGame(answer, guesses, hinted, (word) => ACCEPTED.has(word));
const letters = (g: GuessGame) => g.row.map((square) => square.letter || '_').join('');
const typeWord = (g: GuessGame, word: string) => [...word].forEach((letter) => g.type(letter));

describe('coloring a guess', () => {
  it('marks right, wrong-spot and missing letters', () => {
    expect(markGuess('stare', 'slate')).toEqual(['right', 'present', 'right', 'absent', 'right']);
  });

  it('marks every letter right for the answer', () => {
    expect(markGuess('slate', 'slate')).toEqual(['right', 'right', 'right', 'right', 'right']);
  });

  it('colors only as many copies of a letter as the answer has', () => {
    expect(markGuess('eerie', 'crane')).toEqual(['absent', 'absent', 'present', 'absent', 'right']);
    expect(markGuess('speed', 'abide')).toEqual(['absent', 'absent', 'present', 'absent', 'present']);
  });

  it('marks right spots before wrong spots', () => {
    expect(markGuess('lolly', 'hello')).toEqual(['absent', 'present', 'right', 'right', 'absent']);
  });
});

describe('typing', () => {
  it('fills the row left to right and stops when it is full', () => {
    const g = game();
    typeWord(g, 'sta');
    expect(letters(g)).toBe('sta__');
    expect(g.nextSquare()).toBe(3);
    typeWord(g, 're');
    expect(g.type('x')).toBe(false);
    expect(letters(g)).toBe('stare');
    expect(g.nextSquare()).toBe(-1);
  });

  it('Back removes the last letter she typed', () => {
    const g = game();
    typeWord(g, 'st');
    expect(g.back()).toBe(true);
    expect(letters(g)).toBe('s____');
    expect(g.back()).toBe(true);
    expect(g.back()).toBe(false);
  });
});

describe('checking a row', () => {
  it('says the row is incomplete when it is not full, and keeps her letters', () => {
    const g = game();
    typeWord(g, 'sta');
    expect(g.enter()).toBe('incomplete');
    expect(letters(g)).toBe('sta__');
  });

  it('keeps her letters when the word is not on the list', () => {
    const g = game();
    typeWord(g, 'staxe');
    expect(g.enter()).toBe('notAWord');
    expect(letters(g)).toBe('staxe');
    expect(g.guesses).toEqual([]);
  });

  it('makes an accepted word a guess and starts the next row with right-spot letters locked', () => {
    const g = game();
    typeWord(g, 'stare');
    expect(g.enter()).toBe('guessed');
    expect(g.guesses).toEqual(['stare']);
    expect(letters(g)).toBe('s_a_e');
    expect(g.row.map((square) => square.locked)).toEqual([true, false, true, false, true]);
  });

  it('types and erases around locked letters', () => {
    const g = game('slate', ['stare']);
    typeWord(g, 'lt');
    expect(letters(g)).toBe('slate');
    g.back();
    expect(letters(g)).toBe('sla_e');
    g.back();
    expect(letters(g)).toBe('s_a_e');
    expect(g.back()).toBe(false);
  });

  it('is solved when she types the answer', () => {
    const g = game('slate', ['stare']);
    typeWord(g, 'lt');
    expect(g.enter()).toBe('solved');
    expect(g.solved).toBe(true);
    expect(g.solvedByGuess).toBe(true);
  });

  it('accepts the answer even if it is not on the list', () => {
    const g = game('zesty');
    typeWord(g, 'zesty');
    expect(g.enter()).toBe('solved');
  });
});

describe('what she knows', () => {
  it('knows right-spot letters from every guess, and hinted squares', () => {
    expect(game('slate', ['stare', 'tales'], [1]).known()).toEqual([0, 1, 2, 4]);
  });

  it('gives each key the best color it has earned', () => {
    const keys = game('slate', ['pious', 'stare']).keyStates();
    expect(keys.get('s')).toBe('right');
    expect(keys.get('t')).toBe('present');
    expect(keys.get('r')).toBe('absent');
    expect(keys.get('p')).toBe('absent');
    expect(keys.get('l')).toBeUndefined();
  });

  it('counts hinted letters as right', () => {
    expect(game('slate', [], [1]).keyStates().get('l')).toBe('right');
  });

  it('never marks a letter in the word as missing', () => {
    expect(game('crane', ['eerie']).keyStates().get('e')).toBe('right');
  });

  it('is untouched until she types, guesses or takes a hint', () => {
    expect(game().untouched).toBe(true);
    const typed = game();
    typed.type('s');
    expect(typed.untouched).toBe(false);
    expect(game('slate', ['stare']).untouched).toBe(false);
    expect(game('slate', [], [0]).untouched).toBe(false);
  });
});

describe('hints', () => {
  it('fills the leftmost square she does not know yet, and locks it', () => {
    const g = game('slate', ['stare']);
    expect(g.hint()).toEqual({ position: 1, solved: false });
    expect(letters(g)).toBe('sla_e');
    expect(g.row[1].locked).toBe(true);
    expect(g.hinted).toEqual([1]);
  });

  it('replaces a letter she typed in that square and keeps her others', () => {
    const g = game('slate', ['stare']);
    typeWord(g, 'xy');
    expect(letters(g)).toBe('sxaye');
    g.hint();
    expect(letters(g)).toBe('slaye');
  });

  it('carries hinted letters down to the next row', () => {
    const g = game('slate', ['stare']);
    g.hint();
    typeWord(g, 'v');
    expect(g.enter()).toBe('guessed');
    expect(letters(g)).toBe('sla_e');
  });

  it('solves the word when the last unknown letter is hinted', () => {
    const g = game('slate', ['stare'], [1]);
    expect(g.hint()).toEqual({ position: 3, solved: true });
    expect(g.solved).toBe(true);
    expect(g.solvedByGuess).toBe(false);
  });

  it('has nothing to give once the word is solved', () => {
    expect(game('slate', ['slate']).hint()).toBeNull();
  });
});

describe("the board's six rows", () => {
  it('shows from the first guess until she has more than five', () => {
    expect([0, 1, 5].map(firstVisibleGuess)).toEqual([0, 0, 0]);
    expect([6, 9].map(firstVisibleGuess)).toEqual([1, 4]);
  });
});
```

Run: `npx vitest run tests/guess-rules.test.ts`
Expected: FAIL, cannot resolve `../src/guess/rules`.

- [ ] **Step 2: Create `src/guess/rules.ts`**

```ts
/** Every Word Guess word has five letters. */
export const WORD_LENGTH = 5;
/** The board always shows six rows, like Wordle. */
export const VISIBLE_ROWS = 6;

/** Wordle's colors: right letter in the right spot, right letter in the wrong spot, not in the word. */
export type Mark = 'right' | 'present' | 'absent';
/** What a keyboard key shows: the best mark its letter has earned, or nothing yet. */
export type KeyState = Mark | 'unused';

/** One square of the row she's typing. Locked squares hold letters she already knows (carried down or hinted). */
export interface Square {
  letter: string;
  locked: boolean;
}

export type EnterResult = 'incomplete' | 'notAWord' | 'guessed' | 'solved';

const RANK: Record<KeyState, number> = { unused: 0, absent: 1, present: 2, right: 3 };

/**
 * Wordle's colors for a guess: right spots first, then wrong spots, but only as many times as the answer has
 * that letter; extra copies are absent.
 */
export function markGuess(guess: string, answer: string): Mark[] {
  const marks: Mark[] = Array.from({ length: guess.length }, (): Mark => 'absent');
  const unmatched = new Map<string, number>();
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === answer[i]) marks[i] = 'right';
    else unmatched.set(answer[i], (unmatched.get(answer[i]) ?? 0) + 1);
  }
  for (let i = 0; i < guess.length; i++) {
    const left = unmatched.get(guess[i]) ?? 0;
    if (marks[i] === 'right' || left === 0) continue;
    marks[i] = 'present';
    unmatched.set(guess[i], left - 1);
  }
  return marks;
}

/** The first checked guess the board shows: it shows the last five guesses and the row she's typing. */
export function firstVisibleGuess(guessCount: number): number {
  return Math.max(0, guessCount - (VISIBLE_ROWS - 1));
}

/** One word of Word Guess: her checked guesses, hinted squares and the row she's typing. No screen code. */
export class GuessGame {
  private readonly checked: string[];
  private hints: number[];
  private current: Square[];

  constructor(
    readonly answer: string,
    guesses: readonly string[],
    hinted: readonly number[],
    private readonly isAccepted: (word: string) => boolean,
  ) {
    this.checked = [...guesses];
    this.hints = [...new Set(hinted)].filter((i) => i >= 0 && i < WORD_LENGTH).sort((a, b) => a - b);
    this.current = this.freshRow();
  }

  get guesses(): readonly string[] {
    return this.checked;
  }

  get hinted(): readonly number[] {
    return this.hints;
  }

  get row(): readonly Square[] {
    return this.current;
  }

  /** She typed the winning word herself. */
  get solvedByGuess(): boolean {
    return this.checked.length > 0 && this.checked[this.checked.length - 1] === this.answer;
  }

  /** Solved by typing the word, or by knowing every letter. */
  get solved(): boolean {
    return this.solvedByGuess || this.known().length === WORD_LENGTH;
  }

  /** Nothing guessed, hinted or typed yet. */
  get untouched(): boolean {
    return this.checked.length === 0 && this.hints.length === 0 && this.current.every((square) => square.letter === '');
  }

  /** Squares whose letter she knows: right-spot letters from any guess, and hinted squares. */
  known(): number[] {
    const known = new Set(this.hints);
    for (const guess of this.checked) {
      for (let i = 0; i < WORD_LENGTH; i++) if (guess[i] === this.answer[i]) known.add(i);
    }
    return [...known].sort((a, b) => a - b);
  }

  marks(guess: string): Mark[] {
    return markGuess(guess, this.answer);
  }

  /** The best each letter has earned (right over present over absent). Hinted letters count as right. */
  keyStates(): Map<string, KeyState> {
    const states = new Map<string, KeyState>();
    const raise = (letter: string, state: KeyState) => {
      if (RANK[state] > RANK[states.get(letter) ?? 'unused']) states.set(letter, state);
    };
    for (const guess of this.checked) markGuess(guess, this.answer).forEach((mark, i) => raise(guess[i], mark));
    for (const i of this.hints) raise(this.answer[i], 'right');
    return states;
  }

  /** The square her next letter goes in, or -1 if the row is full. */
  nextSquare(): number {
    return this.current.findIndex((square) => !square.locked && square.letter === '');
  }

  /** Puts a letter in the next empty square. False if the row is full. */
  type(letter: string): boolean {
    const at = this.nextSquare();
    if (at < 0) return false;
    this.current = this.current.map((square, i) => (i === at ? { letter, locked: false } : square));
    return true;
  }

  /** Removes the last letter she typed; never a locked one. False if there was none. */
  back(): boolean {
    for (let i = WORD_LENGTH - 1; i >= 0; i--) {
      const square = this.current[i];
      if (square.locked || square.letter === '') continue;
      this.current = this.current.map((s, j) => (j === i ? { letter: '', locked: false } : s));
      return true;
    }
    return false;
  }

  /** Checks the row. An accepted word becomes a guess, and the next row starts with every known letter. */
  enter(): EnterResult {
    if (this.current.some((square) => square.letter === '')) return 'incomplete';
    const word = this.current.map((square) => square.letter).join('');
    if (word !== this.answer && !this.isAccepted(word)) return 'notAWord';
    this.checked.push(word);
    this.current = this.freshRow();
    return word === this.answer ? 'solved' : 'guessed';
  }

  /** Puts the right letter in the leftmost square she doesn't know yet. Null if she knows every letter. */
  hint(): { position: number; solved: boolean } | null {
    const known = new Set(this.known());
    let position = -1;
    for (let i = 0; i < WORD_LENGTH && position < 0; i++) if (!known.has(i)) position = i;
    if (position < 0) return null;
    this.hints = [...this.hints, position].sort((a, b) => a - b);
    this.current = this.current.map((square, i) => (i === position ? { letter: this.answer[i], locked: true } : square));
    return { position, solved: this.known().length === WORD_LENGTH };
  }

  private freshRow(): Square[] {
    const known = new Set(this.known());
    return Array.from({ length: WORD_LENGTH }, (_, i) =>
      known.has(i) ? { letter: this.answer[i], locked: true } : { letter: '', locked: false },
    );
  }
}
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run tests/guess-rules.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/guess/rules.ts tests/guess-rules.test.ts
git commit -m "feat: Word Guess rules: colors, carried-down letters, hints, keys

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 13: Saving Word Guess

**Files:**
- Create: `tests/memory-store.ts`, `src/guess/storage.ts`, `tests/guess-storage.test.ts`

- [ ] **Step 1: Create `tests/memory-store.ts`**

```ts
import type { KeyValueStore } from '../src/shared/store';

/** An in-memory stand-in for localStorage. */
export class MemoryStore implements KeyValueStore {
  data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}
```

- [ ] **Step 2: Write the failing test `tests/guess-storage.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import {
  GUESS_KEY,
  emptyGuessStats,
  freshGuess,
  listWord,
  loadSavedGuess,
  recordGuessSolve,
  saveSavedGuess,
  type SavedGuess,
} from '../src/guess/storage';
import type { GuessWords } from '../src/guess/words';
import { MemoryStore } from './memory-store';

const WORDS: GuessWords = { answers: ['crane', 'slate', 'house'], accepted: ['crane', 'house', 'slate', 'stare'] };
const SAVED: SavedGuess = {
  index: 1,
  word: 'slate',
  daily: null,
  guesses: ['stare'],
  hinted: [1],
  dailyDone: { date: '2026-10-19', share: 'Wordle 1,948 3/6' },
  stats: { totalSolved: 12, todaySolved: 2, lastPlayedDay: '2026-10-19' },
};
const stored = (value: unknown) => {
  const store = new MemoryStore();
  store.setItem(GUESS_KEY, typeof value === 'string' ? value : JSON.stringify(value));
  return store;
};

describe('saving Word Guess', () => {
  it('starts on the first word with nothing saved', () => {
    expect(loadSavedGuess(new MemoryStore(), WORDS)).toEqual(freshGuess(WORDS));
    expect(freshGuess(WORDS).word).toBe('crane');
  });

  it('round trips her place', () => {
    const store = new MemoryStore();
    saveSavedGuess(store, SAVED);
    expect(loadSavedGuess(store, WORDS)).toEqual(SAVED);
  });

  it('starts her place fresh if the list was regenerated, keeping her counts', () => {
    expect(loadSavedGuess(stored({ ...SAVED, word: 'plant' }), WORDS)).toEqual({ ...SAVED, guesses: [], hinted: [] });
  });

  it('keeps a daily word even though it is not on the list', () => {
    const daily = { ...SAVED, word: 'pious', daily: { date: '2026-10-20', number: 1949 } };
    expect(loadSavedGuess(stored(daily), WORDS)).toEqual(daily);
  });

  it('wraps a place past the end of a shorter list', () => {
    expect(loadSavedGuess(stored({ ...SAVED, index: 4 }), WORDS)).toEqual(SAVED);
  });

  it('starts fresh if the save is damaged', () => {
    for (const bad of ['not json', 'null', { ...SAVED, guesses: ['toolong'] }, { ...SAVED, hinted: [7] }, { ...SAVED, word: 5 }]) {
      expect(loadSavedGuess(stored(bad), WORDS)).toEqual(freshGuess(WORDS));
    }
  });

  it('keeps her place even if her counts are damaged', () => {
    expect(loadSavedGuess(stored({ ...SAVED, stats: { totalSolved: -1 } }), WORDS)).toEqual({ ...SAVED, stats: emptyGuessStats() });
  });

  it('moves her place to a list word, fresh', () => {
    expect(listWord(SAVED, WORDS, 3)).toEqual({ ...SAVED, index: 0, word: 'crane', daily: null, guesses: [], hinted: [] });
  });
});

describe('counting finished words', () => {
  it('counts words today and in all', () => {
    expect(recordGuessSolve(SAVED.stats, '2026-10-19')).toEqual({ totalSolved: 13, todaySolved: 3, lastPlayedDay: '2026-10-19' });
  });

  it("starts today's count over on a new day", () => {
    expect(recordGuessSolve(SAVED.stats, '2026-10-20')).toEqual({ totalSolved: 13, todaySolved: 1, lastPlayedDay: '2026-10-20' });
  });
});
```

Run: `npx vitest run tests/guess-storage.test.ts`
Expected: FAIL, cannot resolve `../src/guess/storage`.

- [ ] **Step 3: Create `src/guess/storage.ts`**

```ts
import type { KeyValueStore } from '../shared/store';
import type { GuessWords } from './words';

export const GUESS_KEY = 'word-guess:v1';

/** The date and NYT puzzle number of a daily Wordle word. */
export interface DailyTag {
  date: string;
  number: number;
}

export interface GuessStats {
  totalSolved: number;
  todaySolved: number;
  lastPlayedDay: string | null;
}

/** Her place in Word Guess. */
export interface SavedGuess {
  /** Her place in the answer list: the list word she's on, or the next one while she's on a daily word. */
  index: number;
  /** The word she's on. */
  word: string;
  /** Set while the word is a daily Wordle word. */
  daily: DailyTag | null;
  /** Her checked guesses, in order. */
  guesses: string[];
  /** Squares filled by Hint. */
  hinted: number[];
  /** The last daily word she finished, with its text for sharing. */
  dailyDone: { date: string; share: string } | null;
  stats: GuessStats;
}

const FIVE = /^[a-z]{5}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function emptyGuessStats(): GuessStats {
  return { totalSolved: 0, todaySolved: 0, lastPlayedDay: null };
}

export function freshGuess(words: GuessWords): SavedGuess {
  return { index: 0, word: words.answers[0], daily: null, guesses: [], hinted: [], dailyDone: null, stats: emptyGuessStats() };
}

/** Her place moved to the list word at `index` (wrapping at the end), with nothing guessed yet. */
export function listWord(saved: SavedGuess, words: GuessWords, index: number): SavedGuess {
  const i = index % words.answers.length;
  return { ...saved, index: i, word: words.answers[i], daily: null, guesses: [], hinted: [] };
}

/** Counts a finished word; "today" starts over on a new day. */
export function recordGuessSolve(stats: GuessStats, day: string): GuessStats {
  return {
    totalSolved: stats.totalSolved + 1,
    todaySolved: stats.lastPlayedDay === day ? stats.todaySolved + 1 : 1,
    lastPlayedDay: day,
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isCount = (value: unknown): boolean => Number.isInteger(value) && (value as number) >= 0;
const isDay = (value: unknown): boolean => typeof value === 'string' && DAY.test(value);
const isWord = (value: unknown): boolean => typeof value === 'string' && FIVE.test(value);

/** Damaged counts never cost her progress. */
function readStats(value: unknown): GuessStats {
  if (
    isRecord(value) &&
    isCount(value.totalSolved) &&
    isCount(value.todaySolved) &&
    (value.lastPlayedDay === null || isDay(value.lastPlayedDay))
  ) {
    return {
      totalSolved: value.totalSolved as number,
      todaySolved: value.todaySolved as number,
      lastPlayedDay: value.lastPlayedDay as string | null,
    };
  }
  return emptyGuessStats();
}

function readSavedGuess(value: unknown): SavedGuess | null {
  if (!isRecord(value)) return null;
  const { index, word, daily, guesses, hinted, dailyDone } = value;
  if (!isCount(index) || !isWord(word)) return null;
  if (daily !== null && !(isRecord(daily) && isDay(daily.date) && isCount(daily.number))) return null;
  if (!Array.isArray(guesses) || !guesses.every(isWord)) return null;
  if (!Array.isArray(hinted) || !hinted.every((i) => Number.isInteger(i) && i >= 0 && i < 5)) return null;
  if (dailyDone !== null && !(isRecord(dailyDone) && isDay(dailyDone.date) && typeof dailyDone.share === 'string')) return null;
  return {
    index: index as number,
    word: word as string,
    daily: daily as DailyTag | null,
    guesses: guesses as string[],
    hinted: hinted as number[],
    dailyDone: dailyDone as SavedGuess['dailyDone'],
    stats: readStats(value.stats),
  };
}

export function loadSavedGuess(store: KeyValueStore, words: GuessWords): SavedGuess {
  try {
    const raw = store.getItem(GUESS_KEY);
    const saved = raw === null ? null : readSavedGuess(JSON.parse(raw));
    if (saved) {
      // A regenerated list may have a different word at her place: start that place fresh, as Word Circle does.
      if (saved.daily === null && words.answers[saved.index % words.answers.length] !== saved.word) {
        return listWord(saved, words, saved.index);
      }
      return { ...saved, index: saved.index % words.answers.length };
    }
  } catch {
    // Unreadable save: start fresh.
  }
  return freshGuess(words);
}

export function saveSavedGuess(store: KeyValueStore, saved: SavedGuess): void {
  try {
    store.setItem(GUESS_KEY, JSON.stringify(saved));
  } catch {
    // Storage full or unavailable: keep playing; progress just won't survive a restart.
  }
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/guess-storage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/memory-store.ts src/guess/storage.ts tests/guess-storage.test.ts
git commit -m "feat: save and restore her place in Word Guess

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 14: The daily word file and when the daily word comes up

**Files:**
- Create: `src/guess/daily.ts`, `tests/guess-daily.test.ts`

- [ ] **Step 1: Write the failing test `tests/guess-daily.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import {
  DAILY_CACHE_KEY,
  cachedDailyWords,
  dailyFor,
  finishWord,
  parseDailyWords,
  refreshDailyWords,
  swapInDaily,
  type DailyWord,
} from '../src/guess/daily';
import { emptyGuessStats, type SavedGuess } from '../src/guess/storage';
import type { GuessWords } from '../src/guess/words';
import { MemoryStore } from './memory-store';

const WORDS: GuessWords = { answers: ['crane', 'slate', 'house'], accepted: ['crane', 'house', 'slate'] };
const TODAY: DailyWord = { date: '2026-10-20', number: 1949, word: 'pious' };
const ON_LIST: SavedGuess = {
  index: 1,
  word: 'slate',
  daily: null,
  guesses: [],
  hinted: [],
  dailyDone: null,
  stats: emptyGuessStats(),
};
const ON_DAILY: SavedGuess = { ...ON_LIST, word: 'pious', daily: { date: '2026-10-20', number: 1949 }, guesses: ['stare'] };

describe('reading daily-word.txt', () => {
  it('reads one word per line', () => {
    expect(parseDailyWords('2026-10-20 1949 pious\n2026-10-21 1950 crane\n')).toEqual([
      TODAY,
      { date: '2026-10-21', number: 1950, word: 'crane' },
    ]);
  });

  it('skips lines it cannot read', () => {
    expect(parseDailyWords('# note\n2026-10-20 pious\n2026-10-20 1949 pi\n<html>\n\n2026-10-20 1949 PIOUS\r\n')).toEqual([TODAY]);
  });

  it("finds today's word", () => {
    expect(dailyFor([TODAY], '2026-10-20')).toEqual(TODAY);
    expect(dailyFor([TODAY], '2026-10-21')).toBeNull();
  });
});

describe('fetching daily-word.txt', () => {
  it('remembers what it fetched, for when the iPad is offline', async () => {
    const store = new MemoryStore();
    expect(await refreshDailyWords(async () => '2026-10-20 1949 pious', store)).toEqual([TODAY]);
    expect(store.getItem(DAILY_CACHE_KEY)).toBe('2026-10-20 1949 pious');
    expect(cachedDailyWords(store)).toEqual([TODAY]);
  });

  it('keeps the last copy when offline', async () => {
    const store = new MemoryStore();
    store.setItem(DAILY_CACHE_KEY, '2026-10-20 1949 pious');
    const fetched = await refreshDailyWords(async () => {
      throw new Error('offline');
    }, store);
    expect(fetched).toBeNull();
    expect(cachedDailyWords(store)).toEqual([TODAY]);
  });
});

describe("bringing in today's word", () => {
  it('takes the place of a list word she has not touched, keeping her place in the list', () => {
    expect(swapInDaily(ON_LIST, TODAY, true)).toEqual({ ...ON_LIST, word: 'pious', daily: { date: '2026-10-20', number: 1949 } });
  });

  it('never interrupts a word she has started', () => {
    expect(swapInDaily(ON_LIST, TODAY, false)).toBeNull();
  });

  it('does nothing without a word for today', () => {
    expect(swapInDaily(ON_LIST, null, true)).toBeNull();
  });

  it('does nothing once she has played it, or while she is on it', () => {
    expect(swapInDaily({ ...ON_LIST, dailyDone: { date: '2026-10-20', share: 'x' } }, TODAY, true)).toBeNull();
    expect(swapInDaily({ ...ON_DAILY, guesses: [] }, TODAY, true)).toBeNull();
  });

  it("replaces an earlier day's daily word she never started", () => {
    const stale: SavedGuess = { ...ON_LIST, word: 'crane', daily: { date: '2026-10-19', number: 1948 } };
    expect(swapInDaily(stale, TODAY, true)?.daily).toEqual({ date: '2026-10-20', number: 1949 });
  });
});

describe('after she finishes a word', () => {
  it('moves on to the next list word', () => {
    expect(finishWord(ON_LIST, WORDS, '2026-10-20', '', null)).toEqual({ ...ON_LIST, index: 2, word: 'house' });
  });

  it("brings in today's word next if she hasn't played it", () => {
    expect(finishWord(ON_LIST, WORDS, '2026-10-20', '', TODAY)).toEqual({
      ...ON_LIST,
      index: 2,
      word: 'pious',
      daily: { date: '2026-10-20', number: 1949 },
    });
  });

  it("remembers today's word and its share text, then goes back to the list where she was", () => {
    expect(finishWord(ON_DAILY, WORDS, '2026-10-20', 'Wordle 1,949 2/6', TODAY)).toEqual({
      ...ON_LIST,
      dailyDone: { date: '2026-10-20', share: 'Wordle 1,949 2/6' },
    });
  });

  it("finishes an earlier day's daily word like any word, then brings in today's", () => {
    const stale: SavedGuess = { ...ON_DAILY, daily: { date: '2026-10-19', number: 1948 } };
    expect(finishWord(stale, WORDS, '2026-10-20', '', TODAY)).toEqual({
      ...ON_LIST,
      word: 'pious',
      daily: { date: '2026-10-20', number: 1949 },
    });
  });

  it('wraps to the start of the list', () => {
    expect(finishWord({ ...ON_LIST, index: 2, word: 'house' }, WORDS, '2026-10-20', '', null)).toMatchObject({ index: 0, word: 'crane' });
  });
});
```

Run: `npx vitest run tests/guess-daily.test.ts`
Expected: FAIL, cannot resolve `../src/guess/daily`.

- [ ] **Step 2: Create `src/guess/daily.ts`**

```ts
import type { KeyValueStore } from '../shared/store';
import { listWord, type SavedGuess } from './storage';
import type { GuessWords } from './words';

/** One day's Wordle word, from daily-word.txt. */
export interface DailyWord {
  date: string;
  /** The NYT's puzzle number. */
  number: number;
  word: string;
}

/** The last daily-word.txt the iPad saw, so the daily word still works offline. */
export const DAILY_CACHE_KEY = 'word-guess:daily';

const LINE = /^(\d{4}-\d{2}-\d{2})\s+(\d+)\s+([a-z]{5})$/;

/** Reads daily-word.txt: one "2026-10-20 1949 crane" per line. Lines that can't be read are skipped. */
export function parseDailyWords(text: string): DailyWord[] {
  const words: DailyWord[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = LINE.exec(line.trim().toLowerCase());
    if (match) words.push({ date: match[1], number: Number(match[2]), word: match[3] });
  }
  return words;
}

export function dailyFor(words: readonly DailyWord[], day: string): DailyWord | null {
  return words.find((word) => word.date === day) ?? null;
}

export function cachedDailyWords(store: KeyValueStore): DailyWord[] {
  try {
    return parseDailyWords(store.getItem(DAILY_CACHE_KEY) ?? '');
  } catch {
    return [];
  }
}

/** Fetches daily-word.txt; returns its words, or null if it couldn't be fetched (the cached copy still stands). */
export async function refreshDailyWords(fetchText: () => Promise<string>, store: KeyValueStore): Promise<DailyWord[] | null> {
  let text: string;
  try {
    text = await fetchText();
  } catch {
    return null;
  }
  try {
    store.setItem(DAILY_CACHE_KEY, text);
  } catch {
    // Storage unavailable: use this copy for now anyway.
  }
  return parseDailyWords(text);
}

/**
 * Puts today's daily word in place of a word she hasn't touched (her place in the list stays where it is).
 * Null if nothing changes: no word today, she has started her word, or she has already played today's.
 */
export function swapInDaily(saved: SavedGuess, today: DailyWord | null, untouched: boolean): SavedGuess | null {
  if (!today || !untouched || saved.daily?.date === today.date || saved.dailyDone?.date === today.date) return null;
  return { ...saved, word: today.word, daily: { date: today.date, number: today.number }, guesses: [], hinted: [] };
}

/**
 * After she finishes her word on `day`: remembers a finished daily word (with its share text) and picks what
 * comes next, which is today's daily word if she hasn't played it, otherwise the next list word.
 */
export function finishWord(saved: SavedGuess, words: GuessWords, day: string, share: string, today: DailyWord | null): SavedGuess {
  const finishedToday = saved.daily?.date === day;
  const index = saved.daily === null ? saved.index + 1 : saved.index;
  const dailyDone = finishedToday ? { date: day, share } : saved.dailyDone;
  const next = listWord({ ...saved, dailyDone }, words, index);
  return swapInDaily(next, today, true) ?? next;
}
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run tests/guess-daily.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/guess/daily.ts tests/guess-daily.test.ts
git commit -m "feat: read the daily Wordle word and decide when it comes up

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 15: The share text

**Files:**
- Create: `src/guess/share.ts`, `tests/guess-share.test.ts`

- [ ] **Step 1: Write the failing test `tests/guess-share.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { shareText } from '../src/guess/share';

describe('the text she shares', () => {
  it("looks like Wordle's own", () => {
    expect(shareText(1948, 'slate', ['pious', 'stare', 'slate'], false)).toBe(
      'Wordle 1,948 3/6\n\n⬜⬜⬜⬜🟨\n🟩🟨🟩⬜🟩\n🟩🟩🟩🟩🟩',
    );
  });

  it('says how many tries when she needed more than six, never X/6', () => {
    const guesses = ['pious', 'crane', 'house', 'pious', 'crane', 'house', 'stare', 'slate'];
    const text = shareText(1948, 'slate', guesses, false);
    expect(text.split('\n')[0]).toBe('Wordle 1,948 in 8 tries');
    expect(text.split('\n')).toHaveLength(10);
  });

  it('ends with a green row, counted as a try, when a hint finished the word', () => {
    expect(shareText(1948, 'slate', ['stare'], true)).toBe('Wordle 1,948 2/6\n\n🟩🟨🟩⬜🟩\n🟩🟩🟩🟩🟩');
  });

  it('writes the number the way Wordle does', () => {
    expect(shareText(987, 'slate', ['slate'], false).split('\n')[0]).toBe('Wordle 987 1/6');
    expect(shareText(12345, 'slate', ['slate'], false).split('\n')[0]).toBe('Wordle 12,345 1/6');
  });
});
```

Run: `npx vitest run tests/guess-share.test.ts`
Expected: FAIL, cannot resolve `../src/guess/share`.

- [ ] **Step 2: Create `src/guess/share.ts`**

```ts
import { markGuess, type Mark } from './rules';

const SQUARES: Record<Mark, string> = { right: '🟩', present: '🟨', absent: '⬜' };

/**
 * Her result in Wordle's own format, for texting to family: "Wordle 1,948 4/6", a blank line, then one row of
 * squares per guess. More than six tries reads "in 8 tries"; a word finished by Hint ends with a green row,
 * counted as a try.
 */
export function shareText(number: number, answer: string, guesses: readonly string[], finishedByHint: boolean): string {
  const rows = guesses.map((guess) => markGuess(guess, answer).map((mark) => SQUARES[mark]).join(''));
  if (finishedByHint) rows.push(SQUARES.right.repeat(answer.length));
  const score = rows.length <= 6 ? `${rows.length}/6` : `in ${rows.length} tries`;
  return `Wordle ${number.toLocaleString('en-US')} ${score}\n\n${rows.join('\n')}`;
}
```

- [ ] **Step 3: Run the test**

Run: `npx vitest run tests/guess-share.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/guess/share.ts tests/guess-share.test.ts
git commit -m "feat: NYT-style share text for the daily Wordle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 16: Word Guess's lines of good news, and the new icons

**Files:**
- Modify: `src/ui/icons.ts`
- Create: `src/guess/celebration.ts`, `tests/guess-celebration.test.ts`

- [ ] **Step 1: Add the new icons to the end of `src/ui/icons.ts`**

```ts
export const GAMES_ICON = `<svg ${ICON_ATTRS}><path d="M4 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M14 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M4 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M14 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/></svg>`;
export const ENTER_ICON = `<svg ${ICON_ATTRS}><path d="M18 6v6a3 3 0 0 1 -3 3h-10l4 -4m0 8l-4 -4"/></svg>`;
export const BACK_ICON = `<svg ${ICON_ATTRS}><path d="M20 6a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-11l-5 -5a1.5 1.5 0 0 1 0 -2l5 -5z"/><path d="M12 10l4 4m0 -4l-4 4"/></svg>`;
export const KEYBOARD_ICON = `<svg ${ICON_ATTRS}><path d="M2 6m0 2a2 2 0 0 1 2 -2h16a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-16a2 2 0 0 1 -2 -2z"/><path d="M6 10l0 .01"/><path d="M10 10l0 .01"/><path d="M14 10l0 .01"/><path d="M18 10l0 .01"/><path d="M6 14l0 .01"/><path d="M18 14l0 .01"/><path d="M10 14l4 .01"/></svg>`;
export const TARGET_ICON = `<svg ${ICON_ATTRS}><path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0"/><path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/></svg>`;
export const NEWS_ICON = `<svg ${ICON_ATTRS}><path d="M16 6h3a1 1 0 0 1 1 1v11a2 2 0 0 1 -4 0v-12a1 1 0 0 0 -1 -1h-10a1 1 0 0 0 -1 1v12a3 3 0 0 0 3 3h11"/><path d="M8 8l4 0"/><path d="M8 12l4 0"/><path d="M8 16l4 0"/></svg>`;
export const SHARE_ICON = `<svg ${ICON_ATTRS}><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/><path d="M7 9l5 -5l5 5"/><path d="M12 4l0 12"/></svg>`;
```

- [ ] **Step 2: Write the failing test `tests/guess-celebration.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { guessLines } from '../src/guess/celebration';

const BASE = { tries: 4, typed: true, daily: false, streakDays: 1, todaySolved: 1, wordNumber: 7 };
const texts = (result: typeof BASE) => guessLines(result).map((line) => line.text);

describe("Word Guess's good news", () => {
  it('shows tries, words today and the word number', () => {
    expect(texts(BASE)).toEqual(['Got it in 4 tries', '1 word today', 'Word number 7']);
  });

  it('says "1 try" for a single try', () => {
    expect(texts({ ...BASE, tries: 1 })[0]).toBe('Got it in 1 try');
  });

  it('leaves out tries after more than six, or when a hint finished the word', () => {
    expect(texts({ ...BASE, tries: 8 })).toEqual(['1 word today', 'Word number 7']);
    expect(texts({ ...BASE, typed: false })).toEqual(['1 word today', 'Word number 7']);
  });

  it("puts today's Wordle first, highlighted, with her tries", () => {
    const lines = guessLines({ ...BASE, daily: true });
    expect(lines[0]).toMatchObject({ kind: 'row-daily', text: "Today's Wordle in 4 tries", highlight: true });
    expect(lines).toHaveLength(3);
    expect(guessLines({ ...BASE, daily: true, tries: 9 })[0].text).toBe("That was today's Wordle");
  });

  it('shows days in a row from the second day, and never more than four lines', () => {
    const lines = guessLines({ ...BASE, daily: true, streakDays: 5, todaySolved: 3 });
    expect(lines.map((line) => line.text)).toEqual(["Today's Wordle in 4 tries", '5 days in a row', '3 words today', 'Word number 7']);
  });

  it('highlights milestones', () => {
    const lines = guessLines({ ...BASE, wordNumber: 50 });
    expect(lines[lines.length - 1]).toMatchObject({ text: 'Word number 50!', highlight: true });
  });
});
```

Run: `npx vitest run tests/guess-celebration.test.ts`
Expected: FAIL, cannot resolve `../src/guess/celebration`.

- [ ] **Step 3: Create `src/guess/celebration.ts`**

```ts
import type { CelebrationLine } from '../frame/view';
import { isMilestone } from '../shared/days';
import { CALENDAR_ICON, NEWS_ICON, STAR_ICON, SUN_ICON, TARGET_ICON } from '../ui/icons';

export interface GuessResult {
  /** How many guesses she made. */
  tries: number;
  /** She typed the winning word herself (a hint didn't finish it). */
  typed: boolean;
  /** It was today's Wordle. */
  daily: boolean;
  streakDays: number;
  todaySolved: number;
  /** Word Guess words finished in all, this one included. */
  wordNumber: number;
}

/** The good news after a word: at most four lines, so the card fits under her word on every iPad. */
export function guessLines(r: GuessResult): CelebrationLine[] {
  const lines: CelebrationLine[] = [];
  const tries = r.typed && r.tries <= 6 ? `${r.tries} ${r.tries === 1 ? 'try' : 'tries'}` : null;
  if (r.daily) {
    lines.push({
      kind: 'row-daily',
      icon: NEWS_ICON,
      text: tries ? `Today's Wordle in ${tries}` : "That was today's Wordle",
      highlight: true,
    });
  } else if (tries) {
    lines.push({ kind: 'row-tries', icon: TARGET_ICON, text: `Got it in ${tries}`, highlight: false });
  }
  if (r.streakDays >= 2) {
    lines.push({ kind: 'row-streak', icon: CALENDAR_ICON, text: `${r.streakDays} days in a row`, highlight: false });
  }
  lines.push({
    kind: 'row-today',
    icon: SUN_ICON,
    text: `${r.todaySolved} ${r.todaySolved === 1 ? 'word' : 'words'} today`,
    highlight: false,
  });
  const milestone = isMilestone(r.wordNumber);
  lines.push({ kind: 'row-number', icon: STAR_ICON, text: `Word number ${r.wordNumber}${milestone ? '!' : ''}`, highlight: milestone });
  return lines;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/guess-celebration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/icons.ts src/guess/celebration.ts tests/guess-celebration.test.ts
git commit -m "feat: Word Guess's lines of good news and its icons

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 17: Saving which game is on screen

**Files:**
- Modify: `src/frame/games.ts`
- Create: `src/frame/storage.ts`, `tests/frame-storage.test.ts`

- [ ] **Step 1: Add Word Guess's id in `src/frame/games.ts`**

Replace `export type GameId = 'circle';` with:

```ts
export const GAME_IDS = ['circle', 'guess'] as const;
export type GameId = (typeof GAME_IDS)[number];
```

- [ ] **Step 2: Write the failing test `tests/frame-storage.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { FRAME_KEY, loadSavedFrame, saveSavedFrame } from '../src/frame/storage';
import { MemoryStore } from './memory-store';

const SEED = { streakDays: 5, lastPlayedDay: '2026-10-19' };

describe('saving which game is on screen', () => {
  it("starts in Word Circle, carrying over Word Circle's days in a row", () => {
    expect(loadSavedFrame(new MemoryStore(), SEED)).toEqual({ current: 'circle', streakDays: 5, lastPlayedDay: '2026-10-19' });
  });

  it('remembers the game and the days in a row', () => {
    const store = new MemoryStore();
    saveSavedFrame(store, { current: 'guess', streakDays: 2, lastPlayedDay: '2026-10-20' });
    expect(loadSavedFrame(store, SEED)).toEqual({ current: 'guess', streakDays: 2, lastPlayedDay: '2026-10-20' });
  });

  it('falls back to Word Circle and the carried-over days if the save is damaged', () => {
    const damaged = [
      'not json',
      'null',
      '{"current":"chess","streakDays":1,"lastPlayedDay":null}',
      '{"current":"guess","streakDays":-1,"lastPlayedDay":null}',
      '{"current":"guess","streakDays":1,"lastPlayedDay":"yesterday"}',
    ];
    for (const raw of damaged) {
      const store = new MemoryStore();
      store.setItem(FRAME_KEY, raw);
      expect(loadSavedFrame(store, SEED)).toEqual({ current: 'circle', ...SEED });
    }
  });
});
```

Run: `npx vitest run tests/frame-storage.test.ts`
Expected: FAIL, cannot resolve `../src/frame/storage`.

- [ ] **Step 3: Create `src/frame/storage.ts`**

```ts
import type { PlayDays } from '../shared/days';
import type { KeyValueStore } from '../shared/store';
import { GAME_IDS, type GameId } from './games';

export const FRAME_KEY = 'word-games:v1';

/** Which game is on screen, and her days in a row across both games. */
export interface SavedFrame extends PlayDays {
  current: GameId;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Loads the frame's save. The first time (or if it's damaged), her days in a row come from `seed` (Word Circle's stats). */
export function loadSavedFrame(store: KeyValueStore, seed: PlayDays): SavedFrame {
  try {
    const raw = store.getItem(FRAME_KEY);
    const value: unknown = raw === null ? null : JSON.parse(raw);
    if (typeof value === 'object' && value !== null) {
      const { current, streakDays, lastPlayedDay } = value as Record<string, unknown>;
      if (
        GAME_IDS.includes(current as GameId) &&
        Number.isInteger(streakDays) &&
        (streakDays as number) >= 0 &&
        (lastPlayedDay === null || (typeof lastPlayedDay === 'string' && DAY.test(lastPlayedDay)))
      ) {
        return { current: current as GameId, streakDays: streakDays as number, lastPlayedDay: lastPlayedDay as string | null };
      }
    }
  } catch {
    // Unreadable save: start from the seed.
  }
  return { current: 'circle', streakDays: seed.streakDays, lastPlayedDay: seed.lastPlayedDay };
}

export function saveSavedFrame(store: KeyValueStore, saved: SavedFrame): void {
  try {
    store.setItem(FRAME_KEY, JSON.stringify(saved));
  } catch {
    // Storage full or unavailable: this session still works.
  }
}
```

- [ ] **Step 4: Run the test and the type check**

```bash
npx vitest run tests/frame-storage.test.ts && npx tsc --noEmit
```

Expected: PASS; no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/frame/games.ts src/frame/storage.ts tests/frame-storage.test.ts
git commit -m "feat: remember which game is on screen and the shared days in a row

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 17a (added at Checkpoint 2): Word Guess skip list — done

The owner chose to keep 68 touchy words out of Word Guess's answers without touching Word Circle: `words/guess-skip.txt` (read like the blocklist), passed to `buildGuessWords` as `skip` (never an answer, still accepted) and checked by `validateGuessWords`. 1,851 answers remain.

---

## Stage 3, part 2 — the screens

(Written just before building, by the owner's choice; the full code for each task is in its commit.)

### Task 18: Frame layout — Games button, Share/Next word pair, Games pop-up cards

**Files:** `src/frame/layout.ts`, `tests/frame-layout.test.ts`, `tests/circle-layout.test.ts`

- `computeFrameLayout(width, height, gameCount = 2)` adds:
  - `gamesButton`: 72 × 72, 12 px left of the clock, same row; `corner` now covers both buttons.
  - `shareButton` (290 × 100) and `nextWordButton` (400 × 100): side by side, 24 px apart, centered on the play area, on the Next button's row.
  - `gameCards`: one per game, each `min(360, (play.w − gaps) / n)` wide, 24 px apart, centered on the play area, from 20% to 76% down the card.
- Tests first (every iPad size): the Games button sits just left of the clock at the same size; `corner` spans both; Share and Next word are inside the play area, at least 96 px tall, don't overlap, and Next word is at least 360 px wide; there are two game cards, each at least 300 × 360, inside the play area, below the title (≥ card.y + 100) and at least 16 px above Close, not overlapping. Word Circle: Extra words stays at least 200 px wide.

### Task 19: Word Guess layout

**Files:** `src/guess/layout.ts`, `tests/guess-layout.test.ts`

- `computeGuessLayout(frame)` returns `rows` (6 board rows), `squareSize`, `squareGap` (8), `squareFont` (62%), `keys` (`{ id: 'key:q' … 'key:enter', 'key:back', rect }`), `keyFont` (55% of key height), `hintButton`, `allLettersButton`, `dailyButton`.
  - Keys: height `clamp(9% of screen height, 64, 84)`, width `(play.w − 9 × 8) / 10`; rows of 10, 9 (offset half a key) and Enter + 7 + Back (Enter and Back 1.5 keys wide), filling the bottom of the play area.
  - Board: squares `floor(min(110, fit by height above the keyboard less 24 px, fit by width between a 110 px left column + 24 px and the corner − 16 px))`; centered in the play area when it fits, otherwise pushed left of the corner.
  - Left column: from the play area's left edge to 24 px left of the board; Hint and All letters 96 px tall, 16 px apart; the daily button below them, up to 180 px tall.
- Tests first (every iPad size): everything in the play area; the 28 keys in Wordle's order; keys at least 64 tall and 60 wide, Enter and Back over 1.4 keys wide; keyboard spans the play area with no overlaps; squares 70–110 px; the board clear of the keys, the left buttons and the corner, at least 16 px above the keyboard; left buttons at least 110 wide and 90 tall, stacked, clear of the keys.

### Task 20: Frame view, games interface and frame controller — Games button and pop-up, Share on the card

**Files:** `src/frame/view.ts`, `src/frame/games.ts`, `src/frame/frame.ts`, `src/styles.css`, `src/circle/screen.ts`, `src/main.ts`

- `CelebrationCard` gains `word?` (shown in green squares under the title, with a smaller title and lines: class `card with-word`) and `share?: () => Promise<void>` (a Share button beside Next; the card's timer stops while sharing and restarts after).
- `FrameView`: Games button (grid icon + "Games") in the corner; `showGames(entries, current, layout)`, `placeGames`, `hideGames` for the "Pick a game" pop-up (a big card per game with a small picture, its name and an optional note; the current one with a purple border and check; Close). `--u` set on the pop-up.
- `GameScreen` gains `title`, `buttonPressed?`, `buttonReleased?`, `note?()`; `FrameHost` gains `updateTargets(targets)` and `recordPlayDay()`.
- `Frame`: takes the Word Circle stats as the seed for `loadSavedFrame`; opens the saved game; pauses the others; Games pop-up (blocked like the clock; closes itself after 60 s; tapping a card switches games: pause the old one, save `current`, redraw sliding in, resume the new one); routes `share`; forwards presses to the game; `recordPlayDay()` updates and saves the shared days in a row.
- Word Circle: `title = 'Word Circle'`; its card shows the shared days in a row (`host.recordPlayDay()`).
- Styles: Games button, pop-up, game cards and pictures, card word squares, Share button, new icon colors, and the `--present`, `--absent`, `--daily-fill` colors.

### Task 21: Word Guess view

**Files:** `src/guess/view.ts`, `src/styles.css`

- `GuessView(layer)`: `render(layout, state, animateIn)` draws the six rows of squares, the keyboard, Hint, All letters and the daily button; `setRow`, `popSquare`, `wiggleRow`, `reveal(row, squares)` (one square every 250 ms), `slideUp(rows)` (rows glide up one, the oldest fades away upward, a fresh row fades in; 500 ms), `setKeys(states, allLetters)` (green/gold borders; letters not in the word hidden unless All letters is on, then gray), `setPressed`, `setHintPulse`, `setAllLetters` (purple border thickens, check icon), `setDaily('none' | 'label' | 'share')`.
- Styles as in the spec's color table.

### Task 22: Word Guess screen and wiring

**Files:** `src/guess/screen.ts`, `src/main.ts`

- `GuessScreen(words, store, { fetchDaily, share, now? })` implements `GameScreen`: loads `word-guess:v1`; reads the cached daily words and swaps today's in if her word is untouched; fetches `daily-word.txt` at start, every 5 minutes and when the app comes back, swapping today's word in only if her word is untouched (redrawing if she's on Word Guess).
- Keys type, Back erases, Enter checks (wiggle on incomplete or unknown words; otherwise reveal, update keys and touch targets, then carry letters down or slide the rows up after the sixth guess); Hint fills a square and may finish the word; All letters toggles; the pressed look follows the touch tracker.
- Finishing: records the word, the shared days in a row, the next word (via `finishWord`, so today's Wordle comes next when it's waiting), then the "Well done!" card with her word, `guessLines`, Next word, and Share on today's Wordle (60 s instead of 15 s); afterwards redraws with the next word.
- `note()`: "Today's Wordle is ready" until she finishes it. The daily button: "Today's Wordle" label while she's on it; "Share today's Wordle" for the rest of that day once she's finished it (when sharing is possible).
- `main.ts`: both games, `fetchDaily` for `daily-word.txt`, and `share` = `navigator.share({ text })` when the iPad has it.

### Task 23: Check in the browser

At 1024×768, 1133×744, 1180×820 and 1366×1024 on `127.0.0.1`: the Games button and pop-up; switching games both ways; typing, Back, a non-word wiggle, a guess coloring in and keys hiding, carried-down letters, All letters, Hint; seven or more guesses sliding the rows; finishing a word and its card; reopening the app in the last game; Word Circle unchanged except Extra words being narrower. Console free of errors.

## Checkpoint 3 (stop here)

Show the owner Word Guess and the Games pop-up and ask them to play it in the browser.
