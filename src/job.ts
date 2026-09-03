// ============================================================
// job.ts - 从 DOM/Vue 实例构建职位对象 + 活跃度/唯一键工具
// ============================================================

import { Job } from "./types";
import {
  getDeepValue,
  normalizeText,
  pickBoolean,
  pickDomText,
  pickFirstString,
  pickJobData,
} from "./dom";

export function buildJob(card: HTMLElement, index: number): Job | null {
  const raw = pickJobData(card) || {};
  const text = normalizeText(card.innerText || card.textContent || "");
  const jobName =
    pickFirstString(raw, ["jobName", "jobTitle", "title", "positionName"]) ||
    pickDomText(card, [".job-name", ".job-title", ".job-card-left .job-name"]);
  const brandName =
    pickFirstString(raw, [
      "brandName",
      "companyName",
      "brandFullName",
      "companyFullName",
    ]) ||
    pickDomText(card, [".company-name", ".company-text .name", ".company-info .name"]);
  const salaryDesc =
    pickFirstString(raw, ["salaryDesc", "salary", "salaryName"]) ||
    pickDomText(card, [".salary", ".job-salary", ".salary-desc"]);

  const job: Job = {
    index,
    card,
    raw,
    rawText: text,
    securityId: pickFirstString(raw, ["securityId", "securityID"]),
    encryptJobId: pickFirstString(raw, ["encryptJobId", "jobId", "encryptJobID"]),
    lid: pickFirstString(raw, ["lid", "listId"]),
    encryptBossId: pickFirstString(raw, ["encryptBossId", "bossId", "encryptBossID"]),
    jobName,
    brandName,
    salaryDesc,
    cityName: pickFirstString(raw, ["cityName", "city"]),
    areaDistrict: pickFirstString(raw, ["areaDistrict", "districtName", "area"]),
    businessDistrict: pickFirstString(raw, ["businessDistrict", "businessArea"]),
    brandScaleName: pickFirstString(raw, [
      "brandScaleName",
      "companyScaleName",
      "scaleName",
    ]),
    brandIndustry: pickFirstString(raw, ["brandIndustry", "industryName"]),
    jobLabels: (Array.isArray(raw.jobLabels)
      ? raw.jobLabels
      : Array.isArray(raw.labels)
      ? raw.labels
      : Array.isArray(raw.skills)
      ? raw.skills
      : []) as string[],
    skills: (Array.isArray(raw.skills) ? raw.skills : []) as string[],
    contact: Boolean(
      getDeepValue(raw, "contact") ||
        getDeepValue(raw, "friendStatus") === 1 ||
        getDeepValue(raw, "friendStatus") === "1" ||
        /已沟通|继续沟通/.test(text),
    ),
    bossOnline: pickBoolean(raw, ["bossOnline", "online", "isOnline"]),
    goldHunter: getDeepValue(raw, "goldHunter"),
  };

  if (!job.jobName && !job.brandName && !job.securityId) return null;
  return job;
}

export function getJobUniqueKey(job: Pick<Job, "securityId" | "encryptJobId" | "lid" | "jobName" | "brandName">): string {
  return [job.securityId, job.encryptJobId, job.lid, job.jobName, job.brandName]
    .map((item) => normalizeText(item))
    .join("|");
}

export function formatJob(job: Pick<Job, "jobName" | "brandName" | "salaryDesc">): string {
  const title = normalizeText(job?.jobName) || "未知职位";
  const company = normalizeText(job?.brandName) || "未知公司";
  const salary = normalizeText(job?.salaryDesc);
  return `${title} - ${company}${salary ? ` - ${salary}` : ""}`;
}

/** 把 BOSS 活跃描述解析成"距今天数";无法解析时返回 Infinity */
export function parseActiveDays(value: unknown): number {
  const text = String(value ?? "");
  if (!text || /刚刚|今日|今天|当前|在线|分钟|小时/.test(text)) return 0;

  let match = text.match(/(\d+)\s*日/);
  if (match) return Number(match[1]);

  match = text.match(/(\d+)\s*天/);
  if (match) return Number(match[1]);

  match = text.match(/(\d+)\s*周/);
  if (match) return Number(match[1]) * 7;

  match = text.match(/(\d+)\s*月/);
  if (match) return Number(match[1]) * 30;

  match = text.match(/(\d+)\s*年/);
  if (match) return Number(match[1]) * 365;

  if (/周/.test(text)) return 7;
  if (/月/.test(text)) return 30;
  if (/年/.test(text)) return 365;
  return Number.POSITIVE_INFINITY;
}
