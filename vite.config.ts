import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/word-circle/',
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
