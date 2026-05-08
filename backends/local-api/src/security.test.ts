import { describe, expect, it } from "vitest";
import { hasAdminAccess, isAdminApiRoute, isPrivilegedAdminUser } from "./security.js";
import type { StoredUser } from "./store.js";

function mkUser(partial: Partial<StoredUser>): StoredUser {
  return {
    id: "u1",
    email: "owner@example.com",
    full_name: "Owner",
    plan: "business",
    email_verified: true,
    created_at: new Date().toISOString(),
    password_hash: "h",
    password_salt: "s",
    ...partial,
  };
}

describe("admin access policy", () => {
  it("allows bypass when enforcement is disabled", () => {
    expect(
      hasAdminAccess({
        enforce: false,
        adminApiKey: "k1",
        providedApiKey: null,
        user: null,
      }),
    ).toBe(true);
  });

  it("allows valid admin key when enforcement is enabled", () => {
    expect(
      hasAdminAccess({
        enforce: true,
        adminApiKey: "k1",
        providedApiKey: "k1",
        user: null,
      }),
    ).toBe(true);
  });

  it("requires verified business or enterprise user when no key provided", () => {
    expect(isPrivilegedAdminUser(mkUser({ plan: "business", email_verified: true }))).toBe(true);
    expect(isPrivilegedAdminUser(mkUser({ plan: "enterprise", email_verified: true }))).toBe(true);
    expect(isPrivilegedAdminUser(mkUser({ plan: "starter", email_verified: true }))).toBe(false);
    expect(isPrivilegedAdminUser(mkUser({ plan: "business", email_verified: false }))).toBe(false);
  });
});

describe("admin route selector", () => {
  it("marks admin management routes as protected", () => {
    expect(isAdminApiRoute("/api/apps")).toBe(true);
    expect(isAdminApiRoute("/api/admin/clients")).toBe(true);
    expect(isAdminApiRoute("/api/campaigns/123")).toBe(true);
    expect(isAdminApiRoute("/api/api-keys")).toBe(true);
    expect(isAdminApiRoute("/api/builds")).toBe(true);
    expect(isAdminApiRoute("/api/analytics/overview")).toBe(true);
  });

  it("keeps auth and customer routes unprotected by admin key", () => {
    expect(isAdminApiRoute("/api/auth/login")).toBe(false);
    expect(isAdminApiRoute("/api/auth/google")).toBe(false);
    expect(isAdminApiRoute("/api/me/cart")).toBe(false);
    expect(isAdminApiRoute("/api/builder/builds")).toBe(false);
  });
});
