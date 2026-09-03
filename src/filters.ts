// ============================================================
// filters.ts - 过滤规则组合
// ============================================================

import { FilterConfig, Job, JobDetail } from "./types";
import { hasAppliedToday } from "./history";
import { parseActiveDays } from "./job";
import { normalizeText, splitKeywords, textHasAny, textHasInclude } from "./dom";
import { applySalaryFilter, extractSalaryRange } from "./salary";

export interface FilterOutcome {
  ok: boolean;
  reason: string;
}

/** 过滤顺序敏感:越靠前越便宜(无须详情接口) */
export function applyFilters(
  job: Job,
  detail: JobDetail | null,
  config: FilterConfig,
): FilterOutcome {
  if (!canApplyFieldsReady(job)) {
    return { ok: false, reason: "缺少 securityId / encryptJobId / lid,无法调用投递接口" };
  }

  if (job.contact) return { ok: false, reason: "已经沟通过" };

  if (config.skipAppliedHistory && hasAppliedToday(makeHistoryKey(job))) {
    return { ok: false, reason: "今日历史中已投递" };
  }

  // 地域黑名单(纯列表数据,无须详情接口;子串匹配 cityName;高薪可豁免)
  const blockList = splitKeywords(config.blockCityKeywords);
  if (blockList.length && job.cityName) {
    const cityLower = normalizeText(job.cityName).toLowerCase();
    if (blockList.some((kw) => cityLower.includes(kw))) {
      const exemptMinK = config.cityExemptMinSalaryK || 0;
      if (exemptMinK > 0) {
        const range = extractSalaryRange(detail?.salaryDesc, job.salaryDesc);
        if (!range.known) {
          return { ok: false, reason: `屏蔽地域命中:${job.cityName}(薪资未知,无法豁免)` };
        }
        if (range.min < exemptMinK) {
          return { ok: false, reason: `屏蔽地域命中:${job.cityName}(薪资下限 ${range.min}K 未达豁免 ${exemptMinK}K)` };
        }
        // 高薪豁免通过,不屏蔽
      } else {
        return { ok: false, reason: `屏蔽地域命中:${job.cityName}` };
      }
    }
  }

  if (
    config.skipHeadhunter &&
    (job.goldHunter === 1 || job.goldHunter === "1" || /猎头/.test(job.rawText))
  ) {
    return { ok: false, reason: "过滤猎头" };
  }

  if (config.onlyOnlineBoss) {
    const canConfirmOnline = job.bossOnline === true || /在线/.test(job.rawText);
    if (!canConfirmOnline) return { ok: false, reason: "无法确认 BOSS 在线" };
  }

  // 详情过滤(需要 fetch detail 接口)
  if (detail) {
    if (detail.friendStatus === 1 || detail.friendStatus === "1") {
      return { ok: false, reason: "详情接口显示已沟通" };
    }

    if (config.activeWithinDays > 0 && detail.activeTimeDesc) {
      const activeDays = parseActiveDays(detail.activeTimeDesc);
      if (Number.isFinite(activeDays) && activeDays > config.activeWithinDays) {
        return { ok: false, reason: "boss活跃度未达标,已过滤" };
      }
    }

    // 薪资过滤(优先用详情里的,否则回落到列表 salaryDesc)
    const salaryRange = extractSalaryRange(detail.salaryDesc, job.salaryDesc);
    const salaryResult = applySalaryFilter(salaryRange, {
      minK: config.salaryMinK,
      maxK: config.salaryMaxK,
    });
    if (!salaryResult.ok) return salaryResult;
  } else if (
    config.activeWithinDays > 0 ||
    config.salaryMinK > 0 ||
    config.salaryMaxK > 0
  ) {
    // 详情未拉到但需要活跃度/薪资过滤:仍尝试用列表 salaryDesc 过滤薪资
    if (config.salaryMinK > 0 || config.salaryMaxK > 0) {
      const range = extractSalaryRange(job.salaryDesc);
      const r = applySalaryFilter(range, {
        minK: config.salaryMinK,
        maxK: config.salaryMaxK,
      });
      if (!r.ok) return r;
    }
  }

  // 关键词过滤(用职位 + 详情拼接的全文)
  const includeDesc = splitKeywords(config.includeDescriptionKeywords);
  const excludeDesc = splitKeywords(config.excludeDescriptionKeywords);
  if (includeDesc.length || excludeDesc.length) {
    const text = fuzzyText(job, detail);
    if (!textHasInclude(text, includeDesc)) {
      return { ok: false, reason: "岗位详情不包含指定关键词" };
    }
    if (excludeDesc.length && textHasAny(text, excludeDesc)) {
      return { ok: false, reason: "岗位详情命中排除关键词" };
    }
  }

  return { ok: true, reason: "" };
}

export function canApplyFieldsReady(job: Job): boolean {
  return Boolean(job?.securityId && job?.encryptJobId && job?.lid);
}

function makeHistoryKey(job: Job): string {
  return [job.securityId, job.encryptJobId, job.lid, job.jobName, job.brandName]
    .map((item) => normalizeText(item))
    .join("|");
}

function fuzzyText(job: Job, detail: JobDetail | null): string {
  return [
    job.jobName,
    job.brandName,
    job.salaryDesc,
    job.cityName,
    job.areaDistrict,
    job.businessDistrict,
    job.brandScaleName,
    job.brandIndustry,
    Array.isArray(job.jobLabels) ? job.jobLabels.join(" ") : job.jobLabels,
    Array.isArray(job.skills) ? job.skills.join(" ") : job.skills,
    detail?.postDescription,
    detail?.address,
    detail?.activeTimeDesc,
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(" ");
}
