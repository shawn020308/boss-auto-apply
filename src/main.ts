// ============================================================
// main.ts - 脚本入口
// ============================================================

import { AppState, FilterConfig } from "./types";
import { loadConfig, saveConfig } from "./config";
import { getCookie } from "./gm";
import { isBossJobPage, isBossChatPage } from "./dom";
import { startChatPage } from "./chat";
import { createLogSink } from "./debug";
import { mountPanel, PanelModel } from "./ui/panel";
import { runApplyLoop, resetRunCounters, onLoopFinished } from "./loop";
import { installRouteWatcher } from "./route";
import { loadHistory, clearStatsRecords } from "./history";

// ──────────────────────────────────────────────
// 应用状态
// ──────────────────────────────────────────────
const state: AppState = {
  running: false,
  stopping: false,
  collapsed: false,
  scanned: 0,
  matched: 0,
  applied: 0,
  skipped: 0,
  failed: 0,
  platformRemainingQuota: null,
  current: "未开始",
  logs: [],
  processedKeys: new Set<string>(),
  dailyLimit: 0,
  debug: false,
  dryRun: false,
  activeTab: "run",
};

let config: FilterConfig = loadConfig();
state.dailyLimit = config.dailyLimit;
state.debug = config.debug;
state.dryRun = config.dryRun;

// ──────────────────────────────────────────────
// 渲染 & 面板
//   render         — 完整重建(仅用于首次挂载/字体缩放)
//   renderDynamic  — 轻量更新(统计/日志/按钮状态),不重建表单 → 不丢焦点
// ──────────────────────────────────────────────
let render: () => void = () => {};
let renderDynamic: () => void = () => {};
let mounted = false;

const log = createLogSink(state, () => renderDynamic());

function getModel(): PanelModel {
  return { config, state };
}

function startApply(): void {
  if (state.running) return;
  if (!isBossJobPage()) {
    log("warn", "请先打开 Boss 直聘职位列表页面,例如 https://www.zhipin.com/web/geek/job");
    return;
  }
  const token = getCookie("bst");
  if (!token) {
    log("error", "未读取到登录 token。请先在浏览器里自行登录 Boss 直聘。");
    return;
  }
  const history = loadHistory();
  if (history.dailyCount >= config.dailyLimit) {
    log("warn", "已达每日上限");
    return;
  }

  state.running = true;
  state.stopping = false;
  resetRunCounters(state);
  log("success", "开始自动投递");

  runApplyLoop({ state, config, log, render: renderDynamic })
    .catch((error: Error) => {
      log("error", `运行异常:${error.message || error}`, error);
    })
    .finally(() => {
      onLoopFinished(state);
      log(
        "success",
        `任务结束:扫描 ${state.scanned},匹配 ${state.matched},成功 ${state.applied},跳过 ${state.skipped},失败 ${state.failed}`,
      );
      renderDynamic();
    });
}

function stopApply(): void {
  if (!state.running) return;
  state.stopping = true;
  state.current = "正在停止,等待当前请求结束";
  log("warn", "已请求停止");
  renderDynamic();
}

function onConfigChange(next: FilterConfig): void {
  config = next;
  saveConfig(config);
  state.dailyLimit = config.dailyLimit;
  state.debug = config.debug;
  state.dryRun = config.dryRun;
}

function ensureMounted(): void {
  if (mounted) {
    renderDynamic();
    return;
  }
  const handle = mountPanel(getModel, {
    onToggleCollapse: () => {
      state.collapsed = !state.collapsed;
      renderDynamic();
    },
    onStart: (next) => {
      onConfigChange(next);
      startApply();
    },
    onStop: stopApply,
    onConfigChange: (next) => {
      onConfigChange(next);
      // 面板内 onFormChange 已轻量更新摘要提示;此处无需再 render
    },
    onFontScaleChange: (delta) => {
      // delta = 0 表示重置;±0.1 表示步进
      const next = delta === 0 ? 1.0 : Math.round((config.fontScale + delta) * 10) / 10;
      const clamped = Math.max(0.7, Math.min(1.5, next));
      config = { ...config, fontScale: clamped };
      saveConfig(config);
      render(); // 缩放会改 zoom 和 badge,需要重建
    },
    onTabChange: (tab) => {
      state.activeTab = tab;
      renderDynamic();
    },
    onClearStats: () => {
      clearStatsRecords();
      resetRunCounters(state);
      log("success", "已清除统计记录并重置内存计数");
      renderDynamic();
    },
  });
  render = handle.render;
  renderDynamic = handle.renderDynamic;
  mounted = true;
  render();
}

function bootstrap(): void {
  // 职位列表页 → 投递面板
  if (isBossJobPage()) {
    ensureMounted();
    installRouteWatcher(() => {
      if (isBossJobPage()) ensureMounted();
    });
    registerMenu();
    log("success", "脚本已加载。");
    return;
  }
  // 聊天页 → 注入企查查链接
  if (isBossChatPage()) {
    startChatPage();
    return;
  }
}

function registerMenu(): void {
  if (typeof isBossJobPage !== "function" || !isBossJobPage()) return;
  try {
    if (typeof GM_registerMenuCommand === "function") {
      GM_registerMenuCommand("显示/隐藏 Boss 自动投递面板", () => {
        ensureMounted();
        state.collapsed = !state.collapsed;
        renderDynamic();
      });
      GM_registerMenuCommand("停止 Boss 自动投递", stopApply);
    }
  } catch (error) {
    console.warn("[boss-auto-apply-lite] register menu failed", error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
} else {
  bootstrap();
}
