# Jigsaw cartoons

**Status:** approved 2026-10-29.

## Why

The owner asked for brightly colored cartoon versions of the pictures, because they're easier for Mom to see. Photo
filters made on the iPad (bright colors, smoothed patches and outlines) looked like a filter, not a cartoon. A
Simpsons-style redraw of a family photo needs an online AI image service, which costs money and sends the photos to a
company. Claude drew the seven starter scenes by hand instead, as SVG. Those drawings belong to the project and can be
published for every family.

## What she sees

- **Cartoons button:** "Pick a picture" gets a Cartoons button at the right end of its title row, just left of
  the corner buttons. It uses the same tick-when-on look as Hide edges.
  - It only appears when at least one picture in the list has a drawing.
  - The puzzle screen doesn't change: there's no room left in its bottom-right corner.
- **With Cartoons on:** every picture with a drawing shows the drawing.
  - Its tile on the page shows the drawing's thumbnail.
  - The puzzle is cut from the drawing.
  - The guide picture, the small picture and the finished picture are the drawing too.
- **Pictures without a drawing:** family photos and any new starter stay photos either way.
- **Remembered:** the choice is kept, like Hide edges.
- **Switching mid-puzzle:** she taps Pictures, then Cartoons, then Close, and the same puzzle comes back in the other
  look. Her place is kept because pieces are the same shapes in either look. Places, finished ticks and stats are
  keyed by the picture, not the look.

## How

- **Drawings:** they're kept in `art/jigsaw/<starter id>.svg`, committed, at 1600 × 1200.
- **Starter script:** `npm run jigsaw-photos` renders each starter's drawing, when there is one, to:
  - `public/jigsaw/<id>.cartoon.png`, 1600 × 1200, as a palette PNG. That keeps flat colors sharp at 120–250 KB.
  - `public/jigsaw/<id>.cartoon.thumb.png`, 448 × 336.

  It adds `cartoon` and `cartoonThumb` (file names) to that starter's entry in `starters.json`. A drawing whose id
  isn't a starter stops the script with an error. The PWA already precaches every `.png`, so the drawings work offline.
- **`Picture`:** gains an optional `cartoon: { src, thumb }`.
  - `parseStarters` fills it in only when both names are plain file names, using the same check as `file` and `thumb`.
  - A damaged cartoon entry drops the cartoon, not the picture.
- **Showing a picture:** a pure helper `pictureShown(picture, cartoons)` returns the picture with `src` and `thumb`
  swapped for the drawing's when `cartoons` is on and the picture has one. The id stays the same.
  - The screen resolves the picture it shows through this helper, and so does the page's tiles. Everything
    downstream already works from `src`: the image cache, the cut key, the guide and the finished picture.
- **Saved setting:** `SavedJigsaw.cartoons: boolean`, false by default, read only when it's a boolean.
- **Layout:** `PicturePageLayout.cartoons` is a rect at the right end of the title row, `CARTOONS_WIDTH` wide. The
  title keeps the rest of the row.
- **The tap:** `cartoons` flips the setting, saves it, and redraws the page.
  - Mid-puzzle, the current picture is re-resolved, so Close shows the other look.
  - The pieces are recut because the view's cut key includes `src`.
  - Only the shown image is kept decoded, as before.

## Not now

- Drawings for family photos: they'd need an AI service, or an "Add cartoon" step in settings for a drawing made
  elsewhere.
- A switch on the puzzle screen.

## Tests

- **`parseStarters`:** reads cartoon names, and drops a damaged cartoon while keeping the picture.
- **`pictureShown`:** on and off, with and without a drawing.
- **Storage:** defaults to false, reads a boolean, and ignores junk.
- **Layout:** the Cartoons rect sits in the title row, left of the corner buttons, without overlapping the title.
- **The published list:** every cartoon file named in `starters.json` exists under `public/`. This extends the
  existing check.
