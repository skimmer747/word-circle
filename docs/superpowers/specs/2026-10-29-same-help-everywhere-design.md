# The same buttons, print and help in every game

**Status:** approved 2026-10-29.

## Why

The owner asked how to make the whole app easier for Mom, who has dementia, and more standardized so every game
works the same. We looked at all four games at 1024 × 768. The shared frame already puts Hint top-left, Games and
the clock top-right, and the same "Well done!" card at the end of every game. The owner chose three of the ideas:
the same buttons everywhere, bigger small print, and the same gentle help. The fourth idea, moving the difficulty and
Jigsaw choices into the caregiver settings, wasn't chosen.

## 1. The same buttons

- **Helper buttons:** each game's purple helper button keeps its place: Shuffle (Word Circle) and Pictures (Jigsaw)
  beside Hint, and All letters (Word Guess) under Hint, where the keyboard leaves room. Word Grid has none. They already
  share one look.
- **Jigsaw's sizes:** 9 / 16 / 30 now read **Easy / Medium / Hard**, like Word Circle and Word Grid. They still mean
  9, 16 and 30 pieces (`COUNT_LEVELS`).
- **Top-right buttons:** they stay the same size. "Games" (and "Stats" where there's one game) is in bigger lettering,
  and the clock gets the word **Time** under its icon.

## 2. Bigger small print

Anything she reads while playing is at least 24 px. The caregiver pages (settings, family charts, the new-photo page,
the welcome page) are unchanged.

| What | Was | Now |
| --- | --- | --- |
| Level buttons; Jigsaw's Tray / Board / Table, Hide edges and Cartoon (`.level`) | 20 | 24 |
| Move picture | 20 | 24 |
| Word Grid's section letters (`cornerFont`) | 18 minimum, 0.18 of a square | 24 minimum, 0.24 of a square |
| Pick a picture captions (`.pic-caption`), with room for two lines (`TILE_CAPTION` 56 → 64) | 22 | 26 |
| Word Circle's "Extra words" label | 22 | 26 |
| Games / Stats label, plus the new Time label | 16 | 20 |

## 3. The same gentle help

The frame owns the help in place of each game's own timer. After **1 minute with no touch**:
- Hint pulses.
- A big bubble appears just under Hint, pointing up at it. It shows the game's line, then "Tap Hint for help." on the
  line below:
  - Word Circle: "Make words from these letters."
  - Word Guess: "Guess the word."
  - Word Grid: "Fill in the words."
  - Jigsaw: "Put the pieces in the picture."

Any touch hides the bubble and stops the pulse, and the touch does its usual job. A touch on the bubble itself only
closes it, so tapping it never presses whatever is underneath. Then the minute starts again.

The help doesn't appear while the frame is blocked: a pop-up, the "Well done!" card, settings, a word being traced or
a piece being dragged, or the game busy. In those cases the minute starts again instead. It also doesn't appear when
the game has nothing to help with:
- Jigsaw's Pick a picture page;
- Today's Wordle, which has no hints.

How it works:
- **The game:** `GameScreen` gains `help?(): string | null` (the line, or null) and `setHintPulse?(on)`.
- **The games:** each game's own idle timer goes: `IDLE_HINT_MS`, `idleTimer` and `resetIdle`.
- **The frame:** it restarts the minute on every pointer down and up, and on start, resume, game switch, closing
  settings and the end of a celebration. It hides the help on every touch, on pause, on a game switch, and when a
  pop-up or celebration opens.
- **The bubble:** the frame's view draws it in its own layer, above the game and below the pop-ups.

## Tests

- **Layout:** the bubble's rect sits under Hint, inside the play area and clear of the corner, on every iPad size.
- **Word Grid:** the section letters are at least 24 px and still fit in their square beside the letter.
- **Jigsaw's level buttons:** read Easy / Medium / Hard.
- **In the browser, every game:** wait out the minute (shortened in the page for the check), then check that the
  bubble and pulse appear and a touch clears them. Check the bubble stays away on Pick a picture.
