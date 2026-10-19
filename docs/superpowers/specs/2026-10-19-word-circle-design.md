# Word Circle — Design

**Date:** 2026-10-19
**Status:** Approved in brainstorming, awaiting written-spec review

## Purpose

A Word Cookies–style word game for one player: a 92-year-old woman with poor eyesight, poor hearing, and dementia, playing on her iPad. She already knows and enjoys Word Cookies and can still find words; her problems are seeing the screen and the busy, cluttered interface.

The game keeps the Word Cookies mechanic she knows (slide a finger across letters arranged in a circle, lift to try the word, words fill slots) and removes everything else: no cookie theme, coins, ads, levels map, timers, lives, or menus.

**Success looks like:** she can pick up the iPad, see where she left off, play without help, never get pulled out of the game by a stray touch, and never see a scolding or confusing message.

## Constraints

- **Device:** her iPad, held in **landscape**. She grips it with one hand (thumb resting on a side edge) and slides with a finger of the other hand. Layout must work on every current iPad size in landscape (smallest 1024×768 CSS px).
- **Eyesight:** very large, high-contrast letters; nothing important in light gray; no reliance on color alone.
- **Hearing:** no information carried by sound. Sound is off entirely.
- **Dementia:** no menus, no setup, no way to lose, no time pressure, consistent layout, opens straight into play.
- **Platform:** installable web app (Home Screen web app) for now; designed so it can later be wrapped as a native iPad app with the owner's Apple developer account.

## 1. The screen

Layout "B": word slots on the left, letter circle on the right. Landscape only.

```
┌──────┬──────────────────────┬───────────────────────────┬──────┐
│      │   [O][N][E]          │        ( S T O )          │      │
│ safe │   [ ][ ][ ]          │          ⓢ                │ safe │
│ zone │   [ ][ ][ ]          │      ⓔ       ⓣ            │ zone │
│      │   [N][O][T][E]       │                           │      │
│      │   [ ][ ][ ][ ]       │       ⓝ     ⓞ             │      │
│      │   [ ][ ][ ][ ][ ]    │                           │      │
│      │  [Shuffle]  [Hint]   │                           │      │
└──────┴──────────────────────┴───────────────────────────┴──────┘
```

- **Safe zones:** a band on the left and right edges, full screen height, rendered as plain background (invisible); nothing is ever drawn in them. The right band is 130 CSS px (about one inch on a standard iPad). Her left thumb rests on the screen, so the left band is 200 CSS px (about 1.5 inches) wherever the screen has room, shrinking toward 130 only on the narrowest iPads (it is `screen width − 130 − 760`, clamped to 130–200; 760 px is what a Hard puzzle needs at minimum sizes).
- **Play area:** the space between the safe zones, split roughly 45% left column / 55% right column.
- **Left column:**
  - **Level buttons** at the top: three small buttons, **Easy**, **Medium** and **Hard** (48 px tall, at most 120 px wide). The current level has a thick purple border and a check mark.
  - One row per answer word, sorted by length then alphabetically (as Word Cookies does).
  - At the bottom, two buttons side by side: **Shuffle** and **Hint**, each with an icon *and* a word label.
- **Right column:**
  - **Extra words** at the top: an "Extra words" label over blue-outlined chips, one per extra word found in this puzzle, oldest first. Room for two rows; when more are found, the oldest chips drop off screen (all stay saved). Hidden until the first extra word is found.
  - **Current-word bar** below it: a white pill with an orange border showing the letters selected so far in large type. Hidden when nothing is selected.
  - **Letter circle** below it: a pale yellow circular backing with 4, 5 or 6 letter tiles evenly spaced around a ring.
- **Sizing** (computed from screen size by a pure layout function):
  - Circle diameter = the largest that fits the right column width and the height remaining under the current-word bar.
  - Tile diameter ≈ 34% of circle diameter for 4 letters, ≈ 30% for 5, ≈ 27% for 6, never below 110 CSS px. Letter glyph ≈ 60% of tile diameter.
  - Word slots: square, sized to fit the longest word and the number of rows in the left column; between 48 and 72 CSS px.
  - Shuffle and Hint at least 90 CSS px tall.
