import { describe, it, expect } from "vitest";
import { gradleVersionMeetsMinimum } from "./builder/runner.js";

describe("gradleVersionMeetsMinimum", () => {
  it("accepts Gradle 8.7+", () => {
    expect(gradleVersionMeetsMinimum("\nGradle 8.7\n", 8, 7)).toBe(true);
    expect(gradleVersionMeetsMinimum("\nGradle 8.10.2\n", 8, 7)).toBe(true);
    expect(gradleVersionMeetsMinimum("\nGradle 9.0\n", 8, 7)).toBe(true);
  });

  it("rejects Gradle below 8.7", () => {
    expect(gradleVersionMeetsMinimum("\nGradle 4.4.1\n", 8, 7)).toBe(false);
    expect(gradleVersionMeetsMinimum("\nGradle 8.6\n", 8, 7)).toBe(false);
  });
});
