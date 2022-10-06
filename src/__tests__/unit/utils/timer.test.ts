import { timer } from "../../../utils/timer";

describe("timer", () => {
  test.skip("elapsed time is correct", async () => {
    const t = timer();

    await new Promise((resolve) => {
      setTimeout(resolve, 2000);
    });

    expect(t.elapsedMs()).toBeCloseTo(2000, 3);
  });
});
