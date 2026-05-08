/**
 * Integration tests for Admin Clients CRM API endpoints
 */

import { describe, it, expect } from 'vitest';
import type { AdminClientSummary } from "./store.js";

// Test configuration
const API_URL = process.env.TEST_API_URL || "http://localhost:8787";
const ADMIN_API_KEY = process.env.APKZIO_ADMIN_API_KEY || "sk_live_demo_apkzio_local";

// Helper to make API requests
async function apiRequest(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-apkzio-admin-key": ADMIN_API_KEY,
    ...((options.headers as Record<string, string>) || {}),
  };

  return fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });
}

describe("Admin Clients CRM API", () => {
  let testClientId: string;

  it("should list admin clients", async () => {
    const res = await apiRequest("/api/admin/clients");
    expect(res.status).toBe(200);
    const data = await res.json() as { ok: boolean; total: number; clients: AdminClientSummary[] };
    expect(data.ok).toBe(true);
    expect(typeof data.total).toBe("number");
    expect(Array.isArray(data.clients)).toBe(true);
  });

  it("should create a new admin client", async () => {
    const res = await apiRequest("/api/admin/clients", {
      method: "POST",
      body: JSON.stringify({
        email: `test-${Date.now()}@example.com`,
        full_name: "Test User",
        plan: "pro",
        phone: "+1234567890",
        location: "New York",
      }),
    });
    expect(res.status).toBe(201);
    const data = await res.json() as { ok: boolean; client: AdminClientSummary };
    expect(data.ok).toBe(true);
    expect(data.client.email).toContain("test-");
    expect(data.client.full_name).toBe("Test User");
    expect(data.client.plan).toBe("pro");
    testClientId = data.client.id;
  });

  it("should get client detail", async () => {
    if (!testClientId) throw new Error("No test client created");
    
    const res = await apiRequest(`/api/admin/clients/${testClientId}`);
    expect(res.status).toBe(200);
    const data = await res.json() as { ok: boolean; client: unknown };
    expect(data.ok).toBe(true);
    expect(data.client).toHaveProperty("summary");
    expect(data.client).toHaveProperty("profile");
    expect(data.client).toHaveProperty("apps");
  });

  it("should update an admin client", async () => {
    if (!testClientId) throw new Error("No test client created");

    const res = await apiRequest(`/api/admin/clients/${testClientId}`, {
      method: "PATCH",
      body: JSON.stringify({
        full_name: "Updated Test User",
        plan: "business",
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { ok: boolean; client: AdminClientSummary };
    expect(data.ok).toBe(true);
    expect(data.client.full_name).toBe("Updated Test User");
    expect(data.client.plan).toBe("business");
  });

  it("should impersonate an admin client", async () => {
    if (!testClientId) throw new Error("No test client created");

    const res = await apiRequest(`/api/admin/clients/${testClientId}/impersonate`, {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { ok: boolean; token: string; user: { id: string } };
    expect(data.ok).toBe(true);
    expect(typeof data.token).toBe("string");
    expect(data.user.id).toBe(testClientId);
  });

  it("should delete an admin client", async () => {
    if (!testClientId) throw new Error("No test client created");

    const res = await apiRequest(`/api/admin/clients/${testClientId}`, {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    const data = await res.json() as { ok: boolean };
    expect(data.ok).toBe(true);

    // Verify deletion
    const getRes = await apiRequest(`/api/admin/clients/${testClientId}`);
    expect(getRes.status).toBe(404);
  });

  it("should filter clients by plan", async () => {
    const res = await apiRequest("/api/admin/clients?plan=pro&limit=10");
    expect(res.status).toBe(200);
    const data = await res.json() as { ok: boolean; clients: AdminClientSummary[] };
    expect(data.ok).toBe(true);
    for (const client of data.clients) {
      expect(client.plan).toBe("pro");
    }
  });

  it("should filter clients by status", async () => {
    const res = await apiRequest("/api/admin/clients?status=active&limit=10");
    expect(res.status).toBe(200);
    const data = await res.json() as { ok: boolean; clients: AdminClientSummary[] };
    expect(data.ok).toBe(true);
    for (const client of data.clients) {
      expect(client.account_status).toBe("active");
    }
  });

  it("should search clients by email", async () => {
    const res = await apiRequest("/api/admin/clients?q=example.com&limit=10");
    expect(res.status).toBe(200);
    const data = await res.json() as { ok: boolean; clients: AdminClientSummary[] };
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.clients)).toBe(true);
  });

  it("should reject client creation with invalid email", async () => {
    const res = await apiRequest("/api/admin/clients", {
      method: "POST",
      body: JSON.stringify({
        email: "invalid-email",
        full_name: "Test User",
      }),
    });
    expect(res.status).toBe(400);
    const data = await res.json() as { ok: boolean; error: { code: string } };
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe("invalid_email");
  });

  it("should reject client creation with duplicate email", async () => {
    const email = `duplicate-${Date.now()}@example.com`;
    
    // Create first client
    const res1 = await apiRequest("/api/admin/clients", {
      method: "POST",
      body: JSON.stringify({
        email,
        full_name: "Test User 1",
      }),
    });
    expect(res1.status).toBe(201);

    // Try to create duplicate
    const res2 = await apiRequest("/api/admin/clients", {
      method: "POST",
      body: JSON.stringify({
        email,
        full_name: "Test User 2",
      }),
    });
    expect(res2.status).toBe(409);
    const data = await res2.json() as { ok: boolean; error: { code: string } };
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe("conflict");
  });
});
