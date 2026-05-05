import { describe, it, expect } from "vitest";
import { cn, hash, mulberry32, clamp, pick } from "@/lib/utils";

describe("cn", () => {
  it("joins truthy parts with single space", () => {
    expect(cn("a", "b")).toBe("a b");
  });
  it("filters out falsy values", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
  it("returns empty string for all-falsy", () => {
    expect(cn(false, null, undefined)).toBe("");
  });
});

describe("hash", () => {
  it("is deterministic for the same string", () => {
    expect(hash("hello")).toBe(hash("hello"));
  });
  it("differs for different inputs", () => {
    expect(hash("a")).not.toBe(hash("b"));
  });
  it("returns an unsigned 32-bit integer", () => {
    const h = hash("anything");
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });
});

describe("mulberry32", () => {
  it("yields the same sequence for the same seed", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    expect(a()).toBe(b());
    expect(a()).toBe(b());
  });
  it("yields values in [0,1)", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 10; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("clamp", () => {
  it("clamps below min", () => {
    expect(clamp(-1, 0, 10)).toBe(0);
  });
  it("clamps above max", () => {
    expect(clamp(99, 0, 10)).toBe(10);
  });
  it("passes through when in range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
});

describe("pick", () => {
  it("uses the rng to choose an element", () => {
    expect(pick(() => 0, ["a", "b", "c"])).toBe("a");
    expect(pick(() => 0.99, ["a", "b", "c"])).toBe("c");
  });
});
