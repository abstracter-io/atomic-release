import prettyMs from "pretty-ms";

type Timer = {
  toString: () => string;
  elapsedMs: () => number;
};

const timer = (): Timer => {
  const start = process.hrtime();

  const elapsedMs = (): number => {
    return process.hrtime(start)[1] / 1000000;
  };

  const toString = (): string => {
    return prettyMs(elapsedMs());
  };

  return {
    elapsedMs,
    toString,
  };
};

export { timer, Timer };
