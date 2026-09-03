// ============================================================
// config.ts - 配置管理:加载、规范化、保存
// ============================================================

import { DEFAULT_CONFIG, FilterConfig } from "./types";
import { gmGet, gmSet, getConfigKey } from "./gm";

/**
 * 规范化配置:
 * - 补齐缺失字段(用 DEFAULT_CONFIG 兜底)
 * - 修正类型(Number / Boolean)
 * - 对安全关键参数加上下限钳制,避免面板输入导致脚本卡死
 */
export function normalizeConfig(input: Partial<FilterConfig> | null | undefined): FilterConfig {
  const merged: FilterConfig = { ...DEFAULT_CONFIG, ...(input || {}) };

  // 数值字段兜底 + 上下限钳制
  merged.maxApplyCount = clampInt(merged.maxApplyCount, 1, 99999, DEFAULT_CONFIG.maxApplyCount);
  merged.dailyLimit = clampInt(merged.dailyLimit, 1, 99999, DEFAULT_CONFIG.dailyLimit);
  merged.delayMinSec = clampNumber(merged.delayMinSec, 0.5, 120, DEFAULT_CONFIG.delayMinSec);
  merged.delayMaxSec = clampNumber(merged.delayMaxSec, 0.5, 300, DEFAULT_CONFIG.delayMaxSec);
  merged.pageDelaySec = clampNumber(merged.pageDelaySec, 0.5, 60, DEFAULT_CONFIG.pageDelaySec);
  merged.longPauseChance = clampNumber(merged.longPauseChance, 0, 1, DEFAULT_CONFIG.longPauseChance);
  merged.longPauseMinSec = clampNumber(merged.longPauseMinSec, 1, 600, DEFAULT_CONFIG.longPauseMinSec);
  merged.longPauseMaxSec = clampNumber(merged.longPauseMaxSec, 1, 900, DEFAULT_CONFIG.longPauseMaxSec);
  merged.activeWithinDays = clampInt(merged.activeWithinDays, 0, 365, DEFAULT_CONFIG.activeWithinDays);
  merged.salaryMinK = clampInt(merged.salaryMinK, 0, 999, DEFAULT_CONFIG.salaryMinK);
  merged.salaryMaxK = clampInt(merged.salaryMaxK, 0, 999, DEFAULT_CONFIG.salaryMaxK);
  merged.fontScale = clampNumber(merged.fontScale, 0.7, 1.5, DEFAULT_CONFIG.fontScale);
  merged.dryRun = typeof merged.dryRun === "boolean" ? merged.dryRun : DEFAULT_CONFIG.dryRun;

  // delayMaxSec 不能小于 delayMinSec
  if (merged.delayMaxSec < merged.delayMinSec) {
    merged.delayMaxSec = merged.delayMinSec;
  }
  if (merged.longPauseMaxSec < merged.longPauseMinSec) {
    merged.longPauseMaxSec = merged.longPauseMinSec;
  }
  // 薪资区间无效时互换
  if (merged.salaryMaxK > 0 && merged.salaryMinK > merged.salaryMaxK) {
    [merged.salaryMinK, merged.salaryMaxK] = [merged.salaryMaxK, merged.salaryMinK];
  }

  // 字符串字段兜底
  merged.includeDescriptionKeywords = String(merged.includeDescriptionKeywords || "");
  merged.excludeDescriptionKeywords = String(merged.excludeDescriptionKeywords || "");

  return merged;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return clamp(Math.round(n), min, max);
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return clamp(n, min, max);
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function loadConfig(): FilterConfig {
  const stored = gmGet<Partial<FilterConfig>>(getConfigKey(), {});
  return normalizeConfig(stored);
}

export function saveConfig(next: FilterConfig): FilterConfig {
  const normalized = normalizeConfig(next);
  gmSet(getConfigKey(), normalized);
  return normalized;
}
