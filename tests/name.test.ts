import { describe, expect, it } from 'vitest';
import { MAX_NAME_LENGTH, cleanName, greeting, wellDoneTitle } from '../src/settings/name';

describe('cleanName', () => {
  it('tidies spaces', () => {
    expect(cleanName('  Ruth   Anne ')).toBe('Ruth Anne');
  });

  it('cuts a long name so the card title still fits', () => {
    expect(cleanName('Grandmother Josephine')).toHaveLength(MAX_NAME_LENGTH);
    expect(MAX_NAME_LENGTH).toBe(16);
  });
});

describe('greeting', () => {
  it('greets her by the time of day', () => {
    expect(greeting('Ruth', 5)).toBe('Good morning, Ruth');
    expect(greeting('Ruth', 11)).toBe('Good morning, Ruth');
    expect(greeting('Ruth', 12)).toBe('Good afternoon, Ruth');
    expect(greeting('Ruth', 17)).toBe('Good evening, Ruth');
    expect(greeting('Ruth', 23)).toBe('Good evening, Ruth');
    expect(greeting('Ruth', 3)).toBe('Good evening, Ruth');
  });

  it('says nothing without a name', () => {
    expect(greeting('', 9)).toBe('');
  });
});

describe('wellDoneTitle', () => {
  it('uses her name when there is one', () => {
    expect(wellDoneTitle('Ruth')).toBe('Well done, Ruth!');
    expect(wellDoneTitle('')).toBe('Well done!');
  });
});
