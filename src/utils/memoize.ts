type Memoize = <T>(key: string, cb: () => T) => T;

const memoize = (): Memoize => {
  const values = new Map<string, unknown>();

  return <T>(key: string, cb: () => T): T => {
    if (!values.has(key)) {
      values.set(key, cb());
    }

    return values.get(key) as T;
  };
};

export { memoize, Memoize };
