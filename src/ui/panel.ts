// ============================================================
// panel.ts - Claude 风格浮动面板
//
// 布局思路(由上到下):
//   1. 头部:标题 + 缩放 + 折叠/展开
//   2. 运行态常驻:5 项统计 → 当前状态 → 开始/停止 → 日志
//   3. 设置(默认折叠):
//        ▶ 投递节奏 · 风控
//        ▶ 薪资区间
//        ▼ 关键词过滤
// ============================================================

import {
  APP_ID,
  AppState,
  DEFAULT_CONFIG,
  FilterConfig,
  VERSION,
} from "../types";
import { htmlEscape } from "../dom";
import { loadHistory } from "../history";
import { normalizeConfig } from "../config";
import { addStyles } from "./styles";

const PANEL_ID = `${APP_ID}-panel`;

export interface PanelCallbacks {
  onToggleCollapse: () => void;
  onStart: (config: FilterConfig) => void;
  onStop: () => void;
  onConfigChange: (config: FilterConfig) => void;
  onFontScaleChange: (delta: number) => void;
}

export interface PanelModel {
  config: FilterConfig;
  state: AppState;
}

export interface PanelHandle {
  panel: HTMLElement;
  render: () => void;
  /** 仅刷新运行态区域(统计/当前/按钮/日志),不重建表单 → 不丢焦点 / 不丢折叠 */
  renderDynamic: () => void;
}

