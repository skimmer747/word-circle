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
