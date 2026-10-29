# Jigsaw cartoons plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Starter pictures get a hand-drawn cartoon look, switched with a Cartoons button on "Pick a picture".

**Architecture:**
- Drawings are SVG files in `art/jigsaw/`. The starter script renders them to PNGs listed in `starters.json`.
- `Picture.cartoon` carries the drawing's addresses.
- The pure helper `pictureShown` swaps the drawing in when the saved `cartoons` setting is on.

**Tech stack:** TypeScript, Vitest, sharp (in the script).

Spec: `docs/superpowers/specs/2026-10-29-jigsaw-cartoons-design.md`.

---

### Task 1: Starter list reads drawings

**Files:**
- Modify: `src/jigsaw/types.ts`
- Modify: `src/jigsaw/pictures.ts`
- Test: `tests/jigsaw-pictures.test.ts`

- [ ] Add a failing test: an entry with `cartoon: 'a.cartoon.png'` and `cartoonThumb: 'a.cartoon.thumb.png'` gives
      `cartoon: { src: '/word-circle/jigsaw/a.cartoon.png', thumb: '/word-circle/jigsaw/a.cartoon.thumb.png' }`.
- [ ] Add a failing test: a bad cartoon name (`'../x.png'`, a number, or only one of the two names) keeps the
      picture without `cartoon`.
- [ ] Add a failing test: `pictureShown(p, false)` returns `p`. `pictureShown(p, true)` swaps `src` and `thumb` when
      `p.cartoon` exists, keeps the same id and caption, and returns `p` unchanged when there's no cartoon.
- [ ] Add `cartoon?: { src: string; thumb: string }` to `Picture`.
- [ ] Parse the cartoon names in `parseStarters`.
- [ ] Export `pictureShown` from `pictures.ts`.
- [ ] Extend the published-list test so it also checks the cartoon files exist.
- [ ] Run `npx vitest run tests/jigsaw-pictures.test.ts`. Expected: pass.
- [ ] Commit.

### Task 2: Remembered setting

**Files:**
- Modify: `src/jigsaw/storage.ts`
- Test: `tests/jigsaw-storage.test.ts`

- [ ] Add failing tests:
  - `freshJigsaw().cartoons` is `false`.
  - A saved `cartoons: true` loads as true.
  - `cartoons: 'yes'` loads as false.
- [ ] Add `cartoons: boolean` to `SavedJigsaw`, set it in `freshJigsaw`, and read it in `loadSavedJigsaw`.
- [ ] Run the storage tests. Expected: pass.
- [ ] Commit.

### Task 3: The button's place

**Files:**
- Modify: `src/jigsaw/layout.ts`
- Test: `tests/jigsaw-layout.test.ts`

- [ ] Add a failing test: on the iPad sizes the layout tests already use, `cartoons`:
  - lies within the title row's height;
  - ends `GAP` left of `frame.corner.x`;
  - is `CARTOONS_WIDTH` wide;
  - doesn't overlap `title`, which now ends `GAP` before it.
- [ ] Add `cartoons: Rect` to `PicturePageLayout` and set it, along with the shortened `title`.
- [ ] Run the layout tests. Expected: pass.
- [ ] Commit.

### Task 4: Page, screen and view

**Files:**
- Modify: `src/jigsaw/picture-page.ts`, which gets `PicturePageState.cartoons: boolean | null`. `null` means no
  button.
- Modify: `src/jigsaw/screen.ts`:
  - It keeps `listed` pictures. `pictureShown` is applied when one starts, at Close, and on the tiles.
  - It handles the `cartoons` target, which only exists while the page shows the button.
- Modify: `src/styles.css` for the button in the title row.

- [ ] Draw the Cartoons button with the existing choice look: the tick icon plus "Cartoons", with `.selected`
      when it's on.
- [ ] In the screen, a tap flips `saved.cartoons`, saves it, re-resolves `this.picture` from the list by id when a
      puzzle is open, and redraws the page.
- [ ] `startPicture`, the restored current picture and `closePictures` all show `pictureShown(...)`.
- [ ] Run `npm test` and `npx tsc --noEmit`. Expected: pass.
- [ ] Commit.

### Task 5: The starter script renders drawings

**Files:**
- Modify: `scripts/jigsaw-photos.ts`
- Modify: `scripts/jigsaw-lib.ts` if a pure helper is needed
- Create: `art/jigsaw/*.svg` (the seven drawings)

- [ ] For each starter with `art/jigsaw/<id>.svg`, write `<id>.cartoon.png` (1600 × 1200) and
      `<id>.cartoon.thumb.png` (448 × 336) as palette PNGs, and add `cartoon` and `cartoonThumb` to its entry.
- [ ] Stop with an error for a drawing whose id isn't a starter.
- [ ] Show the drawings on the review page `docs/jigsaw-starters.html` beside each photo.
- [ ] Copy the originals into the worktree's git-ignored `photos/starter/` and run `npm run jigsaw-photos`. Expected:
      seven photos come out unchanged, plus 14 PNGs and a `starters.json` with cartoon names.
- [ ] Run `npm test` and `npm run build`. Expected: pass.
- [ ] Commit.

### Task 6: Check in the browser

- [ ] In the browser pane at 1024 × 768, with transitions off:
  - The page shows the Cartoons button, and tapping it turns the tiles into drawings.
  - A puzzle opens as the drawing.
  - Pictures, then Cartoons, then Close mid-puzzle shows the photo, with the place kept.
  - It survives a reload.
  - A family photo stays a photo.
  - Hide edges and Move picture still work.
  - There are no console errors.
