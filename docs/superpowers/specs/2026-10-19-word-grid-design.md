# Word Grid — Design

**Date:** 2026-10-19
**Status:** Built 2026-10-19 (plan: `docs/superpowers/plans/2026-10-19-word-grid.md`). At the second checkpoint the owner asked for the buttons to be in the same places in all three games; that standard is §1's "Shared layout", and it changed Word Circle and Word Guess too.
**Builds on:** `2026-10-19-word-circle-design.md` (player, constraints, colors, font, touch rules) and `2026-10-19-word-guess-design.md` (the shared frame, Games button and pop-up, "Well done!" card, saving)

## Purpose

Add a third game to the Word Circle site: **Word Grid**, our own big-print version of Knotwords. She used to play Knotwords, but it got too hard and too small to see. Word Grid keeps its rules and look (a crossword-shaped grid split into outlined sections, each with its own letters, filled so every word across and down is real, with exactly one answer) and changes what her eyesight and dementia need: much bigger squares and letters, the section's letters in big tiles on top that she can tap or drag onto the grid, levels starting with small grids, a Hint that places a letter, and no way to lose.

**Success looks like:** she can pick Word Grid from the Games pop-up, see which letters go where, drag or tap them into place, notice when a row isn't a word, finish a puzzle with or without hints, and move between levels and games without help.

### Decisions made in brainstorming

- **Too soon to tell** how she's taking to Word Guess (it went live today), so Word Grid is designed on its own terms.
- **Just like Knotwords:** crossword-shaped grids (blocked squares are background, not a full square), outlined sections each with their own letters, letters never leave their section, a gentle mark on a run that isn't a word, exactly one answer.
- **Changed from Knotwords:** levels (Easy, Medium, Hard by grid size, as in Word Circle) instead of a puzzle a day; a **tray on top** with big tiles for the section she's working in (instead of Knotwords' keyboard at the bottom); she can **tap or drag** letters onto and off the grid; **Hint** places a right letter (as in her other two games) instead of giving a definition.
- **Tray shows the tapped section only**, so tiles stay big on every level; every section also prints its letters small in its corner, as Knotwords does, so all of them can be seen at once.
- **Wrong words:** a soft pink squiggle through a filled run that isn't a real word; no message, no sound.
- **One answer by construction:** puzzles are made ahead of time by merging sections while a solver confirms the answer is still unique (§3).

## 1. The screen

```
┌──────┬────────────────────────────────────────────────────────┬──────┐
│      │ [Hint]  ( [A] [E] [O] [P] )             [Games][Clock] │      │
│      │                                                        │      │
│ safe │         ┏━━━━━━━━━━━┳━━━━━━━┓                          │ safe │
│ zone │         ┃ E   E   R ┃ I   E ┃                          │ zone │
│      │         ┗━━━┳━━━━━━━┻━━━┳━━━┛                          │      │
│      │             ┃ D~~I~~L~~ ┃     (squiggle)               │      │
│      │            …the rest of the crossword…                 │      │
│      │ [Easy][Medium ✓][Hard]                                 │      │
└──────┴────────────────────────────────────────────────────────┴──────┘
```

- **Safe zones and play area:** exactly as in the other games (left `clamp(width − 890, 130, 200)`, right 130); nothing is drawn in them.
- **Top right:** the frame's **Games** and **Clock** buttons, unchanged.
- **Hint** in the top-left corner and **Easy**, **Medium**, **Hard** in a row along the bottom left, in the same places as in every game (see "Shared layout" below).
- **Tray** at the top, between Hint and the top-right buttons (16 px clear of each): a soft-yellow backing `clamp(12% of screen height, 96, 110)` px tall holding up to four square tiles (tray height − 12 px, 12 px apart), centered in that space.
- **Grid** in the whole width of the play area, from 16 px below the tray to 16 px above the level buttons. Square size = the largest that fits the puzzle's box (4, 5 or 6 squares each way) in that space, at most 150 px; the grid is centered in it. On the smallest iPad (1024×768) that's about 136 px on Easy, 108 px on Medium and 90 px on Hard; on the shorter 1133×744 iPad, Hard is 86 px.
- **Sizing** is computed by a pure layout function and tested at 1024×768, 1080×810, 1133×744, 1180×820, 1194×834, 1366×1024 and 1376×1032: nothing in the safe zones, nothing overlapping the top-right buttons, squares at least 85 px and tray tiles at least 84 px.

