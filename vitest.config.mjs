import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],

    coverage: {
      all: true,
      include: ['src/**'],
      provider: 'v8',
      enabled: Boolean(process.env.CI),
      reporter: ['text'],
    },
  },
});
