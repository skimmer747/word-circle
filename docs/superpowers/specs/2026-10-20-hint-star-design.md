# Hint Star — Design

**Date:** 2026-10-20
**Status:** Approved, not built yet.

## Purpose

When she taps Hint, the letter used to just appear (a quick 150 ms pop in Word Grid, nothing at all in Word Guess and Word Circle). A short, cheerful animation makes Hint fun to use and shows her *where* the hint went. That helps most in Word Grid, where the hinted square can be away from where she's looking, and in Word Circle, where it goes into one of several word rows.

## What she sees

1. **Tap:** the Hint button gives a small press bounce (scale 1 → 0.9 → 1, 200 ms).
2. **Flight (700 ms):** a gold star (amber `#EF9F27` fill with a `--hint` `#B8860B` outline), about 48 px across, leaves the center of the Hint button. It arcs up and over to the center of the target square, spinning one full turn and growing from 0.6× to 1.3× at the top of the arc, then back to 1× as it lands. Ease in-out.
3. **Landing (400 ms):** the star disappears and 10 round gold sparkles (12 px) burst outward 60 px from the square's center, shrinking and fading. At the same moment the letter appears in the square with its usual hint look and pops (scale 0.4 → 1.25 → 1).

The whole thing takes about 1.1 seconds. The star and sparkles float above everything and can't be tapped.

### The target square in each game

- **Word Guess:** the square Hint filled: the highlighted square, or, in a full row, the leftmost square she doesn't know.
- **Word Grid:** the square Hint filled (the selected square, or the first empty or wrong one).
- **Word Circle:** the slot in the word row where the hinted letter appears.

## Rules

- **The hint counts at once.** The game state changes and is saved the instant she taps, as it does now. Only the *showing* of the letter waits for the star. If the app closes mid-flight, the hint is kept.
- **The target square looks empty until the star lands**, then shows the letter. In Word Guess and Word Grid, the hinted square is locked from the tap, so typing or dropping a tile can't land there during the flight.
- **One star at a time.** Taps on Hint while a star is flying are ignored, so an accidental double tap doesn't use two hints.
- **She can keep playing during the flight:** typing in Word Guess, placing tiles in Word Grid, tracing in Word Circle.
- **Finishing waits for the star.** If the hint completes the word or puzzle, "Well done!" (and the found-word pulse in Word Circle) starts after the star has landed.
- **Reduce Motion:** if the iPad's Reduce Motion is on, there is no flight or sparkles; the letter appears at once with the existing small pop.
- **If the target square can't be found on screen** (should never happen), the letter simply appears with the pop.

## Code

- **New `src/ui/hint-star.ts`:**
  - `starPath(from, to)` (pure): the start, arc top and end points, from the centers of two rectangles. The arc top is halfway across and 80 px above the higher of the two points.
  - `flyHintStar(from: HTMLElement, to: HTMLElement): Promise<void>`: makes the star in a fixed-position, `pointer-events: none` layer on `document.body`, animates it with the Web Animations API along `starPath`, bursts the sparkles, and resolves when the star lands. With Reduce Motion (`matchMedia('(prefers-reduced-motion: reduce)')`), it resolves at once.
  - The star icon goes in `src/ui/icons.ts`, the star and sparkle styles in `src/styles.css`.
- **Each game's view** gets a method that runs the star from its Hint button to a square and then shows that square's letter with the pop: `src/guess/view.ts`, `src/grid/view.ts`, `src/circle/view.ts`. Until it lands, the square is drawn empty. On landing, the square (or Word Circle's row) is redrawn from the game's current state, not the state at the tap, so anything she did during the flight (such as finding that word in Word Circle) still shows correctly.
- **Each game's screen** (`hint()` in `src/guess/screen.ts`, `src/grid/screen.ts`, `src/circle/screen.ts`): keeps a `hintFlying` flag to ignore taps mid-flight, updates and saves the game as now, awaits the view's star, then runs the finish or found-word steps.
- No change to game rules, saves, stats or analytics.

## Testing

- **Unit tests:** `starPath` (start and end at the two centers, arc top above both, halfway across); `flyHintStar` resolves at once under Reduce Motion.
- **Browser check (dev):** in each game, tap Hint and watch the star land on the right square, the letter appear only on landing, a second tap mid-flight do nothing, and a hint that finishes the word wait for the star before "Well done!". (The built-in browser pane must be visible: while it's hidden, animations don't advance.)
- **After the push:** the same check on the live site in one game.
