# Stats — Design

**Date:** 2026-10-20
**Status:** Design approved in brainstorming; not built yet.
**Builds on:** `2026-10-19-word-guess-design.md` (the frame, pop-ups, "Well done!" card), `2026-10-19-caregiver-settings-design.md` (the settings page, one-game mode), and each game's design.

## Purpose

Two views of how she's playing, kept apart:

- **Her stats**, opened from the Games pop-up: big, fun, animated, and only ever good news, like the "Well done!" card.
- **How she's doing**, a folded section on the caregiver settings page (behind the 3-second clock hold): honest weekly trends a family member can read, dips included.

Today the games keep only totals: each game's lifetime count, days in a row, and Word Circle's best time per level. There's no history, and Word Guess and Word Grid don't time anything. So this adds a **play log**, one line per finished puzzle or word, and both views read it.

**Success looks like:** she taps Games › Your stats and steps through five cheerful cards that animate as they open, with a burst of confetti when there's something new since her last look. A caregiver holds the clock and, under How she's doing, sees how her speed, hints, tries and play have gone over the last 12 weeks.

### Decisions made in brainstorming

- **Audience:** both, kept apart. Her page never shows anything getting worse; the family view is honest.
- **Her page:** big numbers and her favorite game, bests and the Wordle "got it in" chart, her garden, and fun facts. Lively: count-ups, bounces, sparkles, swaying flowers, and confetti for something new. Every move ends on its own, and Reduce Motion turns it all off.
- **Family view:** speed, help needed (hints, tries), how much she plays (per day, time of day), and which games and levels she chooses.
- **All in one release:** the log, her page and the family view ship together; the graphs fill in from that day.
- **Charts:** plain SVG and CSS, no chart library. The three game colors are the reference categorical palette's first three slots (blue, orange, aqua), which pass the palette validator all-pairs in light mode (aqua needs direct labels, so every line is labeled).

## 1. The play log

### One line per finished puzzle or word

Written when the "Well done!" card is about to show, by the game, through the frame:

```ts
interface PlayRecord {
  day: string;          // local date, "2026-10-20"
  hour: number;         // local hour finished, 0–23
  game: GameId;         // 'circle' | 'guess' | 'grid'
  level: Level | null;  // 'easy' | 'medium' | 'hard'; null for Word Guess
  ms: number;           // active play time (see Timing)
  hints: number;        // letters revealed by Hint
  tries: number;        // Word Guess guesses; 0 for the others
  typed: boolean;       // Word Guess: she typed the answer herself; true for the others
  daily: boolean;       // Word Guess: it was today's Wordle; false for the others
  words: number;        // words found: Word Circle answers + extra words; Word Grid across/down words; Word Guess 1
  letters: number;      // letters in those words
  longest: string;      // the longest of those words
  first: string;        // Word Guess: her first guess ('' if she never typed one); '' for the others
}
```

What each game supplies:

| | Word Circle | Word Guess | Word Grid |
|---|---|---|---|
| `hints` | letters revealed (sum of the revealed record) | `hinted.length` | `hinted.length` |
| `words` / `letters` / `longest` | answer words + extra words found | the answer | every across and down word (`answerWords`) |
| `tries`, `typed`, `daily`, `first` | 0, true, false, '' | from the game | 0, true, false, '' |

### Timing

Word Circle's `PlayTimer` moves from `src/circle/timer.ts` to `src/shared/timer.ts`, and Word Guess and Word Grid use it the same way: touches count, a pause counts for at most a minute, and the clock stops while the app is in the background. Each game saves the time so far with its progress (Word Guess and Word Grid get an optional `elapsedMs`, 0 for older saves). While her stats pop-up is open the game is paused, so looking at stats isn't play time.

### Storage

- **Detail:** `word-games:log:v1`, a JSON array of records, oldest first. Records older than 400 days are dropped whenever one is added.
- **Lifetime figures:** `word-games:lifetime:v1`, updated with every record and never trimmed:

```ts
interface Lifetime {
  since: string;                        // the first logged day
  daysPlayed: number;                   // distinct days with a record
  lastDay: string | null;               // to count daysPlayed
  words: number;
  letters: number;
  longestWord: string;                  // longest ever (ties: the earlier one stays)
  fewestTries: number | null;           // Word Guess, typed solves only
  triesCounts: number[];                // Word Guess typed solves by tries: index 0 = 1 try … 5 = 6 tries, 6 = 7 or more
  noHintGrids: number;                  // Word Grid puzzles with hints 0
  firstGuesses: Record<string, number>; // Word Guess first guesses
  hours: number[];                      // 24 counts, by hour finished
  mostInADay: number;                   // most records on one day
  todayCount: number;                   // records on lastDay, for mostInADay
}
```

