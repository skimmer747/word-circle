import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readBlocklist, readScowl } from '../scripts/scowl';

function tempDir(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'word-circle-'));
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text, 'latin1');
  return dir;
}

describe('readScowl', () => {
  it('keeps lowercase 3–6 letter words with the first size they appear at', () => {
    const dir = tempDir({
      'english-words.10': "cat\nDog\nit\nbanana\nbananas\ncan't\ncafé\n",
      'american-words.10': 'color\n',
      'english-words.20': 'cat\nrobin\n',
      'american-words.20': '',
    });
    expect([...readScowl(dir, 20)]).toEqual([
      ['cat', 10],
      ['banana', 10],
      ['color', 10],
      ['robin', 20],
    ]);
  });

  it('stops at the requested size', () => {
    const dir = tempDir({ 'english-words.10': 'cat\n', 'american-words.10': '' });
    expect([...readScowl(dir, 10).keys()]).toEqual(['cat']);
  });

  it('fails loudly when a list file is missing', () => {
    const dir = tempDir({ 'english-words.10': 'cat\n' });
    expect(() => readScowl(dir, 10)).toThrow();
  });
});

describe('readBlocklist', () => {
  it('reads one word per line, skipping blanks and comments', () => {
    const dir = tempDir({ 'blocklist.txt': '# comment\nDead\n\n  grave  \n' });
    expect([...readBlocklist(path.join(dir, 'blocklist.txt'))]).toEqual(['dead', 'grave']);
  });
});
