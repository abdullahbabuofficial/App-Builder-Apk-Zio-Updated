/**
 * Creates (or links) a Supabase Auth user and an app_owners row for dashboard RLS.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (never use in the browser — server/scripts only).
 * Loads URL from SUPABASE_URL or VITE_SUPABASE_URL from env / .env files.
 *
 * Usage:
 *   cd apkzio-admin
 *   npm run create-dashboard-user
 *
 * Optional env:
 *   CREATE_ADMIN_EMAIL (default test@apkzio.net)
 *   CREATE_ADMIN_PASSWORD (default Test@123)
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

function loadDotEnvFiles() {
  const paths = [
    resolve(__dirname, "../.env"),
    resolve(__dirname, "../../backends/.env"),
  ];
  for (const p of paths) {
    if (existsSync(p)) parseEnvFile(readFileSync(p, "utf8"));
  }
}

loadDotEnvFiles();

/** JWT payload.role — anon keys trigger Auth Admin 403 `not_admin`. */
function jwtRole(token) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(b64, "base64").toString("utf8");
    const payload = JSON.parse(json);
    return payload.role ?? null;
  } catch {
    return null;
  }
}

const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const email = (process.env.CREATE_ADMIN_EMAIL || "test@apkzio.net").trim().toLowerCase();
const password = process.env.CREATE_ADMIN_PASSWORD || "Test@123";

if (!url || !serviceKey) {
  console.error(
    "Missing configuration.\n" +
      "  • Set SUPABASE_SERVICE_ROLE_KEY (e.g. copy backends/.env.example → backends/.env)\n" +
      "  • Set SUPABASE_URL or VITE_SUPABASE_URL in backends/.env or apkzio-admin/.env\n",
  );
  process.exit(1);
}

const keyRole = jwtRole(serviceKey);
if (keyRole !== "service_role") {
  console.error(
    `SUPABASE_SERVICE_ROLE_KEY must be the service_role JWT (Dashboard → Project Settings → API).\n` +
      `Decoded JWT role is "${keyRole ?? "invalid"}". Anon / publishable keys return Auth error not_admin (403).\n`,
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let userId;

const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (createErr) {
  const msg = createErr.message || "";
  const exists =
    /already|registered|exists|duplicate/i.test(msg) || createErr.status === 422;
  if (!exists) {
    console.error("Auth admin createUser failed:", createErr);
    process.exit(1);
  }
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) {
    console.error("Could not list users after duplicate error:", listErr);
    process.exit(1);
  }
  const u = list?.users?.find((x) => (x.email || "").toLowerCase() === email);
  if (!u) {
    console.error("User may exist but was not found in first 200 users:", msg);
    process.exit(1);
  }
  userId = u.id;
  console.log("Auth user already existed:", email, userId);
} else {
  userId = created.user.id;
  console.log("Created Auth user:", email, userId);
}

/** Ensures browser signInWithPassword matches CREATE_ADMIN_PASSWORD (common fix for “Invalid login credentials”). */
const { error: syncErr } = await admin.auth.admin.updateUserById(userId, {
  password,
  email_confirm: true,
});
if (syncErr) {
  console.error("Could not sync password / email_confirm:", syncErr.message);
  process.exit(1);
}
console.log("Synced password + confirmed email for:", email);

const { error: insErr } = await admin.from("app_owners").insert({
  auth_user_id: userId,
  email,
  display_name: "Test Admin",
});

if (insErr) {
  if (insErr.code === "23505") {
    const { data: existing, error: selErr } = await admin
      .from("app_owners")
      .select("owner_id, auth_user_id, email")
      .eq("email", email)
      .maybeSingle();
    if (selErr) {
      console.error(selErr);
      process.exit(1);
    }
    if (existing?.auth_user_id === userId) {
      console.log("app_owners already linked for", email);
    } else {
      const { error: upErr } = await admin
        .from("app_owners")
        .update({ auth_user_id: userId, display_name: "Test Admin" })
        .eq("email", email);
      if (upErr) {
        console.error("Could not update app_owners row:", upErr);
        process.exit(1);
      }
      console.log("Updated app_owners.auth_user_id for", email);
    }
  } else {
    console.error("Insert app_owners failed:", insErr);
    process.exit(1);
  }
} else {
  console.log("Inserted app_owners for dashboard access.");
}

console.log("\nSign in at the admin UI:");
console.log("  Email:", email);
console.log("  Password: (the one you set — default Test@123 if unchanged)");
