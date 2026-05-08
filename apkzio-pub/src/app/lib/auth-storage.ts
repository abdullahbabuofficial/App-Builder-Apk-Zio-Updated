import type { User } from "./api";

const TOKEN_KEY = "apkzio.auth.token";
const USER_KEY = "apkzio.auth.user";

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  const s = safeStorage();
  if (!s) return null;
  try {
    return s.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  const s = safeStorage();
  if (!s) return;
  try {
    s.setItem(TOKEN_KEY, token);
  } catch {
    // ignore quota / privacy mode failures
  }
}

export function getUser(): User | null {
  const s = safeStorage();
  if (!s) return null;
  try {
    const raw = s.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setUser(user: User): void {
  const s = safeStorage();
  if (!s) return;
  try {
    s.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // ignore
  }
}

export function clearAuth(): void {
  const s = safeStorage();
  if (!s) return;
  try {
    s.removeItem(TOKEN_KEY);
    s.removeItem(USER_KEY);
  } catch {
    // ignore
  }
}
