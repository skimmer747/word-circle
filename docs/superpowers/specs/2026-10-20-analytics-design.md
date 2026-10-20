# Google Analytics — Design

**Date:** 2026-10-20
**Status:** Design approved; not built yet.

## Purpose

The owner already uses Google Analytics and wants to see how Word Circle is used: how many iPads, where, whether families put it on the Home Screen, and how much they play. The Measurement ID is `G-FEE3EFJD8Y`, in its own GA4 property ("Word Circle"), separate from the owner's other site.

## Decisions

- **The gtag.js tag in the app** (not Tag Manager, not a server).
- **Live site only:** the tag loads only in the production build *and* when the page's host is `skimmer747.github.io`. Local development and previews send nothing.
- **Ad features off:** `allow_google_signals: false`, `allow_ad_personalization_signals: false`.
- **Offline:** if the tag can't load, events are simply lost; the games are unaffected.

## What is sent

| Event | When | Parameters |
|---|---|---|
| `page_view` (automatic) | the app opens | plus user property `installed`: `'yes'` (Home Screen) or `'no'` (browser tab) |
| `puzzle_finished` | a puzzle or word is finished (from the frame's `logPlay`) | `game` (`circle`/`guess`/`grid`), `level` (`easy`/`medium`/`hard`/`none`), `used_hint` (`'yes'`/`'no'`) |
| `game_switched` | she picks another game in the Games pop-up | `game` |
| `stats_opened` | her stats open | none |
| `settings_opened` | the settings page opens from the clock | none |

Nothing else: no names, words, answers, schedules or anything typed.

## The notice for families

The welcome page's privacy line and the settings page's privacy line each gain: "Visits and finished puzzles are counted with Google Analytics; never names, words or schedules." The README says the same.

## Code

- New `src/analytics.ts`: `analyticsAllowed(prod, host)`, `puzzleEvent(record)` (pure), `startAnalytics(installed)` (injects the tag when allowed), `track(name, params)` (does nothing when not started).
- `src/main.ts` starts it; `src/frame/frame.ts` tracks `puzzle_finished` (in `logPlay`), `game_switched`, `stats_opened`, `settings_opened`.
- `src/settings/welcome.ts`, `src/settings/page.ts`: the notice; `README.md`.

## Testing

- Unit tests: `analyticsAllowed` (only production on the live host), `puzzleEvent` (exactly the three parameters, `none` for Word Guess's level).
- Browser preview (dev): no request to `googletagmanager.com` or `google-analytics.com`.
- After the push: on the live site, requests to `google-analytics.com/g/collect` appear, and the owner sees them in **Reports › Realtime**.
