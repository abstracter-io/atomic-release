import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      SUPPRESS_NO_CONFIG_WARNING: 0,
    },

    include: ['tests/**/*.test.ts'],

    exclude: ['tests/utils/**/*.ts'],

    coverage: {
      all: true,
      include: ['src/**'],
      provider: 'v8',
      enabled: Boolean(process.env.CI),
      reporter: ['text'],
    },
  },
});
