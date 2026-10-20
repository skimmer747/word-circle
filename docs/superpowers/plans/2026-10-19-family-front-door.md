# Front Door for Other Families Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Someone the owner sends the link to is told, in Safari, to add Word Circle to the Home Screen first; opened from the Home Screen, the setup page explains itself, offers optional Rotation Lock / Guided Access steps, and says nothing leaves the iPad.

**Architecture:** A pure `firstScreen` decision (welcome / setup / play) from `loadSettings(...).firstTime` and `isInstalled(window)`. A small DOM welcome page reuses the settings page's scrolling sheet. The settings page gains an intro line, a folded "Keep them in the game" section and a privacy line. `main.ts` picks the first screen.

**Tech Stack:** TypeScript, Vite, vitest (node environment, no DOM: DOM pages are checked in the browser preview).

**Spec:** `docs/superpowers/specs/2026-10-19-family-front-door-design.md`

**Rules:** work in the git worktree `.worktrees/family-front-door` (branch `family-front-door`). Commit messages end with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push: the owner decides, because pushing main updates Mom's iPad.

---

## File map

| File | What it does |
|---|---|
| `src/settings/first-screen.ts` (new) | `isInstalled(win)`, `firstScreen({ firstTime, installed })` |
| `src/settings/welcome.ts` (new) | The welcome Safari shows the first time |
| `src/settings/page.ts` | Intro line, "Keep them in the game" section, privacy line |
| `src/main.ts` | Welcome, first-time setup or play |
| `src/styles.css` | Welcome sizes, folded section, privacy line |
| `README.md` | One line on sending the link to another family |

---

### Task 1: What shows first

**Files:**
- Create: `src/settings/first-screen.ts`
- Test: `tests/first-screen.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/first-screen.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { firstScreen, isInstalled, type InstallWindow } from '../src/settings/first-screen';

const win = (standalone: boolean | undefined, matches: boolean): InstallWindow => ({
  navigator: { standalone },
  matchMedia: () => ({ matches }),
});

describe('isInstalled', () => {
  it('knows an iPad Home Screen app', () => {
    expect(isInstalled(win(true, false))).toBe(true);
  });

  it('knows a standalone window in other browsers', () => {
    expect(isInstalled(win(undefined, true))).toBe(true);
  });

  it('knows a browser tab', () => {
    expect(isInstalled(win(false, false))).toBe(false);
    expect(isInstalled(win(undefined, false))).toBe(false);
  });

  it("says no when it can't tell", () => {
    const broken: InstallWindow = {
      navigator: {},
      matchMedia: () => {
        throw new Error('unsupported');
      },
    };
    expect(isInstalled(broken)).toBe(false);
  });
});

describe('firstScreen', () => {
  it('sends a new iPad in Safari to the welcome, to add it to the Home Screen first', () => {
    expect(firstScreen({ firstTime: true, installed: false })).toBe('welcome');
  });

  it('sets up a new iPad opened from the Home Screen', () => {
    expect(firstScreen({ firstTime: true, installed: true })).toBe('setup');
  });

  it('plays straight away once set up, or with progress (Mom), wherever it was opened', () => {
    expect(firstScreen({ firstTime: false, installed: true })).toBe('play');
    expect(firstScreen({ firstTime: false, installed: false })).toBe('play');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/first-screen.test.ts`
Expected: FAIL, "Failed to load url ../src/settings/first-screen".

- [ ] **Step 3: Write the code**

Create `src/settings/first-screen.ts`:

```ts
/** The parts of `window` this reads, so tests can pass a stand-in. */
export interface InstallWindow {
  navigator: { standalone?: boolean };
  matchMedia(query: string): { matches: boolean };
}

/** True when Word Circle was opened from the Home Screen rather than in a browser tab. */
export function isInstalled(win: InstallWindow): boolean {
  try {
    // iPad Safari's Home Screen apps say so on navigator; other browsers through the display mode.
    return win.navigator.standalone === true || win.matchMedia('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
}

export type FirstScreen = 'welcome' | 'setup' | 'play';

/**
 * A new iPad in Safari is told to add Word Circle to the Home Screen first: a Home Screen app has its own storage,
 * so setup done in Safari wouldn't carry over.
 */
export function firstScreen({ firstTime, installed }: { firstTime: boolean; installed: boolean }): FirstScreen {
  if (!firstTime) return 'play';
  return installed ? 'setup' : 'welcome';
}
```

