# Jigsaw — Design

**Date:** 2026-10-28
**Status:** Approved in brainstorming 2026-10-28; not built yet.
**Builds on:** `2026-10-19-word-circle-design.md` (player, constraints, colors, font, touch rules), `2026-10-19-word-grid-design.md` (shared layout, dragging, tray), `2026-10-19-caregiver-settings-design.md` (settings page), `2026-10-20-stats-design.md` and `2026-10-20-hint-star-design.md`

## Purpose

Add a fourth game to the site: **Jigsaw**, a big-piece jigsaw puzzle made from photos. Families' own photos turn it into a way to remember people and places, so it is built around pictures as much as pieces. It keeps what the best jigsaw apps do well (real jigsaw-shaped pieces, a faint picture showing where pieces go, snapping, saving mid-puzzle, the finished picture shown big) and changes what her eyesight and dementia need: few, big pieces, no turning pieces, no zooming or scrolling, a Hint that places a piece, and no way to lose.

**Success looks like:** she can pick a picture, finish it in any of the three styles with or without hints, see the finished photo with its caption, and move between pictures, styles, piece counts and games without help. A family member can add a photo from the iPad's photo library, frame it, caption it, and see it as a puzzle.

### Decisions made in brainstorming

- **Name:** Jigsaw.
- **Pictures come from two places.** *Starter pictures* that the owner sends through Claude; they are public (in the GitHub repo) and go to every family's iPad. *Family photos* added on each iPad from its photo library; they stay on that iPad only.
- **Adding happens in both places:** an "Add a photo" tile on the game's picture page (she or a visitor can add one on the spot) and a "Jigsaw pictures" section on the settings page (several at once, edit captions and framing, remove). Removing happens only on the settings page.
- **Captions:** one optional free-text box, up to two short lines (e.g. "Rose and Al, Lake George, 1987" or "Sarah, born June 4, 1990"). Shown big under the finished picture and on one line under its thumbnail.
- **She always chooses:** after every puzzle, Next opens the picture page; nothing picks the next picture for her.
- **Pieces:** 9, 16 or 30 (3×3, 4×4, 6×5).
- **Three play styles, all available:** Tray, Board and Table (§2). Style and piece count are chosen independently on **two rows of buttons on screen**, so all nine mixes are possible.
- **Every puzzle is landscape 4:3.** Portrait photos are framed: the family chooses which part goes in the puzzle.
- **Jigsaw appears for every family**, including those who set up before it existed; they can turn it off on the settings page.
- **Starter pictures are published like schedule events:** when the owner sends them, they go live straight away without asking first.

## 1. The screen

```
┌──────┬────────────────────────────────────────────────────────┬──────┐
│      │ [Hint][Pictures] ( ▣ ▣ ▣ )              [Games][Clock] │      │
│      │                                                        │      │
│ safe │        ┌─────────────────────────────────────┐         │ safe │
│ zone │        │ ▓▓ ▓▓ ░░ ░░ ░░ ▓▓   faint picture   │         │ zone │
│      │        │ ▓▓ ░░ ░░ ░░ ░░ ░░   ▓ placed piece  │         │      │
│      │        │ ░░ ░░ ░░ ░░ ░░ ░░                   │         │      │
│      │        └─────────────────────────────────────┘         │      │
│      │ [Tray][Board][Table]                                   │      │
│      │ [ 9  ][ 16  ][ 30  ]                                   │      │
└──────┴────────────────────────────────────────────────────────┴──────┘
```

