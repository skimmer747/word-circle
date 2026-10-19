import '@fontsource/atkinson-hyperlegible/700.css';
import './styles.css';
import { CircleScreen } from './circle/screen';
import type { PuzzleSet } from './circle/types';
import puzzleData from './data/puzzles.json';
import { Frame } from './frame/frame';
import { setupUpdates } from './pwa';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');
const store = window.localStorage;

let frame: Frame | undefined;
const updates = setupUpdates(() => frame?.interacted ?? false);
frame = new Frame(root, store, updates, [new CircleScreen(puzzleData as PuzzleSet, store)]);
frame.start();
