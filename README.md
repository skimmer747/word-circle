# Word Circle

Calm, large-print word games for Mom's iPad:

- **Word Circle**, in the style of Word Cookies.
- **Word Guess**, a big-print Wordle with no losing, plus the real daily Wordle word each morning.

The **Games** button beside the clock switches between them, and each keeps her place.

- Design: `docs/superpowers/specs/2026-10-19-word-circle-design.md` and `docs/superpowers/specs/2026-10-19-word-guess-design.md`
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

## The daily Wordle (Word Guess)

Every morning at about 4–5 AM Eastern, GitHub fetches the real Wordle word from the New York Times and republishes the site with it, so you don't need to do anything.
Her iPad picks it up within about 10 minutes when it has Wi-Fi.
The first new word she starts that day is today's Wordle, marked **Today's Wordle**. When she gets it, the **Share** button texts her result in Wordle's own format (`Wordle 1,948 4/6` and the colored squares).

- **If it ever stops:** she simply gets words from our own list, and nothing breaks. The NYT address it uses is unofficial and could change.
- **GitHub pauses the morning job after 60 days with no commits** to this repository. It emails you first. To turn it back on, open the repository's **Actions** tab, pick **Deploy**, and tap **Enable workflow**.
- **To fetch the word right now:** **Actions › Deploy › Run workflow**.
- A word on her never-use list (`words/blocklist.txt`) is skipped; she gets a word from our list that day.
- `npm run daily-word` does the same fetch on your Mac (into `public/daily-word.txt`, which isn't committed). It prints only how many words it got, so it won't spoil the answer.

## Changing the words

1. Add any word she shouldn't see to `words/blocklist.txt` (one per line). It won't appear anywhere, in either game, not even as an extra word.
   If a plural or other word ending shows up in the word slots, add it to `words/not-plain.txt` instead; it will still count as an extra word.
   To keep a word from ever being the **Word Guess** answer while still letting her type it as a guess (and without touching Word Circle), add it to `words/guess-skip.txt`.
2. Run `npm run puzzles`. This rebuilds all three Word Circle levels in `src/data/puzzles.json`, Word Guess's lists in `src/data/guess-words.json`, and the sample page `docs/puzzle-sample.html` (which lists every Word Guess answer at the bottom).
3. Look over `docs/puzzle-sample.html`, then commit and push. GitHub Pages republishes automatically, and her iPad picks up the change after her next finished puzzle or word.

Regenerating can change the order, so she may start a fresh puzzle or word at her current position.

## Word list credit

Words come from SCOWL (Spell Checker Oriented Word Lists) by Kevin Atkinson; see `words/scowl/Copyright`.
Plurals and other word endings are recognised with AGID (Automatically Generated Inflection Database), also by Kevin Atkinson; see `words/agid/README`.
