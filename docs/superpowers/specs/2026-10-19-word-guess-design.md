# Word Guess and the Games button — Design

**Date:** 2026-10-19
**Status:** Built 2026-10-19 (plan: `docs/superpowers/plans/2026-10-19-word-guess.md`). Since then a third game, Word Grid, joined the Games pop-up, and the three games' buttons were put in the same places; see `2026-10-19-word-grid-design.md` ("Shared layout"). For Word Guess that only fixed its left column at 130 px wide.
**Builds on:** `2026-10-19-word-circle-design.md` (same player, constraints, colors, font and touch rules)

## Purpose

Add a second game to the Word Circle site: **Word Guess**, our own big-print version of Wordle, plus a **Games** button so she can move between games. She already plays Wordle, so Word Guess copies its rules and look closely and changes only what her eyesight and dementia need: no losing, much bigger keys and squares, fewer letters to look at, and the same calm screen as Word Circle.

Each day, the first new word she starts is the real Wordle word for that day, so she plays the same word as everyone else and can text her result to family the way the NYT app does.

**Success looks like:** she can tap Games, pick Word Guess, play a word with no help, never see a loss, find her way back to Word Circle, and send "Wordle 1,948 4/6" to family.

### Decisions made in brainstorming

- **Our own games, not links out.** Real Wordle has ads, banners, a small keyboard, one word a day and a loss after six tries; a link from her Home Screen app opens a browser sheet she could get stuck in. Knotwords is an app only, with no web page to link to.
- **One game first.** Word Guess now. A Knotwords-style logic grid is a separate, later project, once we see how she takes to Word Guess: it leans on working memory (what dementia affects most) and needs a generator for puzzles with exactly one answer.
- **One Games button**, not a link per game: room at the top right is tight, and two taps to switch means a stray touch can't drop her into another game.
- **Names:** plain names that say what you do, matching "Word Circle": **Word Guess**; later perhaps **Word Grid**. The trademark "Wordle" appears only where it refers to the real daily word ("Today's Wordle", and the shared text).

## 1. Structure

One app, one page. A shared **frame** holds everything that is the same in every game; each game lives in its own folder.

**The frame** owns:
- the per-finger touch tracker (`input/touch.ts`, which also gains a callback so a key can show its pressed look) with the thumb safe zones, pointer listening, gesture blocking, resize and the portrait message;
- the **Games** and **Clock** buttons at the top right, the clock pop-up and schedule (`clock/`, unchanged), and the **Games pop-up**;
- the **"Well done!" card**: each game hands it what goes under the title (Word Guess: her word in squares), its lines of good news and its buttons; the frame shows it, routes its buttons, and moves on after the game's timeout;
- applying a waiting update right after a "Well done!" (as now);
- which game is showing, and the shared days-in-a-row.

