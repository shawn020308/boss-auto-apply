// ============================================================
// loop.ts - 主投递循环:翻页、滚动、单职位处理
// ============================================================

import { AppState, FilterConfig, Job } from "./types";
import { SELECTORS } from "./types";
import { applyFilters } from "./filters";
import { applyJob, fetchJobDetail } from "./api";
import { getJobCardElements, randomBetween, sleep } from "./dom";
import { buildJob, formatJob, getJobUniqueKey } from "./job";
import { hasAppliedToday, loadHistory, recordAppliedKey } from "./history";
import { notify } from "./debug";

export type LogFn = (
  level: "info" | "warn" | "error" | "debug" | "success",
  message: string,
  data?: unknown,
) => void;

export interface LoopDeps {
  state: AppState;
  config: FilterConfig;
  log: LogFn;
  render: () => void;
}

export async function runApplyLoop(deps: LoopDeps): Promise<void> {
  const { state, config, log, render } = deps;
  let pageRound = 1;

  while (!state.stopping) {
    state.current = `读取第 ${pageRound} 页职位`;
    render();

    const jobs = await collectJobsWithWait(state);
    if (jobs.length === 0) {
      log("warn", "当前页未找到可读取的职位卡片。");
    }

    for (const job of jobs) {
      if (state.stopping) break;
      if (state.applied >= config.maxApplyCount) {
        state.current = "达到单次上限";
        return;
      }

      const history = loadHistory();
      if (history.dailyCount >= config.dailyLimit) {
        state.current = "已达每日上限";
        log("warn", "已达每日上限");
        return;
      }

      await handleOneJob(job, deps);
    }

    if (state.stopping) break;
    if (state.applied >= config.maxApplyCount) {
      state.current = "达到单次上限";
      return;
    }
    if (!config.autoNextPage) {
      state.current = "当前页处理完成(未开启自动翻页)";
      return;
    }

    const moved = await goNextPageOrScroll();
    if (!moved) {
      state.current = "没有更多职位";
      return;
    }

    pageRound += 1;
    await sleep(config.pageDelaySec * 1000);
  }

  state.current = "已手动停止";
}

async function collectJobsWithWait(state: AppState): Promise<Job[]> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const cards = getJobCardElements();
    if (cards.length > 0) {
      const jobs = cards
        .map((card, index) => buildJob(card, index))
        .filter((j): j is Job => Boolean(j));
      const seen = new Set<string>();
      const unique: Job[] = [];
      for (const job of jobs) {
        const key = getJobUniqueKey(job);
        if (seen.has(key)) continue;
        seen.add(key);
        if (state.processedKeys.has(key)) continue;
        unique.push(job);
      }
      return unique;
    }
    await sleep(500);
  }
  return [];
}

async function handleOneJob(job: Job, deps: LoopDeps): Promise<void> {
  const { state, config, log, render } = deps;
  const key = getJobUniqueKey(job);
  state.processedKeys.add(key);
  state.scanned += 1;
  state.current = formatJob(job);
  render();

  if (config.skipAppliedHistory && hasAppliedToday(key)) {
    state.skipped += 1;
    log("warn", `跳过【${formatJob(job)}】:今日历史中已投递`);
    return;
  }

  try {
    const detail = config.fetchDetail ? await safeFetchJobDetail(job, deps) : null;
    const filter = applyFilters(job, detail, config);
    if (!filter.ok) {
      state.skipped += 1;
      log("warn", `跳过【${formatJob(job)}】:${filter.reason}`);
      return;
    }

    state.matched += 1;
    const result = await applyJob(job, config.treatChatRemindAsSuccess);
    if (result.ok) {
      state.applied += 1;
      recordAppliedKey(key);
      if (result.remainingQuota != null && Number.isFinite(result.remainingQuota)) {
        state.platformRemainingQuota = result.remainingQuota;
      }
      if (result.softSuccess) {
        const quotaNote =
          result.remainingQuota != null && Number.isFinite(result.remainingQuota)
            ? `(平台剩余 ${result.remainingQuota} 次)`
            : "";
        log("success", `投递成功${quotaNote}【${formatJob(job)}】:${result.message}`);
      } else {
        log("success", `投递成功【${formatJob(job)}】`);
      }
      if (
        result.remainingQuota != null &&
        Number.isFinite(result.remainingQuota) &&
        result.remainingQuota <= 3
      ) {
        log("warn", `平台沟通机会仅剩 ${result.remainingQuota} 次`);
      }
    } else if (result.limited) {
      state.failed += 1;
      log("error", `平台限制或需人工处理【${formatJob(job)}】:${result.message}`);
      state.current = result.message || "平台限制";
      state.stopping = true;
      return;
    } else {
      state.failed += 1;
      log("error", `投递失败【${formatJob(job)}】:${result.message}`);
    }

    await sleepHumanDelay(config);
  } catch (error) {
    state.failed += 1;
    log(
      "error",
      `处理失败【${formatJob(job)}】:${(error as Error).message || error}`,
      error,
    );
    await sleepHumanDelay(config);
  } finally {
    render();
  }
}

