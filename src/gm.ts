// ============================================================
// gm.ts - 工具函数:存储(全走 localStorage) / Cookie / HTTP 头
// ============================================================

import { APP_ID } from "./types";

const CONFIG_KEY = `${APP_ID}:config`;
const HISTORY_KEY = `${APP_ID}:history`;

/**
 * 内存兜底:localStorage 写入失败(隐私模式、配额满、安全策略)时,
 * 数据先放这里,保证脚本不崩。代价:页面刷新后这部分会丢,会打 warning。
 */
const memoryFallback = new Map<string, string>();

/** 读(localStorage 优先,失败回退到内存 Map) */
export function gmGet<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw != null) return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`[${APP_ID}] localStorage get failed, fallback to memory`, error);
  }
  const mem = memoryFallback.get(key);
  if (mem !== undefined) {
    try {
      return JSON.parse(mem) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

/** 写(localStorage 优先,失败回退到内存 Map) */
export function gmSet<T>(key: string, value: T): void {
  const text = JSON.stringify(value);
  try {
    window.localStorage.setItem(key, text);
    return;
  } catch (error) {
    console.warn(`[${APP_ID}] localStorage set failed, fallback to memory`, error);
    memoryFallback.set(key, text);
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
