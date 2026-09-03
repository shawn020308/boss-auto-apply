// ============================================================
// history.ts - 当天投递历史(去重 + 计数)
// ============================================================

import { DayHistory } from "./types";
import { gmGet, gmSet, getHistoryKey } from "./gm";

export function getToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function loadHistory(): DayHistory {
  const today = getToday();
  const stored = gmGet<DayHistory | null>(getHistoryKey(), null);
  if (!stored || stored.date !== today) {
    return { date: today, dailyCount: 0, appliedKeys: [] };
  }
  if (!Array.isArray(stored.appliedKeys)) stored.appliedKeys = [];
  if (!Number.isFinite(Number(stored.dailyCount))) {
    stored.dailyCount = stored.appliedKeys.length;
  }
  return stored;
}

export function saveHistory(history: DayHistory): void {
  gmSet(getHistoryKey(), history);
}

export function recordAppliedKey(key: string): void {
  const history = loadHistory();
  if (!history.appliedKeys.includes(key)) history.appliedKeys.push(key);
  history.dailyCount = Math.max(
    Number(history.dailyCount) || 0,
    history.appliedKeys.length,
  );
  saveHistory(history);
}

export function hasAppliedToday(key: string): boolean {
  const history = loadHistory();
  return history.appliedKeys.includes(key);
}