- If storage is full or unavailable, the record is dropped quietly; the game and its own saves are unaffected.
- Damaged saves load as empty: a damaged log or lifetime record starts over.

## 2. Her stats

### Getting there

- **Games pop-up:** the single Close button becomes two: **Close** on the left (the "Well done!" card's Share position, `shareButton`) and **Your stats** on the right (`nextWordButton`), with an icon.
- **One-game mode** (no Games button): the corner shows a **Stats** button in the Games button's place instead, and it opens her stats directly.
- Her stats pop-up opens over the game like the other pop-ups, and is blocked at the same moments: while she's tracing, holding a letter, celebrating, or the game is busy.

### The pop-up

A full-screen card like the clock and Games pop-ups (sizes in `--u`, 1% of the card's height), with **Close** (`shareButton`) and **Next** (`nextWordButton`) at the bottom, tapped through the touch tracker. Next steps through the five cards and goes back to the first after the last. It opens on card 1 every time and closes itself after 2 minutes untouched. The game pauses while it's open.

### The five cards

Numbers come from the games' own saved stats where they already exist ("day one") and from the play log otherwise ("log").

1. **You've solved**
   - The big number: Word Circle + Word Guess + Word Grid totals (day one), counting up.
   - "N days in a row" when the frame's streak is 2 or more and its last played day is today or yesterday (day one).
   - "N days played" from `daysPlayed` (log), when it's at least 1.
2. **Your favorite game**
   - A podium of the games turned on in settings, the highest total in the middle with a crown, the others either side (day one). A single game stands alone with the crown.
   - Under it: "Mostly on Medium", the level with the most records for the top game in the log (not shown for Word Guess or without records).
3. **Your bests**
   - Word Circle's fastest time per level that has one (day one), each with a trophy.
   - "N Word Grids, no hints" when `noHintGrids` ≥ 1.
   - "Getting quicker at Medium!" only when, at Word Circle's most-played level, the last 7 days' average time is lower than the 7 days before, with at least 3 puzzles in each.
   - The Word Guess "got it in" chart from `triesCounts`: rows 1–6 and "7+", the most common row highlighted green. Before any typed solve: "Your Word Guess chart starts with your next word."
4. **Your garden**
   - The last 28 days, 4 rows of 7, oldest top left and today bottom right. A day with records grows a flower: small for 1–2, medium for 3–5, large for 6 or more. Other days are plain soil.
   - Caption: "N flowers in your garden", or "Your garden starts growing with today's puzzles" when there are none.
5. **Did you know?**
   - Headline: her longest word (`longestWord`, at least 5 letters) as letter tiles.
   - Then one more fact, picked by the day of the year from those that are true:
     - "You've found N words" (at least 50)
     - "You've spelled N letters" (at least 200)
     - "Your favorite first guess is CRANE" (used at least 3 times)
     - "You're a morning player" / afternoon / evening (the part of the day with the most of at least 10 records: morning 5–11, afternoon 12–16, evening 17–20; no "night player")
     - "Your most in one day: N" (at least 3)
   - With none of these yet: "Fun facts appear as you play."

### Good news only

- No wording compares her with a worse past ("slower", "fewer", "missed", "lost"). Bests are always the best ever.
- Days she didn't play are plain soil, never marked.
- Days in a row shows only when it's 2 or more, and nothing mentions an ended streak.

### What's new: confetti

`word-games:stats-seen:v1` remembers what she saw last time: Word Circle's best per level, `longestWord`, `fewestTries`, and the total. When a card opens with something new since then, it shows a "New!" badge beside it and a burst of confetti:

| Card | New when |
|---|---|
| 1 | the total passed a milestone (10, 25, 50, 100, 250, 500, 750, 1000, then every 500) since last time |
| 3 | a Word Circle level's best got faster, or `fewestTries` got lower |
| 5 | `longestWord` got longer |

The seen record is updated as each card is shown. With no seen record yet (her first visit), it's saved and nothing counts as new.

### Animations

Each card animates once as it appears, and every move ends within about 6 seconds:

| Card | Animation |
|---|---|
| 1 | the number counts up over 1.5 s, then pops (scales up and back) with a few sparkles |
| 2 | the podium columns rise with a small overshoot, staggered; the crown drops onto the winner |
| 3 | trophies sparkle in turn; Wordle bars grow left to right, staggered |
| 4 | flowers bloom with a small overshoot, staggered, then sway twice; today's flower sparkles |
| 5 | letter tiles flip in one by one |

- **Confetti:** about 40 soft-colored pieces fall from the top for about 1.5 s, once.
- **Reduce Motion** (`prefers-reduced-motion: reduce`): no animation or confetti; everything appears at once.
- No flashing, nothing loops, and nothing moves at the screen's edges.

## 3. How she's doing (family)

A folded section (`<details>`, like "Keep them in the game") on the caregiver settings page, summary "How she's doing", shown on every iPad's settings page. It works from the play log only. In ordinary page size, not her big print.

- **Before 14 days of log:** "Charts appear after about 2 weeks of play (since Oct 20)."
- **Weeks:** 12 rolling 7-day buckets ending today ("This week" is the last 7 days).
- **Most-played level:** for Word Circle and Word Grid, the level with the most records in those 12 weeks.

Contents, in order:

1. **The table:** last 28 days next to the 28 before, one row each when both periods have records:
   - "Word Circle, Medium: time per puzzle" and "Word Grid, Easy: time per puzzle" (each at that game's most-played level), and "Word Guess: time per word".
   - "Word Circle: hints per puzzle", "Word Grid: hints per puzzle", "Word Guess: tries per word".
   - "Days played: N of 28".
2. **Speed:** a line per game, weekly average active minutes per puzzle at its most-played level, with gaps for weeks without play. Each line is labeled at its end.
3. **Hints per puzzle:** Word Circle and Word Grid lines.
4. **Word Guess: tries per word:** one line. It's a separate chart, never a second axis.
5. **Puzzles per day:** 28 bars.
6. **Time of day:** morning, afternoon, evening and night shares of the last 28 days, as horizontal bars with percentages.
7. **Games she chooses:** stacked weekly bars by game, with a legend and a 2 px gap between segments.

Tapping any point or bar shows its exact value in a line under that chart ("Week of Oct 5: 1 min 12 sec per puzzle"). Colors: Word Circle `#2a78d6`, Word Guess `#eb6834`, Word Grid `#1baf7a`, with direct labels; the axes and grid are recessive; text is in the page's text colors.

## 4. Code

New `src/stats/`:

- `log.ts`: `PlayRecord`, `Lifetime`, `loadLog`, `loadLifetime`, `addPlay(store, record)` (append, trim to 400 days, update lifetime). Pure functions with a `KeyValueStore`.
- `records.ts`: building a `PlayRecord` from each game's finished state (`circleRecord`, `guessRecord`, `gridRecord`), pure.
- `her-stats.ts`: `herStats(input)` → the five cards' content (numbers, podium order, bests, chart rows, garden flowers, facts, wording, what's new), pure. Input: log, lifetime, the three games' saved stats, Word Circle's bests, the frame's streak, the enabled games, today, the seen record.
- `family-stats.ts`: `familyStats(log, today)` → the table rows and every chart's series, pure.
- `her-view.ts`: the pop-up's cards, animations and confetti (DOM and CSS).
- `family-view.ts`: the settings section's charts (SVG).

Changed:
- `src/shared/timer.ts` (moved from `src/circle/timer.ts`).
- `src/guess/` and `src/grid/` (timing, saved `elapsedMs`, records).
- `src/circle/screen.ts` (records).
- `src/frame/games.ts` (`FrameHost.logPlay(record)`).
- `src/frame/frame.ts` and `view.ts` (Games pop-up buttons, Stats corner button, the stats pop-up).
- `src/frame/layout.ts`, if new rects are needed (the pairs reuse `shareButton` / `nextWordButton`).
- `src/settings/page.ts` (the How she's doing section).
- `src/main.ts` (wiring the stats inputs).
- `src/styles.css`.

## 5. Testing

- **Unit tests:**
  - **The log:** adding, trimming at 400 days, lifetime figures, damaged and unavailable storage.
  - **Each game's record**, including hints, words, longest word and first guess.
  - **`herStats`:** each card's numbers and wording; empty states; the good-news rules (no streak under 2, no "quicker" without data, soil for unplayed days); garden sizes; fact choice and thresholds; what's new and the seen record.
  - **`familyStats`:** weekly buckets, most-played level, averages with gaps, the table rows, the 14-day threshold, time-of-day shares.
  - **Timers** in Word Guess and Word Grid.
  - **Layout:** the Games pop-up pair, the Stats corner button and the stats pop-up buttons, at every iPad size and thumb side.
- **Browser preview** (a worktree preview on a fresh port, see `browser-and-simulator-testing`):
  - A made-up two months of log, written from the console: all five cards, the animations and confetti, all charts and tap values, at 1024×768, 1180×820 and 1366×1024.
  - Mom-style saves with totals and no log: the friendly empty states.
  - One-game mode: the Stats corner button.
- **Publishing:** build, test, check, commit, and ask the owner before pushing.
