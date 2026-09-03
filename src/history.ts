// ============================================================
// history.ts - 当天投递历史(去重 + 计数 + 统计记录)
// ============================================================

import { DayHistory, JobRecord } from "./types";
import { gmGet, gmSet, getHistoryKey } from "./gm";

/** 每天最多保留的记录数,超过则丢弃最早的 */
const MAX_RECORDS_PER_DAY = 500;

export function getToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeHistory(stored: Partial<DayHistory> | null): DayHistory {
  const today = getToday();
  if (!stored || stored.date !== today) {
    return { date: today, dailyCount: 0, appliedKeys: [], records: [] };
  }
  if (!Array.isArray(stored.appliedKeys)) stored.appliedKeys = [];
  if (!Array.isArray(stored.records)) stored.records = [];
  if (!Number.isFinite(Number(stored.dailyCount))) {
    stored.dailyCount = stored.appliedKeys.length;
  }
  return stored as DayHistory;
}

export function loadHistory(): DayHistory {
  return normalizeHistory(gmGet<DayHistory | null>(getHistoryKey(), null));
}

export function saveHistory(history: DayHistory): void {
  gmSet(getHistoryKey(), history);
}

/** 写入一条记录;applied + 非 dryRun 时自动维护 dailyCount/appliedKeys */
export function recordOutcome(record: JobRecord): void {
  const history = loadHistory();
  history.records.push(record);
  // 超出上限保留最新
  if (history.records.length > MAX_RECORDS_PER_DAY) {
    history.records.splice(0, history.records.length - MAX_RECORDS_PER_DAY);
  }
  if (record.outcome === "applied" && !record.dryRun) {
    if (!history.appliedKeys.includes(record.key)) history.appliedKeys.push(record.key);
    history.dailyCount = Math.max(
      Number(history.dailyCount) || 0,
      history.appliedKeys.length,
    );
  }
  saveHistory(history);
}

/** 仅记录应用成功(供兼容,行为已转移到 recordOutcome) */
export function recordAppliedKey(key: string): void {
  const history = loadHistory();
  if (!history.appliedKeys.includes(key)) history.appliedKeys.push(key);
  history.dailyCount = Math.max(
    Number(history.dailyCount) || 0,
    history.appliedKeys.length,
  );
  saveHistory(history);
}

/**
 * 清除统计记录(只清 records,不动 appliedKeys/dailyCount —— 否则脚本会重新投递已投过的职位)。
 * 调用方还需要自己重置内存计数(state.scanned/matched/...)以同步显示。
 */
export function clearStatsRecords(): void {
  const history = loadHistory();
  history.records = [];
  saveHistory(history);
}

export function hasAppliedToday(key: string): boolean {
  const history = loadHistory();
  return history.appliedKeys.includes(key);
}