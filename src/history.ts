// ============================================================
// history.ts - 投递历史(按天分桶,跨天保留,本地存储)
//
// 设计要点:
// 1. 跨天不清零 —— 每天一个 bucket,统计聚合所有天
// 2. 不丢数据 —— records 无上限,不再 splice
// 3. dailyLimit / appliedKeys 仍然只看当天 bucket(行为不变)
// 4. 老结构({date,...} 单层)自动迁移为 days:[<原数据>],用户已有数据保留
// 5. 存储走 localStorage(见 gm.ts)
// ============================================================

import { AllHistory, DayHistory, JobRecord } from "./types";
import { gmGet, gmSet, getHistoryKey } from "./gm";

const STORAGE_VERSION = 2;

function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function emptyDay(date: string): DayHistory {
  return { date, dailyCount: 0, appliedKeys: [], records: [] };
}

function isDayHistory(value: unknown): value is DayHistory {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as DayHistory).date === "string"
  );
}

function coerceDay(value: unknown): DayHistory {
  if (!isDayHistory(value)) return emptyDay("");
  const d = value as DayHistory;
  return {
    date: d.date,
    dailyCount: Number.isFinite(Number(d.dailyCount)) ? Number(d.dailyCount) : 0,
    appliedKeys: Array.isArray(d.appliedKeys)
      ? d.appliedKeys.filter((k): k is string => typeof k === "string")
      : [],
    records: Array.isArray(d.records) ? d.records : [],
  };
}

/**
 * 把磁盘上的数据规整成 AllHistory。
 * - 新结构{version:2, days:[...]}:走清理路径
 * - 老结构{date, dailyCount, appliedKeys, records}:包成 days:[<原>]
 * - 损坏 / 空:返回空 AllHistory
 */
function normalize(stored: unknown): AllHistory {
  if (stored && typeof stored === "object" && Array.isArray((stored as AllHistory).days)) {
    const days = (stored as AllHistory).days
      .map(coerceDay)
      .filter((d) => d.date);
    return { version: STORAGE_VERSION, days };
  }
  if (isDayHistory(stored)) {
    return { version: STORAGE_VERSION, days: [coerceDay(stored)] };
  }
  return { version: STORAGE_VERSION, days: [] };
}

export function loadAllHistory(): AllHistory {
  return normalize(gmGet<unknown>(getHistoryKey(), null));
}

function saveAllHistory(all: AllHistory): void {
  gmSet(getHistoryKey(), all);
}

function findToday(all: AllHistory): DayHistory | undefined {
  const date = today();
  return all.days.find((d) => d.date === date);
}

/** 当天的 bucket(没有就返回一个空对象,不写盘) —— 用于 dailyLimit / appliedKeys 判定 */
export function loadHistory(): DayHistory {
  const all = loadAllHistory();
  return findToday(all) ?? emptyDay(today());
}

/** 写一条记录(append 到当天 bucket,无上限)。applied + 非 dryRun 同步维护 dailyCount/appliedKeys */
export function recordOutcome(record: JobRecord): void {
  const all = loadAllHistory();
  let bucket = findToday(all);
  if (!bucket) {
    bucket = emptyDay(today());
    all.days.push(bucket);
  }
  bucket.records.push(record);
  if (record.outcome === "applied" && !record.dryRun) {
    if (!bucket.appliedKeys.includes(record.key)) {
      bucket.appliedKeys.push(record.key);
    }
    bucket.dailyCount = Math.max(
      Number(bucket.dailyCount) || 0,
      bucket.appliedKeys.length,
    );
  }
  saveAllHistory(all);
}

export function hasAppliedToday(key: string): boolean {
  const bucket = findToday(loadAllHistory());
  return Boolean(bucket && bucket.appliedKeys.includes(key));
}

/**
 * 清除所有天的 records(不动 appliedKeys/dailyCount —— 否则脚本会重新投递已投过的职位)。
 * 调用方还需要自己重置内存计数(state.scanned/matched/...)以同步显示。
 */
export function clearStatsRecords(): void {
  const all = loadAllHistory();
  for (const d of all.days) d.records = [];
  saveAllHistory(all);
}
