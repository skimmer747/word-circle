import '@fontsource/atkinson-hyperlegible/700.css';
import './styles.css';
import { App } from './app';
import puzzleData from './data/puzzles.json';
import type { Puzzle } from './game/types';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');

const app = new App(root, puzzleData as Puzzle[], window.localStorage, { applyIfPending: () => false });
app.start();