### Shared layout (all three games)

So she always finds them in the same place, every game puts the same buttons in the same spots, worked out once by the frame's layout:

- **Hint**: always the top-left button of the play area, 130 × 96 px, white with a 4 px gold border, lightbulb icon and "Hint".
- **The game's own purple button** right beside Hint, the same size, 4 px purple border: **Shuffle** to its right in Word Circle; **All letters** below it in Word Guess (with Today's Wordle below that); Word Grid has none.
- **Easy, Medium, Hard**: in Word Circle and Word Grid, a row along the bottom left of the play area, each 100 × 64 px, 8 px apart (three fit beside Word Circle's letter circle on the narrowest iPad). White with a 3 px gray border; her level has a 6 px purple border and a check above the word. Word Guess has no levels.
- **Games and Clock**: top right, unchanged.
- **Finished words**: a 5 px green border and light green fill with dark letters in every game (Word Circle's found words gained the fill).

Word Circle keeps the same room for its word slots: Hint and Shuffle took the levels' old place at the top, and the levels took the buttons' old place at the bottom.

### Colors and look (Sky, as in the other games)

| Element | Look |
|---|---|
| Square | white; 2 px gray `#9AA6B2` line between squares of the same section |
| Section outline | 6 px dark blue `#1B3A6B` |
| Blocked square | nothing drawn (background shows), so the grid reads as a crossword |
| Section's letters (corner) | dark blue `#1B3A6B`, in its first square (reading order) top-left, 18% of the square, at least 18 px; letters already placed are dimmed to 35% |
| Selected square | 7 px orange `#E07B24` border inside the square |
| Selected section | pale orange `#FFE9D6` fill on its squares |
| Placed letter | `#141414`, 62% of the square |
| Hinted letter | dark blue `#1B3A6B`, locked |
| Tray backing | soft yellow `#FBE3A0`, rounded |
| Tray tile | white, 4 px dark blue border, letter `#141414` at 62% of the tile |
| Tray tile already placed | dashed border, tile and letter at 35% |
| Tile being dragged | follows the finger at 110% size, orange border plus orange ring (like a selected Word Circle tile) |
| Not-a-word squiggle | soft pink `#D9577F`, 6 px wavy line at 80% through the run's squares |
| Finished word | 5 px green `#2E9E4F` border and the light green fill Word Guess uses, on its squares |
| Level buttons / Hint | as in every game (Shared layout above) |

## 2. How Word Grid plays

### Selecting

- When a puzzle opens (or she comes back to it), its first empty square in reading order is selected; if every square is filled, the first square is.
- Tapping any square selects it: orange border, its section turns pale orange, and the tray shows that section's letters (all of them; the ones already placed are faded).
- Hinted squares can be selected (so the tray shows that section) but never changed.

### Placing, moving and removing letters

All through the per-finger tracker: a finger that lands on a tray tile or a placed letter and moves more than 12 px is a **drag**; one that lifts within 2 seconds, having moved less, is a **tap**.

- **Tap a tray letter** (not faded): it goes into the selected square. If that square already had a letter, that letter goes back to the tray. Selection then moves to the next empty square of the same section (reading order); if the section is full, it stays.
- **Drag a tray letter** onto any square of the selected section: it lands there; a letter already there goes back to the tray. The section's squares stay highlighted while she drags.
- **Drag a placed letter** onto another square of its own section: the two swap (or it moves, if that square was empty). That square becomes the selected one.
- **Drag a placed letter off the grid** (anywhere that isn't a square of its section, including the safe zones): it glides back to the tray.
- **Wrong section:** dropping a tray letter on a square of another section, or anywhere else off its section, makes it glide back to the tray. Letters never cross sections.
- Hinted squares never change: their letters can't be picked up, and a tray letter tapped or dropped onto one goes back to the tray.
- Only one letter is dragged at a time; other fingers (such as a resting thumb) are ignored, as in tracing.

### Not-a-word squiggle

- A **run** is two or more squares in a line across or down with no blocked square between them; every run must spell a real word (§3).
- When every square of a run is filled and it isn't a real word, the squiggle fades in through it (300 ms). It goes away as soon as any letter in that run changes.
- Runs that aren't full are never marked.

### Hint

- Free and unlimited. Puts the right letter in the selected square, unless it's already right; then it fills the first square (reading order) that is empty or wrong instead.
- The right letter comes from the tray if a copy is still there; otherwise from a square of the section where it's wrong (there always is one). Whatever was in the hinted square goes back to the tray.
- The hinted letter turns dark blue and is locked. Hinted squares are saved.
- After 2 minutes without a letter placed or moved, the Hint button gently pulses every 4 seconds until she does something. It never fills anything by itself.

### Finishing

- When every square is filled and every run is a real word, the puzzle is solved. (Because each puzzle has exactly one answer under the same word list, that is the answer.)
- The words turn green one at a time (reading order, across then down, 250 ms each), then the frame's "Well done!" card (§5).

### Levels

- **Easy**, **Medium**, **Hard** (§3) each keep their own place in their list and their own placed and hinted letters, so switching never loses anything. Tapping a level shows its puzzle (500 ms slide, as in Word Circle). She starts on Easy.
- While a level's puzzle is finishing (words turning green, "Well done!"), the level buttons wait.

### Timing

| Situation | What she sees | Timing |
|---|---|---|
| Taps a square | border and section tint move; tray letters fade over | 200 ms |
| Taps a tray letter | letter pops into the square | 150 ms |
| Drops a letter on a square | letter settles into the square | 150 ms |
| Letter goes back | glides to its place in the tray | 250 ms |
| A full run isn't a word | squiggle fades in | 300 ms |
| Hint | letter pops in, dark blue | 150 ms |
| Switches level | puzzle slides in | 500 ms |
| Solves the puzzle | words turn green one at a time, then "Well done!" | 250 ms per word |

No sound, no flashing, no shaking.

## 3. Puzzles

### Levels

| | Easy | Medium | Hard |
|---|---|---|---|
| Grid box | 4 × 4 | 5 × 5 | 6 × 6 |
| Squares (about) | 11 | 18 | 25 |
| Words | 2–4 letters | 2–5 letters | 2–6 letters |
| Biggest section | 3 letters | 4 letters | 4 letters |
| Sections (about) | 5 | 6 | 9 |
| Puzzles | 500 | 500 | 500 |

### Words

- **Answer words** (what the generator fills grids with): SCOWL size ≤ 20, 3–6 lowercase letters `a–z`, plurals and other endings allowed (Knotwords uses them; they make good grids possible), plus 27 everyday two-letter words: am an as at be by do go he hi if in is it me my no of oh on or ox so to up us we. Never on the never-use list (`words/blocklist.txt` plus SCOWL's taboo lists) and never on `words/guess-skip.txt` (the owner's touchy words, now used by both Word Guess and Word Grid).
- **Real words** (what the squiggle and the one-answer check use): SCOWL size ≤ 60, 3–6 letters (about 16,500 words, about 40 KB zipped), plus the answer two-letter words and ad ah ax eh ha ho id la lo ma pa ye. Never-use words are not real words. Every answer word is a real word.
- No word appears twice in one puzzle.

### Shapes

A random crossword shape in the level's box: about 70% of the box's squares open (never under 60% or over 90%); every row and column of the box has at least one open square; the open squares are all one piece (connected side to side); every open square is in at least one run.

### Making a puzzle (one answer by construction)

1. **Shape:** pick a random shape (above).
2. **Fill:** fill it square by square with random letters, backtracking, so every run can still become an answer word; at the end every run is an answer word and no word repeats. Give up on a shape after 20,000 steps and pick another.
3. **Sections:** start with every square as its own one-letter section; that puzzle has exactly one answer. Repeatedly pick two neighbouring sections whose sizes add up to no more than the level's biggest section, preferring the smallest pairs, and merge them; then count the puzzle's answers with the solver (up to 2). If the count is still 1, keep the merge; otherwise undo it and never try that pair again. Stop when no pair is left. Merging only ever adds answers, so the result has exactly one.
4. **Keep it** if it has at most one one-letter section and isn't a repeat of an earlier puzzle; otherwise start over.

The **solver** fills squares in reading order with letters from each square's section (each letter used as often as the section has it), checking after each letter that every run through that square can still become a real word; it stops counting at 2.

### Build

- **`npm run grid-puzzles`** (`scripts/build-grid-puzzles.ts`, using `scripts/grid-lib.ts` and the existing `scripts/scowl.ts`) makes all three levels with a fixed seed, so rebuilds are identical, and writes:
  - `src/data/grid-puzzles.json`: `{ easy: GridPuzzle[], medium: …, hard: … }`, each puzzle `{ "size": 5, "cells": "eerie.lid..odes.pea.be.so", "sections": "aaabb.ccc..deee.ddd.ff.gg" }` (reading order, `.` for a blocked square, sections lettered in order of first appearance). A puzzle's `cells` string is its id.
  - `src/data/grid-words.json`: `{ "words": [...] }`, every real word, sorted.
  - Both are committed, like Word Circle's puzzles. It takes about two minutes (Easy 2 s, Medium about 30 s, Hard about 90 s); `npm run puzzles` is unchanged.
  - At the first review the owner kept 12 odd short words out of the answers by adding them to `words/guess-skip.txt` (hes, sic, ugh, huh, sod, gin, con, ken, mod, cam, ion, scum).
- **Build checks** (the script fails on any): a second solver, written independently (section by section, trying each arrangement of a section's letters), finds exactly one answer for every puzzle, and it's the stored one; every run of every puzzle is an answer word and none repeats; every section is connected, 1 to the level's biggest size, with at most one one-letter section; shapes follow the rules above; no puzzle appears twice in a level; at least 400 puzzles per level.
- **Review page:** `docs/grid-sample.html` (its own page, so the two puzzle scripts never overwrite each other's), written by the same script, drawing the first 20 puzzles of each level (solved, with sections outlined) and listing every answer word used, so the owner can skim and blocklist any. After blocklisting, run `npm run grid-puzzles` again.
- **Order:** each level plays its list in order and wraps to the start after the last puzzle.

## 4. Structure

Word Grid is a `GameScreen` in its own folder, plugged into the frame like the other two games.

```
src/
  grid/
    types.ts        GridPuzzle, levels, saved progress types
    puzzle.ts       reading a GridPuzzle: squares, runs, sections and their letters
    rules.ts        placing, swapping and removing letters; runs to squiggle; solved; hint target
    words.ts        the real-word check (from grid-words.json)
    storage.ts      word-grid:v1
    celebration.ts  the lines of good news on its "Well done!" card
    layout.ts       left column, tray, grid at every iPad size
    view.ts         draws the grid, sections, corner letters, tray, dragged tile, squiggles, green finish
    screen.ts       controller
  input/touch.ts    adds dragging (below)
  frame/games.ts    GAME_IDS gains 'grid'; GameScreen gains optional drag callbacks
  frame/frame.ts    passes drags to the current game
  frame/view.ts     Word Grid's picture in the Games pop-up
  data/grid-puzzles.json, data/grid-words.json   generated
scripts/
  grid-lib.ts             shapes, filling, merging sections, both solvers, checks
  build-grid-puzzles.ts   writes the data and the review page section
```

### Dragging in the touch tracker

- `TracerGeometry` gains `draggables: ButtonGeometry[]` (tray tiles and squares with letters). A finger landing on one (outside the safe zones, while no word is being traced and nothing else is dragging) starts a press on it.
- If it moves more than 12 px from where it landed, the tracker calls `dragStarted(id)`, then `dragMoved(id, x, y)` on every move, and `dragEnded(id, x, y)` when it lifts (or `dragCancelled(id)` on cancel). The game decides where the letter lands from `x, y`.
- If it lifts within 2 seconds having moved less, it's a tap: `buttonTapped(id)`, as for buttons. Empty squares are ordinary buttons (tap to select).
- Other fingers are ignored while a drag is in progress, so her resting thumb never interferes. Word Circle and Word Guess don't use draggables, so they behave exactly as before.

### Frame changes

- `GAME_IDS = ['circle', 'guess', 'grid']`; the Games pop-up shows three cards (about 226 px wide on the smallest iPad), Word Grid's picture being a small outlined crossword.
- `word-games:v1` accepts `current: 'grid'`.
- Nothing else in Word Circle or Word Guess changes.

## 5. "Well done!" card for Word Grid

- The same full-screen card as Word Circle's: **"Well done!"**, then her good news, one line each, only ever good news:
  - **"Solved with no hints"**, only when she used no hint on this puzzle.
  - **"5 days in a row"**: shared with the other games; shown from day two.
  - **"3 puzzles today"**: Word Grid puzzles today.
  - **"Puzzle number 12"**: Word Grid puzzles finished, with the orange highlight at the same milestones as the other games (10, 25, 50, 100, 250, 500, 750, 1,000, then every 500).
- **Next puzzle** button (arrow icon); moves on by itself after 15 seconds.
- The next puzzle is saved as her place before the card appears, so closing the app mid-celebration loses nothing.

## 6. Saving

All in `localStorage`; damaged or missing data never costs her progress elsewhere.

- **`word-grid:v1`** — `{ level, levels, stats }`:
  - `level`: `'easy' | 'medium' | 'hard'` (starts `'easy'`);
  - `levels`: for each level she has played, `{ index, id, placed, hinted }`: her position in that level's list, the puzzle's `cells` string, one letter or `''` per square (reading order, blocked squares `''`), and the hinted squares' positions;
  - `stats`: `{ totalSolved, todaySolved, lastPlayedDay }`.
  - Saved after every letter placed, moved or hinted, and on pause.
  - If the puzzle at `index` no longer has the saved `id` (the list was regenerated), that position starts fresh. Letters that don't belong to their square's section are dropped.
- **`word-games:v1`** — gains `'grid'`; both other games still update the shared days in a row, and Word Grid does too.

## 7. Testing

- **Unit tests (Vitest), written before the code:**
  - `scripts/grid-lib`: the solver on hand-made puzzles with one and with two answers; shapes follow the rules; filling makes answer words with no repeats; merging keeps exactly one answer; the independent solver agrees with the first on random small puzzles; the build checks catch a broken puzzle.
  - **Shipped puzzles:** every puzzle in `grid-puzzles.json` re-solved by the independent solver (exactly one answer, the stored one), and every run an answer word.
  - `grid/puzzle` and `grid/rules`: runs (blocked squares split them, one-square runs don't count); placing, replacing, swapping, removing; letters never crossing sections; the tray's faded letters (repeated letters counted right); runs to squiggle (only full, only not real); solved; hint target, moving the right letter out of another square, locking; selection after placing.
  - `input/touch`: tap versus drag on draggables, the 12 px threshold and 2-second limit, a drag starting in a safe zone ignored, other fingers ignored while dragging, cancel, and tracing and buttons unchanged.
  - `grid/storage` and `frame/storage`: round trips, regenerated list, letters in the wrong section dropped, damaged data, `'grid'` accepted.
  - `grid/celebration`: the lines, with and without hints, milestones.
  - Layout (Word Grid and the frame's three Games cards) at every iPad size: nothing in the safe zones, nothing overlapping, squares at least 85 px and tray tiles at least 84 px on every level; Hint and the level buttons exactly where the frame puts them in every game.
- All existing tests keep passing; `npm test` and `npm run build` stay green.
- **Browser checks** at 1024×768, 1133×744, 1180×820 and 1366×1024 on the `127.0.0.1:5173` test address (so the owner's own saved progress isn't touched): every level, tapping and dragging letters on, between and off the grid, the squiggle, Hint, finishing, switching levels and games, reloading mid-puzzle.

## 8. Build order

Each stage ends with a stop for the owner to look before the next; commits as we go.

1. **Puzzles:** `grid-lib`, the build script, the data files, build checks and the review page section. *Stop: owner skims the puzzles and words and blocklists any.*
2. **The game:** dragging in the touch tracker, Word Grid's rules, saving, layout, drawing and controller, the third Games card, its "Well done!" card. *Stop: owner plays it in the browser (and on her iPad's Simulator if wanted).*
3. **Docs:** this spec's status, the Word Guess spec (the Games pop-up now has three games; `guess-skip.txt` is shared), README (`npm run grid-puzzles`, the shared skip list), setup guide if needed. Then message the other session and ask before pushing anything live.

## Out of scope

A daily puzzle, Knotwords' Twist and adjective puzzles, definition hints, sound, a statistics screen, timing or records, and the native iPad app.
