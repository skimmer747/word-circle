import { readPuzzle } from '../src/grid/puzzle';
import type { GridPuzzle } from '../src/grid/types';

export interface GridSampleSection {
  title: string;
  puzzles: readonly GridPuzzle[];
}

/** One solved puzzle as a little table, with thick lines around each section. */
function renderPuzzle(puzzle: GridPuzzle): string {
  const shape = readPuzzle(puzzle);
  const { size } = shape;
  const sectionAt = (row: number, col: number) =>
    row < 0 || col < 0 || row >= size || col >= size ? -1 : shape.sectionOf[row * size + col];
  const rows = Array.from({ length: size }, (_, row) => {
    const cells = Array.from({ length: size }, (_, col) => {
      const section = sectionAt(row, col);
      if (section < 0) return '<td class="gap"></td>';
      const side = (r: number, c: number) => (sectionAt(r, c) === section ? '1px solid #bbb' : '3px solid #1b3a6b');
      const style = `border-top:${side(row - 1, col)};border-right:${side(row, col + 1)};border-bottom:${side(row + 1, col)};border-left:${side(row, col - 1)}`;
      return `<td style="${style}">${shape.answer[row * size + col].toUpperCase()}</td>`;
    });
    return `<tr>${cells.join('')}</tr>`;
  });
  return `<table class="grid">${rows.join('')}</table>`;
}

export function renderGridSamplePage(sections: readonly GridSampleSection[], answerWords: readonly string[]): string {
  const body = sections
    .map((s) => `<h2>${s.title}</h2>\n<div class="puzzles">${s.puzzles.map(renderPuzzle).join('\n')}</div>`)
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Word Grid puzzle sample</title>
<style>
body { font-family: system-ui, sans-serif; margin: 24px; }
.puzzles { display: flex; flex-wrap: wrap; gap: 24px; margin-bottom: 32px; }
table.grid { border-collapse: collapse; }
table.grid td { width: 30px; height: 30px; text-align: center; font-weight: 700; font-size: 17px; }
table.grid td.gap { border: none; }
.answers { columns: 8 110px; font-size: 15px; }
</style>
</head>
<body>
<h1>Word Grid puzzle sample</h1>
<p>The first puzzles of each Word Grid level, solved, with each section outlined, and every answer word the
puzzles use. To keep a word out, add it to <code>words/blocklist.txt</code> (out of every game) or
<code>words/guess-skip.txt</code> (never an answer in Word Guess or Word Grid) and run <code>npm run grid-puzzles</code>.</p>
${body}
<h2>Every answer word used (${answerWords.length})</h2>
<ul class="answers">${answerWords.map((word) => `<li>${word}</li>`).join('')}</ul>
</body>
</html>
`;
}
