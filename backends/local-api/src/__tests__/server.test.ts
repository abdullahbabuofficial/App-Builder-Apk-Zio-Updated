// Integration tests using supertest against the exported Express app.
// Hits actual endpoints that the local-api defines (no auth/billing
// surfaces — those live in the production Edge functions).

import { describe, it, expect } from "vitest";
import request from "supertest";
import { app, store } from "../server.js";

describe("local-api HTTP surface", () => {
  it("GET /health returns ok", async () => {
    const r = await request(app).get("/health");
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, service: "pushcare-local-api" });
  });

  it("GET /api/apps returns the seeded list", async () => {
    const r = await request(app).get("/api/apps");
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(Array.isArray(r.body.apps)).toBe(true);
    expect(r.body.apps.length).toBeGreaterThan(0);
  });

  it("GET /api/apps/:id 404s for a missing app", async () => {
    const r = await request(app).get("/api/apps/no-such-app");
    expect(r.status).toBe(404);
    expect(r.body.error.code).toBe("not_found");
  });

  it("GET /api/campaigns returns an array", async () => {
    const r = await request(app).get("/api/campaigns");
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.campaigns)).toBe(true);
  });

  it("POST /api/campaigns creates a campaign for an existing app", async () => {
    const app1 = store.listApps()[0]!;
    const r = await request(app).post("/api/campaigns").send({
      app_id: app1.id,
      title: "From test",
      body: "Hi",
      target_type: "all",
    });
    expect(r.status).toBe(200);
    expect(r.body.campaign.recipients_count).toBeGreaterThan(0);
  });

  it("POST /sdk/init with a valid app_key initializes a device", async () => {
    const app1 = store.listApps()[0]!;
    const r = await request(app)
      .post("/sdk/init")
      .set("X-PC-App-Key", app1.app_key)
      .send({ android_id: "supertest-1", fcm_token: "tok-1", country_code: "US" });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
    expect(r.body.app_id).toBe(app1.id);
    expect(typeof r.body.is_new_install).toBe("boolean");
  });

  it("POST /sdk/init with bad key returns 401", async () => {
    const r = await request(app)
      .post("/sdk/init")
      .set("X-PC-App-Key", "pk_garbage")
      .send({ android_id: "x" });
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe("invalid_app_key");
  });

  it("POST /push/send rejects requests without bearer token", async () => {
    const r = await request(app).post("/push/send").send({});
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe("missing_api_key");
  });

  it("POST /push/send accepts the demo service key and queues a campaign", async () => {
    const app1 = store.listApps()[0]!;
    const r = await request(app)
      .post("/push/send")
      .set("Authorization", "Bearer sk_live_demo_pushcare_local")
      .send({ app_id: app1.id, title: "T", body: "B", target: { type: "all" } });
    expect(r.status).toBe(202);
    expect(r.body.notification_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(r.body.status).toBe("queued");
  });
});
