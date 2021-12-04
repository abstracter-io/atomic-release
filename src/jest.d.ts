type Json = Record<string, unknown>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
namespace jest {
  interface Expect {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jsonMatching(expected: Json): any;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jsonContaining(expected: Json | Json[]): any;
  }

  export const expect: Expect;
}
