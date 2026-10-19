import '@fontsource/atkinson-hyperlegible/700.css';
import './styles.css';
import { App } from './app';
import puzzleData from './data/puzzles.json';
import type { PuzzleSet } from './circle/types';
import { setupUpdates } from './pwa';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');

let app: App | undefined;
const updates = setupUpdates(() => app?.interacted ?? false);
app = new App(root, puzzleData as PuzzleSet, window.localStorage, updates);
app.start();
