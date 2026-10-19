import type { Puzzle } from '../src/circle/types';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const escape = (text: string) => text.replace(/[&<>"]/g, (ch) => ESCAPES[ch]);

export interface SampleSection {
  title: string;
  puzzles: readonly Puzzle[];
}

function renderTable(puzzles: readonly Puzzle[]): string {
  const rows = puzzles
    .map(
      (p, i) =>
        `<tr><td>${i + 1}</td><td class="letters">${escape(p.letters.join(' ').toUpperCase())}</td>` +
        `<td>${escape(p.words.join(', '))}</td><td class="bonus">${escape(p.bonus.join(', '))}</td></tr>`,
    )
    .join('\n');
  return `<table>
<thead><tr><th>#</th><th>Letters</th><th>Words to find</th><th>Also accepted ("Good word!")</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>`;
}

export function renderSamplePage(sections: readonly SampleSection[]): string {
  const body = sections.map((s) => `<h2>${escape(s.title)}</h2>\n${renderTable(s.puzzles)}`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Word Circle puzzle sample</title>
<style>
body { font-family: system-ui, sans-serif; margin: 24px; }
table { border-collapse: collapse; width: 100%; margin-bottom: 32px; }
th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; vertical-align: top; }
.letters { font-weight: 700; letter-spacing: 0.1em; white-space: nowrap; }
.bonus { color: #555; }
</style>
</head>
<body>
<h1>Word Circle puzzle sample</h1>
<p>The first puzzles of each level, in play order. To keep a word from ever appearing, add it to
<code>words/blocklist.txt</code> and run <code>npm run puzzles</code>.</p>
${body}
</body>
</html>
`;
}
