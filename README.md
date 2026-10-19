# Word Circle

A calm, large-print word game for Mom's iPad, in the style of Word Cookies.

- Design: `docs/superpowers/specs/2026-10-19-word-circle-design.md`
- Setting up her iPad: `docs/setup-her-ipad.md`
- Live app: https://skimmer747.github.io/word-circle/

## Commands

```bash
npm install
```

```bash
npm run dev
```
Opens at http://localhost:5173/word-circle/

```bash
npm test
```

```bash
npm run build
```

## Changing her schedule (the clock pop-up)

The clock button at the top right shows the time, the date, and countdowns like "Supper in 4 hours 30 minutes".
The events come from `public/schedule.txt`, one per line:

```text
every day 5:00 PM Supper
Sun 10:00 AM Church
Tue,Fri 3:00 PM Phone call with family
2026-10-22 2:00 PM Doctor visit
```

To change it from your phone or computer:

1. Open https://github.com/skimmer747/word-circle/blob/main/public/schedule.txt
2. Tap the pencil icon (Edit this file).
3. Add, change or delete lines. Lines starting with `#` are ignored.
4. Tap **Commit changes**.

Her iPad picks up the new list within about 10 minutes whenever it has Wi-Fi (sooner if she opens the clock).
A line with a typo is simply skipped. You can also just ask Claude to change it.

## Changing the words

1. Add any word she shouldn't see to `words/blocklist.txt` (one per line). It won't appear anywhere, not even as an extra word.
   If a plural or other word ending shows up in the word slots, add it to `words/not-plain.txt` instead; it will still count as an extra word.
2. Run `npm run puzzles`. This rebuilds all three levels in `src/data/puzzles.json` and the sample page `docs/puzzle-sample.html`.
3. Look over `docs/puzzle-sample.html`, then commit and push. GitHub Pages republishes automatically, and her iPad picks up the change after her next finished puzzle.

Regenerating puzzles can change their order, so she may start a fresh puzzle at her current position.

## Word list credit

Words come from SCOWL (Spell Checker Oriented Word Lists) by Kevin Atkinson; see `words/scowl/Copyright`.
Plurals and other word endings are recognised with AGID (Automatically Generated Inflection Database), also by Kevin Atkinson; see `words/agid/README`.
