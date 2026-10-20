import { describe, expect, it } from 'vitest';
import { MAX_NAME_LENGTH, cleanName, wellDoneTitle } from '../src/settings/name';

describe('cleanName', () => {
  it('tidies spaces', () => {
    expect(cleanName('  Ruth   Anne ')).toBe('Ruth Anne');
  });

  it('cuts a long name so the card title still fits', () => {
    expect(cleanName('Grandmother Josephine')).toBe('Grandmother Jose');
    expect(MAX_NAME_LENGTH).toBe(16);
  });

  it('leaves no space dangling after the cut', () => {
    expect(cleanName('Abcdefghijklmno Smith')).toBe('Abcdefghijklmno');
  });

  it('keeps nothing from only spaces', () => {
    expect(cleanName('   ')).toBe('');
  });

  it('cuts by character, so an emoji is never split', () => {
    expect(cleanName('Grandma Ruthie 💖x')).toBe('Grandma Ruthie 💖');
  });
});

describe('wellDoneTitle', () => {
  it('uses her name when there is one', () => {
    expect(wellDoneTitle('Ruth')).toBe('Well done, Ruth!');
    expect(wellDoneTitle('')).toBe('Well done!');
  });
});
