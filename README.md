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

## Changing the words

1. Add any word she shouldn't see to `words/blocklist.txt` (one per line).
2. Run `npm run puzzles`. This rebuilds `src/data/puzzles.json` and `docs/puzzle-sample.html`.
3. Look over `docs/puzzle-sample.html`, then commit and push. GitHub Pages republishes automatically, and her iPad picks up the change after her next finished puzzle.

Regenerating puzzles can change their order, so she may start a fresh puzzle at her current position.

## Word list credit

Words come from SCOWL (Spell Checker Oriented Word Lists) by Kevin Atkinson; see `words/scowl/Copyright`.
Plurals and other word endings are recognised with AGID (Automatically Generated Inflection Database), also by Kevin Atkinson; see `words/agid/README`.
