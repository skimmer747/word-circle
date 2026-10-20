import type { PlayRecord } from './stats/log';

/** The Word Circle property in Google Analytics. Not a secret: it's in every page's code. */
export const MEASUREMENT_ID = 'G-FEE3EFJD8Y';
/** Only the live site is counted, so testing never shows up in the reports. */
const LIVE_HOST = 'skimmer747.github.io';

type Params = Record<string, string>;
type Gtag = (...args: unknown[]) => void;

let gtag: Gtag | null = null;

export function analyticsAllowed(production: boolean, host: string): boolean {
  return production && host === LIVE_HOST;
}

/** What a finished puzzle tells Google: only the game, its level and whether Hint helped. */
export function puzzleEvent(record: PlayRecord): Params {
  return { game: record.game, level: record.level ?? 'none', used_hint: record.hints > 0 ? 'yes' : 'no' };
}

/** Loads Google's tag on the live site, with its ad features off. `installed`: opened from the Home Screen. */
export function startAnalytics(installed: boolean): void {
  if (gtag || !analyticsAllowed(import.meta.env.PROD, window.location.hostname)) return;
  const page = window as unknown as { dataLayer: unknown[] };
  page.dataLayer = page.dataLayer || [];
  // Google's tag reads the arguments object itself, so this must not be an arrow function.
  gtag = function () {
    // eslint-disable-next-line prefer-rest-params
    page.dataLayer.push(arguments);
  };
  gtag('js', new Date());
  gtag('set', 'user_properties', { installed: installed ? 'yes' : 'no' });
  gtag('config', MEASUREMENT_ID, { allow_google_signals: false, allow_ad_personalization_signals: false });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

/** Counts something that happened. Does nothing off the live site. */
export function track(name: string, params: Params = {}): void {
  gtag?.('event', name, params);
}
