import { vitest } from 'vitest';

const spiedLogger = () => {
  return {
    warn: vitest.fn(),
    info: vitest.fn(),
    debug: vitest.fn(),
    error: vitest.fn(),
  };
};

export { spiedLogger };
