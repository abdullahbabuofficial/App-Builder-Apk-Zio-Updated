// Unit tests for PushCareStore. The store seeds itself with deterministic
// demo data so we can drive sdkInit, createCampaign, validateServiceKey
// without any persistent backend.

import { describe, it, expect, beforeEach } from "vitest";
import { PushCareStore } from "../store.js";

const DEMO_KEY = "sk_live_demo_pushcare_test";

describe("PushCareStore", () => {
  let store: PushCareStore;

  beforeEach(() => {
    store = new PushCareStore(DEMO_KEY);
  });

  describe("sdkInit", () => {
    it("creates a brand-new device + subscriber on first call", () => {
      const app = store.listApps()[0]!;
      const out = store.sdkInit(
        { android_id: "test-android-1", fcm_token: "tok-test-1", country_code: "US" },
        app.app_key,
      );
      expect(out.is_new_install).toBe(true);
      expect(out.app_id).toBe(app.id);
      expect(out.heartbeat_interval_sec).toBe(45);
      expect(out.device_id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("returns the same device_id and is_new_install=false on repeat calls", () => {
      const app = store.listApps()[0]!;
      const first = store.sdkInit(
        { android_id: "test-android-2", fcm_token: "tok-2", country_code: "BD" },
        app.app_key,
      );
      const second = store.sdkInit(
        { android_id: "test-android-2", fcm_token: "tok-2", country_code: "BD" },
        app.app_key,
      );
      expect(second.is_new_install).toBe(false);
      expect(second.device_id).toBe(first.device_id);
      expect(second.app_id).toBe(first.app_id);
    });

    it("throws invalid_app_key for unknown keys", () => {
      expect(() => store.sdkInit({ android_id: "x" }, "pk_bogus")).toThrowError(/invalid_app_key/);
    });
  });

  describe("createCampaign", () => {
    it("with target_type=all → recipients_count > 0", () => {
      const app = store.listApps()[0]!;
      const camp = store.createCampaign({
        app_id: app.id,
        title: "T",
        body: "B",
        target_type: "all",
      });
      expect(camp.recipients_count).toBeGreaterThan(0);
      expect(camp.status).toBe("sent");
      expect(camp.target_summary).toBe("All subscribers");
    });

    it("schedules into the future when scheduled_at is provided", () => {
      const app = store.listApps()[0]!;
      const future = new Date(Date.now() + 60_000).toISOString();
      const camp = store.createCampaign({
        app_id: app.id,
        title: "T",
        body: "B",
        target_type: "all",
        scheduled_at: future,
      });
      expect(camp.status).toBe("scheduled");
      expect(camp.sent_count).toBe(0);
    });

    it("throws app_not_found for unknown app_id", () => {
      expect(() =>
        store.createCampaign({ app_id: "nope", title: "x", body: "x", target_type: "all" }),
      ).toThrowError(/app_not_found/);
    });
  });

  describe("validateServiceKey", () => {
    it("accepts the seeded demo key", () => {
      expect(store.validateServiceKey(DEMO_KEY)).toBe(true);
    });
    it("rejects unknown keys", () => {
      expect(store.validateServiceKey("sk_live_obviously_wrong")).toBe(false);
    });
  });

  describe("seed data shape", () => {
    it("provides a non-empty list of apps with stable shape", () => {
      const apps = store.listApps();
      expect(apps.length).toBeGreaterThanOrEqual(5);
      for (const a of apps) {
        expect(a.app_key).toMatch(/^pk_[a-f0-9]+$/);
        expect(typeof a.created_at).toBe("string");
      }
    });

    it("registerDevice rotates the subscriber for an existing device", () => {
      const app = store.listApps()[0]!;
      const init = store.sdkInit({ android_id: "rot-1", fcm_token: "old" }, app.app_key);
      const out = store.registerDevice({
        device_id: init.device_id,
        app_key: app.app_key,
        fcm_token: "new-token",
      });
      expect(out.subscriber_id).toMatch(/^[0-9a-f-]{36}$/);
      expect(out.subscriber_id).not.toBe(init.subscriber_id);
    });
  });
});