- [ ] **Step 4: Run it to see it pass, and type-check**

Run: `npx vitest run tests/first-screen.test.ts && npx tsc`
Expected: 7 tests PASS; tsc prints nothing.

- [ ] **Step 5: Commit**

```bash
git add src/settings/first-screen.ts tests/first-screen.test.ts
git commit -m "feat: decide whether a new iPad sees the welcome, setup, or the game"
```

---

### Task 2: The welcome page

**Files:**
- Create: `src/settings/welcome.ts`
- Modify: `src/styles.css` (append)

No unit test: it's DOM. Task 5 checks it in the browser.

- [ ] **Step 1: Write the page**

Create `src/settings/welcome.ts`:

```ts
import { el } from '../ui/dom';

export interface WelcomeOptions {
  /** "Set it up in this browser instead" was tapped; the welcome has already removed itself. */
  setUpHere(): void;
}

/** The Home Screen steps, with the names of the iPad's buttons in bold. */
const STEPS = [
  "Tap the <b>Share</b> button (a square with an arrow pointing up). If you don't see it, tap <b>•••</b> first.",
  'Tap <b>Add to Home Screen</b>, then <b>Add</b>.',
  'Close Safari and open <b>Word Circle</b> from the Home Screen, with Wi-Fi on. It will ask a few questions about who will play.',
];

/**
 * What a browser tab shows the first time: what Word Circle is, and to add it to the Home Screen before setting it
 * up there (a Home Screen app has its own storage, so setup done in Safari wouldn't carry over). Nothing is saved.
 */
export function openWelcomePage(root: HTMLElement, options: WelcomeOptions): void {
  const page = el('div', 'settings-page welcome-page', root);
  const sheet = el('div', 'settings-sheet', page);
  el('h1', 'settings-title', sheet).textContent = 'Word Circle';
  el('p', 'welcome-about', sheet).textContent =
    'Calm, large-print word games for an iPad: Word Circle, Word Guess and Word Grid. No ads, no accounts, no losing.';
  const steps = el('section', 'settings-section', sheet);
  el('h2', '', steps).textContent = 'First, put it on the Home Screen';
  const list = el('ol', 'welcome-steps', steps);
  for (const step of STEPS) el('li', '', list).innerHTML = step;
  el('p', 'settings-privacy', sheet).textContent = 'Nothing you set up is sent anywhere. It stays on this iPad.';
  const here = el('button', 'welcome-here', sheet);
  here.type = 'button';
  here.textContent = 'Not on an iPad? Set it up in this browser instead';
  here.addEventListener('click', () => {
    page.remove();
    options.setUpHere();
  });
}
```

- [ ] **Step 2: Style it**

Append to `src/styles.css`:

```css
/* The welcome a browser tab shows the first time: bigger text, since it's all there is to read. */
.welcome-page {
  font-size: 24px;
}

.welcome-page .settings-title {
  font-size: 40px;
}

.welcome-about {
  margin: 12px 0 24px;
  line-height: 1.4;
}

.welcome-steps {
  margin: 0;
  padding-left: 1.4em;
  line-height: 1.4;
}

.welcome-steps li + li {
  margin-top: 12px;
}

.welcome-here {
  display: block;
  margin: 8px auto 0;
  padding: 12px;
  border: none;
  background: none;
  color: var(--navy);
  font: inherit;
  font-size: 20px;
  text-decoration: underline;
}

/* "Nothing … leaves this iPad", on the welcome and the settings page. */
.settings-privacy {
  margin: 0 0 16px;
  color: var(--label);
}
```

- [ ] **Step 3: Type-check and test**

