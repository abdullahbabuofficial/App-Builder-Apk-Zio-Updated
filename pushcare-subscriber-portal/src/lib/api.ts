// API client for the subscriber portal.
//
// All endpoints take the JWT in the URL path so the server can re-verify it
// on every request. We never read the signature here.
//
// Every mutation is best-effort — if the backend isn't wired up yet (404 /
// network error / CORS) we log a warning and resolve with a stub so the UI
// stays optimistic. Real wiring lives in pushcare-server (TODO below).

const DEFAULT_BASE = "http://localhost:8787";

export function getApiBaseUrl(): string {
  return import.meta.env.VITE_PUSHCARE_API_URL || DEFAULT_BASE;
}

export type PauseDuration = "off" | "1h" | "1d" | "1w" | "forever";

export const CATEGORY_KEYS = ["promo", "alerts", "transactional", "news"] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export type PreferencesPayload = {
  app: {
    id: string;
    name: string;
    package: string;
    icon_color: string;
    icon_glyph: string;
  };
  device: {
    id: string;
    subscribed_at: string; // ISO
  };
  pause: {
    state: PauseDuration;
    until?: string | null; // ISO when pause expires
  };
  categories: Record<CategoryKey, boolean>;
};

// Mock returned when there is no backend yet. Lets the page render fully so
// designers / QA can click through without spinning up the API.
function mockPreferences(decoded: { app_id?: string; device_id?: string }): PreferencesPayload {
  return {
    app: {
      id: decoded.app_id || "demo-app",
      name: "Aurora Weather",
      package: "com.aurora.weather",
      icon_color: "#CDFF3F",
      icon_glyph: "A",
    },
    device: {
      id: decoded.device_id || "demo-device",
      // 47 days ago
      subscribed_at: new Date(Date.now() - 47 * 86400 * 1000).toISOString(),
    },
    pause: { state: "off", until: null },
    categories: {
      promo: false,
      alerts: true,
      transactional: true,
      news: true,
    },
  };
}

async function safeFetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
    if (!res.ok) {
      console.warn(`[pushcare] ${init?.method || "GET"} ${url} -> ${res.status}`);
      return null;
    }
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : ({} as T);
  } catch (err) {
    console.warn(`[pushcare] network error for ${url}`, err);
    return null;
  }
}

export async function fetchPreferences(
  token: string,
  decoded: { app_id?: string; device_id?: string }
): Promise<PreferencesPayload> {
  const url = `${getApiBaseUrl()}/api/preferences/${encodeURIComponent(token)}`;
  const data = await safeFetchJson<PreferencesPayload>(url);
  // Fall back to a mock so the page is always usable.
  return data ?? mockPreferences(decoded);
}

export async function pausePreferences(token: string, duration: PauseDuration): Promise<void> {
  // TODO(pushcare-server): implement /api/preferences/:token/pause — server
  // verifies JWT, writes `paused_until` on the device row, returns the new
  // pause state.
  const url = `${getApiBaseUrl()}/api/preferences/${encodeURIComponent(token)}/pause`;
  await safeFetchJson(url, {
    method: "POST",
    body: JSON.stringify({ duration }),
  });
  console.log(`[pushcare] pause -> ${duration}`);
}

export async function setCategories(token: string, categories: CategoryKey[]): Promise<void> {
  // TODO(pushcare-server): implement /api/preferences/:token/categories.
  const url = `${getApiBaseUrl()}/api/preferences/${encodeURIComponent(token)}/categories`;
  await safeFetchJson(url, {
    method: "POST",
    body: JSON.stringify({ categories }),
  });
  console.log("[pushcare] categories ->", categories);
}

export async function deleteSubscriber(token: string): Promise<void> {
  // TODO(pushcare-server): implement /api/preferences/:token/delete — server
  // hard-deletes the device row + any per-device events. Idempotent.
  const url = `${getApiBaseUrl()}/api/preferences/${encodeURIComponent(token)}/delete`;
  await safeFetchJson(url, { method: "POST" });
  console.log("[pushcare] delete subscriber");
}

// Helper used by PausedConfirmation to know when notifications resume.
export function pauseUntilFromKey(d: PauseDuration, now = Date.now()): Date | null {
  switch (d) {
    case "1h":
      return new Date(now + 60 * 60 * 1000);
    case "1d":
      return new Date(now + 24 * 60 * 60 * 1000);
    case "1w":
      return new Date(now + 7 * 24 * 60 * 60 * 1000);
    case "forever":
      return null; // displayed as "until you turn them back on"
    default:
      return null;
  }
}
