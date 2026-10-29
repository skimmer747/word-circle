# Jigsaw cartoons

**Status:** approved 2026-10-29. Later the same day the button was moved onto the puzzle, then added back on Pick a
picture as well.

## Why

The owner asked for brightly colored cartoon versions of the pictures, because they're easier for Mom to see. Photo
filters made on the iPad (bright colors, smoothed patches and outlines) looked like a filter, not a cartoon. A
Simpsons-style redraw of a family photo needs an online AI image service, which costs money and sends the photos to a
company. Claude drew the seven starter scenes by hand instead, as SVG. Those drawings belong to the project and can be
published for every family.

## What she sees

- **Cartoon button:** the puzzle gets a **Cartoon** button right after Tray, Board and Table, as tall as both button
  rows. It uses the same tick-when-on look as Hide edges, and appears only when the picture has a drawing.
  - Tapping it mid-puzzle switches the pieces, the faint guide and the small picture between the photo and the
    drawing.
  - Her place is kept, because the pieces are the same shapes in either look. Places, finished ticks and stats are
    keyed by the picture, not the look.
  - The new look is loaded before it's shown, so pieces never blink out.
- **Room for it:** there is room on most iPads. On the smallest ones (1024 × 768, 1080 × 810, 1133 × 744 with a
  thumb side), the small corner picture from Move picture gets smaller to make room, down to about half size. The
  board never changes.
- **Remembered:** the choice is kept, and other pictures with a drawing open the same way. Pick a picture's tiles
  follow it too.
- **Pictures without a drawing:** family photos and any new starter have no button and stay photos.
- **On Pick a picture too:** a **Cartoons** button sits at the right end of the title row, just left of the corner
  buttons. The owner asked for both. It's shown when any picture has a drawing, and it switches the same choice: the
  tiles change straight away, and Close brings back the puzzle in that look.

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
- **Page layout:** `PicturePageLayout.cartoons` is `CARTOONS_WIDTH` wide at the end of the title row. The title keeps
  the rest of the row.
- **Layout:** `JigsawLayout.cartoonButton` sits `GAP` after the last style button, `CARTOON_WIDTH` wide and as tall
  as both rows. `smallPicture` starts after it when there isn't room for full size, centred on the rows.
- **The tap:** both buttons use the `cartoon` target. It flips the setting, saves it, and redraws, which updates the tick.
  - It decodes the other look's image, then switches `this.picture`. The pieces are recut because the view's cut key
    includes `src`.
  - If the image can't be had, the setting flips back.
  - Only the shown image is kept decoded, as before.

## Not now

- Drawings for family photos: they'd need an AI service, or an "Add cartoon" step in settings for a drawing made
  elsewhere.

## Tests

- **`parseStarters`:** reads cartoon names, and drops a damaged cartoon while keeping the picture.
- **`pictureShown`:** on and off, with and without a drawing.
- **Storage:** defaults to false, reads a boolean, and ignores junk.
- **Layout:** the page's Cartoons sits in the title row, left of the corner, leaving the title room. Cartoon sits after Tray, Board and Table on every iPad, as tall as both rows and apart from everything
  else. The small picture stays 4:3, at least 95 px wide, and full size from 1180 px wide.
- **The published list:** every cartoon file named in `starters.json` exists under `public/`. This extends the
  existing check.