Run: `npx tsc && npm test`
Expected: tsc prints nothing; all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/settings/welcome.ts src/styles.css
git commit -m "feat: the welcome Safari shows first: add Word Circle to the Home Screen"
```

---

### Task 3: Setup page additions

**Files:**
- Modify: `src/settings/page.ts` (the title lines; just before `const actions = …`)
- Modify: `src/styles.css` (append)

- [ ] **Step 1: The intro line**

In `src/settings/page.ts`, replace:

```ts
  el('h1', 'settings-title', sheet).textContent = options.firstTime ? 'Set up Word Circle' : 'Settings';
  el('p', 'settings-tip', sheet).textContent = 'To come back here, hold the clock for 3 seconds.';
```

with:

```ts
  el('h1', 'settings-title', sheet).textContent = options.firstTime ? 'Set up Word Circle' : 'Settings';
  if (options.firstTime) {
    el('p', 'settings-intro', sheet).textContent = 'A few questions about who will play. You can change any of this later.';
  }
  el('p', 'settings-tip', sheet).textContent = 'To come back here, hold the clock for 3 seconds.';
```

- [ ] **Step 2: The folded section and the privacy line**

Above `function section(` add:

```ts
/** The optional iPad steps that keep them in the game, from the owner's guide for Mom's iPad. Fixed text, no user input. */
const KEEP_IN_GAME = `
<h3>Lock the screen sideways</h3>
<p>Swipe down from the top-right corner to open Control Center, then tap <b>Rotation Lock</b> (a padlock inside a circular arrow).</p>
<h3>Guided Access</h3>
<p>It keeps them inside Word Circle, so swipes from the edges can't take them elsewhere.</p>
<ol>
  <li>Open <b>Settings › Accessibility › Guided Access</b> and turn it on.</li>
  <li>Tap <b>Passcode Settings › Set Guided Access Passcode</b> and choose a passcode only you know.</li>
  <li>Tap <b>Display Auto-Lock</b> and choose <b>15 Minutes</b>.</li>
  <li>Open Word Circle, quickly press the <b>top button</b> three times, then tap <b>Start</b>.</li>
</ol>
<p>To leave Guided Access, press the top button three times, enter the passcode, and tap <b>End</b>. On an iPad with a round Home button, triple-click the Home button instead.</p>
`;
```

Then replace:

```ts
  const actions = el('div', 'settings-actions', sheet);
```

with:

```ts
  const keep = el('details', 'settings-section settings-keep', sheet);
  el('summary', '', keep).textContent = 'Keep them in the game (optional)';
  keep.insertAdjacentHTML('beforeend', KEEP_IN_GAME);

  el('p', 'settings-privacy', sheet).textContent = 'Everything on this page stays on this iPad.';
  const actions = el('div', 'settings-actions', sheet);
```

- [ ] **Step 3: Style it**

Append to `src/styles.css`:

```css
.settings-intro {
  margin: 6px 0 0;
}

/* "Keep them in the game": folded until tapped. */
.settings-keep summary {
  min-height: 48px;
  font-size: 22px;
  font-weight: 700;
  line-height: 48px;
  cursor: pointer;
}

.settings-keep ol {
  margin: 0;
  padding-left: 1.4em;
  line-height: 1.4;
}

.settings-keep li + li {
  margin-top: 8px;
}

.settings-keep p {
  line-height: 1.4;
}
```

- [ ] **Step 4: Type-check and test**

Run: `npx tsc && npm test`
Expected: tsc prints nothing; all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/settings/page.ts src/styles.css
git commit -m "feat: the setup page explains itself, says nothing leaves the iPad, and offers Rotation Lock and Guided Access"
```

---

### Task 4: main.ts picks the first screen; README

**Files:**
- Modify: `src/main.ts` (imports; the block from `const { settings, firstTime } = loadSettings(store);` to the end)
- Modify: `README.md` ("Settings (for a caregiver)" section)

- [ ] **Step 1: main.ts**

Add imports, keeping the `./settings/…` lines together in path order:

```ts
import { firstScreen, isInstalled } from './settings/first-screen';
import { openSettingsPage } from './settings/page';
import { loadSettings, saveSettings, type Settings } from './settings/settings';
import { openWelcomePage } from './settings/welcome';
```

Replace everything from `const { settings, firstTime } = loadSettings(store);` to the end of the file with:

```ts
const { settings, firstTime } = loadSettings(store);
// Start playing goes straight in (no reload), so an iPad that can't save still gets to play.
const firstSetup = () =>
  showSettings(
    settings,
    true,
    (next) => {
      saveSettings(store, next);
      startApp(next);
    },
    () => {},
  );
const screen = firstScreen({ firstTime, installed: isInstalled(window) });
if (screen === 'welcome') openWelcomePage(root, { setUpHere: firstSetup });
else if (screen === 'setup') firstSetup();
else startApp(settings);
```

- [ ] **Step 2: README**

In `README.md`, at the end of the "## Settings (for a caregiver)" section (after the line starting "A new iPad shows this page the first time."), add:

```markdown
For another family, just send them the link https://skimmer747.github.io/word-circle/. Opened in Safari on their iPad, it tells them to add it to the Home Screen first, then asks its setup questions when they open it from there.
```

- [ ] **Step 3: Type-check, test, build**

Run: `npx tsc && npm test && npm run build`
Expected: tsc prints nothing; all tests PASS; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts README.md
git commit -m "feat: a new iPad in Safari sees the welcome first; README says how to share it"
```

---

### Task 5: Check it in the browser and the Simulator

The preview tool reads only the main checkout's `.claude/launch.json`. Add a temporary entry there (don't commit it):

```json
    {
      "name": "front-door-test",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["--prefix", "/Users/toddanderson/Dev/Moms Word Game/.worktrees/family-front-door", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5176", "--strictPort"],
      "port": 5176,
      "url": "http://127.0.0.1:5176"
    }
```

Port 5176 is a new origin, so storage starts empty (a new iPad). The browser pane isn't a Home Screen app, so it shows the welcome.

- [ ] **Step 1: The welcome.** `preview_start {name: "front-door-test"}`, resize to 1180×820, open `/word-circle/`. Expected: "Word Circle", the about line, the three steps, the privacy line and the "Not on an iPad?" button. Nothing in localStorage under `word-games:settings:v1`. No console errors.
- [ ] **Step 2: Setting up in the browser.** Tap "Not on an iPad? Set it up in this browser instead". Expected: "Set up Word Circle" with the intro line, the tip, the folded "Keep them in the game (optional)" (open it: Rotation Lock and the four Guided Access steps), and "Everything on this page stays on this iPad." above Start playing. Tap Start playing: the game shows; reload: straight to the game.
- [ ] **Step 3: Sizes.** At 1024×768 and 1366×1024 the welcome and setup pages fit without sideways scrolling and scroll up and down.
- [ ] **Step 4: Settings page later.** Hold the clock 3 s (PointerEvents on `window`): the page says "Settings", no intro line, and still has the folded section and privacy line.
- [ ] **Step 5: iPad Simulator, if one is available.** Open `http://localhost:5176/word-circle/` in the Simulator's Safari (the Simulator reaches this Mac at localhost; `index.html`'s `apple-mobile-web-app-capable` tag makes a Home Screen copy open on its own, even without the dev server's manifest). Expected: the welcome. Add to Home Screen, open it from there. Expected: "Set up Word Circle", not the welcome.
- [ ] **Step 6: Clean up.** Reset the viewport, stop the server, `git checkout -- .claude/launch.json` in the main checkout. Fix anything found (source, tests, commit separately).

---

### Task 6: Finish

- [ ] **Step 1:** In the spec, change the Status line to `**Status:** Built 2026-10-19 (plan: \`docs/superpowers/plans/2026-10-19-family-front-door.md\`).`
- [ ] **Step 2:** `npm test && npx tsc && npm run build`, then commit `docs: front-door spec marked built`.
- [ ] **Step 3:** Merge the branch into local main (fast-forward), run the tests on main, remove the worktree and branch. Ask the owner before pushing.
