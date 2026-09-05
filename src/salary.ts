// ============================================================
// salary.ts - 薪资字符串解析 + 区间过滤
// ============================================================

export interface SalaryRange {
  /** 单位:K(千) */
  min: number;
  max: number;
  /** 是否明确包含数字(否则视为"面议",无法过滤) */
  known: boolean;
}

/**
 * 把 BOSS 上的薪资字符串解析为 K 单位的区间。
 *
 * 常见格式:
 *   "10-15K·15薪"      → { min: 10, max: 15, known: true }
 *   "8-13K·13薪"       → { min:  8, max: 13, known: true }
 *   "5-10K"            → { min:  5, max: 10, known: true }
 *   "1-2万"            → { min: 10, max: 20, known: true }
 *   "8千-1.2万"        → { min:  8, max: 12, known: true }
 *   "20K"              → { min: 20, max: 20, known: true }
 *   "100-150元/天"     → { min: 2.2, max: 3.3, known: true }   ← ×22÷1000
 *   "2000-4000元/月"   → { min:  2,  max:  4,  known: true }   ← ÷1000
 *   "2000 每月"        → { min:  2,  max:  2,  known: true }
 *   "面议" / "薪资面议" → { min:  0, max:  0, known: false }
 */
// 日薪/时薪特征:带"元/天"、"/日"、"元/小时"等
const DAILY_RATE = /元?\s*[/每]\s*(天|日)/;
const HOURLY_RATE = /元?\s*[/每]\s*(时|小时)/;
// 月薪(单位 元):"2000-4000元/月"、"2000元每月"、"2000 每月"
const MONTHLY_YUAN_RATE = /(?:元\s*[/每]?\s*月|每月)/;

/** 1 个自然月 = 22 工作日,每天 8 小时 */
const WORK_DAYS_PER_MONTH = 22;
const WORK_HOURS_PER_DAY = 8;

export function parseSalary(text: string | null | undefined): SalaryRange {
  const normalized = String(text ?? "").trim();
  if (!normalized) return { min: 0, max: 0, known: false };
  if (/面议|协商/.test(normalized)) return { min: 0, max: 0, known: false };

  // ── 日薪 / 时薪:按 22 工作日/月、8 小时/天 换算成 K/月
  //    "100-150元/天"   → (100..150) × 22 ÷ 1000  = 2.2K .. 3.3K
  //    "100元/小时"     → 100 × 8 × 22 ÷ 1000    = 17.6K
  //    "150-200元/天"   → 3.3K .. 4.4K            ← 之前被错当成 K/月,导致漏过滤
  //    "N薪" 中的 N 不计入(否则 "100元/天·15薪" 会把 15 当成 0.33K)
  if (DAILY_RATE.test(normalized) || HOURLY_RATE.test(normalized)) {
    const isHourly = HOURLY_RATE.test(normalized);
    const monthlyFactor = isHourly
      ? (WORK_HOURS_PER_DAY * WORK_DAYS_PER_MONTH) / 1000
      : WORK_DAYS_PER_MONTH / 1000;
    const segments: number[] = [];
    const regex = /(\d+(?:\.\d+)?)(?!\s*薪)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(normalized)) !== null) {
      const value = Number(match[1]);
      if (!Number.isFinite(value)) continue;
      segments.push(value * monthlyFactor);
    }
    if (segments.length === 0) return { min: 0, max: 0, known: false };
    if (segments.length === 1) return { min: segments[0], max: segments[0], known: true };
    const min = Math.min(segments[0], segments[1]);
    const max = Math.max(segments[0], segments[1]);
    return { min, max, known: true };
  }

  // ── 元/月(或"X 每月"):有单位的数字按单位(K/千/万),无单位按 元 处理再 ÷1000 转 K
  //    "2000-4000元/月" → [2000, 4000] → ÷1000 → [2, 4]
  //    "5K元/月"        → [5K]           → [5]       (已带单位)
  //    "2000 每月"     → [2000]        → ÷1000 → [2]
  if (MONTHLY_YUAN_RATE.test(normalized)) {
    const segments: number[] = [];
    const regex = /(\d+(?:\.\d+)?)\s*([Kk千万wW])?(?!\s*薪)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(normalized)) !== null) {
      const value = Number(match[1]);
      const unit = match[2];
      if (!Number.isFinite(value)) continue;
      segments.push(unit ? unitToK(unit, value) : value / 1000);
    }
    if (segments.length === 0) return { min: 0, max: 0, known: false };
    if (segments.length === 1) return { min: segments[0], max: segments[0], known: true };
    // 只取前两个数字(后面的如"15薪"中的 15 已被正则排除)
    const min = Math.min(segments[0], segments[1]);
    const max = Math.max(segments[0], segments[1]);
    return { min, max, known: true };
  }

  // ── 月薪模式(K/千/万) —— 启发式:含"万/千"时无单位数字默认同单位
  //    "10-15K·15薪" → [10K, 15K]   ("15薪" 中 15 被正则排除)
  //    "1-2万"       → [1万, 2万]
  //    "8千-1.2万"   → [8千, 1.2万] (混合:各自单位优先)
  //    "20K"         → [20K]
  const globalUnit = pickGlobalUnit(normalized);

  const segments: number[] = [];
  const regex = /(\d+(?:\.\d+)?)\s*([Kk千万wW])?(?!\s*薪)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(normalized)) !== null) {
    const value = Number(match[1]);
    const unit = match[2];
    if (!Number.isFinite(value)) continue;
    const effectiveUnit = unit ?? globalUnit ?? "";
    const k = unitToK(effectiveUnit, value);
    segments.push(k);
  }

  if (segments.length === 0) return { min: 0, max: 0, known: false };
  if (segments.length === 1) return { min: segments[0], max: segments[0], known: true };

  // 只取前两个数字作为 min/max
  const min = Math.min(segments[0], segments[1]);
  const max = Math.max(segments[0], segments[1]);
  return { min, max, known: true };
}

