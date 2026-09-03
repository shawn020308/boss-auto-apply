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
 *   "面议" / "薪资面议" → { min:  0, max:  0, known: false }
 */
export function parseSalary(text: string | null | undefined): SalaryRange {
  const normalized = String(text ?? "").trim();
  if (!normalized) return { min: 0, max: 0, known: false };
  if (/面议|协商/.test(normalized)) return { min: 0, max: 0, known: false };

  // 提取所有 "数字 [可选单位]" 段;单位支持 K/k/千/万/w/W
  // 例如 "10-15K·15薪" → [10K, 15K]
  //      "1-2万"      → [1万, 2万]   (启发式:含"万"时,无单位数字默认也为万)
  //      "8千-1.2万"  → [8千, 1.2万] (混合:各自的单位优先)
  //      "20K"        → [20K]
  //      "30-50K·15薪" → [30K, 50K]  ("15薪"里的 15 无单位,默认 K,会被截断)
  // 启发式规则:扫描整个字符串,如果出现 万 / 千 这种"区间级单位",则把所有
  // 不带显式单位的数字都按这个单位换算;否则无单位数字按 K 处理。
  const globalUnit = pickGlobalUnit(normalized);

  const segments: number[] = [];
  const regex = /(\d+(?:\.\d+)?)\s*([Kk千万wW])?/g;
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

  // 只取前两个数字作为 min/max,后面的(如"15薪"中的 15)忽略
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
