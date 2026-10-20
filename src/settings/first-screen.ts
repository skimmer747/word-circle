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