function pickGlobalUnit(text: string): string | null {
  // 若同时出现 万 和 千,视为跨单位区间(不设全局单位,让各自的单位生效)
  const hasWan = /万/.test(text);
  const hasQian = /千/.test(text);
  if (hasWan && !hasQian) return "万";
  if (hasQian && !hasWan) return "千";
  return null;
}

function unitToK(unit: string, value: number): number {
  switch (unit) {
    case "千":
      return value;
    case "万":
    case "w":
    case "W":
      return value * 10;
    case "K":
    case "k":
    default:
      return value;
  }
}

/** 把详情/职位描述里所有可能含薪资的字段合并后解析 */
export function extractSalaryRange(...candidates: unknown[]): SalaryRange {
  for (const c of candidates) {
    const range = parseSalary(typeof c === "string" ? c : "");
    if (range.known) return range;
  }
  return { min: 0, max: 0, known: false };
}

export interface SalaryFilterOptions {
  /** 下限 K,0 = 不限 */
  minK: number;
  /** 上限 K,0 = 不限 */
  maxK: number;
}

export interface SalaryFilterResult {
  ok: boolean;
  reason: string;
}

/**
 * 给定薪资区间和过滤选项,判断是否通过。
 *
 * 策略:把职位的 [min, max] 与用户配置的 [minK, maxK] 求交集。
 *   - 用户只设下限:只要 职位.max >= minK 通过(职位下限再低,上限够高也可能行)
 *   - 用户只设上限:只要 职位.min <= maxK 通过
 *   - 都设:必须重叠
 *   - 面议:任一过滤开启则跳过(无法判断,默认保守)
 */
export function applySalaryFilter(
  range: SalaryRange,
  opts: SalaryFilterOptions,
): SalaryFilterResult {
  const { minK, maxK } = opts;
  if (minK <= 0 && maxK <= 0) return { ok: true, reason: "" };

  if (!range.known) {
    return { ok: false, reason: "薪资为面议,无法判断" };
  }

  if (minK > 0 && range.max < minK) {
    return { ok: false, reason: `薪资上限低于 ${minK}K` };
  }
  if (maxK > 0 && range.min > maxK) {
    return { ok: false, reason: `薪资下限高于 ${maxK}K` };
  }

  return { ok: true, reason: "" };
}
