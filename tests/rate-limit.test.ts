import { rateLimit } from "@/lib/rate-limit";
import { describe, expect, it } from "vitest";

describe("rateLimit", () => {
  it("allows up to N requests per window", () => {
    const key = `rl-${Math.random()}`;
    expect(rateLimit(key, 2, 60_000)).toBe(true);
    expect(rateLimit(key, 2, 60_000)).toBe(true);
    expect(rateLimit(key, 2, 60_000)).toBe(false);
  });
});