- **Font:** Atkinson Hyperlegible Bold (Braille Institute, SIL Open Font License), bundled locally.
- **Colors ("Sky"):** every letter is dark (black, dark blue or dark green) on white; color lives in the background, borders, the circle and the swipe line.

  | Element | Color |
  |---|---|
  | Background | pale sky blue `#D8EAF7` |
  | Circle backing | soft yellow `#FBE3A0` |
  | Letter tile (idle) | white, 4px dark blue border `#1B3A6B`, letter `#141414` |
  | Letter tile (selected) | white, orange `#E07B24` border plus 6px orange ring, letter stays `#141414` |
  | Connecting line | orange `#E07B24`, 14px, round caps |
  | Current-word bar | white, 4px orange border, letters `#141414` |
  | Empty word slot | white, 3px border `#7A8CA0` |
  | Hinted letter in slot | dark blue `#1B3A6B` letter on white slot |
  | Found word slot | white, 4px green border `#2E9E4F`, dark green letter `#1F6B35` |
  | Shuffle / Hint | white, 4px purple `#6A4FB3` / gold `#B8860B` border and icon, text `#141414` |
  | Level buttons | white, 2px gray border, text `#141414`; current level 4px purple border + check |
  | "Good!" / "Well done!" | white bubble, green border, dark green text |

  Orange stands out for aging eyes (blue and purple get harder to tell apart with age), so her selection is the most visible thing on screen.
- **Nothing else on screen:** no score, coins, level number, puzzle counter, menu, or settings icon.
- **Portrait:** if the iPad is somehow in portrait, show only a large "Please turn the iPad sideways" message with a simple picture. (Rotation Lock should prevent this.)

## 2. Touch and the safe zone

Uses Pointer Events. The touch module receives normalized events `{type: down|move|up|cancel, id, x, y}` so it can be unit-tested without a browser.

**Rules:**

1. **Safe-zone filter.** A pointer whose `down` is inside either safe zone is added to an *ignored* set and ignored for its entire life, even if it later moves into the play area. Removed from the set on `up`/`cancel`.
2. **One active finger.** At most one pointer is *active*. A `down` while another pointer is active is ignored for that pointer's life.
3. **Start only on a letter.** A `down` outside the safe zones becomes active only if it lands on a tile (hit radius = tile radius × 1.15). A `down` on empty background does nothing.
3a. **Buttons go through the same tracker.** iPadOS drops ordinary `click` events while another finger is on the screen, so a resting thumb would block Shuffle, Hint and the level buttons. Instead, a `down` on a button (outside the safe zones, while no word is being traced) is remembered for that pointer, and its `up` taps the button only if it ends on the same button within 2 seconds (a longer press is a thumb coming to rest, not a tap). Each pointer is tracked separately, so other fingers resting anywhere don't matter; `cancel` never taps.
4. **Adding letters.** While active, moving into a tile (hit radius = drawn tile radius) that is not already selected appends it.
5. **Backtracking.** Moving into the *second-to-last* selected tile removes the last selected tile. Moving into any other already-selected tile does nothing.
6. **Wandering.** Moving outside the circle (or into a safe zone) does not end the word.
7. **Submitting.** `up` on the active pointer submits the word if it has ≥ 3 letters; otherwise the selection clears silently.
8. **Interruptions.** `cancel` on the active pointer clears the selection without submitting.

**Output events** from the touch module: `letterAdded(tileIndex)`, `letterRemoved(tileIndex)`, `wordSubmitted(tileIndices)`, `selectionCleared()`, `buttonTapped(id)`.

**Browser behavior disabled:** pinch and double-tap zoom (`user-scalable=no`, `touch-action: none`, `gesturestart` prevented), text selection (`user-select: none`), long-press callout (`-webkit-touch-callout: none`), pull-to-refresh and rubber-band scrolling (`overscroll-behavior: none`, fixed full-screen layout).

**Known limitation:** if her holding thumb rests on an actual letter tile (not the edge), it is indistinguishable from a real play. Tiles always start more than an inch from the screen edge, so this should be rare.

**iPad settings (documented in the setup guide):** Guided Access (locks to the app, disables Home and notification edge swipes), Rotation Lock set in landscape, and Auto-Lock.

## 3. How the game plays

