// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const spiedLogger = () => {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };
};

export { spiedLogger };
