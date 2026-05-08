import { describe, expect, it } from "vitest";
import { buildPublicStatusPayload } from "./public-status.js";

describe("buildPublicStatusPayload", () => {
  it("returns a stable public shape without throwing", () => {
    const p = buildPublicStatusPayload();
    expect(p.ok).toBe(true);
    expect(p.service).toBe("apkzio-local-api");
    expect(p.persistence).toBe("memory");
    expect(p.features.webview_zip_pipeline).toBe(true);
    expect(typeof p.features.admin_auth_enforced).toBe("boolean");
    expect(typeof p.features.firebase_admin).toBe("boolean");
    expect(typeof p.features.email_via_resend).toBe("boolean");
    expect(typeof p.features.apk_gradle_pipeline).toBe("boolean");
    expect(
      p.features.apk_pipeline_hint === null || typeof p.features.apk_pipeline_hint === "string",
    ).toBe(true);
    expect(typeof p.features.apk_gradle_task).toBe("string");
    expect(typeof p.features.apk_gradle_timeout_ms).toBe("number");
    expect(typeof p.features.apk_max_concurrent_gradle).toBe("number");
  });
});