| Situation | What she sees | Timing |
|---|---|---|
| Opens the app | The level and puzzle she was on, with found words and hinted letters still filled in. No title screen. | — |
| Taps Easy, Medium or Hard | That level's puzzle slides in right away, at the place she left it in that level. Nothing is lost by switching; ignored while she's tracing a word or during "Well done!" | 500 ms |
| Finds an answer word | Word glides from the current-word bar into its slot; slot turns green; large "Good!" appears | glide 600 ms, message 1200 ms |
| Word already found | That word's slot gently pulses twice | ~800 ms |
| Real word not in the slots (new) | "Good word!" in the current-word bar, then fades; the word pops in as a chip under "Extra words" | 1200 ms |
| Extra word already found | Its chip gently pulses twice (if it has dropped off screen, "Good word!" instead) | ~800 ms |
| Not a word | Current-word bar wiggles once, then fades | ~400 ms + fade |
| 1–2 letters | Selection clears silently | — |
| Taps Shuffle | Tiles glide smoothly to new positions around the ring | 500 ms |
| Taps Hint | One letter is filled into a slot (navy letter on white) | — |
| No word found for 2 minutes | Hint button gently pulses once every 4 seconds until she taps Hint or finds a word. Never auto-reveals. | after 120 s idle |
| Finishes the puzzle | A "Well done!" card with her stats (below) and a big **Next puzzle** button; the next puzzle slides in when she taps it, or by itself after 15 seconds | up to 15 s |

- **Hint rule:** pick the shortest unfound word (ties: first in slot order); reveal its leftmost unrevealed letter. If every letter of a word becomes revealed, that word counts as found (green, with the usual "Good!").
- **Hints are free and unlimited.**
- **Motion:** slow and smooth; no flashing, no shaking of the whole screen.
- **Sound:** none.
- **Celebration and stats** (only ever good news; no clock is shown while she plays):
  - **New record! 1 min 52 sec**: only when she beats her best time for that level (Easy, Medium and Hard each have their own; her first puzzle in a level counts). Orange highlight with a trophy. Puzzles finished with hints still count.
  - **5 days in a row**: days (local calendar) on which she finished at least one puzzle; shown from day 2. A missed day quietly starts the count over; nothing ever says a streak was lost.
  - **3 puzzles today**: always shown.
  - **Puzzle number 48**: always shown; at milestones (10, 25, 50, 100, 250, 500, 750, 1,000, then every 500) it reads "Puzzle number 50!" with the orange highlight.
  - **Play time** counts only active time: it pauses while the iPad sleeps or the app is closed, and any stretch without touches counts for at most one minute, so putting the iPad down doesn't spoil a record. The time is saved with each level's progress.
  - The Next puzzle button is tapped through the same per-finger tracker as everything else, so it works with a resting thumb. The next puzzle is saved as her place before the card appears, so closing the app mid-celebration loses nothing.
- **Saving:** progress is written to `localStorage` after every found word, extra word, hint, level change and puzzle change, and when the app is hidden. Key `word-circle:v2`, value `{ level, levels: { easy?, medium?, hard? }, stats }` where each level's entry is `{ puzzleIndex, puzzleId, found: string[], revealed: { [word]: number[] }, bonusFound: string[], elapsedMs }` and `stats` is `{ totalSolved, bestMs: { easy?, medium?, hard? }, streakDays, lastPlayedDay, todaySolved }`. A save from before levels existed (key `word-circle:v1`) is moved into Medium; missing `bonusFound`, `elapsedMs` or `stats` load as empty, and damaged stats never cost her progress. On load, if a level's saved `puzzleId` doesn't match the puzzle at `puzzleIndex` (puzzles were regenerated), that level starts that index fresh. New players start on Medium. Home Screen web apps keep their storage (not subject to Safari's 7-day eviction).
- **End of list:** after the last puzzle, wrap around to puzzle 0.

## 3b. Clock and schedule

