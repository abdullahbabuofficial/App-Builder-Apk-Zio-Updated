/**
 * Renders the WebView template to a temp dir and runs ./gradlew assembleDebug.
 * Requires JAVA_HOME / java 17+, ANDROID_HOME with API 34 + build-tools 34.x.
 * Used in CI after android-actions/setup-android.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { renderTemplate } from "../src/builder/template-engine.js";

function run(
  cmd: string,
  args: string[],
  opts: { cwd: string; env: NodeJS.ProcessEnv },
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: opts.env,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function main(): Promise<void> {
  const androidHome =
    process.env.ANDROID_HOME?.trim() || process.env.ANDROID_SDK_ROOT?.trim();
  if (!androidHome) {
    console.error("e2e: set ANDROID_HOME or ANDROID_SDK_ROOT");
    process.exit(1);
  }

  const outDir = await fs.mkdtemp(path.join("/tmp", "apkzio-e2e-"));
  const rendered = await renderTemplate({
    config: {
      app_name: "E2E Build",
      package_name: "com.apkzio.e2e",
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
    },
    versionCode: 1,
    versionName: "1.0-e2e",
  });

  for (const file of rendered.files) {
    const target = path.join(outDir, file.path);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content);
  }

  const gradlew = path.join(outDir, "gradlew");
  await fs.chmod(gradlew, 0o755);

  const env = {
    ...process.env,
    ANDROID_HOME: androidHome,
    ANDROID_SDK_ROOT: androidHome,
  };

  const code = await run("./gradlew", ["assembleDebug", "--no-daemon"], {
    cwd: outDir,
    env,
  });
  if (code !== 0) {
    console.error(`e2e: gradle exited ${code}`);
    process.exit(code);
  }

  const apk = path.join(
    outDir,
    "app",
    "build",
    "outputs",
    "apk",
    "debug",
    "app-debug.apk",
  );
  const st = await fs.stat(apk).catch(() => null);
  if (!st?.isFile()) {
    console.error("e2e: app-debug.apk missing");
    process.exit(1);
  }
  console.log(`e2e ok · ${apk} · ${st.size} bytes`);
  await fs.rm(outDir, { recursive: true, force: true }).catch(() => undefined);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
