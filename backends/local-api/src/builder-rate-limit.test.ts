import { describe, it, expect } from "vitest";
import { createFixedWindowLimiter } from "./builder-rate-limit.js";

describe("createFixedWindowLimiter", () => {
  it("allows exactly max hits per window per key", () => {
    const allow = createFixedWindowLimiter(3, 60_000);
    expect(allow("a")).toBe(true);
    expect(allow("a")).toBe(true);
    expect(allow("a")).toBe(true);
    expect(allow("a")).toBe(false);
  });

  it("isolates keys", () => {
    const allow = createFixedWindowLimiter(1, 60_000);
    expect(allow("x")).toBe(true);
    expect(allow("x")).toBe(false);
    expect(allow("y")).toBe(true);
  });
});
