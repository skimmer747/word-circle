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
import type { GameId, GameScreen } from './frame/games';
import { GridScreen } from './grid/screen';
import type { GridPuzzleSet, GridWords } from './grid/types';
import { GuessScreen } from './guess/screen';
import { loadStarters } from './jigsaw/pictures';
import { JigsawScreen } from './jigsaw/screen';
import type { GuessWords } from './guess/words';
import { photoAdder } from './photos/adder';
import { loadPictureList } from './photos/family';
import { openPhotoStore, trackChanges, type PhotoStore } from './photos/store';
import { startAnalytics } from './analytics';
import { setupUpdates } from './pwa';
import { firstScreen, isInstalled } from './settings/first-screen';
import { openSettingsPage } from './settings/page';
import { loadSettings, saveSettings, type Settings } from './settings/settings';
import { openWelcomePage } from './settings/welcome';
import { avoidChecker } from './shared/avoid';
import { dayKey } from './shared/days';
import { familyStats, type FamilyStats } from './stats/family-stats';
import { loadLifetime, loadLog } from './stats/log';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');
const store = window.localStorage;
/** The family's photos for Jigsaw, in this app's own IndexedDB database; null where it can't keep them. */
const photoStore = openPhotoStore();

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
let settingsShowing = false;
// Updates wait while she's playing, or while a caregiver is filling in the settings page.
const updates = setupUpdates(() => settingsShowing || (frame?.interacted ?? false));

function showSettings(
  settings: Settings,
  firstTime: boolean,
  family: FamilyStats | null,
  photos: PhotoStore | null,
  done: (next: Settings) => void,
  cancel: () => void,
): void {
  settingsShowing = true;
  openSettingsPage(root!, settings, {
    firstTime,
    family,
    photos,
    done: (next) => {
      settingsShowing = false;
      done(next);
    },
    cancel: () => {
      settingsShowing = false;
      cancel();
    },
  });
}

/** Builds the games this iPad's settings ask for, and starts. */
function startApp(settings: Settings): void {
  const avoided = avoidChecker(settings.avoid);
  const makers: Record<GameId, () => GameScreen> = {
    circle: () => new CircleScreen(puzzleData as PuzzleSet, store, { startLevel: settings.startLevel, avoided }),
    guess: () => new GuessScreen(guessWords as GuessWords, store, { fetchDaily, share: settings.share ? share : null, avoided }),
    grid: () => new GridScreen(gridPuzzles as GridPuzzleSet, gridWords as GridWords, store, { startLevel: settings.startLevel, avoided }),
    jigsaw: () =>
      new JigsawScreen(store, {
        loadPictures: () =>
          loadPictureList(photoStore, settings.jigsawStarters ? () => loadStarters(import.meta.env.BASE_URL) : async () => []),
        photos: photoStore && photoAdder(root!, photoStore),
      }),
  };
  frame = new Frame(root!, store, updates, settings.games.map((id) => makers[id]()), loadSavedGame(store).stats, {
    name: settings.name,
    thumb: settings.thumb,
    schedule: settings.schedule,
    openSettings: (closed) => {
      const watched = photoStore && trackChanges(photoStore);
      showSettings(
        settings,
        false,
        familyStats(loadLog(store), dayKey(new Date()), loadLifetime(store).since),
        watched?.store ?? null,
        (next) => {
          saveSettings(store, next);
          // Everything is saved after every move, so she loses nothing; the app comes back built from the new settings.
          window.location.reload();
        },
        // Photos are saved as they're changed, so Cancel still brings the game up to date with them.
        () => (watched?.changed() ? window.location.reload() : closed()),
      );
    },
  });
  frame.start();
}

const { settings, firstTime } = loadSettings(store);
// Start playing goes straight in (no reload), so an iPad that can't save still gets to play.
const firstSetup = () =>
  showSettings(
    settings,
    true,
    null,
    photoStore,
    (next) => {
      saveSettings(store, next);
      startApp(next);
    },
    () => {},
  );
const installed = isInstalled(window);
startAnalytics(installed);
const screen = firstScreen({ firstTime, installed });
if (screen === 'welcome') openWelcomePage(root, { setUpHere: firstSetup });
else if (screen === 'setup') firstSetup();
else startApp(settings);
