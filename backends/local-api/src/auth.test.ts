import { describe, expect, it } from "vitest";
import { hashPassword, signToken, verifyPassword, verifyToken } from "./auth.js";

describe("auth primitives", () => {
  it("hashes and verifies a password", () => {
    const { hash, salt } = hashPassword("StrongPass#123");
    expect(hash).toBeTruthy();
    expect(salt).toBeTruthy();
    expect(verifyPassword("StrongPass#123", hash, salt)).toBe(true);
    expect(verifyPassword("WrongPass#123", hash, salt)).toBe(false);
  });

  it("signs and verifies token claims", () => {
    const token = signToken("user-1", 300);
    const claims = verifyToken(token);
    expect(claims).not.toBeNull();
    expect(claims?.user_id).toBe("user-1");
    expect((claims?.exp ?? 0) > (claims?.iat ?? 0)).toBe(true);
  });
});
