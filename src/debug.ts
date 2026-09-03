// ============================================================
// debug.ts - 日志/通知
// ============================================================

import { APP_ID, LogEntry } from "./types";
import type { AppState } from "./types";

export type LogLevel = LogEntry["level"];

export function createLogSink(
  state: AppState,
  render: () => void,
): (level: LogLevel, message: string, data?: unknown) => void {
  return function log(level: LogLevel, message: string, data?: unknown): void {
    if (level === "debug" && !state.debug) return;
    const entry: LogEntry = {
      time: new Date().toLocaleTimeString(),
      level,
      message,
      data,
    };
    state.logs.unshift(entry);
    if (state.logs.length > 120) state.logs.length = 120;

    const prefix = `[${APP_ID}] ${message}`;
    if (level === "error") console.error(prefix, data ?? "");
    else if (level === "warn") console.warn(prefix, data ?? "");
    else if (level === "debug") console.debug(prefix, data ?? "");
    else console.log(prefix, data ?? "");

    render();
  };
}

export function notify(title: string, text: string): void {
  try {
    if (typeof GM_notification === "function") {
      GM_notification({ title, text, timeout: 3500 });
    }
  } catch (error) {
    console.warn(`[${APP_ID}] notification failed`, error);
  }
}
