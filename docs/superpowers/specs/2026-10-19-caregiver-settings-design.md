# Caregiver Settings — Design

**Date:** 2026-10-19
**Status:** Design approved in brainstorming; not built yet.
**Builds on:** `2026-10-19-word-circle-design.md` (player, touch rules, safe zones), `2026-10-19-word-guess-design.md` (the shared frame, clock pop-up, "Well done!" card, saving) and `2026-10-19-word-grid-design.md` (shared button layout)

## Purpose

Today the site is set up for one person: Mom. Her schedule is the one `public/schedule.txt` that every visitor gets, her left thumb sets the wide left safe zone, and her word lists are built into the app. The owner wants **other families to be able to use it on their own**, setting it up for their own parent without needing the owner.

This design is the first piece of that: **a caregiver settings page inside the app**, saved on the iPad, with nothing stored on a server. Mom's iPad keeps working exactly as it does now.

**Success looks like:** a caregiver who has never heard of GitHub opens the site on their parent's iPad, fills in one page (name, thumb, games, schedule, words to avoid), taps **Start playing**, and later changes anything by holding the clock. Mom's iPad updates without her noticing anything different.

### Decisions made in brainstorming

- **Who:** other families setting it up on their own, without the owner as their admin. That rules out per-person files in this repository.
- **Where settings live:** on the iPad (like game progress). **Remote editing** from a caregiver's phone (which needs a backend) is left for later, if families ask for it.
- **What can be set:** name, which thumb rests on the screen, which games appear, starting level, Share on or off, the schedule, and extra words to avoid.
- **Left out:** sound (the app has none) and text size (every game already fits its letters as large as the screen allows; a bigger option would mean reworking each game's layout).
- **Getting in:** hold the clock for 3 seconds. No code; opening it by accident changes nothing.
- **Approach A:** settings saved on the iPad with a first-time setup page. Not B (settings in the home-screen link: any change means re-adding the icon) and not yet C (a "save settings as a link" backup, easy to add later).
- **One page, not a step-by-step wizard;** the schedule is a **fill-in form** with the iPad's own date and time pickers, not a text box.

### Not in this design

Each is its own design later: editing settings from a caregiver's phone; a landing page, privacy note and setup guide for families who find the site; rewording the README and `docs/setup-her-ipad.md` for other families; making `schedule.txt` private (it stays publicly readable on GitHub, as today).

## 1. The settings

One object, saved under `word-games:settings:v1` next to the games' progress.

| Setting | What it does | New iPad | Mom's iPad |
|---|---|---|---|
| `name` | "Well done, Ruth!" as the card's title and "Good morning, Ruth" (afternoon, evening by the hour) at the top of the clock pop-up. Blank: today's wording. | blank | blank |
| `thumb` | `left`, `right` or `none`: which side gets the wider safe zone (§4) | `left` | `left` |
| `games` | Which games appear, in the usual order; at least one | all three | all three |
| `startLevel` | `easy`, `medium` or `hard`: where Word Circle and Word Grid open the first time. After that her own last level is kept. | `medium` | `medium` |
| `share` | Whether Word Guess offers Share after today's Wordle | on | on |
| `schedule` | `{ source: 'web' }` (fetch `schedule.txt`, as today) or `{ source: 'device', lines: string[] }` | device, no lines | web |
| `avoid` | Extra words kept out of every game (lowercase, letters only), on top of the built-in blocklist | none | none |

**Mom's iPad is recognised** by having saved progress (any game's save or the frame's `word-games:v1`) but no settings. It gets the "Mom's iPad" column, is saved straight away, and never sees first-time setup. A truly new iPad (no saves at all) gets the "New iPad" column and first-time setup (§2).

**Only Mom's iPad can use `source: 'web'`.** There's no way to choose it in the page; an iPad that starts on `device` never fetches `schedule.txt`, so nobody else sees her events.

**A damaged save** keeps every field that is still valid and fills the rest with the "New iPad" defaults, except that it never goes back to first-time setup. If storage is unavailable, the settings still work for that session.

## 2. The settings page

### Getting there

- **Hold the clock for 3 seconds.** From 0.5 s a ring fills around the clock button; at 3 s the page opens. Lifting sooner is an ordinary clock tap (the clock pop-up opens, as today), so a normal tap looks unchanged.
- The touch tracker treats any press over 2 s (`MAX_TAP_MS`) as a resting thumb and ignores it. The clock button gets one exception: a press that starts on the clock and stays within it is timed as a hold instead. A thumb resting elsewhere is still ignored. A right thumb that happens to rest on the clock would open the page; that's harmless (§2, Done and Cancel).
- Holding is ignored while a game is busy (animating or celebrating), as the Games pop-up is today.
- **First-time setup:** on a new iPad the page opens by itself before the first game is shown.

### The page

A full-screen page for the caregiver, built from ordinary HTML controls (text fields, buttons, the iPad's keyboard and pickers) at a comfortable size, not the games' extra-large style. While it's open the frame's touch tracker steps aside so the controls get their touches normally. It scrolls if it's taller than the screen.

From top to bottom:

1. **Title:** "Set up Word Circle" (first time) or "Settings". Under it: "To come back here, hold the clock for 3 seconds."
2. **Name:** one text field, placeholder "Their first name (optional)".
3. **Thumb:** "Does a thumb rest on the screen while they play?" Three buttons, **Left**, **Right**, **Neither**, each with a small drawing of the screen showing where the wide safe zone goes.
4. **Games:** a checkbox for each game (unticking the last one is refused, with "Keep at least one game"). **Starting level:** Easy, Medium, Hard. **Share today's Wordle:** on or off.
5. **Schedule** (§3).
6. **Words to avoid:** a text box, words separated by commas, spaces or new lines, with a count under it ("3 words"). Anything that isn't letters is dropped; words are saved lowercase and without repeats.
7. **Buttons:** **Done** (first time: **Start playing**) and **Cancel** (not shown the first time).

**Done** saves and reloads the app (§5). **Cancel** closes the page and throws away the changes. If the page is left untouched for 5 minutes it closes as if Cancel was tapped, so a page opened by accident doesn't sit on her screen. That timer doesn't apply to first-time setup.

## 3. The schedule section

On a `device` iPad:

- **The list:** one row per event, in the clock's wording, such as "Supper · every day · 6:00 PM" or "Doctor visit · Thu Oct 22 · 2:00 PM", each with **Delete**. "No events yet" when empty.
- **Add event:**
  - **What:** text field.
  - **Repeat:** **Once**, **Every day** or **Some days**.
  - **Date** (Once only): the iPad's date picker (`<input type="date">`), starting at today.
  - **Days** (Some days only): seven toggle buttons, Sun to Sat; at least one.
  - **Time:** the iPad's time picker (`<input type="time">`).
  - **Add** puts it in the list. It's greyed out until What, Time, and the Date or Days are filled in.
- Each event is saved as one line in `schedule.txt`'s format (`every day 6:00 PM Supper`, `Tue,Fri 3:00 PM Phone call`, `2026-10-22 2:00 PM Doctor visit`), so the clock reads them with the existing `parseSchedule` and nothing in `src/clock/` changes.
- One-time events whose date has passed are dropped from the list when the page opens.

On Mom's iPad (`web`): "Events come from schedule.txt on GitHub" and a **Type them here instead** button, which switches this iPad to `device` with an empty list (only once Done is tapped).

## 4. How each setting reaches the games

`main.ts` loads the settings once at startup and builds the app from them:

- **Games:** only the games in `settings.games` are created and handed to the `Frame`. With one game the frame hides the Games button (the clock stays where it is) and the saved current game is ignored. If the saved current game is switched off, the first remaining game shows.
- **Thumb:** `computeFrameLayout(width, height, gameCount, thumb)`. `left` is today's layout (left `clamp(width − 890, 130, 200)`, right 130). `right` mirrors only the safe zones (left 130, right `clamp(width − 890, 130, 200)`); every button keeps its place relative to the play area. `none` uses 130 on both sides. The existing layout tests run for all three.
- **Start level:** passed to Word Circle and Word Grid; used only when a game has no saved level yet.
- **Share:** `share` is passed to Word Guess only when on (Word Guess already hides Share when it's missing).
- **Schedule:** the frame fetches `schedule.txt` only for `source: 'web'`. For `device` it parses `lines` and skips the fetch, the 10-minute refresh and the schedule cache.
- **Name:** passed to the frame for the card title and the clock greeting.
- **Words to avoid** (`src/settings/avoid.ts`, one `isAvoided(word)` check):
  - Puzzle lists are **not** filtered, so saved positions keep pointing at the same puzzles. Instead each game skips an avoided puzzle when it would come up: on start, after a solve, and when switching level. If every puzzle in a level is avoided (only possible with absurd lists), the level plays as if nothing were avoided rather than breaking.
  - **Word Circle:** a puzzle is avoided if any of its slot `words` is. Avoided `bonus` words are not accepted as extra words.
  - **Word Guess:** avoided answers are skipped; avoided words aren't accepted as guesses (as with the blocklist). If today's Wordle word is avoided, she gets a word from the app's own list that day, as the blocklist already does.
  - **Word Grid:** a puzzle is avoided if any of its across or down answers is.
  - A puzzle already on screen that contains a newly avoided word moves on to the next one after Done. Its progress is dropped.

## 5. Applying changes

**Done** saves the settings, then reloads the page (`location.reload()`). Every move is already saved, so she loses nothing, and the app comes back built from the new settings. No game needs to rebuild itself while running. The reload works offline because the service worker serves the cached app.

## 6. Code

New folder `src/settings/`:

- `settings.ts`: the `Settings` type, defaults, `loadSettings(store)` (including the Mom's-iPad rule and damaged saves), `saveSettings`.
- `schedule-form.ts`: form entry → `schedule.txt` line, line → list row, dropping past one-time events. No DOM.
- `avoid.ts`: parsing the avoid box, `isAvoided`, and the per-game "is this puzzle avoided" checks.
- `page.ts` and `view.ts`: the settings page (state and DOM).

Changed: `main.ts` (build from settings), `frame/frame.ts` (clock hold, opening the page, greeting, one-game mode, schedule source), `frame/layout.ts` (thumb), `input/touch.ts` (clock hold), and the three games' screens (start level, skipping avoided puzzles).

## 7. Testing

**Unit tests (vitest):**

- Loading settings: new iPad (first-time setup, defaults), Mom's iPad (each kind of existing save gives the "Mom's iPad" column), damaged and partly damaged saves, unavailable storage.
- Layout: left, right and none at the iPad sizes the layout tests already use; buttons stay put relative to the play area; one-game mode hides Games.
- Clock hold: a tap opens the clock; a 3 s hold on the clock opens settings; a 3 s press elsewhere is still ignored; a hold that slides off the clock is cancelled.
- Schedule form: each repeat type makes a line that `parseSchedule` reads back to the same event; past one-time events are dropped.
- Words to avoid: parsing the box; each game skips avoided puzzles without moving saved positions; Word Circle refuses an avoided extra word; Word Guess skips an avoided daily word; a level where everything is avoided still plays.
- Games: switched-off games aren't built; a saved current game that's switched off falls back to the first one.

**In the browser preview** (`word-circle-test`, iPad landscape sizes):

- Empty storage: first-time setup appears, Start playing reaches the first game, the settings stick after a reload.
- A copy of Mom's kind of saves: no setup, everything looks and plays as before, the clock still reads `schedule.txt`.
- Hold the clock, change each setting, Done: the changes show; Cancel: nothing changes.

**Publishing:** as always, build, test, check in the browser, commit, and ask the owner before pushing, since pushing updates Mom's iPad.
