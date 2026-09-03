// ============================================================
// api.ts - BOSS 直聘 API:详情查询 + 投递接口 + 响应解析
// ============================================================

import { Job, JobDetail } from "./types";
import { buildBossHeaders, getCookie } from "./gm";
import { normalizeText } from "./dom";
import { formatJob } from "./job";

export interface ApplyResult {
  ok: boolean;
  limited: boolean;
  /** 当 ok=true 但 limited=false 时,可能是"软成功"(开聊提醒) */
  softSuccess: boolean;
  message: string;
  remainingQuota: number | null;
  raw?: unknown;
}

export async function fetchJobDetail(job: Job): Promise<JobDetail | null> {
  if (!job.securityId || !job.lid) return null;

  const params = new URLSearchParams({
    lid: job.lid,
    securityId: job.securityId,
    sessionId: "",
  });

  const response = await fetch(
    `/wapi/zpgeek/job/card.json?${params.toString()}`,
    {
      method: "GET",
      credentials: "include",
      headers: buildBossHeaders(),
    },
  );

  const data = await parseResponse(response);

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (
    data &&
    typeof data === "object" &&
    (data as Record<string, unknown>).code !== undefined &&
    (data as Record<string, unknown>).code !== 0
  ) {
    const obj = data as Record<string, unknown>;
    throw new Error(String(obj.message) || `接口返回 code=${obj.code}`);
  }

  const obj = data as Record<string, unknown> | null;
  const zpData = obj?.zpData as Record<string, unknown> | undefined;
  return (zpData?.jobCard || zpData || obj?.data || null) as JobDetail | null;
}

export async function applyJob(job: Job, treatChatRemindAsSuccess: boolean): Promise<ApplyResult> {
  const params = new URLSearchParams({
    securityId: job.securityId,
    jobId: job.encryptJobId,
    lid: job.lid,
  });

  const response = await fetch(`/wapi/zpgeek/friend/add.json?${params.toString()}`, {
    method: "POST",
    credentials: "include",
    headers: buildBossHeaders(),
  });

  const data = await parseResponse(response);
  debugBossResponse(job, response, data);

  if (!response.ok) {
    return {
      ok: false,
      limited: response.status === 403 || response.status === 429,
      softSuccess: false,
      message: `HTTP ${response.status}`,
      remainingQuota: null,
      raw: data,
    };
  }

  const obj = data as Record<string, unknown> | null;
  const message = extractBossMessage(data);
  const chatRemindDialog = getChatRemindDialog(data);
  const chatRemindText = chatRemindDialog ? dialogToText(chatRemindDialog) : "";
  const fullMessage = normalizeText([message, chatRemindText].filter(Boolean).join(";"));
  const remainingQuota = parseRemainingQuota(fullMessage);

  if (obj?.code === 0 || obj?.message === "Success" || message === "Success") {
    return {
      ok: true,
      limited: false,
      softSuccess: false,
      message: message || "Success",
      remainingQuota,
      raw: data,
    };
  }

  const limited = isHardLimitMessage(fullMessage);
  const isChatRemind = Boolean(chatRemindDialog) || /开聊提醒/.test(fullMessage);
  if (isChatRemind && !limited && treatChatRemindAsSuccess) {
    return {
      ok: true,
      limited: false,
      softSuccess: true,
      message: chatRemindText || message || "开聊提醒",
      remainingQuota,
      raw: data,
    };
  }

  return {
    ok: false,
    limited,
    softSuccess: false,
    message: fullMessage || `接口返回 code=${obj?.code}`,
    remainingQuota,
    raw: data,
  };
}

export function parseResponse(response: Response): Promise<unknown> {
  return response.text().then((text) => {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return { code: response.ok ? 0 : response.status, message: text };
    }
  });
}

function extractBossMessage(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const obj = data as Record<string, unknown>;
  const dialogText = dialogToText(getChatRemindDialog(data));
  if (dialogText) return normalizeText(dialogText);

  const zpData = obj.zpData as Record<string, unknown> | undefined;
  const bizData = zpData?.bizData as Record<string, unknown> | undefined;
  const candidates = [
    obj.message,
    obj.msg,
    zpData?.message,
    bizData?.toast,
    zpData?.toast,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return normalizeText(c);
  }
  return "";
}

function getChatRemindDialog(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  const zpData = obj.zpData as Record<string, unknown> | undefined;
  const bizData = zpData?.bizData as Record<string, unknown> | undefined;
  return (
    (bizData?.chatRemindDialog as Record<string, unknown> | undefined) ||
    (zpData?.chatRemindDialog as Record<string, unknown> | undefined) ||
    (obj.chatRemindDialog as Record<string, unknown> | undefined) ||
    null
  );
}

function dialogToText(dialog: Record<string, unknown> | null): string {
  if (!dialog) return "";
  const values: string[] = [];
  const visit = (value: unknown, depth = 0): void => {
    if (value == null || depth > 3) return;
    if (typeof value === "string" || typeof value === "number") {
      const text = normalizeText(value);
      if (text) values.push(text);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1));
      return;
    }
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      for (const key of ["title", "content", "subTitle", "desc", "text", "buttonText", "confirmText", "cancelText"]) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) visit(obj[key], depth + 1);
      }
    }
  };
  visit(dialog);
  return [...new Set(values)].join(";");
}

function parseRemainingQuota(message: string): number | null {
  const text = normalizeText(message || "");
  const match = text.match(/(?:还剩|剩余)\s*(\d+)\s*次/);
  return match ? Number(match[1]) : null;
}

function isHardLimitMessage(message: string): boolean {
  const text = message || "";
  const remainingQuota = parseRemainingQuota(text);
  if (remainingQuota === 0) return true;
  return /上限|今日沟通人数已达|频繁|验证|验证码|登录|失效|安全|风控|异常|稍后|暂时无法|账号/.test(text);
}

function debugBossResponse(job: Job, response: Response, data: unknown): void {
  const message = extractBossMessage(data);
  const obj = data as Record<string, unknown> | null;
  const ok =
    response.ok && (obj?.code === 0 || message === "Success");
  if (ok) return;
  console.groupCollapsed(
    `[boss-auto-apply-lite] 投递接口响应 ${response.status} ${obj?.code ?? ""} ${formatJob(job)}`,
  );
  console.log("message:", message);
  console.log("chatRemindDialog:", getChatRemindDialog(data));
  console.log("raw:", data);
  console.groupEnd();
}

// re-export getCookie/buildBossHeaders to avoid callers depending on gm.ts shape
export { getCookie };
