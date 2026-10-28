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
    'Calm, large-print word games and jigsaws for an iPad: Word Circle, Word Guess, Word Grid and Jigsaw. No ads, no accounts, no losing.';
  const steps = el('section', 'settings-section', sheet);
  el('h2', '', steps).textContent = 'First, put it on the Home Screen';
  const list = el('ol', 'welcome-steps', steps);
  for (const step of STEPS) el('li', '', list).innerHTML = step;
  el('p', 'settings-privacy', sheet).textContent = 'Nothing you set up is sent anywhere. It stays on this iPad. Visits and finished puzzles are counted with Google Analytics; never names, words or schedules.';
  const here = el('button', 'welcome-here', sheet);
  here.type = 'button';
  here.textContent = 'Not on an iPad? Set it up in this browser instead';
  here.addEventListener('click', () => {
    page.remove();
    options.setUpHere();
  });
}