**Each game** has the same four parts Word Circle has today: rules with no screen code, pure layout math, drawing, and a controller. The frame tells the current game when to draw itself (with the frame's geometry: safe zones, play area, top-right buttons), forwards taps on the game's own buttons and, for Word Circle, letter tracing; it asks the game whether it's busy (mid-animation) before opening a pop-up; and it tells the game when it is shown, hidden, or the app goes to the background.

**Files:**

```
src/
  main.ts                 entry point: font, styles, data, starts the frame
  pwa.ts                  unchanged
  styles.css              shared styles; game styles in their own sections
  shared/random.ts        unchanged
  shared/store.ts         the KeyValueStore interface (moved out of game/storage.ts)
  shared/days.ts          dayKey, previousDay, milestones, shared days-in-a-row (moved out of game/stats.ts)
  input/touch.ts          adds buttonPressed / buttonReleased callbacks
  clock/                  unchanged
  ui/fit.ts               unchanged
  ui/dom.ts               small DOM helpers shared by the views
  ui/icons.ts             the SVG icons shared by the views
  frame/
    frame.ts              controller (what src/app.ts did, minus Word Circle's rules)
    layout.ts             safe zones, play area, Games and Clock buttons, full-screen cards and their buttons, Games pop-up cards
    view.ts               top-right buttons, clock pop-up, Games pop-up, "Well done!" card, portrait message
    games.ts              the interface every game implements, and the list of games
    storage.ts            word-games:v1
  circle/                 Word Circle, moved from src/app.ts, src/game/ and src/ui/{layout,view,ring}.ts, not rewritten
  guess/
    rules.ts              colors for a guess (with repeated letters), known letters, carried-down letters, hint, keyboard states
    words.ts              the word-list type and the accepted-guess check
    daily.ts              reading daily-word.txt; when the daily word comes up
    share.ts              the shared text
    celebration.ts        the lines of good news on its "Well done!" card
    storage.ts            word-guess:v1, including the regenerated-list check
    layout.ts             board, keyboard, left buttons
    view.ts               draws and animates the board and keyboard
    screen.ts             controller
  data/puzzles.json       unchanged
  data/guess-words.json   generated: { answers: string[], accepted: string[] }
scripts/
  build-puzzles.ts        also writes guess-words.json and adds the answers to the review page
  guess-lib.ts            builds and checks the Word Guess lists
  daily-word.ts           fetches the daily Wordle words (§4)
  daily-lib.ts            reads the NYT replies and writes daily-word.txt
```

**Step one is only the move:** Word Circle must look and behave exactly as before (all existing tests passing, browser check) before any Word Guess code goes in.

## 2. Word lists

Generated by `npm run puzzles` alongside the Word Circle puzzles, from the same sources.

- **Answers (1,851):** SCOWL size ≤ 35, five letters, lowercase `a–z`, plain dictionary words only (same AGID and `not-plain.txt` rule as Word Circle's slots), never on the never-use list or SCOWL's taboo lists, and never on the Word Guess skip list.
- **Skip list:** `words/guess-skip.txt` holds words that are never the Word Guess answer but still count as guesses, and don't affect Word Circle. The owner chose 68 touchy words for it (death, illness, violence, crime, drink and drugs, insults, other upsetting words) after reviewing the answers. Word Grid uses the same list for its answers (and added 12 odd short words of its own). `words/blocklist.txt` still removes a word from every game entirely.
- **Play order:** most common first. The words in SCOWL size ≤ 10, then size 20, then size 35, each group shuffled with a fixed seed so builds are reproducible.
- **Accepted guesses (5,022):** SCOWL size ≤ 60, five letters, `a–z`, plurals and endings included, never blocked. Every answer is also accepted.
- **Build checks** (the build fails on violation): every answer is five letters, plain, not blocked, not skipped and accepted; no duplicates; at least 1,500 answers.
- **Review page:** `docs/puzzle-sample.html` has a Word Guess section listing every answer in play order, so the owner can skim it.
- **End of list:** after the last answer, wrap around to the first.

## 3. How Word Guess plays

### The screen

```
┌──────┬──────────┬───────────────────────┬────────────────┬──────┐
│      │ [Hint]   │  [S][T][A][R][E]       │ [Games][Clock] │      │
│ safe │ [All     │  [S][L][A][ ][E]       │                │ safe │
│ zone │ letters] │  [ ][ ][ ][ ][ ]       │                │ zone │
│      │ [Today's │  [ ][ ][ ][ ][ ]       │                │      │
│      │  Wordle] │  [ ][ ][ ][ ][ ]       │                │      │
│      │          │  [ ][ ][ ][ ][ ]       │                │      │
│      │ [Q][W][E][ ][T][Y][U][I][O][P]                     │      │
│      │   [A][S][D][F][G][H][J][K][L]                      │      │
│      │ [Enter][Z][X][C][V][B][N][M][Back]                 │      │
└──────┴────────────────────────────────────────────────────┴──────┘
```

- **Safe zones and play area:** exactly as Word Circle (left `clamp(width − 890, 130, 200)`, right 130); nothing is drawn in them.
- **Keyboard** across the bottom of the play area: QWERTY in Wordle's three rows (10, 9, and Enter + 7 + Back). Each key is `(play width − 9 gaps) / 10` wide (about 65 px on a 1024-wide iPad, more on bigger ones) and `clamp(9% of screen height, 64, 84)` px tall, with 8 px gaps; the letter is about 55% of the key height. **Enter** and **Back** are one and a half keys wide, each with a word and an icon.
- **Board** above the keyboard: six rows of five squares, as large as fits (about 71–75 px on the smallest iPads, at most 110 px), letters about 62% of the square. It sits between the left buttons and the top-right buttons without touching either.
- **Left column** (130 px wide): **Hint** in the top-left corner (130 × 96 px, where Hint is in every game) and **All letters** below it (the same size), and on the daily word the **Today's Wordle** label below them (§4), up to 180 px tall.
- **Top right:** the frame's **Games** and **Clock** buttons (72 px squares), in the same place as in Word Circle.
- **Sizing** is computed by a pure layout function and tested at 1024×768, 1080×810, 1133×744, 1180×820, 1194×834 and 1366×1024.

### Colors (Sky, Word Circle style: white squares, colored borders)

| Element | Look |
|---|---|
| Empty square | white, 3 px border `#7A8CA0` |
| Next square to fill | white, 4 px orange `#E07B24` border |
| Typed letter, not yet checked | white, 3 px dark blue `#1B3A6B` border |
| Right letter, right spot | white, 5 px green `#2E9E4F` border |
| Right letter, wrong spot | white, 5 px gold `#B8860B` border |
| Not in the word | white, 5 px gray `#9AA6B2` border |
| Key, not used yet | white, 3 px dark blue `#1B3A6B` border |
| Key, green / gold | same 5 px green / gold border as on the board |
| Key, not in the word | hidden, leaving its gap (gray border while **All letters** is on) |
| Key while pressed | orange `#E07B24` border plus orange ring, like a selected letter tile |
| Hint / All letters | white, 4 px gold `#B8860B` / purple `#6A4FB3` border and icon; All letters on: purple border plus a check |
| Today's Wordle label | pale gold `#FFF4D6` fill, 4 px gold border, newspaper icon |

Every letter is `#141414` on white.

### Typing and checking

- Keys are buttons in the per-finger tracker (down and up on the same key within 2 seconds), so her resting thumb never blocks them. A key shows its pressed look while her finger is on it.
- **Letters** fill her current row left to right, skipping squares that already hold a carried-down or hinted letter. Typing into a full row does nothing.
- **Back** removes the last letter she typed; it never removes a carried-down or hinted letter.
- **Enter** on a row that isn't full, or that spells a word not on the accepted list: the row wiggles gently once and her letters stay.
- **Enter** on an accepted word: the squares' borders color in one at a time, left to right; then the keyboard updates. Colors follow Wordle's rules, including repeated letters: right-spot letters are marked first, then wrong-spot letters up to the number of times that letter is in the answer; any extra copies are gray. A key shows the best it has earned (green over gold over gray), and is hidden only if the letter isn't in the word at all.
- **Carry-down:** her next row starts with every letter known to be in its right spot (from any guess or hint), already filled in and locked, as in Wordle's Hard mode.
- **More than six guesses:** the board always shows six rows. After the sixth, the rows glide up one, the oldest leaves the top, and a fresh row appears at the bottom. Every guess stays saved, and the keyboard keeps everything she has learned.
- **Getting it:** the row turns green square by square, then the "Well done!" card (§6).

### Hint

- Free and unlimited. Puts the right letter into the highlighted square (the next one she would type in), keeping the letters she typed before it. When her row is full, it goes in the leftmost square whose letter isn't yet known to be right, replacing the letter she typed there. That letter is locked and carries down like any right-spot letter.
- If the hint makes all five letters known, the word is complete: "Well done!".
- After 2 minutes without a guess, the Hint button gently pulses every 4 seconds until she guesses or taps Hint. It never reveals anything by itself.

### All letters

Shows the hidden keys again with gray borders, for when she wants to try a word that uses a ruled-out letter. Tapping it again hides them. Each new word starts with them hidden.

### Timing

| Situation | What she sees | Timing |
|---|---|---|
| Taps a letter | letter pops into the next empty square | 150 ms |
| Not a word, or row not full | row wiggles once, letters stay | ~400 ms |
| Accepted guess | borders color in one square at a time, then the keys update | 250 ms per square |
| Seventh guess and later | rows glide up by one | 500 ms |
| Taps All letters | hidden keys fade in / out | 300 ms |
| Gets the word | row turns green square by square, then "Well done!" | 250 ms per square |

No sound, no flashing, no shaking of the whole screen.

## 4. The daily Wordle

### Getting the word (automatic)

- **Scheduled job:** the existing GitHub Actions deploy workflow also runs every morning (`cron: '0 9 * * *'`, about 4–5 AM Eastern) and can be run by hand from GitHub ("Run workflow").
- **Fetch:** before building, `npm run daily-word` (`scripts/daily-word.ts`) reads `https://www.nytimes.com/svc/wordle/v2/YYYY-MM-DD.json` for yesterday through two days ahead. Each reply has `solution`, `print_date` and `days_since_launch` (the puzzle number; 1,948 on 2026-10-19). Fetching ahead means the new word is ready at her midnight whenever the job runs, and one missed run doesn't matter.
- **Checks:** a word is used only if it is five letters `a–z` and not on the never-use list or SCOWL's taboo lists; otherwise that day is skipped and she gets our list.
- **Output:** `public/daily-word.txt`, written during the build and **not committed** (it is in `.gitignore`), so the repository never gets a daily commit. One line per day: `2026-10-20 1949 crane`.
- **Failures:** on a push deploy, a failed fetch never fails the build; the file just holds whatever was fetched. On a scheduled run where nothing could be fetched, the job stops before deploying, so the last deploy (which holds words up to two days ahead) stays live.
- **Known limits:** the NYT address is unofficial and could change or block GitHub's servers without warning, and automated reading of their site may go against their terms of use; if it stops working, she simply gets words from our list. GitHub switches off scheduled jobs in a public repository after 60 days with no commits; it emails a warning first, and re-enabling takes one click. Words up to two days ahead are visible at the file's address.

### In the app

- **Fetching:** the app fetches `daily-word.txt` (bypassing caches) when it opens, when it comes back to the foreground, and every 5 minutes while visible, like the schedule. The last text is kept in `localStorage` (`word-guess:daily`) so it works offline. The file is not precached by the service worker. Lines that can't be read are skipped; only the line for the iPad's local date counts.
- **When it comes up:** when she starts a new word, if today's daily word exists and she hasn't finished it, the new word is the daily word; the list position doesn't move, so the list word she would have had comes next. If the daily word arrives while her current list word has no guesses and no hints yet, it takes that word's place right away. It never interrupts a word she has started.
- **Accepted:** the daily word is always an accepted guess, even if it isn't on our list.
- **Obvious:** while she's on the daily word, the **Today's Wordle** label (newspaper icon) sits in the left column. Until she has finished it, the Word Guess card in the Games pop-up adds a line, **"Today's Wordle is ready"**.
- **After midnight:** a daily word she hasn't finished by the end of its day stays her word and finishes like any other word, without the label or Share.

### Sharing

- On the daily word's "Well done!" card, a **Share** button sits beside **Next word**. Tapping it opens the iPad's share sheet (Web Share API, `navigator.share({ text })`) with the text ready; she taps a family member's face or Messages, then Send.
- For the rest of that day, the Today's Wordle label becomes a **Share today's Wordle** button (share icon), so she can still send it if someone asks later.
- If the iPad has no share sheet (`navigator.share` missing), neither Share button appears.
- **The text**, in Wordle's own format (light-mode squares):

  ```text
  Wordle 1,948 4/6

  ⬜🟨⬜⬜⬜
  ⬜🟩🟨⬜⬜
  🟩🟩⬜🟩⬜
  🟩🟩🟩🟩🟩
  ```

  - One row per guess: 🟩 right spot, 🟨 wrong spot, ⬜ not in the word. The number uses a thousands comma.
  - More than six tries: the first line reads `Wordle 1,948 in 8 tries` (never Wordle's `X/6`), and every row is included.
  - Hints aren't shown. If a hint completed the word, the text ends with a 🟩🟩🟩🟩🟩 row, counted as a try.
- The share text is saved with her daily result, so the later Share button works after a reload.

## 5. Games button, Games pop-up, opening the app

- **Games button:** a 72 px white square with a dark-blue border, a grid icon and the word "Games", 12 px left of the Clock button, in the same place in every game. Tapped through the per-finger tracker.
- **Games pop-up:** like the clock pop-up, a card filling the screen (16 px margin, dark-blue border), every text size a fraction of the card height (`--u`), titled **"Pick a game"**. One big card per game, each with a small picture of the game and its name (**Word Circle**: a yellow circle of letters; **Word Guess**: rows of bordered squares; **Word Grid**, added later: a small outlined crossword; with three cards the pictures shrink to fit, the names don't). The game she's in has a thick purple border and a check. The cards sit inside the play area, clear of the safe zones. A big **Close** button (360 × 100 px) at the bottom.
  - Tapping a card: that game slides in (500 ms) at her saved place. Tapping the game she's in, or Close, goes back. It closes by itself after 60 seconds. While it's open, only the cards and Close respond.
  - It doesn't open while she's tracing a word, during an animation, or during "Well done!" (same rule as the clock).
- **Opening the app:** opens in the game that was showing when she last used it. Before she has ever switched (including her first launch after this update) that is Word Circle.

## 6. "Well done!" card for Word Guess

- The same full-screen card as Word Circle's: **"Well done!"**, then her word in five green-bordered squares, then her good news, one line each (at most four), only ever good news:
  - **"Got it in 4 tries"** ("Got it in 1 try"): only when she typed the winning word herself in six or fewer tries.
  - On the daily word, that line becomes **"Today's Wordle in 4 tries"** (or **"That was today's Wordle"** after more than six tries or a hint), with the orange highlight and a newspaper icon.
  - **"5 days in a row"**: shared with Word Circle (a day counts if she finished a puzzle or word in either game); shown from day two.
  - **"3 words today"**.
  - **"Word number 48"**: Word Guess words finished, with the orange highlight at the same milestones as Word Circle (10, 25, 50, 100, 250, 500, 750, 1,000, then every 500).
- To make room for her word, this card's title and lines are a little smaller than Word Circle's (title 12% and lines 6.5% of the card's height, word squares 9%). The lines shrink together if the widest is too wide (as Word Circle's do).
- **Buttons:** **Next word** (arrow icon); on the daily word, **Share** beside it. Both sit inside the play area, clear of the safe zones.
- **Moves on** by itself after 15 seconds, or 60 seconds on the daily word; it never moves on while the share sheet is open.
- The next word is saved as her place before the card appears, so closing the app mid-celebration loses nothing.

## 7. Saving

All in `localStorage`; damaged or missing data never costs her progress elsewhere.

- **`word-circle:v2`** — unchanged.
- **`word-games:v1`** — `{ current: 'circle' | 'guess', streakDays, lastPlayedDay }`. On first load it is created with `current: 'circle'` and the streak copied from Word Circle's saved stats, so her current run carries over. Both games update it when she finishes a puzzle or word, and both cards show its count.
- **`word-guess:v1`** — `{ index, word, daily, guesses, hinted, dailyDone, stats }`:
  - `index`: her position in the answer list; `word`: the word she's on;
  - `daily`: `{ date, number }` when the word is a daily word, else `null`;
  - `guesses`: her checked guesses in order; `hinted`: square positions filled by Hint;
  - `dailyDone`: `{ date, share }` for the last daily word she finished (its share text);
  - `stats`: `{ totalSolved, todaySolved, lastPlayedDay }`.
  - If `daily` is `null` and the answer at `index` is no longer `word` (the list was regenerated), that position starts fresh, as Word Circle does.
- **`word-guess:daily`** — the last fetched `daily-word.txt` text.
- Letters typed but not yet checked, and the All letters setting, are not saved.

## 8. Changes to Word Circle

- The **Games** button appears left of the Clock button; **Extra words** narrows to make room (about 220 px wide on the smallest iPad). Chips that don't fit drop off screen as now; all stay saved.
- Its **"days in a row"** shows the shared count.
- Its **play time** pauses while Word Guess is showing, so switching never spoils a record.
- Nothing else changes.

## 9. Testing

- **Unit tests (Vitest), written before the code:**
  - `guess/rules`: colors for a guess, including repeated letters in the guess and the answer; carry-down and locking; Back skipping locked squares; hint placement (the highlighted square, or the leftmost unknown one in a full row, replacing a typed letter), and completing a word; key states and hidden letters; the six-row window after six guesses.
  - `guess/share`: six or fewer tries, more than six, finished by hint, number with comma.
  - `guess/daily`: reading the file (only today's line, bad lines skipped); when the daily word comes up; swapping only an untouched list word; never interrupting; after midnight.
  - `scripts/daily-word`: parsing a pretend NYT reply, skipping blocked or malformed words, the date range, strict mode on scheduled runs.
  - `guess/storage` and `frame/storage`: round trips, regenerated list, damaged data, streak copied from Word Circle.
  - `shared/days`: shared days-in-a-row across both games.
  - Layout (frame, Word Circle and Word Guess) at all six iPad sizes: nothing in the safe zones, nothing overlapping, keys and squares at least their minimum sizes, Games and Clock in the same place in both games, both "Well done!" cards and the Games pop-up fit.
  - Word list build checks (§2).
- All existing tests keep passing; `npm test` and `npm run build` stay green.
- **Browser checks** at 1024×768, 1133×744, 1180×820 and 1366×1024 on the `127.0.0.1:5173` address (so the owner's own saved progress isn't touched).
- **iPad Simulator:** the Share button opens the share sheet from a tap. iPadOS only allows the share sheet during a user action; the tap arrives as a pointer event, and Safari counts it (checked 2026-10-19), so no `touchend` fallback was needed.
- **On her iPad (owner):** sharing with Guided Access turned on.

## 10. Build order

Each stage ends with a stop for the owner to look before the next; commits as we go.

1. **Frame:** move the shared parts out of Word Circle. Word Circle unchanged; all tests pass; browser check. *Stop.*
2. **Word lists:** `guess-words.json`, build checks, review page. *Stop: owner skims the answers and blocklists any.*
3. **Word Guess** rules, screen and saving, the Games button and pop-up, opening in her last game, shared days-in-a-row, the "Well done!" card. The app's side of the daily Wordle (reading the file, the label, Share) is built here too, but stays hidden until a `daily-word.txt` exists. *Stop: owner plays it in the browser.*
4. **Turning on the daily Wordle:** the fetch script, the scheduled workflow, trying a made-up daily word in the browser (so no real answer is spoiled), and the share sheet checked in the Simulator. *Stop.*
5. **Docs:** this spec's status, the Word Circle spec (structure and Word Circle changes), README (daily word, re-enabling the schedule), setup guide. Then ask before pushing anything live.

## Out of scope

The Knotwords-style game (a separate, later project), levels for Word Guess, Wordle's Hard-mode rule for wrong-spot letters, sound, a statistics screen, the NYT archive, and the native iPad app.
