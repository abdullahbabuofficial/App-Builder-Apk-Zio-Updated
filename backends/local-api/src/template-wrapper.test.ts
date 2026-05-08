import { describe, it, expect } from "vitest";
import { renderTemplate } from "./builder/template-engine.js";

const minimalConfig = {
  app_name: "Smoke Test",
  package_name: "com.apkzio.smoketest",
  start_url: "https://example.com/",
  primary_color: "#CDFF3F",
  background_color: "#0B0F0E",
  splash_color: "#0B0F0E",
  allow_file_uploads: true,
  allow_geolocation: false,
  allow_camera: false,
  pull_to_refresh: true,
  swipe_back: true,
  offline_message: "offline",
  release_notes: "",
};

describe("template Gradle wrapper", () => {
  it("includes gradlew and wrapper jar so APK builds use Gradle 8.x, not ancient system gradle", async () => {
    const r = await renderTemplate({
      config: minimalConfig,
      versionCode: 1,
      versionName: "1.0",
    });
    const paths = new Set(r.files.map((f) => f.path));
    expect(paths.has("gradlew")).toBe(true);
    expect(paths.has("gradle/wrapper/gradle-wrapper.jar")).toBe(true);
    expect(paths.has("gradle/wrapper/gradle-wrapper.properties")).toBe(true);
  });
});
