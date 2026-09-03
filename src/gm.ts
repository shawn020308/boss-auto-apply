// ============================================================
// gm.ts - Tampermonkey 存储封装
// ============================================================

import { APP_ID } from "./types";

const CONFIG_KEY = `${APP_ID}:config`;
const HISTORY_KEY = `${APP_ID}:history`;

export function gmGet<T>(key: string, fallback: T): T {
  try {
    if (typeof GM_getValue === "function") {
      const raw = GM_getValue(key, "");
      if (raw === "" || raw == null) return fallback;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    }
  } catch (error) {
    console.warn(`[${APP_ID}] GM_getValue failed`, error);
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function gmSet<T>(key: string, value: T): void {
  try {
    if (typeof GM_setValue === "function") {
      GM_setValue(key, JSON.stringify(value));
      return;
    }
  } catch (error) {
    console.warn(`[${APP_ID}] GM_setValue failed`, error);
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`[${APP_ID}] localStorage set failed`, error);
  }
}

export function getCookie(name: string): string {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${escapedName}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : "";
}

export function getConfigKey(): string {
  return CONFIG_KEY;
}

export function getHistoryKey(): string {
  return HISTORY_KEY;
}

export function buildBossHeaders(): Record<string, string> {
  const token = getCookie("bst");
  const headers: Record<string, string> = {
    Accept: "application/json, text/plain, */*",
    "X-Requested-With": "XMLHttpRequest",
  };
  if (token) headers.Zp_token = token;
  return headers;
}
