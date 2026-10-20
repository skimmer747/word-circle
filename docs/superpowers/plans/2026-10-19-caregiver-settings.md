# Caregiver Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any family set Word Circle up for their own parent on the iPad itself (name, thumb, games, starting level, Share, schedule, words to avoid), while Mom's iPad carries on exactly as it does today.

**Architecture:** One `Settings` object is saved in localStorage next to the games' progress. `main.ts` reads it once at startup and builds the frame and games from it. A new iPad first shows a one-page setup form; after that, holding the clock for 3 seconds opens the same page. **Done** saves and reloads. Words to avoid are skipped when a puzzle comes up, never filtered out of the lists, so saved places don't shift.

**Tech Stack:** TypeScript, Vite, vitest (node environment: no DOM in tests, so everything the page decides lives in pure functions that are tested; the DOM page is checked in the browser preview).

**Spec:** `docs/superpowers/specs/2026-10-19-caregiver-settings-design.md`

**Before you start:** another Claude session ("Word game for elderly iPad player") also edits this repo. Run `git status` before every commit and commit only your own files. **Never push**: the owner pushes after checking, because pushing updates Mom's iPad.

---

## File map

| File | What it does |
|---|---|
| `src/shared/avoid.ts` (new) | Parse the avoid box, `avoidChecker`, `firstAllowed` (skip to the next allowed puzzle) |
| `src/settings/name.ts` (new) | `cleanName`, `wellDoneTitle` (the greeting ended up in `src/clock/clock.ts`; see the end) |
| `src/settings/schedule-form.ts` (new) | Form entry → `schedule.txt` line, line → list row, drop past one-time events |
| `src/settings/settings.ts` (new) | `Settings` type, new-iPad and Mom's-iPad defaults, `loadSettings`, `saveSettings` |
| `src/settings/page.ts` (new) | The settings page (DOM) |
| `src/clock/clock.ts` | `clockFace` gains `greeting`; `formatTime` exported |
| `src/frame/layout.ts` | `Thumb`, safe zones on either side |
| `src/input/touch.ts` | Hold buttons (`holdStarted` / `holdEnded`) |
| `src/frame/games.ts` | `GAME_TITLES` |
| `src/frame/frame.ts`, `src/frame/view.ts` | Hold ring, opening settings, greeting, card title, one-game mode, schedule source |
| `src/circle/storage.ts`, `src/circle/screen.ts` | Start level, skipping avoided puzzles and extra words |
| `src/guess/storage.ts`, `src/guess/daily.ts`, `src/guess/screen.ts` | Skipping avoided answers, guesses and daily words |
| `src/grid/puzzle.ts`, `src/grid/storage.ts`, `src/grid/screen.ts` | Start level, skipping avoided puzzles |
| `src/main.ts` | First-time setup, building the app from settings |
| `src/styles.css` | Settings page, hold ring, clock greeting, card title fit |

---

### Task 1: Words to avoid

**Files:**
- Create: `src/shared/avoid.ts`
- Test: `tests/avoid.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/avoid.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { NOTHING_AVOIDED, avoidChecker, firstAllowed, parseAvoidWords } from '../src/shared/avoid';

describe('parseAvoidWords', () => {
  it('reads words separated by commas, spaces or new lines', () => {
    expect(parseAvoidWords('cancer, Funeral\nhospice  grave')).toEqual(['cancer', 'funeral', 'hospice', 'grave']);
  });

  it('drops anything that is not a letter, and repeats', () => {
    expect(parseAvoidWords(' 42, ill!, ILL; \n\n')).toEqual(['ill']);
  });

  it('reads an empty box as no words', () => {
    expect(parseAvoidWords('')).toEqual([]);
  });
});

describe('avoidChecker', () => {
  it('avoids exactly the listed words, in any case', () => {
    const avoided = avoidChecker(['grave']);
    expect(avoided('grave')).toBe(true);
    expect(avoided('GRAVE')).toBe(true);
    expect(avoided('gravel')).toBe(false);
  });

  it('avoids nothing for an empty list', () => {
    expect(avoidChecker([])).toBe(NOTHING_AVOIDED);
  });
});

describe('firstAllowed', () => {
  const list = ['a', 'b', 'c', 'd'];

  it('keeps a place that is not avoided', () => {
    expect(firstAllowed(list, 1, (x) => x === 'c')).toBe(1);
  });

  it('moves on past avoided places, wrapping at the end', () => {
    expect(firstAllowed(list, 2, (x) => x === 'c')).toBe(3);
    expect(firstAllowed(list, 3, (x) => x === 'd' || x === 'a')).toBe(1);
  });

  it('wraps a place past the end', () => {
    expect(firstAllowed(list, 5, NOTHING_AVOIDED)).toBe(1);
  });

  it('stays put if everything is avoided', () => {
    expect(firstAllowed(list, 2, () => true)).toBe(2);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/avoid.test.ts`
Expected: FAIL, "Failed to resolve import ../src/shared/avoid".

- [ ] **Step 3: Write the code**

Create `src/shared/avoid.ts`:

```ts
/** Says whether a word is one she should never see. */
export type AvoidCheck = (word: string) => boolean;

export const NOTHING_AVOIDED: AvoidCheck = () => false;

/** The words in a caregiver's "Words to avoid" box: letters only, lowercase, each once, in the order typed. */
export function parseAvoidWords(text: string): string[] {
  const words = text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((word) => word.length > 0);
  return [...new Set(words)];
}

export function avoidChecker(words: readonly string[]): AvoidCheck {
  if (words.length === 0) return NOTHING_AVOIDED;
  const avoided = new Set(words);
  return (word) => avoided.has(word.toLowerCase());
}

/**
 * The first place from `index` on (wrapping at the end) whose item isn't avoided, so saved places never shift.
 * `index` itself if every item is avoided: better an avoided word than a broken game.
 */
export function firstAllowed<T>(list: readonly T[], index: number, avoided: (item: T) => boolean): number {
  const count = list.length;
  for (let step = 0; step < count; step++) {
    const i = (index + step) % count;
    if (!avoided(list[i])) return i;
  }
  return count === 0 ? index : index % count;
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run tests/avoid.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/avoid.ts tests/avoid.test.ts
git commit -m "feat: words to avoid: parse the box, check a word, skip to the next allowed puzzle"
```

---

### Task 2: Name, greeting and card title

**Files:**
- Create: `src/settings/name.ts`
- Modify: `src/clock/clock.ts` (`ClockFace`, `formatTime`, `clockFace`)
- Test: `tests/name.test.ts`, `tests/clock.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/name.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MAX_NAME_LENGTH, cleanName, greeting, wellDoneTitle } from '../src/settings/name';

describe('cleanName', () => {
  it('tidies spaces', () => {
    expect(cleanName('  Ruth   Anne ')).toBe('Ruth Anne');
  });

  it('cuts a long name so the card title still fits', () => {
    expect(cleanName('Grandmother Josephine')).toHaveLength(MAX_NAME_LENGTH);
    expect(MAX_NAME_LENGTH).toBe(16);
  });
});

describe('greeting', () => {
  it('greets her by the time of day', () => {
    expect(greeting('Ruth', 5)).toBe('Good morning, Ruth');
    expect(greeting('Ruth', 11)).toBe('Good morning, Ruth');
    expect(greeting('Ruth', 12)).toBe('Good afternoon, Ruth');
    expect(greeting('Ruth', 17)).toBe('Good evening, Ruth');
    expect(greeting('Ruth', 23)).toBe('Good evening, Ruth');
    expect(greeting('Ruth', 3)).toBe('Good evening, Ruth');
  });

  it('says nothing without a name', () => {
    expect(greeting('', 9)).toBe('');
  });
});

describe('wellDoneTitle', () => {
  it('uses her name when there is one', () => {
    expect(wellDoneTitle('Ruth')).toBe('Well done, Ruth!');
    expect(wellDoneTitle('')).toBe('Well done!');
  });
});
```

In `tests/clock.test.ts`, replace the first `it` inside `describe('clockFace', …)`:

```ts
  it('says the time, part of day and date in plain words', () => {
    expect(clockFace(at(10, 30))).toEqual({ greeting: '', time: '10:30 AM', part: 'in the morning', date: 'Monday, October 19' });
    expect(clockFace(at(14, 5)).part).toBe('in the afternoon');
    expect(clockFace(at(18, 40)).part).toBe('in the evening');
    expect(clockFace(at(22, 0)).part).toBe('at night');
    expect(clockFace(at(3, 0)).part).toBe('at night');
  });

  it('greets her by name when it has one', () => {
    expect(clockFace(at(10, 30), 'Ruth').greeting).toBe('Good morning, Ruth');
    expect(clockFace(at(18, 40), 'Ruth').greeting).toBe('Good evening, Ruth');
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/name.test.ts tests/clock.test.ts`
Expected: FAIL. name.test can't resolve `../src/settings/name`, and clock.test's `toEqual` lacks `greeting`.

- [ ] **Step 3: Write the code**

Create `src/settings/name.ts`:

```ts
/** The longest name kept, so "Well done, …!" still fits on the card. */
export const MAX_NAME_LENGTH = 16;

/** A name as typed, tidied: no spaces at the ends or doubled, at most MAX_NAME_LENGTH characters. */
export function cleanName(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH).trim();
}

/** "Good morning, Ruth" (afternoon from noon, evening from 5 PM until 5 AM); '' without a name. */
export function greeting(name: string, hour: number): string {
  if (!name) return '';
  const part = hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 17 ? 'afternoon' : 'evening';
  return `Good ${part}, ${name}`;
}

/** The "Well done!" card's title. */
export function wellDoneTitle(name: string): string {
  return name ? `Well done, ${name}!` : 'Well done!';
}
```

In `src/clock/clock.ts`:

1. Add the import at the top: `import { greeting } from '../settings/name';`
2. In `interface ClockFace`, add before `time`:

```ts
  /** "Good morning, Ruth", or '' when no name is set. */
  greeting: string;
```

3. Change `function formatTime(` to `export function formatTime(` and give it a comment: `/** Minutes after midnight as "6:00 PM". */`
4. Replace `clockFace`:

```ts
export function clockFace(now: Date, name = ''): ClockFace {
  return {
    greeting: greeting(name, now.getHours()),
    time: formatTime(now.getHours() * 60 + now.getMinutes()),
    part: partOfDay(now.getHours()),
    date: `${DAY_NAMES[now.getDay()]}, ${MONTH_NAMES[now.getMonth()]} ${now.getDate()}`,
  };
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run tests/name.test.ts tests/clock.test.ts`
Expected: PASS.

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc`
Expected: no output.

```bash
git add src/settings/name.ts src/clock/clock.ts tests/name.test.ts tests/clock.test.ts
git commit -m "feat: her name in a greeting and the card title"
```

---

### Task 3: Schedule form

**Files:**
- Create: `src/settings/schedule-form.ts`
- Test: `tests/schedule-form.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/schedule-form.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseSchedule } from '../src/clock/schedule';
import { currentLines, eventLine, eventRow, type EventEntry } from '../src/settings/schedule-form';

