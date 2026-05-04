/**
 * End-to-end check: same path as the browser (anon key + signInWithPassword).
 * Run after: npm run create-dashboard-user
 *
 * Usage: npm run verify-login
 * Env: TEST_LOGIN_EMAIL, TEST_LOGIN_PASSWORD (defaults match create-dashboard-user)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseEnvFile(content) {
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = val;
    }
  }
}

const envPath = resolve(__dirname, "../.env");
if (existsSync(envPath)) parseEnvFile(readFileSync(envPath, "utf8"));

const url = (process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const anon = process.env.VITE_SUPABASE_ANON_KEY || "";
const email = (process.env.TEST_LOGIN_EMAIL || "test@pushcare.net").trim().toLowerCase();
const password = process.env.TEST_LOGIN_PASSWORD || "Test@123";

if (!url || !anon) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in pushcare-admin/.env");
  process.exit(1);
}

const supabase = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase.auth.signInWithPassword({ email, password });

if (error) {
  console.error("VERIFY_LOGIN_FAILED:", error.message);
  process.exit(1);
}

console.log("VERIFY_LOGIN_OK", data.user?.email, data.user?.id);
process.exit(0);