async function safeFetchJobDetail(
  job: Job,
  deps: LoopDeps,
): Promise<Awaited<ReturnType<typeof fetchJobDetail>>> {
  if (!job.securityId || !job.lid) {
    deps.log("debug", `缺少详情字段,跳过详情请求:${formatJob(job)}`);
    return null;
  }
  try {
    return await fetchJobDetail(job);
  } catch (error) {
    deps.log(
      "warn",
      `获取详情失败,继续使用基础信息过滤【${formatJob(job)}】:${(error as Error).message || error}`,
    );
    return null;
  }
}

/**
 * 投递间隔:
 * - 基础:在 [delayMinSec, delayMaxSec] 间均匀随机
 * - 长尾:按 longPauseChance 概率触发一次 [longPauseMinSec, longPauseMaxSec] 的较长等待,
 *   模拟"用户看完 JD 再投"的节奏,降低机器人特征。
 */
async function sleepHumanDelay(config: FilterConfig): Promise<void> {
  if (config.longPauseChance > 0 && Math.random() < config.longPauseChance) {
    const seconds = randomBetween(config.longPauseMinSec, config.longPauseMaxSec);
    await sleep(seconds * 1000);
    return;
  }
  const seconds = randomBetween(config.delayMinSec, config.delayMaxSec);
  await sleep(seconds * 1000);
}

async function goNextPageOrScroll(): Promise<boolean> {
  const scrollContainer = SELECTORS.scrollContainers
    .map((selector) => document.querySelector(selector))
    .find(Boolean) as HTMLElement | undefined;

  if (scrollContainer) {
    const before = scrollContainer.scrollTop + scrollContainer.clientHeight;
    scrollContainer.scrollTo({
      top: scrollContainer.scrollHeight,
      behavior: "smooth",
    });
    await sleep(1000);
    const after = scrollContainer.scrollTop + scrollContainer.clientHeight;
    if (after > before + 20) return true;
  }

  const pageBefore = window.scrollY + window.innerHeight;
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  await sleep(1000);
  const pageAfter = window.scrollY + window.innerHeight;
  if (pageAfter > pageBefore + 20) return true;

  const nextIcon = document.querySelector(SELECTORS.nextIcon);
  const nextButton =
    nextIcon?.closest("button, a, li, .btn, .page-next") || nextIcon?.parentElement;
  if (
    nextButton instanceof HTMLElement &&
    !/disabled|disable/.test(nextButton.className || "") &&
    nextButton.getAttribute("aria-disabled") !== "true"
  ) {
    nextButton.click();
    return true;
  }

  return false;
}

export function resetRunCounters(state: AppState): void {
  state.scanned = 0;
  state.matched = 0;
  state.applied = 0;
  state.skipped = 0;
  state.failed = 0;
  state.platformRemainingQuota = null;
  state.current = "准备开始";
  state.processedKeys = new Set<string>();
}

export function onLoopFinished(state: AppState): void {
  state.running = false;
  state.stopping = false;
  state.current = state.current || "已结束";
  notify("Boss 自动投递助手", `任务结束:成功 ${state.applied} 条`);
}