export function mountPanel(getModel: () => PanelModel, cb: PanelCallbacks): PanelHandle {
  if (!document.body) throw new Error("document.body not ready");
  addStyles();

  let panel = document.getElementById(PANEL_ID) as HTMLElement | null;
  if (!panel) {
    panel = document.createElement("div");
    panel.id = PANEL_ID;
    document.body.appendChild(panel);
  }

  /** 完整重建。慎用:会丢焦点和 <details> 状态 */
  const render = (): void => {
    if (!panel) return;
    const { config, state } = getModel();
    panel.style.zoom = String(config.fontScale);

    panel.classList.toggle("is-collapsed", state.collapsed);
    const runningText = state.running ? (state.stopping ? "停止中" : "运行中") : "空闲";
    const history = loadHistory();
    const quotaText =
      state.platformRemainingQuota == null
        ? ""
        : ` · 平台剩余 ${state.platformRemainingQuota}`;

    panel.innerHTML = `
      <div class="aj-header">
        <div>
          <div class="aj-title">Boss 自动投递助手</div>
          <div class="aj-subtitle">v${VERSION} · ${runningText} · 今日已投 ${history.dailyCount}/${state.dailyLimit || DEFAULT_CONFIG.dailyLimit}${quotaText}</div>
        </div>
        <div class="aj-header-actions">
          <div class="aj-scale-group">
            <button class="aj-scale-btn" data-action="scale-down" title="缩小界面">−</button>
            <span class="aj-scale-badge">${config.fontScale.toFixed(1)}x</span>
            <button class="aj-scale-btn" data-action="scale-up" title="放大界面">+</button>
            <button class="aj-scale-btn" data-action="scale-reset" title="重置缩放">⌂</button>
          </div>
          <button class="aj-icon-btn" data-action="toggle-collapse" title="${state.collapsed ? "展开" : "收起"}">${state.collapsed ? "▴" : "▾"}</button>
        </div>
      </div>
      <div class="aj-body">

        <div class="aj-status">
          <div class="aj-stat aj-stat--scanned"><b data-bind="scanned">${state.scanned}</b><span>扫描</span></div>
          <div class="aj-stat aj-stat--matched"><b data-bind="matched">${state.matched}</b><span>匹配</span></div>
          <div class="aj-stat aj-stat--applied"><b data-bind="applied">${state.applied}</b><span>成功</span></div>
          <div class="aj-stat aj-stat--skipped"><b data-bind="skipped">${state.skipped}</b><span>跳过</span></div>
          <div class="aj-stat aj-stat--failed"><b data-bind="failed">${state.failed}</b><span>失败</span></div>
        </div>

        <div class="aj-current" data-bind="current">当前:${htmlEscape(state.current)}</div>

        <div class="aj-actions">
          <button class="aj-btn aj-btn-primary" data-action="start" ${state.running ? "disabled" : ""}>开始</button>
          <button class="aj-btn aj-btn-danger" data-action="stop" ${state.running ? "" : "disabled"}>停止</button>
        </div>

        <div class="aj-logs" data-bind="logs"></div>

        <form class="aj-form" data-role="config-form" autocomplete="off" style="margin-top:14px">
          <details class="aj-details" data-details="rhythm">
            <summary>
              <span>投递节奏 · 风控</span>
              <span class="aj-chevron">▸</span>
            </summary>
            <div class="aj-numbers">
              ${num("dailyLimit", "每日上限", "份", config.dailyLimit)}
              ${num("activeWithinDays", "BOSS 活跃度", "天内", config.activeWithinDays)}
              ${num("delayMinSec", "投递间隔", "秒 (最小)", config.delayMinSec)}
              ${num("delayMaxSec", "投递间隔", "秒 (最大)", config.delayMaxSec)}
              ${num("pageDelaySec", "翻页等待", "秒", config.pageDelaySec)}
            </div>
            <div class="aj-checks" style="margin-top:10px">
              ${chk("onlyOnlineBoss", "仅在线 BOSS", config.onlyOnlineBoss)}
              ${chk("debug", "调试日志", config.debug)}
            </div>
          </details>

          <details class="aj-details" data-details="salary">
            <summary>
              <span>薪资区间</span>
              <span class="aj-summary-hint" data-bind="salary-hint">${describeSalary(config)}</span>
              <span class="aj-chevron">▸</span>
            </summary>
            <div class="aj-numbers">
              ${num("salaryMinK", "薪资下限", "K (0=不限)", config.salaryMinK)}
              ${num("salaryMaxK", "薪资上限", "K (0=不限)", config.salaryMaxK)}
            </div>
          </details>

          <details class="aj-details" data-details="keywords" open>
            <summary>
              <span>关键词过滤</span>
              <span class="aj-summary-hint" data-bind="keyword-hint">${describeKeywords(config)}</span>
              <span class="aj-chevron">▸</span>
            </summary>
            <div style="margin-bottom:10px">
              <label style="font-size:11.5px;color:var(--aj-secondary);margin-bottom:4px;display:block">岗位详情包含</label>
              <textarea name="includeDescriptionKeywords" placeholder="Vue, React, 全栈">${htmlEscape(config.includeDescriptionKeywords)}</textarea>
            </div>
            <div>
              <label style="font-size:11.5px;color:var(--aj-secondary);margin-bottom:4px;display:block">岗位详情排除</label>
              <textarea name="excludeDescriptionKeywords" placeholder="外包, 销售">${htmlEscape(config.excludeDescriptionKeywords)}</textarea>
            </div>
          </details>
        </form>
      </div>
    `;

    // 把 logs 一次性写入
    const logsEl = panel.querySelector<HTMLElement>('[data-bind="logs"]');
    if (logsEl) logsEl.innerHTML = buildLogsHtml(state.logs);

    // 恢复 details 状态
    restoreDetailsState();
  };

  /** 轻量刷新:仅更新运行态(统计/当前/按钮/日志),不重建表单 → 不丢焦点 / 不丢折叠 */
  const renderDynamic = (): void => {
    if (!panel) return;
    const { state } = getModel();
    panel.classList.toggle("is-collapsed", state.collapsed);

    // 统计
    for (const key of ["scanned", "matched", "applied", "skipped", "failed"] as const) {
      const el = panel.querySelector<HTMLElement>(`[data-bind="${key}"]`);
      if (el) el.textContent = String(state[key]);
    }

    // 当前
    const currentEl = panel.querySelector<HTMLElement>('[data-bind="current"]');
    if (currentEl) currentEl.textContent = `当前:${state.current}`;

    // 头部副标题(运行状态文字 + 今日已投)
    const subtitleEl = panel.querySelector<HTMLElement>(".aj-subtitle");
    if (subtitleEl) {
      const history = loadHistory();
      const quotaText =
        state.platformRemainingQuota == null ? "" : ` · 平台剩余 ${state.platformRemainingQuota}`;
      const runningText = state.running ? (state.stopping ? "停止中" : "运行中") : "空闲";
      subtitleEl.textContent = `v${VERSION} · ${runningText} · 今日已投 ${history.dailyCount}/${state.dailyLimit || DEFAULT_CONFIG.dailyLimit}${quotaText}`;
    }

    // 开始/停止按钮
    const startBtn = panel.querySelector<HTMLButtonElement>('[data-action="start"]');
    const stopBtn = panel.querySelector<HTMLButtonElement>('[data-action="stop"]');
    if (startBtn) startBtn.disabled = state.running;
    if (stopBtn) stopBtn.disabled = !state.running;

    // 日志
    const logsEl = panel.querySelector<HTMLElement>('[data-bind="logs"]');
    if (logsEl) logsEl.innerHTML = buildLogsHtml(state.logs);
  };

  /** 在面板重建前,记录当前每个 <details> 是否展开 */
  let detailsState: Record<string, boolean> = {};
  const captureDetailsState = (): void => {
    if (!panel) return;
    detailsState = {};
    panel.querySelectorAll<HTMLDetailsElement>(".aj-details").forEach((d) => {
      const key = d.getAttribute("data-details");
      if (key) detailsState[key] = d.open;
    });
  };

  /** 在面板重建后,把记录的展开状态写回 */
  const restoreDetailsState = (): void => {
    if (!panel) return;
    panel.querySelectorAll<HTMLDetailsElement>(".aj-details").forEach((d) => {
      const key = d.getAttribute("data-details");
      if (key && key in detailsState) d.open = detailsState[key];
    });
  };

  /** 在 render() 末尾调用,确保捕获发生在 innerHTML 替换之前 */
  const renderCapturing = (): void => {
    captureDetailsState();
    render();
  };

  panel.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-action]") : null;
    if (!target) return;
    event.preventDefault();
    const action = target.getAttribute("data-action");
    switch (action) {
      case "toggle-collapse":
        cb.onToggleCollapse();
        break;
      case "start": {
        const next = collectFormConfig(panel!);
        cb.onStart(next);
        break;
      }
      case "stop":
        cb.onStop();
        break;
      case "scale-down":
        cb.onFontScaleChange(-0.1);
        break;
      case "scale-up":
        cb.onFontScaleChange(0.1);
        break;
      case "scale-reset":
        cb.onFontScaleChange(0);
        break;
    }
  });

  /** 输入时 silent 保存(不重建面板 → 不丢焦点) */
  const onFormChange = (event: Event): void => {
    if (!panel) return;
    const form = panel.querySelector<HTMLFormElement>('[data-role="config-form"]');
    if (!form || !(event.target instanceof Element) || !form.contains(event.target)) return;
    const next = collectFormConfig(panel);
    cb.onConfigChange(next); // silent: 仅保存,不动 DOM
    // 轻量更新:折叠标题里的摘要提示
    updateSummaryHints(next);
  };

  /** 折叠标题里的摘要文字,无需重建整个面板 */
  const updateSummaryHints = (config: FilterConfig): void => {
    if (!panel) return;
    const salaryHint = panel.querySelector<HTMLElement>('[data-bind="salary-hint"]');
    if (salaryHint) salaryHint.textContent = describeSalary(config);
    const kwHint = panel.querySelector<HTMLElement>('[data-bind="keyword-hint"]');
    if (kwHint) kwHint.textContent = describeKeywords(config);
  };

  panel.addEventListener("input", onFormChange);
  panel.addEventListener("change", onFormChange);

  renderCapturing();
  return {
    panel,
    render: renderCapturing,
    renderDynamic,
  };
}

