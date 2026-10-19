import fs from 'node:fs';

const ENTRY = /^(\S+) ([VNA])(\??): (.*)$/;

/**
 * Words that appear in AGID (infl.txt) only as a plural or other ending of another word,
 * e.g. "notes", "stoned", "spoken", "laxer". Words that are also headwords ("spoke", "news") are left out,
 * except -ing forms of verbs ("making", "asking"), which count as endings even when also listed as nouns.
 * Uncertain entries ("cars N?", "fines V?") don't count as headwords.
 */
export function parseInflectedForms(text: string): Set<string> {
  const headwords = new Set<string>();
  const forms = new Set<string>();
  const verbIngForms = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const entry = line.match(ENTRY);
    if (!entry) continue;
    const [, word, partOfSpeech, uncertain, inflections] = entry;
    if (uncertain === '') headwords.add(word);
    for (const part of inflections.split(/[|,]/)) {
      const form = part.trim().split(' ')[0].replace(/[~<!?]/g, '');
      if (!form) continue;
      forms.add(form);
      if (partOfSpeech === 'V' && uncertain === '' && form !== word && form.endsWith('ing')) verbIngForms.add(form);
    }
  }
  return new Set([...forms].filter((form) => !headwords.has(form) || verbIngForms.has(form)));
}

export function readInflectedForms(file: string): Set<string> {
  return parseInflectedForms(fs.readFileSync(file, 'latin1'));
}