const entry = (overrides: Partial<EventEntry>): EventEntry => ({
  what: 'Supper',
  repeat: 'daily',
  date: '',
  days: [],
  time: '18:00',
  ...overrides,
});

describe('eventLine', () => {
  it('writes each kind of event as a schedule.txt line', () => {
    expect(eventLine(entry({}))).toBe('every day 6:00 PM Supper');
    expect(eventLine(entry({ what: 'Phone call', repeat: 'days', days: [5, 2], time: '15:00' }))).toBe('Tue,Fri 3:00 PM Phone call');
    expect(eventLine(entry({ what: 'Doctor visit', repeat: 'once', date: '2026-10-22', time: '14:00' }))).toBe(
      '2026-10-22 2:00 PM Doctor visit',
    );
  });

  it('makes lines the clock reads back as the same event', () => {
    const [event] = parseSchedule(eventLine(entry({ what: 'Church', repeat: 'days', days: [0], time: '10:30' }))!);
    expect(event).toEqual({ name: 'Church', minutes: 630, repeat: { kind: 'weekdays', days: [0] } });
  });

  it('handles midnight and noon', () => {
    expect(eventLine(entry({ time: '00:15' }))).toBe('every day 12:15 AM Supper');
    expect(eventLine(entry({ time: '12:00' }))).toBe('every day 12:00 PM Supper');
  });

  it('tidies the name', () => {
    expect(eventLine(entry({ what: '  Supper   with  Jo ' }))).toBe('every day 6:00 PM Supper with Jo');
  });

  it('waits until everything is filled in', () => {
    expect(eventLine(entry({ what: '  ' }))).toBeNull();
    expect(eventLine(entry({ time: '' }))).toBeNull();
    expect(eventLine(entry({ repeat: 'days', days: [] }))).toBeNull();
    expect(eventLine(entry({ repeat: 'once', date: '' }))).toBeNull();
  });
});

describe('eventRow', () => {
  it('describes an event in words', () => {
    expect(eventRow('every day 6:00 PM Supper')).toBe('Supper · every day · 6:00 PM');
    expect(eventRow('Tue,Fri 3:00 PM Phone call')).toBe('Phone call · Tue, Fri · 3:00 PM');
    expect(eventRow('2026-10-22 2:00 PM Doctor visit')).toBe('Doctor visit · Thu Oct 22 · 2:00 PM');
  });

  it('gives null for a line it cannot read', () => {
    expect(eventRow('sometime Supper')).toBeNull();
  });
});

