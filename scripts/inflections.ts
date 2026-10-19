import fs from 'node:fs';

const ENTRY = /^(\S+) [VNA]\??: (.*)$/;

/**
 * Words that appear in AGID (infl.txt) only as a plural or other ending of another word,
 * e.g. "notes", "stoned", "spoken", "laxer". Words that are also headwords ("spoke", "news") are left out.
 */
export function parseInflectedForms(text: string): Set<string> {
  const headwords = new Set<string>();
  const forms = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const entry = line.match(ENTRY);
    if (!entry) continue;
    headwords.add(entry[1]);
    for (const part of entry[2].split(/[|,]/)) {
      const form = part.trim().split(' ')[0].replace(/[~<!?]/g, '');
      if (form) forms.add(form);
    }
  }
  return new Set([...forms].filter((form) => !headwords.has(form)));
}

export function readInflectedForms(file: string): Set<string> {
  return parseInflectedForms(fs.readFileSync(file, 'latin1'));
}