- **Clock button:** a 72 px white square with a dark-blue clock icon at the top right of the right column (Extra words narrows to make room). Tapped through the per-finger tracker like every button.
- **Clock pop-up:** a card that fills almost the whole screen (16 px margin, dark-blue border); every text size is a fraction of the card height so it is as big as each iPad allows:
  - the time ("10:30 AM", 22% of the card height: about 160–220 px), the part of day ("in the morning" 5–11, "in the afternoon" 12–4, "in the evening" 5–8, "at night" 9–4), and the day and date ("Monday, October 19"); updated every second;
  - up to 3 upcoming events (about 40–55 px), soonest first: countdowns for the rest of today ("Supper in 4 hours 30 minutes", minutes rounded up), "Time for Supper" (orange highlight) from 5 minutes before until 30 minutes after, then one-off events in the next 7 days ("Doctor visit tomorrow at 2:00 PM", "… on Thursday at 2:00 PM"). With nothing coming up, only the time and date show;
  - a big **Close** button (360 × 100 px); it also closes by itself after 60 seconds. While it's open, only Close responds.
- **Schedule file:** `public/schedule.txt`, deployed with the site and edited on GitHub (or by asking Claude). One event per line: `every day 5:00 PM Supper`, `Sun 10:00 AM Church`, `Tue,Fri 3 PM Phone call`, `2026-10-22 2:00 PM Doctor visit`. Times may be `5:00 PM`, `5 PM`, `5:30pm` or `17:30`. `#` lines and unreadable lines are skipped.
- **Fetching:** the app fetches the file (bypassing caches) when it opens, when it comes back to the foreground, every 5 minutes while visible, and when the clock is opened. The last fetched text is kept in `localStorage` (`word-circle:schedule`) so the clock works offline. The file is not precached by the service worker.

## 4. Puzzles and words

Puzzles are generated offline by a Node script on the Mac and shipped inside the app as `puzzles.json`.

- **Source:** SCOWL (Spell Checker Oriented Word Lists), en_US, with its license notice included in the repo.
  - **Answer words:** SCOWL size ≤ 35 (common words), plain dictionary words only: no plurals or other endings (-s, -ed, -ing, -er, -est). A word is dropped if AGID (the Automatically Generated Inflection Database, `words/agid/infl.txt`) lists it only as an ending of another word, so "notes", "posed", "spoken" and "laxer" are out while "news" and "spoke" stay. Uncertain AGID entries (marked `?`, e.g. "cars N?") don't count as dictionary words, and -ing forms of verbs ("making", "asking") count as endings even when AGID also lists them as nouns. Slips can be added to `words/not-plain.txt`. Plurals and endings still count as extra words.
  - **Accepted ("Good word!") words:** SCOWL size ≤ 60.
  - Both: lowercase `a–z` only (no capitals/proper nouns, apostrophes, or accents), length 3–6, not on the never-use list.
- **Never-use list:** `words/blocklist.txt`, one word per line, seeded with offensive words, slurs and upsetting ones (death, illness, violence). Editable by the owner; re-run the script to apply. SCOWL's own offensive and profane lists (`words/scowl/misc`) are always excluded as well.
- **Levels:**

  | Level | Letters | Words in slots | Target puzzles | Build fails below |
  |---|---|---|---|---|
  | Easy | 4 | 3–4 | 700 | 500 |
  | Medium | 5 | 4–6 | 1,400 | 1,000 |
  | Hard | 6 | 6 | 1,000 | 800 |

  Easy draws on the same common-word list (the very most common words alone give only ~240 puzzles) but, like every level, prefers the most common words first.
- **Generation (per level):**
  1. Candidate base words: answer words with the level's letter count, most common first.
  2. For each, find all answer words formable from its letters (as a multiset; repeated letters allowed if the base has them). The base word is always included.
  3. Keep the candidate only if it has at least the level's minimum number of such words. If it has more than the maximum, keep the base word plus the most common others (lowest SCOWL size, then preferring a mix of lengths); the rest become bonus words.
  4. **Bonus words** for a puzzle = every accepted word formable from its letters that isn't an answer word.
  5. One puzzle per distinct letter set (e.g. STONE/NOTES/ONSET produce one puzzle).
  6. Letter order on the circle is shuffled (seeded) so no answer word that uses every letter is spelled out clockwise. Letter sets where every arrangement spells an answer (e.g. LOOP/POOL/POLO) are skipped.
  7. Each level's puzzles are shuffled with a fixed seed so builds are reproducible and similar puzzles don't come back to back.
