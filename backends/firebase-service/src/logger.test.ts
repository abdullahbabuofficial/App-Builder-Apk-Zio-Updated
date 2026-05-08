import { describe, expect, it } from "vitest";
import { logger } from "./logger.js";

describe("logger", () => {
  it("creates a structured logger with expected bindings", () => {
    const bindings = logger.bindings();
    expect(bindings.service).toBe("apkzio-dispatcher");
    expect(typeof bindings.env).toBe("string");
  });
});