describe('currentLines', () => {
  it('drops one-time events from earlier days, and lines it cannot read', () => {
    const lines = ['every day 6:00 PM Supper', '2026-10-18 2:00 PM Old visit', '2026-10-19 2:00 PM Today visit', 'nonsense'];
    expect(currentLines(lines, '2026-10-19')).toEqual(['every day 6:00 PM Supper', '2026-10-19 2:00 PM Today visit']);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/schedule-form.test.ts`
Expected: FAIL, "Failed to resolve import ../src/settings/schedule-form".

- [ ] **Step 3: Write the code**

Create `src/settings/schedule-form.ts`:

```ts
import { formatTime } from '../clock/clock';
import { parseSchedule, type ScheduledEvent } from '../clock/schedule';

/** Weekday buttons and lines, 0 = Sunday. */
export const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type RepeatChoice = 'once' | 'daily' | 'days';

/** What the caregiver filled in under "Add event". */
export interface EventEntry {
  what: string;
  repeat: RepeatChoice;
  /** "2026-10-22", from the date picker (Once only). */
  date: string;
  /** 0 = Sunday ... 6 = Saturday (Some days only). */
  days: number[];
  /** "18:00", from the time picker. */
  time: string;
}

/** The entry as a schedule.txt line ("every day 6:00 PM Supper"), or null until it's all filled in. */
export function eventLine(entry: EventEntry): string | null {
  const what = entry.what.replace(/\s+/g, ' ').trim();
  const time = /^(\d{2}):(\d{2})$/.exec(entry.time);
  if (!what || !time) return null;
  let when: string;
  if (entry.repeat === 'daily') {
    when = 'every day';
  } else if (entry.repeat === 'days') {
    const days = [...new Set(entry.days)].filter((day) => day >= 0 && day <= 6).sort((a, b) => a - b);
    if (days.length === 0) return null;
    when = days.map((day) => WEEKDAY_NAMES[day]).join(',');
  } else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) return null;
    when = entry.date;
  }
  const line = `${when} ${formatTime(Number(time[1]) * 60 + Number(time[2]))} ${what}`;
  // The clock's own reader has the last word, so a line it can't read is never saved.
  return parseSchedule(line).length === 1 ? line : null;
}

function repeatText({ repeat }: ScheduledEvent): string {
  if (repeat.kind === 'daily') return 'every day';
  if (repeat.kind === 'weekdays') return repeat.days.map((day) => WEEKDAY_NAMES[day]).join(', ');
  const [year, month, day] = repeat.date.split('-').map(Number);
  return `${WEEKDAY_NAMES[new Date(year, month - 1, day).getDay()]} ${MONTH_NAMES[month - 1]} ${day}`;
}

/** "Supper · every day · 6:00 PM", for the list of events; null for a line that can't be read. */
export function eventRow(line: string): string | null {
  const [event] = parseSchedule(line);
  if (!event) return null;
  return `${event.name} · ${repeatText(event)} · ${formatTime(event.minutes)}`;
}

/** The lines still worth listing on `today` ("2026-10-19"): one-time events from earlier days, and lines that can't be read, are dropped. */
export function currentLines(lines: readonly string[], today: string): string[] {
  return lines.filter((line) => {
    const [event] = parseSchedule(line);
    return event !== undefined && !(event.repeat.kind === 'date' && event.repeat.date < today);
  });
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run tests/schedule-form.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/settings/schedule-form.ts tests/schedule-form.test.ts
git commit -m "feat: schedule events from a fill-in form, written as schedule.txt lines"
```

---

### Task 4: Thumb on either side

**Files:**
- Modify: `src/frame/layout.ts:1-10` (constants), `computeFrameLayout`
- Modify: `tests/screens.ts`, `tests/frame-layout.test.ts`, `tests/circle-layout.test.ts`, `tests/guess-layout.test.ts`, `tests/grid-layout.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/screens.ts`, change the import to `import { THUMBS, type Rect } from '../src/frame/layout';` and add after `SCREENS`:

```ts
/** Every iPad, with a thumb resting on the left, on the right, or neither. */
export const SCREENS_AND_THUMBS = SCREENS.flatMap(([width, height]) => THUMBS.map((thumb) => [width, height, thumb] as const));
```

In `tests/frame-layout.test.ts`, replace the imports and the opening of the `describe.each` up to the end of the first `it`:

```ts
import { describe, expect, it } from 'vitest';
import { computeFrameLayout, SAFE_ZONE_MIN, SAFE_ZONE_THUMB } from '../src/frame/layout';
import { SCREENS, SCREENS_AND_THUMBS, inPlayArea } from './screens';

describe.each(SCREENS_AND_THUMBS)('frame layout on a %i×%i screen, thumb %s', (width, height, thumb) => {
  const frame = computeFrameLayout(width, height, 3, thumb);

  it('gives a resting thumb a wider safe zone where the screen has room, and the other sides an inch', () => {
    const wide = thumb === 'left' ? frame.safeZoneLeft : thumb === 'right' ? frame.safeZoneRight : null;
    const narrow =
      thumb === 'left' ? [frame.safeZoneRight] : thumb === 'right' ? [frame.safeZoneLeft] : [frame.safeZoneLeft, frame.safeZoneRight];
    for (const zone of narrow) expect(zone).toBe(SAFE_ZONE_MIN);
    if (wide !== null) {
      expect(wide).toBeGreaterThanOrEqual(SAFE_ZONE_MIN);
      expect(wide).toBeLessThanOrEqual(SAFE_ZONE_THUMB);
      if (width >= 1133) expect(wide).toBe(SAFE_ZONE_THUMB);
    }
  });
```

At the end of the file, add:

```ts
describe.each(SCREENS)('thumb sides on a %i×%i screen', (width, height) => {
  it('keeps the left thumb layout exactly as it was', () => {
    expect(computeFrameLayout(width, height, 3)).toEqual(computeFrameLayout(width, height, 3, 'left'));
  });

  it('mirrors the safe zones for a right thumb', () => {
    const left = computeFrameLayout(width, height, 3, 'left');
    const right = computeFrameLayout(width, height, 3, 'right');
    expect(right.safeZoneLeft).toBe(left.safeZoneRight);
    expect(right.safeZoneRight).toBe(left.safeZoneLeft);
    expect(right.play.w).toBe(left.play.w);
  });

  it('fits one game card in the Games pop-up', () => {
    const frame = computeFrameLayout(width, height, 1);
    expect(frame.gameCards).toHaveLength(1);
    expect(inPlayArea(frame.gameCards[0], frame)).toBe(true);
  });
});
```

In `tests/circle-layout.test.ts`: import `SCREENS_AND_THUMBS` instead of `SCREENS`, and change the outer block's first lines to:

```ts
describe.each(SCREENS_AND_THUMBS)('Word Circle layout on a %i×%i screen, thumb %s', (width, height, thumb) => {
  describe.each(PUZZLE_SHAPES)('with $letterCount letters and words $wordLengths', (shape) => {
    const layout = computeLayout(computeFrameLayout(width, height, 3, thumb), shape);
```

In `tests/guess-layout.test.ts`: import `SCREENS_AND_THUMBS` instead of `SCREENS`, and change the first lines to:

```ts
describe.each(SCREENS_AND_THUMBS)('Word Guess layout on a %i×%i screen, thumb %s', (width, height, thumb) => {
  const layout = computeGuessLayout(computeFrameLayout(width, height, 3, thumb));
```

In `tests/grid-layout.test.ts`: import `SCREENS_AND_THUMBS` instead of `SCREENS`, and change the first lines to:

```ts
describe.each(SCREENS_AND_THUMBS)('Word Grid layout on a %i×%i screen, thumb %s', (width, height, thumb) => {
  const frame = computeFrameLayout(width, height, 3, thumb);
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/frame-layout.test.ts`
Expected: FAIL, because `THUMBS`, `SAFE_ZONE_MIN` and `SAFE_ZONE_THUMB` aren't exported yet.

- [ ] **Step 3: Write the code**

In `src/frame/layout.ts`, replace the first five lines (the three safe-zone constants and their comments) with:

```ts
/** Every safe zone is at least about an inch wide... */
export const SAFE_ZONE_MIN = 130;
/** ...and the side a thumb rests on grows to about 1.5 inches where there's room. */
export const SAFE_ZONE_THUMB = 200;

/** Which side a thumb rests on while she plays (set on the settings page). */
export const THUMBS = ['left', 'right', 'none'] as const;
export type Thumb = (typeof THUMBS)[number];
```

Replace the start of `computeFrameLayout` (signature, `safeZoneLeft` and `play`):

```ts
export function computeFrameLayout(width: number, height: number, gameCount = 2, thumb: Thumb = 'left'): FrameLayout {
  const wide = Math.min(SAFE_ZONE_THUMB, Math.max(SAFE_ZONE_MIN, width - SAFE_ZONE_MIN - MIN_PLAY_WIDTH));
  const safeZoneLeft = thumb === 'left' ? wide : SAFE_ZONE_MIN;
  const safeZoneRight = thumb === 'right' ? wide : SAFE_ZONE_MIN;
  const play: Rect = {
    x: safeZoneLeft + MARGIN,
    y: MARGIN,
    w: width - safeZoneLeft - safeZoneRight - 2 * MARGIN,
    h: height - 2 * MARGIN,
  };
```

In the returned object, change `safeZoneRight: SAFE_ZONE_RIGHT,` to `safeZoneRight,`.

- [ ] **Step 4: Run all tests and the type check**

Run: `npm test`
Expected: PASS. The layout tests now run once per thumb side (about 3× as many).

Run: `npx tsc`
Expected: no output. If anything still imports `SAFE_ZONE_RIGHT`, `SAFE_ZONE_LEFT_TARGET` or `SAFE_ZONE_LEFT_MIN`, switch it to the new names.

- [ ] **Step 5: Commit**

```bash
git add src/frame/layout.ts tests/screens.ts tests/frame-layout.test.ts tests/circle-layout.test.ts tests/guess-layout.test.ts tests/grid-layout.test.ts
git commit -m "feat: the wider safe zone can go on the left, the right, or neither"
```

---

### Task 5: Settings: load and save

**Files:**
- Create: `src/settings/settings.ts`
- Test: `tests/settings.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/settings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { OLD_STORAGE_KEY as OLD_CIRCLE_KEY, STORAGE_KEY as CIRCLE_KEY } from '../src/circle/storage';
import { FRAME_KEY } from '../src/frame/storage';
import { GRID_KEY } from '../src/grid/storage';
import { GUESS_KEY } from '../src/guess/storage';
import {
  SETTINGS_KEY,
  loadSettings,
  momsIpadSettings,
  newIpadSettings,
  saveSettings,
  type Settings,
} from '../src/settings/settings';
import type { KeyValueStore } from '../src/shared/store';
import { MemoryStore } from './memory-store';

describe('loading settings', () => {
  it('asks for setup on a brand-new iPad', () => {
    expect(loadSettings(new MemoryStore())).toEqual({ settings: newIpadSettings(), firstTime: true });
  });

  it.each([FRAME_KEY, CIRCLE_KEY, OLD_CIRCLE_KEY, GUESS_KEY, GRID_KEY])(
    "treats an iPad with progress under %s as Mom's, and saves that",
    (key) => {
      const store = new MemoryStore();
      store.setItem(key, '{}');
      expect(loadSettings(store)).toEqual({ settings: momsIpadSettings(), firstTime: false });
      expect(JSON.parse(store.getItem(SETTINGS_KEY)!)).toEqual(momsIpadSettings());
    },
  );

  it("keeps Mom's iPad as it is: schedule.txt, left thumb, every game, Share, Word Grid from Easy", () => {
    expect(momsIpadSettings()).toEqual({
      name: '',
      thumb: 'left',
      games: ['circle', 'guess', 'grid'],
      startLevel: 'easy',
      share: true,
      schedule: { source: 'web' },
      avoid: [],
    });
  });

  it('gives new iPads a schedule of their own, never schedule.txt', () => {
    expect(newIpadSettings()).toEqual({
      name: '',
      thumb: 'left',
      games: ['circle', 'guess', 'grid'],
      startLevel: 'medium',
      share: true,
      schedule: { source: 'device', lines: [] },
      avoid: [],
    });
  });

  it('loads saved settings', () => {
    const saved: Settings = {
      name: 'Ruth',
      thumb: 'right',
      games: ['grid'],
      startLevel: 'hard',
      share: false,
      schedule: { source: 'device', lines: ['every day 6:00 PM Supper'] },
      avoid: ['grave'],
    };
    const store = new MemoryStore();
    expect(saveSettings(store, saved)).toBe(true);
    expect(loadSettings(store)).toEqual({ settings: saved, firstTime: false });
  });

  it('replaces only the damaged fields, with new-iPad defaults', () => {
    const store = new MemoryStore();
    store.setItem(
      SETTINGS_KEY,
      JSON.stringify({ name: 7, thumb: 'up', games: ['chess'], startLevel: 'expert', share: 'yes', schedule: { source: 'ftp' }, avoid: 'grave' }),
    );
    expect(loadSettings(store)).toEqual({ settings: newIpadSettings(), firstTime: false });
    store.setItem(SETTINGS_KEY, JSON.stringify({ name: 'Ruth', thumb: 'up' }));
    expect(loadSettings(store).settings).toEqual({ ...newIpadSettings(), name: 'Ruth' });
  });

  it('never goes back to setup, or to schedule.txt, after a damaged save', () => {
    const store = new MemoryStore();
    store.setItem(FRAME_KEY, '{}');
    store.setItem(SETTINGS_KEY, 'not json');
    expect(loadSettings(store)).toEqual({ settings: newIpadSettings(), firstTime: false });
  });

  it('tidies what it loads', () => {
    const store = new MemoryStore();
    store.setItem(SETTINGS_KEY, JSON.stringify({ name: '  Ruth   Anne ', games: ['grid', 'circle', 'grid'], avoid: ['Grave', 'grave', 'ill!'] }));
    expect(loadSettings(store).settings).toMatchObject({ name: 'Ruth Anne', games: ['circle', 'grid'], avoid: ['grave', 'ill'] });
  });

  it('plays with the defaults, without setup, if storage is unavailable', () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('unavailable');
      },
      setItem: () => {
        throw new Error('unavailable');
      },
    };
    expect(loadSettings(broken)).toEqual({ settings: newIpadSettings(), firstTime: false });
    expect(saveSettings(broken, newIpadSettings())).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/settings.test.ts`
Expected: FAIL, "Failed to resolve import ../src/settings/settings".

- [ ] **Step 3: Write the code**

Create `src/settings/settings.ts`:

```ts
import { OLD_STORAGE_KEY as OLD_CIRCLE_KEY, STORAGE_KEY as CIRCLE_KEY } from '../circle/storage';
import { GAME_IDS, type GameId } from '../frame/games';
import { THUMBS, type Thumb } from '../frame/layout';
import { FRAME_KEY } from '../frame/storage';
import { GRID_KEY } from '../grid/storage';
import { GUESS_KEY } from '../guess/storage';
import { parseAvoidWords } from '../shared/avoid';
import type { KeyValueStore } from '../shared/store';
import { cleanName } from './name';

export const SETTINGS_KEY = 'word-games:settings:v1';

export const START_LEVELS = ['easy', 'medium', 'hard'] as const;
export type StartLevel = (typeof START_LEVELS)[number];

/** Where the clock's events come from: schedule.txt on the site (Mom's iPad only) or lines typed on this iPad. */
export type ScheduleSetting = { source: 'web' } | { source: 'device'; lines: string[] };

/** What a caregiver sets on the settings page. */
export interface Settings {
  /** Her first name, for the card and the clock greeting; '' for none. */
  name: string;
  thumb: Thumb;
  /** The games she can pick from, in the usual order; at least one. */
  games: GameId[];
  /** Where Word Circle and Word Grid start the first time they're opened. */
  startLevel: StartLevel;
  /** Whether Word Guess offers Share after today's Wordle. */
  share: boolean;
  schedule: ScheduleSetting;
  /** Extra words kept out of every game. */
  avoid: string[];
}

export interface LoadedSettings {
  settings: Settings;
  /** True on an iPad that has never been set up or played: show the setup page first. */
  firstTime: boolean;
}

/** A new iPad starts with these. */
export function newIpadSettings(): Settings {
  return {
    name: '',
    thumb: 'left',
    games: [...GAME_IDS],
    startLevel: 'medium',
    share: true,
    schedule: { source: 'device', lines: [] },
    avoid: [],
  };
}

/**
 * Mom's iPad (it has progress from before settings existed) carries on exactly as it was: her left thumb,
 * schedule.txt from the site, and Word Grid starting on Easy as it always has (Word Circle already has her level).
 */
export function momsIpadSettings(): Settings {
  return { ...newIpadSettings(), startLevel: 'easy', schedule: { source: 'web' } };
}

/** Any of these means the iPad was played on before settings existed. */
const PROGRESS_KEYS = [FRAME_KEY, CIRCLE_KEY, OLD_CIRCLE_KEY, GUESS_KEY, GRID_KEY];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

function readSchedule(value: unknown): ScheduleSetting | null {
  if (!isRecord(value)) return null;
  if (value.source === 'web') return { source: 'web' };
  if (value.source === 'device' && Array.isArray(value.lines) && value.lines.every((line) => typeof line === 'string')) {
    return { source: 'device', lines: value.lines as string[] };
  }
  return null;
}

/** A saved copy, field by field. Anything damaged gets the new-iPad default, so a bad save never brings in schedule.txt. */
function readSettings(value: unknown): Settings {
  const settings = newIpadSettings();
  if (!isRecord(value)) return settings;
  if (typeof value.name === 'string') settings.name = cleanName(value.name);
  if (THUMBS.includes(value.thumb as Thumb)) settings.thumb = value.thumb as Thumb;
  if (Array.isArray(value.games)) {
    const saved = value.games as unknown[];
    const games = GAME_IDS.filter((id) => saved.includes(id));
    if (games.length > 0) settings.games = games;
  }
  if (START_LEVELS.includes(value.startLevel as StartLevel)) settings.startLevel = value.startLevel as StartLevel;
  if (typeof value.share === 'boolean') settings.share = value.share;
  settings.schedule = readSchedule(value.schedule) ?? settings.schedule;
  if (Array.isArray(value.avoid)) settings.avoid = parseAvoidWords(value.avoid.filter((word) => typeof word === 'string').join(' '));
  return settings;
}

function hasProgress(store: KeyValueStore): boolean {
  try {
    return PROGRESS_KEYS.some((key) => store.getItem(key) !== null);
  } catch {
    return false;
  }
}

export function loadSettings(store: KeyValueStore): LoadedSettings {
  let raw: string | null;
  try {
    raw = store.getItem(SETTINGS_KEY);
  } catch {
    // Storage unavailable: play with the defaults rather than ask for a setup that couldn't be saved.
    return { settings: newIpadSettings(), firstTime: false };
  }
  if (raw !== null) {
    let value: unknown = null;
    try {
      value = JSON.parse(raw);
    } catch {
      // Unreadable save: the defaults, below.
    }
    return { settings: readSettings(value), firstTime: false };
  }
  if (hasProgress(store)) {
    const settings = momsIpadSettings();
    saveSettings(store, settings);
    return { settings, firstTime: false };
  }
  return { settings: newIpadSettings(), firstTime: true };
}

/** Returns false if it couldn't be saved. */
export function saveSettings(store: KeyValueStore, settings: Settings): boolean {
  try {
    store.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run tests/settings.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc`
Expected: no output.

```bash
git add src/settings/settings.ts tests/settings.test.ts
git commit -m "feat: caregiver settings saved on the iPad; Mom's iPad keeps what it has"
```

---

### Task 6: Holding the clock

**Files:**
- Modify: `src/input/touch.ts` (`TracerGeometry`, `TracerCallbacks`, `Press`, `handle`, `onDown`, `onEnd`, `reset`)
- Test: `tests/touch.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/touch.test.ts`:

```ts
describe('holding the clock', () => {
  const CLOCK = { id: 'clock', x: 960, y: 16, w: 72, h: 72 };
  const clock = [996, 52] as const;

  function holdSetup() {
    const events: string[] = [];
    const tracer = new LetterTracer({
      letterAdded: () => {},
      letterRemoved: () => {},
      wordSubmitted: () => {},
      selectionCleared: () => {},
      buttonTapped: (id) => events.push(`tap ${id}`),
      holdStarted: (id) => events.push(`hold ${id}`),
      holdEnded: (id) => events.push(`end ${id}`),
    });
    tracer.setGeometry({ ...GEOMETRY, buttons: [...GEOMETRY.buttons, CLOCK], holdButtons: ['clock'] });
    const send = (type: PointerInput['type'], id: number, x: number, y: number, time?: number) =>
      tracer.handle({ type, id, x, y, time });
    return { tracer, events, send };
  }

  it('reports the hold, and still taps the clock on a quick lift', () => {
    const { events, send } = holdSetup();
    send('down', 1, ...clock, 0);
    send('up', 1, ...clock, 300);
    expect(events).toEqual(['hold clock', 'end clock', 'tap clock']);
  });

  it('ends the hold without a tap after a long press', () => {
    const { events, send } = holdSetup();
    send('down', 1, ...clock, 0);
    send('up', 1, ...clock, 3500);
    expect(events).toEqual(['hold clock', 'end clock']);
  });

  it('ends the hold as soon as the finger slides off the clock', () => {
    const { events, send } = holdSetup();
    send('down', 1, ...clock, 0);
    send('move', 1, 900, 52, 100);
    expect(events).toEqual(['hold clock', 'end clock']);
    send('up', 1, 900, 52, 200);
    expect(events).toEqual(['hold clock', 'end clock']);
  });

  it('ends the hold when the screen changes under the finger', () => {
    const { tracer, events, send } = holdSetup();
    send('down', 1, ...clock, 0);
    tracer.setEnabled(false);
    expect(events).toEqual(['hold clock', 'end clock']);
  });

  it('only reports holds on hold buttons', () => {
    const { events, send } = holdSetup();
    send('down', 1, 390, 745, 0);
    send('up', 1, 390, 745, 3500);
    expect(events).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/touch.test.ts`
Expected: FAIL. Type errors are ignored by vitest, but no `hold clock` events are reported.

- [ ] **Step 3: Write the code**

In `src/input/touch.ts`:

1. In `TracerGeometry`, after `draggables`:

```ts
  /** Buttons that also report being held down (the clock, which opens settings when held). */
  holdButtons?: readonly string[];
```

2. In `TracerCallbacks`, after `buttonReleased`:

```ts
  /** A finger came down on a hold button... */
  holdStarted?(id: string): void;
  /** ...and lifted, slid off it, or was cancelled, or the screen changed under it. */
  holdEnded?(id: string): void;
```

3. Replace `interface Press`:

```ts
interface Press {
  button: string;
  time?: number;
  /** True while the finger is still down on a hold button. */
  holding: boolean;
}
```

4. In `handle`, the `'move'` case becomes:

```ts
      case 'move':
        if (input.id === this.activeId) this.onMove(input);
        else if (input.id === this.dragging?.id) this.onDrag(input);
        else if (input.id === this.scrolling?.id) this.onScroll(input);
        else if (this.presses.get(input.id)?.holding) this.onHoldMove(input);
        return;
```

5. In `onDown`, replace the `if (button !== null) { … }` block:

```ts
    if (button !== null) {
      const holding = this.geometry.holdButtons?.includes(button) ?? false;
      this.presses.set(id, { button, time, holding });
      this.callbacks.buttonPressed?.(button);
      if (holding) this.callbacks.holdStarted?.(button);
      return;
    }
```

6. Add after `onDrag`:

```ts
  /** A finger holding a hold button slid off it: the hold is over. */
  private onHoldMove({ id, x, y }: PointerInput): void {
    const press = this.presses.get(id)!;
    if (this.buttonAt(x, y) === press.button) return;
    press.holding = false;
    this.callbacks.holdEnded?.(press.button);
  }
```

7. In `onEnd`, the press branch becomes:

```ts
    const press = this.presses.get(id);
    if (press) {
      this.presses.delete(id);
      this.callbacks.buttonReleased?.(press.button);
      if (press.holding) this.callbacks.holdEnded?.(press.button);
      const quick = press.time === undefined || time === undefined || time - press.time <= MAX_TAP_MS;
      if (submit && quick && this.buttonAt(x, y) === press.button) this.callbacks.buttonTapped(press.button);
      return;
    }
```

8. In `reset`, replace the presses loop:

```ts
    for (const press of this.presses.values()) {
      this.callbacks.buttonReleased?.(press.button);
      if (press.holding) this.callbacks.holdEnded?.(press.button);
    }
```

- [ ] **Step 4: Run all tests and the type check**

Run: `npx vitest run tests/touch.test.ts && npx tsc`
Expected: PASS; tsc prints nothing.

- [ ] **Step 5: Commit**

```bash
git add src/input/touch.ts tests/touch.test.ts
git commit -m "feat: the touch tracker reports a finger held on the clock"
```

---

### Task 7: Word Circle: start level and words to avoid

**Files:**
- Modify: `src/circle/storage.ts` (`fresh`, `loadSavedGame`, new `skipAvoided`, `withoutAvoidedBonus`)
- Modify: `src/circle/screen.ts` (constructor, `start`, `openLevel`, `loadPuzzle`, `finishPuzzle`)
- Test: `tests/storage.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/storage.test.ts`, add `skipAvoided` and `withoutAvoidedBonus` to the import from `../src/circle/storage`, add `import { NOTHING_AVOIDED, avoidChecker } from '../src/shared/avoid';`, and append:

```ts
describe('the starting level', () => {
  it('starts a new player on the chosen level', () => {
    expect(loadSavedGame(new MemoryStore(), 'easy')).toEqual({ ...FRESH, level: 'easy' });
  });

  it('keeps her own level once she has one', () => {
    const store = new MemoryStore();
    saveSavedGame(store, { ...FRESH, level: 'hard' });
    expect(loadSavedGame(store, 'easy').level).toBe('hard');
  });
});

describe('words she should never see', () => {
  const withWords = (id: string, words: string[]): Puzzle => ({ id, letters: [...id], words, bonus: [] });
  const LIST = [withWords('abcde', ['bead']), withWords('fghij', ['grave']), withWords('klmno', ['lemon'])];
  const START = { index: 1, found: ['grave'], revealed: {}, bonusFound: [], elapsedMs: 5000 };

  it('keeps her puzzle when nothing in it is avoided', () => {
    expect(skipAvoided(LIST, START, NOTHING_AVOIDED)).toBe(START);
  });

  it('moves her to the next allowed puzzle, fresh', () => {
    expect(skipAvoided(LIST, START, avoidChecker(['grave']))).toEqual({ index: 2, found: [], revealed: {}, bonusFound: [], elapsedMs: 0 });
  });

  it('drops avoided extra words and leaves the rest', () => {
    const p: Puzzle = { id: 'aelst', letters: [...'least'], words: ['last'], bonus: ['slate', 'stale'] };
    expect(withoutAvoidedBonus(p, avoidChecker(['stale'])).bonus).toEqual(['slate']);
    expect(withoutAvoidedBonus(p, NOTHING_AVOIDED)).toBe(p);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/storage.test.ts`
Expected: FAIL, because `skipAvoided` and `withoutAvoidedBonus` don't exist, and the start level is ignored.

- [ ] **Step 3: Write the code**

In `src/circle/storage.ts`:

1. Add `import { firstAllowed, type AvoidCheck } from '../shared/avoid';`
2. Replace `const fresh = …` with:

```ts
const fresh = (level: Level = 'medium'): SavedGame => ({ level, levels: {}, stats: emptyStats() });
```

3. Replace `loadSavedGame`'s signature and its two `fresh()` returns:

```ts
/** Her save, or a fresh start on `startLevel` (set on the settings page). */
export function loadSavedGame(store: KeyValueStore, startLevel: Level = 'medium'): SavedGame {
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (raw !== null) return readSavedGame(JSON.parse(raw)) ?? fresh(startLevel);
    const old = store.getItem(OLD_STORAGE_KEY);
    if (old !== null) {
      const progress: unknown = JSON.parse(old);
      if (isProgress(progress)) return { level: 'medium', levels: { medium: complete(progress) }, stats: emptyStats() };
    }
  } catch {
    // Unreadable save: start fresh.
  }
  return fresh(startLevel);
}
```

4. Append:

```ts
/** Where to start instead if a puzzle's words include one she should never see: the next puzzle without one, fresh. */
export function skipAvoided(puzzles: readonly Puzzle[], start: StartPoint, avoided: AvoidCheck): StartPoint {
  const index = firstAllowed(puzzles, start.index, (puzzle) => puzzle.words.some(avoided));
  return index === start.index ? start : { index, found: [], revealed: {}, bonusFound: [], elapsedMs: 0 };
}

/** The puzzle without extra words she should never see (they then don't count as words at all). */
export function withoutAvoidedBonus(puzzle: Puzzle, avoided: AvoidCheck): Puzzle {
  return puzzle.bonus.some(avoided) ? { ...puzzle, bonus: puzzle.bonus.filter((word) => !avoided(word)) } : puzzle;
}
```

In `src/circle/screen.ts`:

1. Add `import { NOTHING_AVOIDED, type AvoidCheck } from '../shared/avoid';` and add `skipAvoided, withoutAvoidedBonus` to the `./storage` import.
2. Above the class, add:

```ts
export interface CircleOptions {
  /** Her level the very first time (default Medium). */
  startLevel?: Level;
  /** Words she should never see: puzzles with one are skipped, and they never count as extra words. */
  avoided?: AvoidCheck;
}
```

3. Replace the constructor:

```ts
  private readonly startLevel: Level;
  private readonly avoided: AvoidCheck;

  constructor(
    private readonly puzzles: PuzzleSet,
    private readonly store: KeyValueStore,
    options: CircleOptions = {},
  ) {
    this.startLevel = options.startLevel ?? 'medium';
    this.avoided = options.avoided ?? NOTHING_AVOIDED;
  }
```

4. In `start`: `this.saved = loadSavedGame(this.store, this.startLevel);`
5. Replace `openLevel`'s body:

```ts
    this.level = level;
    const list = this.puzzles[level];
    this.loadPuzzle(skipAvoided(list, resolveStart(list, this.saved.levels[level]), this.avoided));
```

6. In `loadPuzzle`, the `Game` line becomes:

```ts
    this.game = new Game(withoutAvoidedBonus(this.puzzles[this.level][start.index], this.avoided), start.found, start.revealed, start.bonusFound);
```

7. In `finishPuzzle`, replace the `this.loadPuzzle({ … })` call:

```ts
    this.loadPuzzle(
      skipAvoided(
        this.puzzles[this.level],
        { index: nextIndex(this.index, this.puzzles[this.level].length), found: [], revealed: {}, bonusFound: [], elapsedMs: 0 },
        this.avoided,
      ),
    );
```

- [ ] **Step 4: Run all tests and the type check**

Run: `npm test && npx tsc`
Expected: PASS; tsc prints nothing.

- [ ] **Step 5: Commit**

```bash
git add src/circle/storage.ts src/circle/screen.ts tests/storage.test.ts
git commit -m "feat: Word Circle starts on the chosen level and skips avoided words"
```

---

### Task 8: Word Guess: words to avoid

**Files:**
- Modify: `src/guess/storage.ts` (`listWord`, `loadSavedGuess`)
- Modify: `src/guess/daily.ts` (`finishWord`)
- Modify: `src/guess/screen.ts` (`GuessOptions`, constructor, `start`, `today`, `finish`)
- Test: `tests/guess-storage.test.ts`, `tests/guess-daily.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/guess-storage.test.ts`, add `import { avoidChecker } from '../src/shared/avoid';` and append:

```ts
describe('words she should never see', () => {
  const avoided = avoidChecker(['slate']);

  it('skips an avoided word when moving to a place', () => {
    expect(listWord(SAVED, WORDS, 1, avoided)).toMatchObject({ index: 2, word: 'house' });
  });

  it('moves her off a word that has just been avoided, fresh', () => {
    expect(loadSavedGuess(stored(SAVED), WORDS, avoided)).toEqual({ ...SAVED, index: 2, word: 'house', guesses: [], hinted: [] });
  });

  it('moves her off an avoided daily word onto her list word', () => {
    const daily: SavedGuess = { ...SAVED, word: 'grave', daily: { date: '2026-10-20', number: 1949 } };
    expect(loadSavedGuess(stored(daily), WORDS, avoidChecker(['grave']))).toEqual({
      ...SAVED,
      word: 'slate',
      daily: null,
      guesses: [],
      hinted: [],
    });
  });

  it('starts a new player on the first word not avoided', () => {
    expect(loadSavedGuess(new MemoryStore(), WORDS, avoidChecker(['crane'])).word).toBe('slate');
  });
});
```

In `tests/guess-daily.test.ts`, add `import { avoidChecker } from '../src/shared/avoid';` and append:

```ts
describe('finishWord with words she should never see', () => {
  it('skips an avoided list word after she finishes', () => {
    expect(finishWord(ON_LIST, WORDS, '2026-10-20', '', null, avoidChecker(['house']))).toMatchObject({ index: 0, word: 'crane' });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/guess-storage.test.ts tests/guess-daily.test.ts`
Expected: FAIL, because the avoided words are still handed out.

- [ ] **Step 3: Write the code**

In `src/guess/storage.ts`:

1. Add `import { NOTHING_AVOIDED, firstAllowed, type AvoidCheck } from '../shared/avoid';`
2. Replace `listWord`:

```ts
/** Her place moved to the list word at `index` (wrapping at the end, skipping avoided words), with nothing guessed yet. */
export function listWord(saved: SavedGuess, words: GuessWords, index: number, avoided: AvoidCheck = NOTHING_AVOIDED): SavedGuess {
  const i = firstAllowed(words.answers, index % words.answers.length, avoided);
  return { ...saved, index: i, word: words.answers[i], daily: null, guesses: [], hinted: [] };
}
```

3. Replace `loadSavedGuess`:

```ts
export function loadSavedGuess(store: KeyValueStore, words: GuessWords, avoided: AvoidCheck = NOTHING_AVOIDED): SavedGuess {
  try {
    const raw = store.getItem(GUESS_KEY);
    const saved = raw === null ? null : readSavedGuess(JSON.parse(raw));
    if (saved) {
      // A word she should never see (just added on the settings page): move on to the next list word, fresh.
      if (avoided(saved.word)) return listWord(saved, words, saved.index, avoided);
      // A regenerated list may have a different word at her place: start that place fresh, as Word Circle does.
      if (saved.daily === null && words.answers[saved.index % words.answers.length] !== saved.word) {
        return listWord(saved, words, saved.index, avoided);
      }
      return { ...saved, index: saved.index % words.answers.length };
    }
  } catch {
    // Unreadable save: start fresh.
  }
  return listWord(freshGuess(words), words, 0, avoided);
}
```

In `src/guess/daily.ts`:

1. Add `import { NOTHING_AVOIDED, type AvoidCheck } from '../shared/avoid';`
2. Change `finishWord`'s signature and its `listWord` call:

```ts
export function finishWord(
  saved: SavedGuess,
  words: GuessWords,
  day: string,
  share: string,
  today: DailyWord | null,
  avoided: AvoidCheck = NOTHING_AVOIDED,
): SavedGuess {
  const finishedToday = saved.daily?.date === day;
  const index = saved.daily === null ? saved.index + 1 : saved.index;
  const dailyDone = finishedToday ? { date: day, share } : saved.dailyDone;
  const next = listWord({ ...saved, dailyDone }, words, index, avoided);
  return swapInDaily(next, today, true) ?? next;
}
```

In `src/guess/screen.ts`:

1. Add `import { NOTHING_AVOIDED, type AvoidCheck } from '../shared/avoid';`
2. In `GuessOptions`, add:

```ts
  /** Words she should never see: never an answer (not even today's Wordle) and not accepted as guesses. */
  avoided?: AvoidCheck;
```

3. Add a field `private readonly avoided: AvoidCheck;` next to `isAccepted`, and replace the constructor body:

```ts
    this.avoided = options.avoided ?? NOTHING_AVOIDED;
    const accepted = acceptedChecker(words);
    this.isAccepted = (word) => accepted(word) && !this.avoided(word);
    this.now = options.now ?? (() => new Date());
```

4. In `start`: `this.saved = loadSavedGuess(this.store, this.words, this.avoided);`
5. Replace `today()`:

```ts
  /** Today's Wordle, unless it's a word she should never see (then she gets list words, as with the blocklist). */
  private today(): DailyWord | null {
    const today = dailyFor(this.dailyWords, dayKey(this.now()));
    return today && !this.avoided(today.word) ? today : null;
  }
```

6. In `finish`: `this.saved = finishWord(this.saved, this.words, day, share, this.today(), this.avoided);`

- [ ] **Step 4: Run all tests and the type check**

Run: `npm test && npx tsc`
Expected: PASS; tsc prints nothing.

- [ ] **Step 5: Commit**

```bash
git add src/guess/storage.ts src/guess/daily.ts src/guess/screen.ts tests/guess-storage.test.ts tests/guess-daily.test.ts
git commit -m "feat: Word Guess skips avoided words, including today's Wordle"
```

---

### Task 9: Word Grid: start level and words to avoid

**Files:**
- Modify: `src/grid/puzzle.ts` (new `answerWords`)
- Modify: `src/grid/storage.ts` (`freshGrid`, `freshProgress`, `progressFor`, `nextPuzzle`, `loadSavedGrid`)
- Modify: `src/grid/screen.ts` (constructor, `start`, `loadPuzzle`, `save`, `finish`)
- Test: `tests/grid-storage.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/grid-storage.test.ts`, add `import { answerWords } from '../src/grid/puzzle';` and `import { avoidChecker } from '../src/shared/avoid';`, then append:

```ts
describe('words she should never see', () => {
  it('lists every word across and down', () => {
    expect(answerWords(puzzle('abcd'))).toEqual(['ab', 'cd', 'ac', 'bd']);
  });

  it('skips a saved puzzle with an avoided word, fresh, and keeps one without', () => {
    // Easy's saved puzzle, efgh, has "eg" down.
    expect(progressFor(SAVED, PUZZLES, 'easy', avoidChecker(['eg']))).toEqual({ index: 0, id: 'abcd', placed: [], hinted: [] });
    expect(progressFor(SAVED, PUZZLES, 'easy', avoidChecker(['ab']))).toEqual(SAVED.levels.easy);
  });

  it('skips avoided puzzles when moving on', () => {
    expect(nextPuzzle(SAVED, PUZZLES, 'medium', avoidChecker(['mn'])).levels.medium).toEqual({ index: 0, id: 'ijkl', placed: [], hinted: [] });
  });

  it('starts a new player on the chosen level', () => {
    expect(loadSavedGrid(new MemoryStore(), 'hard').level).toBe('hard');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/grid-storage.test.ts`
Expected: FAIL, because `answerWords` doesn't exist.

- [ ] **Step 3: Write the code**

In `src/grid/puzzle.ts`, append:

```ts
/** Every word across and down in the puzzle's answer. */
export function answerWords(puzzle: GridPuzzle): string[] {
  const open = [...puzzle.cells].map((ch) => ch !== '.');
  return findRuns(open, puzzle.size).map((run) => run.map((square) => puzzle.cells[square]).join(''));
}
```

In `src/grid/storage.ts`:

1. Add imports:

```ts
import { NOTHING_AVOIDED, firstAllowed, type AvoidCheck } from '../shared/avoid';
import { answerWords } from './puzzle';
```

and add `type GridPuzzle` to the existing `./types` import: `import { GRID_LEVELS, type GridLevel, type GridPuzzle, type GridPuzzleSet } from './types';`

2. Replace `freshGrid`, `freshProgress`, `progressFor` and `nextPuzzle`:

```ts
export function freshGrid(level: GridLevel = 'easy'): SavedGrid {
  return { level, levels: {}, stats: emptyGridStats() };
}

const hasAvoided = (avoided: AvoidCheck) => (puzzle: GridPuzzle) => answerWords(puzzle).some(avoided);

/** A fresh start at `index` (wrapping at the end), or at the next puzzle without a word she should never see. */
function freshProgress(puzzles: GridPuzzleSet, level: GridLevel, index: number, avoided: AvoidCheck): GridProgress {
  const list = puzzles[level];
  const i = firstAllowed(list, index % list.length, hasAvoided(avoided));
  return { index: i, id: list[i].cells, placed: [], hinted: [] };
}

/** Her place in `level`: the saved one if that puzzle is still there and allowed, otherwise that place (or the next allowed one), fresh. */
export function progressFor(saved: SavedGrid, puzzles: GridPuzzleSet, level: GridLevel, avoided: AvoidCheck = NOTHING_AVOIDED): GridProgress {
  const progress = saved.levels[level];
  if (!progress) return freshProgress(puzzles, level, 0, avoided);
  const index = progress.index % puzzles[level].length;
  const puzzle = puzzles[level][index];
  return puzzle.cells === progress.id && !hasAvoided(avoided)(puzzle)
    ? { ...progress, index }
    : freshProgress(puzzles, level, index, avoided);
}

/** Moves `level` on to its next allowed puzzle (wrapping at the end), with nothing placed. */
export function nextPuzzle(saved: SavedGrid, puzzles: GridPuzzleSet, level: GridLevel, avoided: AvoidCheck = NOTHING_AVOIDED): SavedGrid {
  const next = freshProgress(puzzles, level, progressFor(saved, puzzles, level, avoided).index + 1, avoided);
  return { ...saved, levels: { ...saved.levels, [level]: next } };
}
```

3. Change `loadSavedGrid`:

```ts
/** Her save, or a fresh start on `startLevel` (set on the settings page). */
export function loadSavedGrid(store: KeyValueStore, startLevel: GridLevel = 'easy'): SavedGrid {
  try {
    const raw = store.getItem(GRID_KEY);
    const saved = raw === null ? null : readSavedGrid(JSON.parse(raw));
    if (saved) return saved;
  } catch {
    // Unreadable save: start fresh.
  }
  return freshGrid(startLevel);
}
```

In `src/grid/screen.ts`:

1. Add `import { NOTHING_AVOIDED, type AvoidCheck } from '../shared/avoid';`
2. Above the class:

```ts
export interface GridOptions {
  /** Her level the very first time (default Easy). */
  startLevel?: GridLevel;
  /** Words she should never see: puzzles with one are skipped. */
  avoided?: AvoidCheck;
  /** The current time; tests can pass a fixed one. */
  now?: () => Date;
}
```

3. Replace the constructor:

```ts
  private readonly startLevel: GridLevel;
  private readonly avoided: AvoidCheck;
  private readonly now: () => Date;

  constructor(
    private readonly puzzles: GridPuzzleSet,
    words: GridWords,
    private readonly store: KeyValueStore,
    options: GridOptions = {},
  ) {
    this.isWord = wordChecker(words);
    this.startLevel = options.startLevel ?? 'easy';
    this.avoided = options.avoided ?? NOTHING_AVOIDED;
    this.now = options.now ?? (() => new Date());
  }
```

4. In `start`: `this.saved = loadSavedGrid(this.store, this.startLevel);`
5. In `loadPuzzle` and `save`: `progressFor(this.saved, this.puzzles, level, this.avoided)`.
6. In `finish`: `this.saved = nextPuzzle(this.saved, this.puzzles, this.saved.level, this.avoided);`

- [ ] **Step 4: Run all tests and the type check**

Run: `npm test && npx tsc`
Expected: PASS; tsc prints nothing.

- [ ] **Step 5: Commit**

```bash
git add src/grid/puzzle.ts src/grid/storage.ts src/grid/screen.ts tests/grid-storage.test.ts
git commit -m "feat: Word Grid starts on the chosen level and skips puzzles with avoided words"
```

---

### Task 10: The settings page

**Files:**
- Modify: `src/frame/games.ts` (new `GAME_TITLES`), `src/circle/screen.ts`, `src/guess/screen.ts`, `src/grid/screen.ts` (`title`)
- Create: `src/settings/page.ts`
- Modify: `src/styles.css` (append)

There's no DOM in the tests. Everything this page decides is already tested in Tasks 1–5; the page itself is checked in the browser in Task 12.

- [ ] **Step 1: One list of game names**

In `src/frame/games.ts`, after `export type GameId …`, add:

```ts
/** Each game's name, in the Games pop-up and on the settings page. */
export const GAME_TITLES: Record<GameId, string> = { circle: 'Word Circle', guess: 'Word Guess', grid: 'Word Grid' };
```

In each screen, turn the `../frame/games` import into a value import that includes `GAME_TITLES`, e.g. in `src/circle/screen.ts`: `import { GAME_TITLES, type FrameHost, type GameScreen, type GameTargets } from '../frame/games';` (same idea in the other two), and use it:
- `src/circle/screen.ts`: `readonly title = GAME_TITLES.circle;`
- `src/guess/screen.ts`: `readonly title = GAME_TITLES.guess;`
- `src/grid/screen.ts`: `readonly title = GAME_TITLES.grid;`

- [ ] **Step 2: Write the page**

Create `src/settings/page.ts`:

```ts
import { GAME_IDS, GAME_TITLES } from '../frame/games';
import { THUMBS, type Thumb } from '../frame/layout';
import { parseAvoidWords } from '../shared/avoid';
import { dayKey } from '../shared/days';
import { el } from '../ui/dom';
import { MAX_NAME_LENGTH, cleanName } from './name';
import { WEEKDAY_NAMES, currentLines, eventLine, eventRow, type EventEntry, type RepeatChoice } from './schedule-form';
import { START_LEVELS, type Settings, type StartLevel } from './settings';

/** A page opened by accident closes itself, as if Cancel was tapped, after this long untouched. */
const IDLE_CLOSE_MS = 5 * 60_000;

export interface SettingsPageOptions {
  /** First-time setup: "Set up Word Circle", Start playing, and no Cancel. */
  firstTime: boolean;
  /** Done or Start playing, with the new settings. */
  done(settings: Settings): void;
  /** Cancel, or left untouched for 5 minutes. Not offered the first time. */
  cancel(): void;
}

const THUMB_LABELS: Record<Thumb, string> = { left: 'Left', right: 'Right', none: 'Neither' };
const LEVEL_LABELS: Record<StartLevel, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const REPEATS: readonly RepeatChoice[] = ['once', 'daily', 'days'];
const REPEAT_LABELS: Record<RepeatChoice, string> = { once: 'Once', daily: 'Every day', days: 'Some days' };

function section(parent: HTMLElement, title: string): HTMLElement {
  const box = el('section', 'settings-section', parent);
  el('h2', '', box).textContent = title;
  return box;
}

function button(parent: HTMLElement, text: string, onClick: () => void, className = 'settings-button'): HTMLButtonElement {
  const node = el('button', className, parent);
  node.type = 'button';
  node.textContent = text;
  node.addEventListener('click', onClick);
  return node;
}

/** A row of buttons where one is chosen (shown pressed). */
function choices<T extends string>(
  parent: HTMLElement,
  values: readonly T[],
  label: (value: T) => string,
  current: () => T,
  choose: (value: T) => void,
): HTMLButtonElement[] {
  const row = el('div', 'settings-choices', parent);
  const buttons = values.map((value) =>
    button(
      row,
      label(value),
      () => {
        choose(value);
        mark();
      },
      'settings-choice',
    ),
  );
  const mark = () => buttons.forEach((node, i) => node.setAttribute('aria-pressed', String(values[i] === current())));
  mark();
  return buttons;
}

function field(parent: HTMLElement, label: string, type: string): HTMLInputElement {
  const box = el('label', 'settings-field', parent);
  el('span', '', box).textContent = label;
  const input = el('input', 'settings-input', box);
  input.type = type;
  return input;
}

function checkbox(parent: HTMLElement, label: string, checked: boolean, onChange: (box: HTMLInputElement) => void): HTMLInputElement {
  const row = el('label', 'settings-check', parent);
  const box = el('input', '', row);
  box.type = 'checkbox';
  box.checked = checked;
  row.append(label);
  box.addEventListener('change', () => onChange(box));
  return box;
}

/** The caregiver's settings page: ordinary controls at a comfortable size, over everything. Removes itself when closed. */
export function openSettingsPage(root: HTMLElement, settings: Settings, options: SettingsPageOptions): void {
  const today = dayKey(new Date());
  const draft = JSON.parse(JSON.stringify(settings)) as Settings;
  if (draft.schedule.source === 'device') draft.schedule = { source: 'device', lines: currentLines(draft.schedule.lines, today) };
  const entry: EventEntry = { what: '', repeat: 'once', date: today, days: [], time: '' };

  const page = el('div', 'settings-page', root);
  const sheet = el('div', 'settings-sheet', page);
  let idle = 0;
  const close = () => {
    window.clearTimeout(idle);
    page.remove();
  };
  const keepOpen = () => {
    if (options.firstTime) return;
    window.clearTimeout(idle);
    idle = window.setTimeout(() => {
      close();
      options.cancel();
    }, IDLE_CLOSE_MS);
  };
  page.addEventListener('pointerdown', keepOpen);
  page.addEventListener('input', keepOpen);
  keepOpen();

  // Only text up here: the finger that held the clock lifts over this corner.
  el('h1', 'settings-title', sheet).textContent = options.firstTime ? 'Set up Word Circle' : 'Settings';
  el('p', 'settings-tip', sheet).textContent = 'To come back here, hold the clock for 3 seconds.';

  const nameBox = section(sheet, 'Name');
  const name = el('input', 'settings-input', nameBox);
  name.type = 'text';
  name.placeholder = 'Their first name (optional)';
  name.maxLength = MAX_NAME_LENGTH;
  name.autocomplete = 'off';
  name.value = draft.name;

  const thumbBox = section(sheet, 'Does a thumb rest on the screen while they play?');
  const thumbButtons = choices(thumbBox, THUMBS, (thumb) => THUMB_LABELS[thumb], () => draft.thumb, (thumb) => (draft.thumb = thumb));
  thumbButtons.forEach((node, i) => {
    // A small screen with its safe zones shaded, the wide one where the thumb rests.
    const picture = document.createElement('span');
    picture.className = `thumb-pic ${THUMBS[i]}`;
    node.prepend(picture);
  });

  const gamesBox = section(sheet, 'Games');
  const warning = el('p', 'settings-warn', gamesBox);
  for (const id of GAME_IDS) {
    checkbox(gamesBox, GAME_TITLES[id], draft.games.includes(id), (box) => {
      const games = GAME_IDS.filter((game) => (game === id ? box.checked : draft.games.includes(game)));
      if (games.length === 0) {
        box.checked = true;
        warning.textContent = 'Keep at least one game';
        return;
      }
      warning.textContent = '';
      draft.games = games;
    });
  }
  gamesBox.append(warning);
  el('h3', '', gamesBox).textContent = 'Starting level (Word Circle and Word Grid)';
  choices(gamesBox, START_LEVELS, (level) => LEVEL_LABELS[level], () => draft.startLevel, (level) => (draft.startLevel = level));
  el('h3', '', gamesBox).textContent = 'Word Guess';
  checkbox(gamesBox, "Show Share after today's Wordle", draft.share, (box) => (draft.share = box.checked));

  const scheduleBox = section(sheet, 'Schedule');
  const scheduleBody = el('div', '', scheduleBox);
  const renderSchedule = (): void => {
    scheduleBody.replaceChildren();
    const schedule = draft.schedule;
    if (schedule.source === 'web') {
      el('p', 'settings-note', scheduleBody).textContent = 'Events come from schedule.txt on GitHub.';
      button(scheduleBody, 'Type them here instead', () => {
        draft.schedule = { source: 'device', lines: [] };
        renderSchedule();
      });
      return;
    }
    const list = el('ul', 'settings-events', scheduleBody);
    if (schedule.lines.length === 0) el('li', 'settings-empty', list).textContent = 'No events yet';
    schedule.lines.forEach((line, i) => {
      const item = el('li', 'settings-event', list);
      el('span', '', item).textContent = eventRow(line) ?? line;
      button(item, 'Delete', () => {
        schedule.lines.splice(i, 1);
        renderSchedule();
      });
    });

    const form = el('div', 'settings-add', scheduleBody);
    el('h3', '', form).textContent = 'Add event';
    const what = field(form, 'What', 'text');
    what.placeholder = 'For example, Supper';
    what.value = entry.what;
    choices(form, REPEATS, (repeat) => REPEAT_LABELS[repeat], () => entry.repeat, (repeat) => {
      entry.repeat = repeat;
      renderSchedule();
    });
    let update = () => {};
    if (entry.repeat === 'once') {
      const date = field(form, 'Date', 'date');
      date.min = today;
      date.value = entry.date;
      date.addEventListener('input', () => {
        entry.date = date.value;
        update();
      });
    }
    if (entry.repeat === 'days') {
      // Several days can be on at once, so each button keeps its own pressed look.
      const row = el('div', 'settings-choices', form);
      WEEKDAY_NAMES.forEach((dayName, day) => {
        const mark = () => node.setAttribute('aria-pressed', String(entry.days.includes(day)));
        const node = button(
          row,
          dayName,
          () => {
            entry.days = entry.days.includes(day) ? entry.days.filter((d) => d !== day) : [...entry.days, day];
            mark();
            update();
          },
          'settings-choice',
        );
        mark();
      });
    }
    const time = field(form, 'Time', 'time');
    time.value = entry.time;
    const add = button(form, 'Add', () => {
      const line = eventLine(entry);
      if (!line) return;
      schedule.lines.push(line);
      entry.what = '';
      entry.time = '';
      entry.days = [];
      renderSchedule();
    });
    update = () => {
      add.disabled = eventLine(entry) === null;
    };
    what.addEventListener('input', () => {
      entry.what = what.value;
      update();
    });
    time.addEventListener('input', () => {
      entry.time = time.value;
      update();
    });
    update();
  };
  renderSchedule();

  const avoidBox = section(sheet, 'Words to avoid');
  el('p', 'settings-note', avoidBox).textContent = 'Words to keep out of every game. Separate them with commas or new lines.';
  const avoid = el('textarea', 'settings-input', avoidBox);
  avoid.rows = 3;
  avoid.value = draft.avoid.join(', ');
  const count = el('p', 'settings-note', avoidBox);
  const showCount = () => {
    const n = draft.avoid.length;
    count.textContent = `${n} word${n === 1 ? '' : 's'}`;
  };
  avoid.addEventListener('input', () => {
    draft.avoid = parseAvoidWords(avoid.value);
    showCount();
  });
  showCount();

  const actions = el('div', 'settings-actions', sheet);
  if (!options.firstTime) {
    button(
      actions,
      'Cancel',
      () => {
        close();
        options.cancel();
      },
      'settings-cancel',
    );
  }
  button(
    actions,
    options.firstTime ? 'Start playing' : 'Done',
    () => {
      draft.name = cleanName(name.value);
      close();
      options.done(draft);
    },
    'settings-done',
  );
}
```

- [ ] **Step 3: Style it**

Append to `src/styles.css`:

```css
/* The caregiver's settings page: ordinary controls at a comfortable size, scrolling over everything.
   It's its own scroll container, so the body's touch-action: none doesn't stop it scrolling. */
.settings-page {
  position: absolute;
  inset: 0;
  z-index: 50;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-y;
  background: var(--bg);
  font-size: 20px;
  font-weight: 400;
}

/* Safari won't let her type in a field that inherits user-select: none. */
.settings-page input,
.settings-page textarea {
  -webkit-user-select: text;
  user-select: text;
  font: inherit;
}

.settings-sheet {
  box-sizing: border-box;
  max-width: 720px;
  margin: 0 auto;
  padding: 32px 24px 48px;
}

.settings-title {
  margin: 0;
  font-size: 34px;
  font-weight: 700;
  color: var(--navy);
}

.settings-tip {
  margin: 6px 0 24px;
  color: var(--label);
}

.settings-section {
  margin-bottom: 20px;
  padding: 20px;
  border-radius: 16px;
  background: #fff;
}

.settings-section h2 {
  margin: 0 0 12px;
  font-size: 22px;
  font-weight: 700;
}

.settings-section h3 {
  margin: 18px 0 8px;
  font-size: 20px;
  font-weight: 700;
}

.settings-input {
  box-sizing: border-box;
  width: 100%;
  min-height: 48px;
  padding: 8px 12px;
  border: 2px solid var(--slot-border);
  border-radius: 10px;
  background: #fff;
  color: var(--ink);
}

.settings-field {
  display: block;
  margin-top: 12px;
}

.settings-field > span {
  display: block;
  margin-bottom: 4px;
}

.settings-choices {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}

.settings-choice,
.settings-button,
.settings-cancel,
.settings-done {
  min-height: 48px;
  padding: 8px 18px;
  border: 2px solid var(--navy);
  border-radius: 10px;
  background: #fff;
  color: var(--navy);
  font: inherit;
  font-weight: 700;
}

.settings-choice[aria-pressed='true'] {
  background: var(--navy);
  color: #fff;
}

.settings-button:disabled {
  opacity: 0.4;
}

.settings-check {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 48px;
}

.settings-check input {
  width: 28px;
  height: 28px;
}

.settings-events {
  margin: 0;
  padding: 0;
  list-style: none;
}

.settings-event {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--absent-fill);
}

.settings-empty,
.settings-note {
  color: var(--label);
}

.settings-warn {
  min-height: 1.2em;
  margin: 0;
  color: var(--squiggle);
}

.settings-add {
  margin-top: 16px;
}

.settings-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.settings-done {
  border-color: var(--found);
  background: var(--found);
  color: #fff;
}

/* A little screen on each thumb button, its safe zones shaded and the wide one where the thumb rests. */
.thumb-pic {
  position: relative;
  display: block;
  width: 72px;
  height: 50px;
  margin: 2px auto 6px;
  border: 3px solid currentColor;
  border-radius: 8px;
  background: #fff;
}

.thumb-pic::before,
.thumb-pic::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 10px;
  background: var(--absent-fill);
}

.thumb-pic::before {
  left: 0;
}

.thumb-pic::after {
  right: 0;
}

.thumb-pic.left::before,
.thumb-pic.right::after {
  width: 20px;
  background: var(--present-fill);
}
```

- [ ] **Step 4: Type-check and test**

Run: `npx tsc && npm test`
Expected: tsc prints nothing; all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/frame/games.ts src/circle/screen.ts src/guess/screen.ts src/grid/screen.ts src/settings/page.ts src/styles.css
git commit -m "feat: the caregiver settings page"
```

---

### Task 11: Wire settings into the frame and main.ts

**Files:**
- Modify: `src/frame/view.ts` (`renderCorner`, `showCelebration`, `placeCelebration`, `showClock`, `updateClock`, hold ring)
- Modify: `src/frame/frame.ts` (options, hold, settings, schedule source, one-game mode)
- Modify: `src/main.ts`
- Modify: `src/styles.css` (`.card-title`, clock greeting, hold ring)

Frame and main change together so every commit builds.

- [ ] **Step 1: The view**

In `src/frame/view.ts`:

1. `renderCorner` takes whether to show Games:

```ts
  /** The Games button (only with more than one game) and the Clock button in the top-right corner. */
  renderCorner(layout: FrameLayout, showGames: boolean): void {
    this.corner.replaceChildren();
    if (showGames) {
      const games = el('button', 'games-button', this.corner);
      games.type = 'button';
      games.innerHTML = `${GAMES_ICON}<span>Games</span>`;
      place(games, layout.gamesButton);
    }
    const clock = el('button', 'clock-button', this.corner);
    clock.type = 'button';
    clock.setAttribute('aria-label', 'Clock');
    clock.innerHTML = CLOCK_ICON;
    place(clock, layout.clockButton);
  }

  /** A ring that fills around the clock over `ms` while it's held; the settings page opens when it's full. */
  showHoldRing(layout: FrameLayout, ms: number): void {
    this.hideHoldRing();
    const ring = el('div', 'hold-ring', this.corner);
    ring.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" pathLength="100"/></svg>';
    ring.style.setProperty('--hold-ms', `${ms}ms`);
    place(ring, layout.clockButton);
  }

  hideHoldRing(): void {
    this.corner.querySelector('.hold-ring')?.remove();
  }
```

2. `showCelebration` takes the title: change the signature to `showCelebration(card: CelebrationCard, layout: FrameLayout, title: string): void` and the title line to `el('div', 'card-title', box).textContent = title;`.

3. At the end of `placeCelebration`, after `this.fitCelebrationRows();`, add `this.fitCelebrationTitle();`, and add the method below `fitCelebrationRows`:

```ts
  /** Shrinks "Well done, …!" to one line if her name makes it too wide. */
  private fitCelebrationTitle(): void {
    const box = this.celebrate.querySelector<HTMLElement>('.card');
    const title = this.celebrate.querySelector<HTMLElement>('.card-title');
    if (!box || !title) return;
    title.style.fontSize = '';
    const boxStyle = getComputedStyle(box);
    const room = box.clientWidth - parseFloat(boxStyle.paddingLeft) - parseFloat(boxStyle.paddingRight) - 1;
    const scale = fitFontScale(title.scrollWidth, room, 0.4);
    if (scale < 1) title.style.fontSize = `${parseFloat(getComputedStyle(title).fontSize) * scale * FIT_SPARE}px`;
  }
```

4. In `showClock`, add the greeting line first, before `el('div', 'clock-time', card);`:

```ts
    el('div', 'clock-greeting', card);
```

and in `updateClock`, before `set('.clock-time', face.time);`:

```ts
    set('.clock-greeting', face.greeting);
```

- [ ] **Step 2: The frame**

In `src/frame/frame.ts`:

1. Imports: add

```ts
import { wellDoneTitle } from '../settings/name';
import type { ScheduleSetting } from '../settings/settings';
```

change the schedule import to `import { parseSchedule, type ScheduledEvent } from '../clock/schedule';`,

and change the layout import to `import { computeFrameLayout, type FrameLayout, type Thumb } from './layout';`.

2. Constants, after `SCHEDULE_REFRESH_MS`:

```ts
/** Holding the clock this long opens the settings page... */
const HOLD_OPEN_MS = 3000;
/** ...and a ring starts filling around it after this long, so a quick tap looks just as before. */
const HOLD_RING_MS = 500;

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
```

3. Fields, after `gamesAutoClose`:

```ts
  private settingsOpen = false;
  private holdRing = 0;
  private holdOpen = 0;
```

4. Constructor: add a last parameter `private readonly options: FrameOptions,` and two tracer callbacks after `dragCancelled`:

```ts
      holdStarted: (id) => this.holdStarted(id),
      holdEnded: (id) => this.holdEnded(id),
```

5. In `start`, replace `this.schedule = cachedSchedule(this.store);` with:

```ts
    const { schedule } = this.options;
    this.schedule = schedule.source === 'web' ? cachedSchedule(this.store) : parseSchedule(schedule.lines.join('\n'));
```

6. In `celebrate`: `if (this.layout) this.view.showCelebration(card, this.layout, wellDoneTitle(this.options.name));`
7. In `blocked()`, add `this.settingsOpen ||` to the list.
8. At the top of `refreshSchedule()`:

```ts
    // Only Mom's iPad reads schedule.txt; others have their events typed in.
    if (this.options.schedule.source !== 'web') return;
```

9. In `openClock` and `updateClock`, pass her name: `clockFace(new Date(), this.options.name)` and `clockFace(now, this.options.name)`.
10. Add after `closeClock`:

```ts
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
    this.tracer.setEnabled(false);
    this.game.pause();
    this.options.openSettings(() => this.settingsClosed());
  }

  private settingsClosed(): void {
    this.settingsOpen = false;
    this.game.resume();
    this.updateTouchTargets();
  }
```

11. In `listen()`:
- First line of `forward`'s inner function: `if (this.settingsOpen) return;`
- Replace `document.addEventListener('touchmove', block, { passive: false });` with:

```ts
    // The settings page scrolls; nothing else does.
    document.addEventListener(
      'touchmove',
      (event) => {
        if (!this.settingsOpen) event.preventDefault();
      },
      { passive: false },
    );
```

- In the `visibilitychange` handler, the `else` branch becomes:

```ts
      } else {
        if (!this.settingsOpen) this.game.resume();
        void this.refreshSchedule();
      }
```

12. In `relayout`:

```ts
    const layout = computeFrameLayout(width, height, this.games.length, this.options.thumb);
    this.layout = layout;
    this.view.renderCorner(layout, this.games.length > 1);
```

13. In `updateTouchTargets`, the `else` branch's buttons and the end of the method:

```ts
      buttons = [...this.targets.buttons, { id: 'clock', ...layout.clockButton }];
      // With one game there's no Games button.
      if (this.games.length > 1) buttons.push({ id: 'games', ...layout.gamesButton });
```

add `holdButtons: ['clock'],` to the `setGeometry` object, and change the last line to:

```ts
    this.tracer.setEnabled(!this.settingsOpen);
```

- [ ] **Step 3: main.ts**

Replace everything from `let frame: Frame | undefined;` to the end of `src/main.ts` with:

```ts
let frame: Frame | undefined;
let settingsShowing = false;
// Updates wait while she's playing, or while a caregiver is filling in the settings page.
const updates = setupUpdates(() => settingsShowing || (frame?.interacted ?? false));

function showSettings(settings: Settings, firstTime: boolean, done: (next: Settings) => void, cancel: () => void): void {
  settingsShowing = true;
  openSettingsPage(root!, settings, {
    firstTime,
    done: (next) => {
      settingsShowing = false;
      done(next);
    },
    cancel: () => {
      settingsShowing = false;
      cancel();
    },
  });
}

/** Builds the games this iPad's settings ask for, and starts. */
function startApp(settings: Settings): void {
  const avoided = avoidChecker(settings.avoid);
  const makers: Record<GameId, () => GameScreen> = {
    circle: () => new CircleScreen(puzzleData as PuzzleSet, store, { startLevel: settings.startLevel, avoided }),
    guess: () => new GuessScreen(guessWords as GuessWords, store, { fetchDaily, share: settings.share ? share : null, avoided }),
    grid: () => new GridScreen(gridPuzzles as GridPuzzleSet, gridWords as GridWords, store, { startLevel: settings.startLevel, avoided }),
  };
  frame = new Frame(root!, store, updates, settings.games.map((id) => makers[id]()), loadSavedGame(store).stats, {
    name: settings.name,
    thumb: settings.thumb,
    schedule: settings.schedule,
    openSettings: (closed) =>
      showSettings(
        settings,
        false,
        (next) => {
          saveSettings(store, next);
          // Everything is saved after every move, so she loses nothing; the app comes back built from the new settings.
          window.location.reload();
        },
        closed,
      ),
  });
  frame.start();
}

const { settings, firstTime } = loadSettings(store);
if (firstTime) {
  // Start playing goes straight in (no reload), so an iPad that can't save still gets to play.
  showSettings(
    settings,
    true,
    (next) => {
      saveSettings(store, next);
      startApp(next);
    },
    () => {},
  );
} else {
  startApp(settings);
}
```

and add these imports at the top:

```ts
import type { GameId, GameScreen } from './frame/games';
import { openSettingsPage } from './settings/page';
import { loadSettings, saveSettings, type Settings } from './settings/settings';
import { avoidChecker } from './shared/avoid';
```

(`root` is checked at the top of the file, but TypeScript doesn't carry that into functions, hence `root!`.)

- [ ] **Step 4: Styles**

In `src/styles.css`:

1. Add `white-space: nowrap;` to the `.card-title` rule (so a long name shrinks instead of wrapping).
2. Append:

```css
/* "Good morning, Ruth" at the top of the clock card; hidden when no name is set. */
.clock-greeting {
  margin-bottom: calc(var(--u) * 0.8);
  font-size: calc(var(--u) * 6.8);
  line-height: 1.15;
  color: var(--found-ink);
}

.clock-greeting:empty {
  display: none;
}

/* Fills around the clock while it's held; the settings page opens when it's full. */
.hold-ring {
  position: absolute;
  pointer-events: none;
}

.hold-ring svg {
  position: absolute;
  inset: -10px;
  width: calc(100% + 20px);
  height: calc(100% + 20px);
  transform: rotate(-90deg);
}

.hold-ring circle {
  fill: none;
  stroke: var(--select);
  stroke-width: 7;
  stroke-dasharray: 100;
  stroke-dashoffset: 100;
  animation: hold-fill var(--hold-ms) linear forwards;
}

@keyframes hold-fill {
  to {
    stroke-dashoffset: 0;
  }
}
```

- [ ] **Step 5: Type-check, test, build**

Run: `npx tsc && npm test && npm run build`
Expected: tsc prints nothing; all tests PASS; the build finishes with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/frame/view.ts src/frame/frame.ts src/main.ts src/styles.css
git commit -m "feat: hold the clock for settings; the app is built from this iPad's settings"
```

---

### Task 12: Check it in the browser at iPad sizes

Use the `word-circle-test` preview (`preview_start {name: "word-circle-test"}`; it serves http://127.0.0.1:5173/word-circle/). Read `browser-and-simulator-testing` in memory first: CSS animations can look frozen in a hidden pane, so check state with `read_page` or `javascript_tool` rather than screenshots alone.

- [ ] **Step 1: A brand-new iPad**

Set the tab to 1180×820 (`resize_window`). In `javascript_tool`: `localStorage.clear(); location.reload()`.
Expected: "Set up Word Circle" with Name, Thumb, Games, Schedule and Words to avoid, Start playing, and no Cancel. Fill in: name "Ruth", thumb Right, untick Word Guess, Starting level Hard, add "Supper / Every day / 18:00", avoid "slate". Tap Start playing.
Expected: Word Circle on Hard; the wide safe zone is on the right (`read_page` or a screenshot); the Games button is there (two games). Reload: no setup page, same settings. `localStorage.getItem('word-games:settings:v1')` shows them.

- [ ] **Step 2: The clock and the card**

Tap the clock. Expected: "Good …, Ruth" at the top, and "Supper" in the countdowns. In network requests, no `schedule.txt` fetch.
Hold the clock for 3 s by sending pointer events from `javascript_tool` (pointerdown on the clock's centre, wait 3200 ms, pointerup). Expected: the settings page opens, and nothing on it was tapped by the finger lifting.
Type the name "Margaret Josephine": the field stops at 16 characters ("Margaret Josephi"). Tap Done. Expected: the app reloads with the change. Switch to Easy and use Hint until the puzzle is solved: the card says "Well done, Margaret Josephi!" on one line, shrunk to fit.

- [ ] **Step 3: Cancel, and one game**

Hold the clock, change something, Cancel. Expected: nothing changed, and the game carries on. Hold the clock, leave only Word Grid ticked, Done. Expected: no Games button; Word Grid shows.

- [ ] **Step 4: Mom's iPad**

In `javascript_tool`: `localStorage.clear(); localStorage.setItem('word-games:v1', JSON.stringify({ current: 'circle', streakDays: 3, lastPlayedDay: '2026-10-19' })); location.reload()`.
Expected: no setup page; the wide safe zone on the left; the Games button with three games; network requests show `schedule.txt` fetched; `localStorage.getItem('word-games:settings:v1')` has `"schedule":{"source":"web"}` and `"startLevel":"easy"`. Hold the clock: the Schedule section says "Events come from schedule.txt on GitHub".

- [ ] **Step 5: Other iPad sizes and the scrolling page**

Repeat Step 1's look at 1024×768 and 1366×1024, and scroll the settings page by dragging (it must scroll; the game must not move). Check the console has no errors (`read_console_messages`).

- [ ] **Step 6: Fix anything found**

Anything that's wrong: fix it in the source, run `npm test && npx tsc`, check again, and commit each fix on its own with a message saying what it fixes.

---

### Task 13: Docs and final checks

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-10-19-caregiver-settings-design.md` (Status line)

- [ ] **Step 1: README**

In `README.md`, after the paragraph about the buttons, add:

```markdown
## Settings (for a caregiver)

Hold the clock button for 3 seconds to open the settings page: her name, which thumb rests on the screen, which games show, the starting level, Word Guess's Share button, her schedule and words to avoid. **Done** saves and restarts the app; nothing she's played is lost.
A new iPad shows this page the first time. Mom's iPad skipped it and still reads its schedule from `public/schedule.txt` (below); every other iPad keeps its schedule on the iPad itself.
```

- [ ] **Step 2: Spec status**

In the spec, change the Status line to:

```markdown
**Status:** Built 2026-10-19 (plan: `docs/superpowers/plans/2026-10-19-caregiver-settings.md`).
```

- [ ] **Step 3: Everything**

Run: `npm test && npx tsc && npm run build`
Expected: all PASS; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/superpowers/specs/2026-10-19-caregiver-settings-design.md
git commit -m "docs: caregiver settings in the README; spec marked built"
```

- [ ] **Step 5: Don't push**

Tell the owner it's ready and ask before pushing. Pushing to main updates Mom's iPad; per the publishing conventions, they decide when.

---

## Changes made while building

Reviews during the build changed a few things from the code above. The code in the repository is the record; this list says what differs and why.

- **Task 1:** `parseAvoidWords` splits only at spaces, commas, semicolons and new lines, then drops non-letters inside each word, so "can't" avoids "cant" rather than "can" and "t". `avoidChecker` lowercases its list. More `firstAllowed` fallback tests.
- **Task 2:** `greeting(name, now)` lives in `src/clock/clock.ts` and follows `partOfDay`, saying "Hello, Ruth" at night (9 PM–5 AM) so it never disagrees with "at night". `cleanName` cuts by character, so an emoji is never split. More boundary tests.
- **Task 10:** the date and time fields also listen for `change`, since the iPad's pickers may only report that when Done is tapped.
- **Task 11:** the settings page's text fields turn the iPad's press-and-hold menu back on, so Paste works.
- **Task 12:** the preview tool reads the main checkout's `.claude/launch.json`, so checking a worktree needs a temporary entry there that runs `npm --prefix <worktree> run dev` on another port.
