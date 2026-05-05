// Decode a JWT payload client-side WITHOUT verifying the signature.
//
// Why no verification here:
//   • The portal is purely a static site — verifying a signature would mean
//     shipping the server's public key (or worse, secret) to every browser.
//   • Every action the portal takes (pause, set categories, delete) hits the
//     PushCare API and the SERVER reverifies the JWT on every request. That's
//     where authorization actually happens.
//   • What we read here — `app_id`, `device_id`, `exp` — is for display only:
//     "you're managing notifications for <app>" and "this link expires soon".
//
// If a tampered token gets us to render the wrong app name, no harm done —
// the next API call will be rejected.

export type DecodedToken = {
  app_id?: string;
  device_id?: string;
  exp?: number; // unix seconds
  iat?: number;
  // Some SDKs may include a friendly app label so we don't have to look it up.
  app_name?: string;
  app_package?: string;
  app_icon_color?: string;
  app_icon_glyph?: string;
  subscribed_at?: string; // ISO
};

export function decodeToken(token: string): DecodedToken | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
    const json = atob(padded);
    const parsed = JSON.parse(json) as DecodedToken;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** True if the token has an `exp` claim and it's in the past. */
export function isTokenExpired(t: DecodedToken | null): boolean {
  if (!t || typeof t.exp !== "number") return false;
  return t.exp * 1000 < Date.now();
}
