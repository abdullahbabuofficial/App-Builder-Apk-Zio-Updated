import { readFile } from "node:fs/promises";
import admin from "firebase-admin";

let app: admin.app.App | null = null;
let initPromise: Promise<admin.app.App | null> | null = null;

function isProbablyJson(s: string): boolean {
  const t = s.trim();
  return t.startsWith("{") && t.endsWith("}");
}

function decodeBase64(s: string): string | null {
  try {
    return Buffer.from(s, "base64").toString("utf8");
  } catch {
    return null;
  }
}

async function readServiceAccount(): Promise<admin.ServiceAccount | null> {
  const jsonRaw = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? "").trim();
  const pathRaw = String(process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? "").trim();

  if (jsonRaw) {
    const candidate = isProbablyJson(jsonRaw) ? jsonRaw : decodeBase64(jsonRaw);
    if (!candidate) return null;
    try {
      return JSON.parse(candidate) as admin.ServiceAccount;
    } catch {
      return null;
    }
  }

  if (pathRaw) {
    const body = await readFile(pathRaw, "utf8").catch(() => null);
    if (!body) return null;
    try {
      return JSON.parse(body) as admin.ServiceAccount;
    } catch {
      return null;
    }
  }

  return null;
}

export function isFirebaseAdminConfigured(): boolean {
  const jsonRaw = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? "").trim();
  const pathRaw = String(process.env.FIREBASE_SERVICE_ACCOUNT_PATH ?? "").trim();
  return !!(jsonRaw || pathRaw);
}

export async function getFirebaseAdminApp(): Promise<admin.app.App | null> {
  if (app) return app;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (admin.apps.length > 0) {
      app = admin.app();
      return app;
    }

    const svc = await readServiceAccount();
    if (!svc) return null;

    const projectId = String(process.env.FIREBASE_PROJECT_ID ?? "").trim() || undefined;
    app = admin.initializeApp({
      credential: admin.credential.cert(svc),
      projectId,
    });
    return app;
  })();

  return initPromise;
}

/** Verify a Firebase Auth ID token (e.g. from Google sign-in on the web client). */
export async function verifyFirebaseIdToken(
  idToken: string,
): Promise<admin.auth.DecodedIdToken | null> {
  const tok = String(idToken ?? "").trim();
  if (!tok) return null;
  const firebaseApp = await getFirebaseAdminApp();
  if (!firebaseApp) return null;
  try {
    return await admin.auth(firebaseApp).verifyIdToken(tok, true);
  } catch {
    return null;
  }
}

export async function sendFcmMulticast(args: {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<{ success: number; failure: number }> {
  const app = await getFirebaseAdminApp();
  if (!app) return { success: 0, failure: args.tokens.length };

  const tokens = (args.tokens ?? []).map((t) => String(t).trim()).filter(Boolean);
  if (tokens.length === 0) return { success: 0, failure: 0 };

  const chunks: string[][] = [];
  for (let i = 0; i < tokens.length; i += 500) {
    chunks.push(tokens.slice(i, i + 500));
  }

  let success = 0;
  let failure = 0;
  for (const chunk of chunks) {
    const resp = await admin
      .messaging(app)
      .sendEachForMulticast({
        tokens: chunk,
        notification: { title: args.title, body: args.body },
        data: args.data,
      })
      .catch(() => null);
    if (!resp) {
      failure += chunk.length;
      continue;
    }
    success += resp.successCount;
    failure += resp.failureCount;
  }

  return { success, failure };
}

