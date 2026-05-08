import type { StoredUser } from "./store.js";

export type AdminPolicy = {
  enforce: boolean;
  adminApiKey: string;
  providedApiKey: string | null;
  user: StoredUser | null;
};

export function isPrivilegedAdminUser(user: StoredUser | null): boolean {
  if (!user) return false;
  if (!user.email_verified) return false;
  return user.plan === "business" || user.plan === "enterprise";
}

export function hasAdminAccess(policy: AdminPolicy): boolean {
  if (!policy.enforce) return true;
  if (policy.providedApiKey && policy.providedApiKey === policy.adminApiKey) return true;
  return isPrivilegedAdminUser(policy.user);
}

export function isAdminApiRoute(pathname: string): boolean {
  if (!pathname.startsWith("/api/")) return false;
  if (pathname.startsWith("/api/admin/")) return true;
  if (
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/me/") ||
    pathname.startsWith("/api/builder/") ||
    pathname.startsWith("/api/wp/")
  ) {
    return false;
  }
  return (
    pathname.startsWith("/api/apps") ||
    pathname.startsWith("/api/campaigns") ||
    pathname.startsWith("/api/api-keys") ||
    pathname.startsWith("/api/builds") ||
    pathname.startsWith("/api/analytics") ||
    pathname.startsWith("/api/wp-plugins")
  );
}