- **Safe zones, Games and Clock:** exactly as in the other games.
- **Hint** in the frame's `hintButton` (top-left of the play area).
- **Pictures** (the game's own purple button, 4 px purple border, same size as Hint) 16 px to the right of Hint, where Word Circle's Shuffle sits.
- **Tray** (Tray and Board styles): a soft-yellow backing from 16 px right of Pictures to 16 px left of the top-right corner, the same height as Hint, holding **3 square slots**. Slot size = `min(trayHeight − 12, (trayWidth − 4 × 12) / 3)`, 12 px apart, centered. A piece sits scaled down to fit its slot (tabs included) and grows to full size when picked up. On the smallest iPad (1024×768) the tray is 264 px wide and the slots 72 px, so a tray piece is about half its board size at 30 pieces but only about a quarter at 9; bigger iPads have a wider tray. Worth a close look at the first checkpoint.
- **Box lid** (Table style): the tray's place shows the whole picture small (4:3, as tall as the tray), like the lid of a puzzle box. It is not a button.
- **Two rows of buttons** at the bottom left, each 100 × 64 px, 8 px apart, in the shared level-button look (white, 3 px gray border; the chosen one has a 6 px purple border and a check above its label):
  - bottom row in the frame's `levelButtons` rects: **9**, **16**, **30**;
  - the row 8 px above it: **Tray**, **Board**, **Table**.
- **Board** (Tray and Board styles): the largest 4:3 rectangle that fits the full play-area width, from 16 px below the Hint row to 16 px above the style row, centered horizontally. On the smallest iPad it is about 629 × 472, so a piece's body is about 210 × 157 (9 pieces), 157 × 118 (16) and 105 × 94 (30); bigger on bigger iPads.
- **Free area:** the play area minus Hint, Pictures, the tray or lid, the top-right corner and the two button rows. Loose pieces (Board and Table styles) always stay inside it; one dropped partly outside is nudged back in.
- **Sizing** is a pure layout function, tested at 1024×768, 1080×810, 1133×744, 1180×820, 1194×834, 1366×1024 and 1376×1032, both thumb sides: nothing in the safe zones, nothing overlapping the corner, the rows or each other, 30-piece board pieces at least 95 px wide (the 1133×744 iPad is the tightest, at about 99), Table pieces at least 70 px wide.

### Pieces

- **Shape:** classic jigsaw pieces. Every inside edge has a tab on one side and a matching hole on the other; the outside edges are flat. Tabs reach about 20% of the piece's shorter side. Which way each tab points comes from a seed made from the picture and the piece count, so the same puzzle always cuts the same way (saved progress redraws exactly).
- **Look:** each piece is the photo cut to its shape, with a 2 px white edge and a soft shadow while it's loose or held. Placed pieces lose the shadow. No turning, ever.
- **Drawing:** pieces are cut once from the photo into small images and moved with transforms, so 30 pieces drag smoothly.
- **Touch target:** a piece's body rectangle (without its tabs). Where pieces overlap, the topmost wins: the game lists draggables topmost first, because the touch tracker takes the first match.

## 2. How it plays

### Tray style

- The board shows the picture faintly (30% opacity) behind thin light lines along the piece edges.
- The tray holds three pieces at a time. They come in this order: the four corners, then the other edge pieces, then the middle, each group shuffled (seeded). When a piece leaves the tray, the next one slides in.
- **Drag:** she picks a piece up from the tray. Dropped with its center within 40% of a piece's width and height of its own spot, it glides in and clicks into place (fixed from then on). Dropped anywhere else, it glides back to its tray slot.
- **Tap then tap:** tapping a tray piece lifts it (purple outline, a little bigger). Tapping its own spot on the board sends it there. Tapping anywhere else, or the lifted piece again, puts it back.
- No wrong marks, no sound, no counting.

### Board style

Like Tray, except a piece dropped anywhere other than its spot **stays where she left it** (on the board or in the free area), and the tray hands her the next piece. A piece left lying around can be picked up again at any time and clicks in if dropped near its spot. Tap then tap works the same, except tapping somewhere other than its spot moves the piece there. The most recently moved piece is on top.

### Table style

- No board and no faint picture; the box lid shows the whole picture small.
- All the pieces start spread out over the free area in a jittered grid, not touching each other. Piece size is the largest that lets them all fit like that, so they are smaller than on the board: on the smallest iPad about 140, 105 and 75 px wide for 9, 16 and 30 pieces.
- **Joining:** when she drops a piece or group so that one of its pieces lands within 30% of a piece's size of where it belongs next to another piece, the two snap together and join. A joined group moves as one when she drags any piece in it.
- When every piece is in one group, the picture is done: it glides to the middle of the screen and grows to the board's size.
- Tap then tap: tapping a piece lifts it; tapping elsewhere in the free area moves it (and its group) there.

### Hint (all styles)

The Hint star (`src/ui/hint-star.ts`) flies from the Hint button to a piece, and the piece glides home:
- **Tray and Board:** the first piece in the tray, or, if the tray is empty, a piece left lying around.
- **Table:** a piece (with its group) that belongs next to the biggest group glides over and joins it.
Each counts as one hint. The game is busy (pop-ups wait) until the piece lands.

### Changing style or piece count

Tapping another style or piece count cuts the same picture again for that mix. Her place in each mix is kept, so switching back picks up where she was (see §5 for how many are kept).

### Finishing

1. The last piece clicks in (or the last two groups join).
2. The seams fade away over 0.6 s, leaving the whole photo.
3. While she looks at a finished picture, the tray or lid and the two rows give way: the photo grows to fill the space, with the caption (if any) underneath it in big print, at most two lines.
4. After 2.5 s the "Well done!" card appears with its usual Back to puzzle and Your stats buttons. **Next opens the picture page.** Back to puzzle shows the finished photo and caption again, with Next in the rows' place (`reviewButton`).

### Timing

Active play time is measured as in the other games (`src/shared/timer.ts`); she never sees a clock or score.

## 3. Pictures

### The picture page ("Pick a picture")

- Opens the first time she opens Jigsaw, after every finished puzzle (Next), and from the Pictures button. Opening Jigsaw later returns to the puzzle in progress, or to this page if there is none.
- Drawn by the game across the play area, like the frame's pop-ups; Games and Clock stay on top and usable, so she can still switch games.
- A grid of 3 × 2 tiles in the play area (about 224 × 168 each on the smallest iPad). The first tile on every page is **Add a photo** (dashed purple border, big +), so it is always in the same place; the other five are pictures.
- Under each picture, its caption on one line, cut short with "…" if it doesn't fit.
- **Order:** family photos newest first, then the starter pictures (if shown) in the owner's order.
- A **green check** on every picture she has finished, in any style or piece count.
- Big **‹ Back** and **More pictures ›** buttons at the bottom instead of scrolling; Back is hidden on the first page and More pictures on the last.
- **Close** appears only when she opened the page from Pictures with a puzzle in progress; it goes back to that puzzle.
- Tapping a picture starts it in her current style and piece count, or picks up where she left off in that mix. A finished picture starts afresh (its check stays).
- With no pictures at all (starters hidden and no family photos), the page shows only Add a photo.

### Adding a photo in the game

1. **Add a photo** opens the iPad's own picker through a hidden `<input type="file" accept="image/*">`. iPadOS first shows its own menu (Photo Library / Take Photo / Choose File); a web page can't skip it. Cancelling adds nothing.
2. The **"Your new puzzle"** screen is an ordinary page layer above the game (not inside the touch tracker), because it needs a real text box and the on-screen keyboard. So the keyboard never hides what she needs, the photo is on the left, and the caption box and buttons are on the right, top-aligned.
   - The photo is shown with a 4:3 white frame over it; outside the frame is dimmed. Dragging the photo moves it under the frame, which always stays inside the photo.
   - Starting frame: centered across; up and down, the frame starts a quarter of the way into the spare height (near the top, where faces usually are).
   - **Caption (optional)** box: up to two lines, 80 characters, with the grayed example "Rose and Al, Lake George, 1987".
   - **Start puzzle** saves the photo and starts its puzzle in her current style and piece count. **Cancel** adds nothing.
3. If the photo can't be read: "That photo can't be used. Try another one." If it can't be saved (iPad full): "That photo couldn't be saved. The iPad may be full." Nothing is added in either case.

### Settings page: "Jigsaw pictures"

A folded section on the caregiver settings page:
- **Add photos:** the same picker, allowing several at once; each lands at the top of the list with the starting frame and no caption.
- Each family photo in a row: its framed thumbnail, its caption box (saved as they type), **Change framing** (the framing screen) and **Remove**, which asks "Remove this picture from Jigsaw? It stays in Photos." first.
- **Show the starter pictures** tick box, on by default.

### Where family photos live

- Each photo is shrunk so its long side is at most 2000 px (keeping the whole photo, so the framing can change later) and saved as a JPEG with its caption, its frame and a 448 × 336 framed thumbnail.
- They are kept in the Home Screen app's own IndexedDB database on that iPad. The app asks the iPad to keep its storage permanently (`navigator.storage.persist()`).
- They are never uploaded and never appear in Share, the family stats or Google Analytics. They don't move to a new iPad, and deleting the Home Screen icon deletes them; the originals stay in Photos.

### Starter pictures (through Claude)

- The owner sends photos in chat or drops them into `photos/starter/`, with an optional caption and, if it matters, which part to keep (top, middle or bottom; left, middle or right). Captions and framing notes go in `photos/starter/captions.txt`, one line per photo: `file name | caption | keep`.
- `npm run jigsaw-photos` (`scripts/jigsaw-photos.ts`, using the `sharp` image library as a dev dependency) frames each one to 4:3, shrinks it to 1600 × 1200 plus a 448 × 336 thumbnail, writes them to `public/jigsaw/` with `public/jigsaw/starters.json` (id, files, caption, in order) and writes a review page `docs/jigsaw-starters.html`. iPhone HEIC files are converted to JPEG first with macOS `sips`.
- The originals in `photos/starter/` stay out of git (`.gitignore`); only the shrunk copies are published.
- They are public and go to every family's iPad, so only photos the owner took or that are free to share.
- **Publishing:** like schedule events: check the review page, commit, push straight away, then confirm on the live site. If local main has someone else's unpushed work, publish from a temporary worktree based on origin/main.
- The service worker keeps the starter pictures on the iPad so they work without Wi-Fi (the precache patterns gain `jigsaw/*.jpg`).
- While the game is being built, a few plain stand-in pictures are used; the owner's first batch (10–20 is plenty) replaces them before launch.

## 4. Structure

Jigsaw is a `GameScreen` in its own folder, plugged into the frame like the other games.

```
src/
  jigsaw/
    types.ts         styles, piece counts, pictures, saved progress types
    cut.ts           grid, seeded tabs and holes, piece outlines
    layout.ts        board, tray or lid, rows, free area, piece sizes at every iPad size
    rules.ts         tray order, snapping, loose pieces, Table groups and joining, hint target, finished
    pictures.ts      the picture list: starters + family photos, order, pages, checks
    storage.ts       word-games:jigsaw:v1
    view.ts          draws the board, faint picture, pieces, tray, lid, rows, finished picture
    picture-page.ts  "Pick a picture"
    new-photo.ts     "Your new puzzle": framing and caption (also used by the settings page)
    celebration.ts   the finish and its "Well done!" card
    screen.ts        controller
  photos/
    store.ts         family photos in IndexedDB: add, list, update caption or frame, remove
    shrink.ts        photo file → shrunk JPEG and framed thumbnail
  settings/          the "Jigsaw pictures" section and the starter tick box
scripts/
  jigsaw-photos.ts   the starter pipeline
public/jigsaw/       starter pictures and starters.json (generated)
```

### Frame and settings changes

- `GAME_IDS` gains `'jigsaw'` and `GAME_TITLES` gains "Jigsaw". The Games pop-up shows four cards (about 164 px wide on the smallest iPad); Jigsaw's picture is a single jigsaw piece.
- `word-games:v1` accepts `current: 'jigsaw'`.
- **Settings:** a new `knownGames` list is saved with the settings. On load, any game not in it (for older settings, anything beyond the original three) is turned on and added to it, so new games appear for every family once. A new `jigsawStarters` setting (default true) drives the tick box. Mom's iPad, which has no settings, gets every game as now.
- **Play log:** `PlayRecord` for Jigsaw has `level` easy / medium / hard for 9 / 16 / 30 pieces, `hints` = pieces placed by Hint, `tries` 0, `typed` true, and a new optional `style: 'tray' | 'board' | 'table'`.
- **Analytics:** `puzzle_finished` gains a `style` parameter for Jigsaw. Never photos, captions or picture names.
- **Stats:** her finished jigsaws count in her stats cards (`GameSummary.solved`); the family charts gain a fourth color, the next slot of the dataviz reference palette.

## 5. Saving

`word-games:jigsaw:v1` in local storage:
- her style and piece count;
- the current picture, if a puzzle is in progress;
- her place in up to the **20 most recently played** picture / style / piece-count mixes: placed pieces, tray order, loose pieces' positions and Table groups. Positions are stored relative to the board or free area, so they still fit after the thumb side changes;
- the ids of pictures she has finished.

Family photos are in IndexedDB (§3). If a family photo is removed, its saved places and check go too; if it was the current puzzle, she lands on the picture page. Unreadable saved data starts afresh, as in the other games.

## 6. Testing

- **Automated (Vitest), pure parts:** every inside edge has a tab on one side and the matching hole on the other, and the same seed cuts the same way; tray order (corners, then edges, then middle); snapping distances; Board loose pieces; Table joining and groups moving together; hint targets in each style; finished detection; Table start positions don't overlap and stay in the free area; framing stays inside the photo and starts near the top; picture order, paging and checks; saving and loading, including damaged data and removed photos; the settings `knownGames` upgrade; the layout at all seven iPad sizes and both thumb sides.
- **IndexedDB** sits behind a small interface with an in-memory fake for tests, as `tests/memory-store.ts` does for local storage.
- **Browser** (the `word-circle-test` preview) at iPad sizes: all nine style and piece-count mixes, Hint, finishing, the picture page, settings.
- **iPad Simulator**, early, before the rest is built: the photo picker opens from a tap that goes through the touch tracker; photos come in the right way up; 30 pieces drag smoothly; the Home Screen app keeps photos after relaunch.
- **On her real iPad, after launch:** the photo picker under Guided Access, and whether the iPad's first picker menu is too much for her.

## 7. Build order

Each step is tested and committed before the next; the owner tries it at the two checkpoints.

1. Tray style with stand-in pictures: cutting, layout, tray, snapping, Hint, finishing, the picture page, saving. **Checkpoint: the owner tries it.**
2. Board and Table styles, and the two rows.
3. Family photos: the picker, "Your new puzzle" (framing and caption), the photo store. **Checkpoint: the owner tries it, including adding a photo.**
4. The settings section, `knownGames` and the starter tick box.
5. The starter pipeline and the owner's first batch; stats, analytics and the Games pop-up card.

## Out of scope

- Getting family photos onto an iPad from afar (a private photo box with an upload page was discussed and set aside).
- Portrait-shaped puzzles, rotating pieces, zooming, piece counts other than 9, 16 and 30.
- Sorting tools (edges-only filters, piece trays to sort into) beyond the tray's edge-first order.
- Removing photos from inside the game.
