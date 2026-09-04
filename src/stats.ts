// ============================================================
// stats.ts - 统计 Tab 数据聚合
// ============================================================

import { AllHistory, JobRecord } from "./types";
import { parseSalary } from "./salary";

export interface CompanyCount {
  name: string;
  count: number;
}

export interface SalaryBucket {
  /** 区间标签,如 "0-5K"、"5-10K"、"10-15K"、"15-20K"、"20-30K"、"30K+" */
  label: string;
  count: number;
}

export interface ReasonCount {
  /** 大类标签 */
  category: string;
  /** 该类下原始 reason(供 hover 提示) */
  examples: string[];
  count: number;
}

export interface StatsSummary {
  totalRecords: number;
  totalApplied: number;
  totalSkipped: number;
  totalFailed: number;
  dryRunRecords: number;
}

/** 跳过原因归类(把 filters/loop 散落的 reason 字符串归到 7 大类) */
const REASON_CATEGORIES: Array<{ category: string; match: RegExp }> = [
  { category: "关键词", match: /关键词/ },
  { category: "薪资", match: /薪资/ },
  { category: "BOSS 活跃度", match: /活跃|在线/ },
  { category: "已沟通过", match: /沟通|沟通过|friendStatus/ },
  { category: "猎头", match: /猎头/ },
  { category: "数据缺失", match: /缺少|securityId|lid/ },
  { category: "地域", match: /屏蔽地域/ },
];

export function categorizeReason(reason: string): string {
  for (const c of REASON_CATEGORIES) {
    if (c.match.test(reason)) return c.category;
  }
  return "其他";
}

/** 概况 */
export function summarize(records: JobRecord[]): StatsSummary {
  const summary: StatsSummary = {
    totalRecords: records.length,
    totalApplied: 0,
    totalSkipped: 0,
    totalFailed: 0,
    dryRunRecords: 0,
  };
  for (const r of records) {
    if (r.outcome === "applied") summary.totalApplied += 1;
    else if (r.outcome === "skipped") summary.totalSkipped += 1;
    else summary.totalFailed += 1;
    if (r.dryRun) summary.dryRunRecords += 1;
  }
  return summary;
}

/** TOP 20 公司投递数(按 outcome=applied 计数;非 dryRun 优先,但 dryRun 也计入方便预览) */
export function topCompanies(records: JobRecord[], limit = 20): CompanyCount[] {
  const map = new Map<string, number>();
  for (const r of records) {
    if (r.outcome !== "applied") continue;
    const name = (r.brandName || "未知公司").trim();
    if (!name) continue;
    map.set(name, (map.get(name) || 0) + 1);
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** 薪资分布直方图:按区间分桶 */
export function salaryDistribution(records: JobRecord[]): SalaryBucket[] {
  const buckets: SalaryBucket[] = [
    { label: "0-5K", count: 0 },
    { label: "5-10K", count: 0 },
    { label: "10-15K", count: 0 },
    { label: "15-20K", count: 0 },
    { label: "20-30K", count: 0 },
    { label: "30K+", count: 0 },
    { label: "面议/未知", count: 0 },
  ];
  for (const r of records) {
    if (r.outcome !== "applied") continue;
    const range = parseSalary(r.salaryDesc);
    if (!range.known) {
      buckets[buckets.length - 1].count += 1;
      continue;
    }
    // 用 min 落入区间 —— boss 区间普遍虚高,按最低取更接近实际
    const min = range.min;
    if (min < 5) buckets[0].count += 1;
    else if (min < 10) buckets[1].count += 1;
    else if (min < 15) buckets[2].count += 1;
    else if (min < 20) buckets[3].count += 1;
    else if (min < 30) buckets[4].count += 1;
    else buckets[5].count += 1;
  }
  return buckets;
}

/** 跳过原因饼图数据 */
export function skipReasonDistribution(records: JobRecord[]): ReasonCount[] {
  const map = new Map<string, { examples: Set<string>; count: number }>();
  for (const r of records) {
    if (r.outcome !== "skipped" || !r.skipReason) continue;
    const cat = categorizeReason(r.skipReason);
    const entry = map.get(cat) ?? { examples: new Set<string>(), count: 0 };
    entry.count += 1;
    entry.examples.add(r.skipReason);
    map.set(cat, entry);
  }
  return [...map.entries()]
    .map(([category, v]) => ({
      category,
      count: v.count,
      examples: [...v.examples].slice(0, 2),
    }))
    .sort((a, b) => b.count - a.count);
}

/** 综合入口:从 history 一次性算出所有统计(跨天聚合) */
export function computeStats(history: AllHistory): {
  summary: StatsSummary;
  companies: CompanyCount[];
  salaries: SalaryBucket[];
  reasons: ReasonCount[];
} {
  const records: JobRecord[] = [];
  for (const day of history.days) {
    if (Array.isArray(day.records)) {
      for (const r of day.records) records.push(r);
    }
  }
  return {
    summary: summarize(records),
    companies: topCompanies(records, 6),
    salaries: salaryDistribution(records),
    reasons: skipReasonDistribution(records),
  };
}