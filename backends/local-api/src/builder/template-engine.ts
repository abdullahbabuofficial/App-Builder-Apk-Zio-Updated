/**
 * WebView App Builder — template engine.
 *
 * Reads the baked-in Android Studio template tree from `backends/local-api/template`,
 * walks it, applies token substitutions, and rewrites the synthetic
 * `__PACKAGE_PATH__` directory segment into the user's real Java package path
 * (e.g. `com.example.webview` → `com/example/webview`). It also strips
 * `<!-- IF FOO --> ... <!-- ENDIF -->` blocks when the corresponding boolean is
 * false, which is how we toggle conditional `<uses-permission>` lines in the
 * AndroidManifest without keeping a parallel set of templates.
 *
 * The engine is purely in-memory; the runner stages files to disk, zips them,
 * and may run `./gradlew assembleDebug` when the host has an Android SDK.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Resolves to <repo>/backends/local-api/template regardless of where node was launched. */
export const TEMPLATE_DIR = path.resolve(__dirname, "..", "..", "template");

export type WebViewBuildConfig = {
  app_name: string;
  package_name: string;
  start_url: string;
  primary_color: string;
  background_color: string;
  splash_color: string;
  allow_file_uploads: boolean;
  allow_geolocation: boolean;
  allow_camera: boolean;
  pull_to_refresh: boolean;
  swipe_back: boolean;
  offline_message: string;
  release_notes: string;
};

export type RenderInput = {
  config: WebViewBuildConfig;
  versionCode: number;
  versionName: string;
};

export type RenderedFile = {
  /** Forward-slash, project-relative path (e.g. "app/src/main/AndroidManifest.xml"). */
  path: string;
  content: Buffer;
  /** Convenience flag — true when we treated the file as text and ran substitution. */
  isText: boolean;
};

export type RenderResult = {
  files: RenderedFile[];
  packageSlug: string;
};

const TEXT_EXTENSIONS = new Set([
  ".kt", ".kts", ".java", ".xml", ".html", ".txt", ".md", ".pro",
  ".properties", ".gradle", ".toml", ".json", ".yml", ".yaml",
  ".gitignore",
]);

const PERMISSION_BLOCK = /<!--\s*IF\s+(ALLOW_GEOLOCATION|ALLOW_CAMERA|ALLOW_FILE_UPLOADS)\s*-->[\s\S]*?<!--\s*ENDIF\s*-->\s*/g;

function isTextFile(rel: string): boolean {
  const base = path.basename(rel).toLowerCase();
  if (base.startsWith(".") && TEXT_EXTENSIONS.has(base)) return true;
  const ext = path.extname(base);
  return TEXT_EXTENSIONS.has(ext);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildTokenMap(input: RenderInput): Record<string, string> {
  const c = input.config;
  return {
    __APP_NAME__: c.app_name,
    __PACKAGE_NAME__: c.package_name,
    __VERSION_CODE__: String(input.versionCode),
    __VERSION_NAME__: input.versionName,
    __START_URL__: c.start_url,
    __PRIMARY_HEX__: c.primary_color,
    __BACKGROUND_HEX__: c.background_color,
    __SPLASH_HEX__: c.splash_color,
    __OFFLINE_MESSAGE__: escapeXml(c.offline_message),
    __ALLOW_GEOLOCATION__: String(!!c.allow_geolocation),
    __ALLOW_CAMERA__: String(!!c.allow_camera),
    __ALLOW_FILE_UPLOADS__: String(!!c.allow_file_uploads),
    __PULL_TO_REFRESH__: String(!!c.pull_to_refresh),
    __SWIPE_BACK__: String(!!c.swipe_back),
    __GENERATED_AT__: new Date().toISOString(),
  };
}

/**
 * Strip `<!-- IF FOO --> ... <!-- ENDIF -->` blocks when the boolean for FOO is
 * false. The block is dropped entirely (including the trailing newline so we
 * don't leave a hole in indentation-sensitive XML).
 */
function applyConditionalBlocks(text: string, config: WebViewBuildConfig): string {
  return text.replace(PERMISSION_BLOCK, (match, key: string) => {
    const allowed =
      (key === "ALLOW_GEOLOCATION" && !!config.allow_geolocation) ||
      (key === "ALLOW_CAMERA" && !!config.allow_camera) ||
      (key === "ALLOW_FILE_UPLOADS" && !!config.allow_file_uploads);
    if (!allowed) return "";
    // When allowed, just strip the IF/ENDIF markers but keep the inner lines.
    return match
      .replace(/<!--\s*IF\s+\w+\s*-->\s*\n?/g, "")
      .replace(/<!--\s*ENDIF\s*-->\s*\n?/g, "");
  });
}

function applyTokens(text: string, tokens: Record<string, string>): string {
  let out = text;
  for (const [key, value] of Object.entries(tokens)) {
    if (!out.includes(key)) continue;
    out = out.split(key).join(value);
  }
  return out;
}

/** Convert "com.example.app" → "com/example/app". */
function packagePath(pkg: string): string {
  return pkg.replace(/\./g, "/");
}

function rewritePackagePath(rel: string, pkg: string): string {
  if (!rel.includes("__PACKAGE_PATH__")) return rel;
  return rel.split("__PACKAGE_PATH__").join(packagePath(pkg));
}

/** Slugify a package name into something we can use as the zip's root folder. */
export function packageSlug(pkg: string): string {
  const last = pkg.split(".").filter(Boolean).pop() ?? "webview";
  return last.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "webview";
}

async function* walk(dir: string, base: string): AsyncGenerator<{ abs: string; rel: string }> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(base, abs).split(path.sep).join("/");
    if (entry.isDirectory()) {
      yield* walk(abs, base);
    } else if (entry.isFile()) {
      yield { abs, rel };
    }
  }
}

/**
 * Load the template tree, expand tokens, rewrite the Java package directory,
 * and return the rendered file list. Does NOT touch disk on the output side —
 * `runner.ts` handles staging + zipping.
 */
export async function renderTemplate(input: RenderInput): Promise<RenderResult> {
  const tokens = buildTokenMap(input);
  const out: RenderedFile[] = [];
  const seen = new Set<string>();

  const stat = await fs.stat(TEMPLATE_DIR).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    throw new Error(`template directory missing at ${TEMPLATE_DIR}`);
  }

  for await (const { abs, rel } of walk(TEMPLATE_DIR, TEMPLATE_DIR)) {
    const targetRel = rewritePackagePath(rel, input.config.package_name);
    if (seen.has(targetRel)) {
      throw new Error(`template emitted duplicate path: ${targetRel}`);
    }
    seen.add(targetRel);

    const text = isTextFile(rel);
    const raw = await fs.readFile(abs);

    if (text) {
      const stage1 = applyConditionalBlocks(raw.toString("utf8"), input.config);
      const stage2 = applyTokens(stage1, tokens);
      out.push({ path: targetRel, content: Buffer.from(stage2, "utf8"), isText: true });
    } else {
      out.push({ path: targetRel, content: raw, isText: false });
    }
  }

  return { files: out, packageSlug: packageSlug(input.config.package_name) };
}
