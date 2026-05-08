import { describe, it, expect, afterEach } from "vitest";
import {
  getApkBuildCapabilitySummary,
  resetApkBuildEnvironmentCacheForTests,
} from "./builder/runner.js";

describe("APK pipeline scope (debug / install-only)", () => {
  const snapshot = { ...process.env };

  afterEach(() => {
    process.env = { ...snapshot };
    resetApkBuildEnvironmentCacheForTests();
  });

  it("defaults gradle task to assembleDebug", () => {
    delete process.env.APKZIO_GRADLE_TASK;
    expect(getApkBuildCapabilitySummary().gradle_task).toBe("assembleDebug");
  });

  it("ignores non-debug Gradle tasks (Play Store release not supported here)", () => {
    process.env.APKZIO_GRADLE_TASK = "assembleRelease";
    expect(getApkBuildCapabilitySummary().gradle_task).toBe("assembleDebug");
  });
});
