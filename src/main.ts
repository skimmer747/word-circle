import '@fontsource/atkinson-hyperlegible/700.css';
import './styles.css';
import { CircleScreen } from './circle/screen';
import { loadSavedGame } from './circle/storage';
import type { PuzzleSet } from './circle/types';
import guessWords from './data/guess-words.json';
import puzzleData from './data/puzzles.json';
import gridPuzzles from './data/grid-puzzles.json';
import gridWords from './data/grid-words.json';
import { Frame } from './frame/frame';
import { GridScreen } from './grid/screen';
import type { GridPuzzleSet, GridWords } from './grid/types';
import { GuessScreen } from './guess/screen';
import type { GuessWords } from './guess/words';
import { setupUpdates } from './pwa';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');
const store = window.localStorage;

/** The daily Wordle words, published with the site each morning. */
async function fetchDaily(): Promise<string> {
  const response = await fetch(`${import.meta.env.BASE_URL}daily-word.txt?v=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Daily word not available (${response.status})`);
  return response.text();
}

/** Opens the iPad's share sheet with her result. Called straight from her tap. */
const share =
  typeof navigator.share === 'function'
    ? async (text: string) => {
        try {
          await navigator.share({ text });
        } catch {
          // She closed the share sheet without sending: nothing to do.
        }
      }
    : null;

let frame: Frame | undefined;
const updates = setupUpdates(() => frame?.interacted ?? false);
const games = [
  new CircleScreen(puzzleData as PuzzleSet, store),
  new GuessScreen(guessWords as GuessWords, store, { fetchDaily, share }),
  new GridScreen(gridPuzzles as GridPuzzleSet, gridWords as GridWords, store),
];
frame = new Frame(root, store, updates, games, loadSavedGame(store).stats);
frame.start();
