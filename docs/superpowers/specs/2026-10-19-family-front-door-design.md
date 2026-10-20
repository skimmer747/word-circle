# Front Door for Other Families — Design

**Date:** 2026-10-19
**Status:** Design approved in brainstorming; not built yet.
**Builds on:** `2026-10-19-caregiver-settings-design.md` (the settings page, first-time setup, Mom's-iPad rule)

## Purpose

Caregiver settings let any family set Word Circle up for their own parent, but nothing guides them there. Opening the link on an iPad today goes straight to the settings form, with no word about what Word Circle is. The install steps (Add to Home Screen, Rotation Lock, Guided Access) live only in `docs/setup-her-ipad.md`, which is written about Mom.

Worse, there's a trap. On iPadOS a Home Screen web app has its own storage, separate from Safari. A family that fills in setup in Safari and then adds the app to the Home Screen opens it to find setup again, with their answers gone.

**Success looks like:** someone the owner sends the link to opens it in Safari on their parent's iPad and is told, in order, to add it to the Home Screen and open it from there. The Home Screen app then asks its setup questions, offers the optional Rotation Lock and Guided Access steps, and says plainly that nothing leaves the iPad. Mom's iPad doesn't change.

### Decisions made in brainstorming

- **Who:** families the owner sends the link to (friends, relatives, a care home). They know roughly what it is, so this is clear setup steps in the right order, not a page that sells the app to strangers.
- **Approach A, in the app:** Safari shows a short welcome with the Add to Home Screen steps instead of the settings; the Home Screen app shows the setup page with an optional "Keep them in the game" section; a privacy line on both. No separate guide page or printable guide.
- **Mom's `public/schedule.txt` stays as it is**, publicly readable. The owner's "tell Claude to add an event" routine keeps working.
- `docs/setup-her-ipad.md` stays the owner's guide for Mom's iPad.

## 1. What shows first

`firstScreen({ firstTime, installed })` decides:

| firstTime (no settings, no progress) | installed (opened from the Home Screen) | Shows |
|---|---|---|
| yes | no | **Welcome** (§2) |
| yes | yes | **Setup page** (first-time) |
| no | either | **Play**, as today |

`firstTime` is today's `loadSettings(store).firstTime`, so Mom's iPad, and any browser that has played before, never sees the welcome.

`isInstalled(window)` is true when `navigator.standalone === true` (iPadOS Safari's Home Screen apps) or `matchMedia('(display-mode: standalone)').matches` (other browsers). If either check throws, it's false.

## 2. The welcome (Safari, first time)

One scrolling page in the settings page's style (`.settings-page` sheet), with bigger text (24 px body, 40 px title). Text, exactly:

- Title: **Word Circle**
- "Calm, large-print word games for an iPad: Word Circle, Word Guess and Word Grid. No ads, no accounts, no losing."
- Heading: **First, put it on the Home Screen**
- Numbered steps:
  1. "Tap the **Share** button (a square with an arrow pointing up). If you don't see it, tap **•••** first."
  2. "Tap **Add to Home Screen**, then **Add**."
  3. "Close Safari and open **Word Circle** from the Home Screen, with Wi-Fi on. It will ask a few questions about who will play."
- Privacy line: "Nothing you set up is sent anywhere. It stays on this iPad."
- A plain text-style button at the bottom: "Not on an iPad? Set it up in this browser instead". It removes the welcome and opens the first-time setup page (Start playing then works as today).

Nothing on the welcome is saved, so opening the link in Safari again shows it again.

## 3. Setup page additions

In `src/settings/page.ts`, for every iPad (Mom's too):

1. **Intro, first time only**, under the title: "A few questions about who will play. You can change any of this later." The "To come back here, hold the clock for 3 seconds." line stays.
2. **A last section, folded shut** (`<details>`), with the summary "Keep them in the game (optional)":
   - **Lock the screen sideways:** "Swipe down from the top-right corner to open Control Center, then tap **Rotation Lock** (a padlock inside a circular arrow)."
   - **Guided Access** (keeps them inside Word Circle, so swipes from the edges can't take them elsewhere):
     1. "Open **Settings › Accessibility › Guided Access** and turn it on."
     2. "Tap **Passcode Settings › Set Guided Access Passcode** and choose a passcode only you know."
     3. "Tap **Display Auto-Lock** and choose **15 Minutes**."
     4. "Open Word Circle, quickly press the **top button** three times, then tap **Start**."
     - "To leave Guided Access, press the top button three times, enter the passcode, and tap **End**. On an iPad with a round Home button, triple-click the Home button instead."
3. **Privacy line**, just above the buttons: "Everything on this page stays on this iPad."

## 4. Code

- New `src/settings/first-screen.ts`: `isInstalled(win)` and `firstScreen(...)`. No DOM beyond reading the window it's given, so it's tested with fake windows.
- New `src/settings/welcome.ts`: `openWelcomePage(root, { setUpHere })`; removes itself before calling `setUpHere`.
- `src/settings/page.ts`: the three additions in §3.
- `src/main.ts`: `firstScreen` picks welcome, first-time setup or `startApp`.
- `src/styles.css`: welcome text sizes, the folded section, the privacy line.
- `README.md`: "For another family, just send them the link https://skimmer747.github.io/word-circle/. Opened on their iPad, it walks them through adding it to the Home Screen and setting it up."

## 5. Testing

- **Unit tests (vitest):** `firstScreen` in all four combinations; `isInstalled` for an iPad Home Screen app (`navigator.standalone` true), a desktop standalone window (media query matches), plain Safari (both false), and a window whose `matchMedia` throws.
- **Browser preview** (a fresh origin, e.g. a new port, so storage starts empty): the welcome shows; "Set it up in this browser instead" opens setup with the intro, privacy line and folded section; Start playing reaches the game; an origin with progress goes straight to the game. At 1024×768 and 1366×1024, the welcome scrolls if it doesn't fit.
- **iPad Simulator, if available:** open the site in Safari (welcome), Add to Home Screen, open it from the Home Screen: setup shows, not the welcome.
- **Publishing:** build, test, check, commit, and ask the owner before pushing.