function buildLogsHtml(logs: AppState["logs"]): string {
  if (!logs.length) {
    return '<div class="aj-log aj-log-info">暂无日志。点击"开始"按钮进行自动投递。</div>';
  }
  return logs
    .map(
      (item) =>
        `<div class="aj-log aj-log-${item.level}"><span class="aj-log-time">${htmlEscape(item.time)}</span>${htmlEscape(item.message)}</div>`,
    )
    .join("");
}

function describeSalary(c: FilterConfig): string {
  if (!c.salaryMinK && !c.salaryMaxK) return "不限";
  if (c.salaryMinK && c.salaryMaxK) return `${c.salaryMinK}K – ${c.salaryMaxK}K`;
  if (c.salaryMinK) return `≥ ${c.salaryMinK}K`;
  return `≤ ${c.salaryMaxK}K`;
}

function describeKeywords(c: FilterConfig): string {
  const inc = (c.includeDescriptionKeywords || "").trim();
  const exc = (c.excludeDescriptionKeywords || "").trim();
  if (!inc && !exc) return "不限";
  const count = (s: string) => s.split(/[，,\n;]/).filter(Boolean).length;
  const parts: string[] = [];
  if (inc) parts.push(`含 ${count(inc)}`);
  if (exc) parts.push(`排除 ${count(exc)}`);
  return parts.join(" · ");
}

function collectFormConfig(panel: HTMLElement): FilterConfig {
  const form = panel.querySelector<HTMLFormElement>('[data-role="config-form"]');
  if (!form) throw new Error("config form not found");
  const next: Record<string, unknown> = {};
  for (const key of Object.keys(DEFAULT_CONFIG)) {
    const field = form.elements.namedItem(key);
    if (!field) continue;
    if (field instanceof HTMLInputElement && field.type === "checkbox") {
      next[key] = field.checked;
    } else if (field instanceof HTMLInputElement && field.type === "number") {
      next[key] = field.value === "" ? 0 : Number(field.value);
    } else if (field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement) {
      next[key] = field.value;
    }
  }
  return normalizeConfig(next as Partial<FilterConfig>);
}

function chk(name: keyof FilterConfig, label: string, checked: boolean): string {
  return `<label class="aj-check"><input type="checkbox" name="${name}" ${checked ? "checked" : ""}> ${label}</label>`;
}

function num(
  name: keyof FilterConfig,
  label: string,
  unit: string,
  value: number,
): string {
  return `
    <div class="aj-num-field">
      <label>${label}<span class="aj-unit">${unit}</span></label>
      <input type="number" name="${name}" step="0.5" min="0" value="${value}">
    </div>
  `;
}