- **Output format:** `src/data/puzzles.json` (bundled into the app) = `{ easy: Puzzle[], medium: Puzzle[], hard: Puzzle[] }`, each `Puzzle` = `{ id, letters: string[], words: string[], bonus: string[] }`, where `id` is the sorted letter set and `words` is in slot display order.
- **Review page:** the script also writes `docs/puzzle-sample.html` showing the first 20 puzzles of each level (letters, answer words, bonus words) for the owner to look over before she sees them.

## 5. Build, delivery, and testing

**Stack:** TypeScript, Vite, Vitest. No UI framework (one screen; DOM + SVG). Targets Safari on iPadOS 15+.

**Structure:**

```
index.html
src/
  main.ts              entry point: font, styles, puzzles, starts App
  app.ts               controller: wires rules, touch, layout and view together
  pwa.ts               service worker registration and update timing
  shared/
    random.ts          seeded random + shuffle (shared with the puzzle script)
  game/                pure rules, no DOM
    types.ts           Puzzle, Progress types
    state.ts           tryWord → answer | alreadyFound | bonus | notAWord; hint(); isComplete()
    storage.ts         load/save progress (storage interface, localStorage impl)
  input/
    touch.ts           normalized pointer events → letter/word events (rules in §2)
  ui/
    layout.ts          pure geometry from screen size (§1 sizing)
    ring.ts            circle letter order (shuffle)
    view.ts            draws slots, tiles, line, bar, buttons; glides, pulses, wiggle, messages
  data/
    puzzles.json       generated puzzles (bundled, so they're precached with the app)
  styles.css
public/
  icon.svg + generated PNG icons (incl. 180×180 apple-touch-icon)
  (font comes from the @fontsource/atkinson-hyperlegible package; manifest is generated by vite-plugin-pwa)
scripts/
  build-puzzles.ts     §4 generator CLI
  puzzle-lib.ts        pure generation + validation
  scowl.ts             reads SCOWL lists and the never-use list
  sample-page.ts       review page
words/
  blocklist.txt
  scowl/               downloaded SCOWL lists + license
tests/
docs/
  setup-her-ipad.md
.github/workflows/deploy.yml
```

Each module has one job and a small interface: `game/` knows nothing about the screen, `input/touch.ts` knows nothing about words, `ui/layout.ts` is pure math. The `game/` module is what carries over unchanged to a future native app.

**Offline and updates:** a service worker (vite-plugin-pwa / Workbox) precaches every file, including the font and puzzles. A new version installs in the background and is applied only on a fresh launch or right after a "Well done!" (a reload there restores the next puzzle from saved progress), never in the middle of a puzzle.

**Delivery:**
- GitHub repository (public, for free GitHub Pages) under the owner's account; GitHub Actions builds and deploys on every push to `main`.
- `docs/setup-her-ipad.md`: open the link in Safari → Share → Add to Home Screen; turn on Guided Access (Settings › Accessibility › Guided Access, set a passcode, triple-click to start); Rotation Lock while sideways; Auto-Lock setting.

**Testing:**
- **Unit tests (Vitest):**
  - `game/state`: answer, already found, bonus, not a word, too short; hint selection order; hint completing a word; puzzle completion; save/load round trip; mismatched `puzzleId` resets.
  - `input/touch`: down in left/right safe zone then move into tiles → ignored; down on background → nothing; second finger mid-word → ignored; backtrack removes last; revisiting a non-previous selected tile → nothing; wandering off circle keeps word; up with < 3 letters clears; cancel clears without submit.
  - `ui/layout`: on 1024×768, 1080×810, 1133×744, 1180×820, 1194×834, 1366×1024 — nothing overlaps a safe zone, tiles ≥ 110 px, slots within 48–72 px, everything fits on screen with 6 words of up to 6 letters.
- **Puzzle checks** (run by the generator; build fails on violation): every puzzle has 4–6 answer words, every word is formable from its letters, no word is on the blocklist, no duplicate letter sets, no puzzle whose circle order spells the base word clockwise.
- **Simulator check:** run in the iPad Simulator (Xcode is installed) in landscape: layout, sliding, backtracking, safe-zone touches, Shuffle, Hint, puzzle completion, reload restoring progress.
- **Real-device check (owner):** on her iPad, held the way she holds it.

## Out of scope for v1

Sound, a settings or caregiver screen, left-hand (mirrored) layout, statistics, multiple players, and the native iPad app. The native app is a later, separate project: wrap this build with Capacitor and distribute with the owner's developer account.
