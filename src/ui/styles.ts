// ============================================================
// styles.ts - Claude 温润风格面板样式
//
// 配色思路:奶油底 + 暖灰边 + 焦糖橙重点色,完全替换原 Boss 绿。
// 字号整体上调 ~1pt,日志区 13px 等宽,行高 1.6。
// ============================================================

import { APP_ID } from "../types";

const PANEL_ID = `${APP_ID}-panel`;
const STYLE_ID = `${APP_ID}-style`;

export function addStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const css = `
  /* ─────────────────────────────────────────────
     主题变量(Claude warm)
     ───────────────────────────────────────────── */
  #${PANEL_ID} {
    /* base palette */
    --aj-bg:           #faf8f5;
    --aj-surface:      #f5f1eb;
    --aj-surface-2:    #efe9e0;
    --aj-border:       #e8e3dc;
    --aj-border-soft:  #f0ebe4;
    --aj-text:         #1f1d1a;
    --aj-secondary:    #6f6b65;
    --aj-muted:        #a8a39c;
    --aj-placeholder:  #c2bdb6;
    --aj-accent:       #d97757;
    --aj-accent-hover: #c56544;
    --aj-accent-soft:  #fbeee6;
    --aj-on-accent:    #ffffff;

    --aj-blue:         #5b8db8;
    --aj-blue-bg:      #eef3f8;
    --aj-amber:        #c08a45;
    --aj-amber-bg:     #faf3e9;
    --aj-red:          #cc5a4a;
    --aj-red-bg:       #faf0ed;
    --aj-green:        #6a9b71;
    --aj-green-bg:     #eef4ef;

    /* shape */
    --aj-radius:       10px;
    --aj-radius-sm:    6px;
    --aj-shadow:       0 0 0 1px rgba(0,0,0,0.04), 0 12px 36px rgba(80, 60, 40, 0.10);
  }

  #${PANEL_ID} {
    position: fixed;
    right: 18px;
    bottom: 18px;
    z-index: 2147483647;
    width: 400px;
    max-height: calc(100vh - 36px);
    overflow: hidden;
    border-radius: var(--aj-radius);
    background: var(--aj-bg);
    color: var(--aj-text);
    box-shadow: var(--aj-shadow);
    font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI",
          "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", Helvetica, Arial, sans-serif;
    color-scheme: light;
    display: flex;
    flex-direction: column;
  }
  #${PANEL_ID} * { box-sizing: border-box; }

  /* ── 头部(取消渐变,改用纯色 + 细分割线) ── */
  #${PANEL_ID} .aj-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 12px 16px;
    background: var(--aj-bg);
    border-bottom: 1px solid var(--aj-border);
  }
  #${PANEL_ID} .aj-title {
    font-weight: 700;
    font-size: 15px;
    letter-spacing: -0.01em;
    color: var(--aj-text);
  }
  #${PANEL_ID} .aj-subtitle {
    margin-top: 2px;
    font-size: 12px;
    color: var(--aj-secondary);
    font-weight: 400;
  }
  #${PANEL_ID} .aj-header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  #${PANEL_ID} .aj-icon-btn {
    width: 28px;
    height: 28px;
    border: 1px solid var(--aj-border);
    border-radius: var(--aj-radius-sm);
    background: var(--aj-bg);
    color: var(--aj-secondary);
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition: all 0.15s ease;
  }
  #${PANEL_ID} .aj-icon-btn:hover {
    background: var(--aj-surface);
    color: var(--aj-text);
  }

  /* ── 缩放显示文字 ── */
  #${PANEL_ID} .aj-scale-badge {
    font-size: 11px;
    color: var(--aj-secondary);
    font-variant-numeric: tabular-nums;
    min-width: 30px;
    text-align: center;
  }

  /* ── 主体 ── */
  #${PANEL_ID} .aj-body {
    flex: 1;
    overflow: auto;
    padding: 12px 16px 16px;
    border-top: 0;
  }
  #${PANEL_ID}.is-collapsed .aj-body { display: none; }

  /* ── 统计卡(5 列) ── */
  #${PANEL_ID} .aj-status {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
    margin-bottom: 12px;
  }
  #${PANEL_ID} .aj-stat {
    border-radius: var(--aj-radius-sm);
    padding: 7px 4px;
    background: var(--aj-surface);
    text-align: center;
    border: 1px solid var(--aj-border-soft);
    transition: transform 0.15s, box-shadow 0.15s;
  }
  #${PANEL_ID} .aj-stat:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(0,0,0,0.04);
  }
  #${PANEL_ID} .aj-stat b {
    display: block;
    font-size: 16px;
    color: var(--aj-text);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  #${PANEL_ID} .aj-stat span {
    font-size: 11px;
    color: var(--aj-secondary);
    margin-top: 1px;
    display: block;
  }
  /* 5 个状态分别着色 */
  #${PANEL_ID} .aj-stat--scanned  b { color: var(--aj-secondary); }
  #${PANEL_ID} .aj-stat--matched  b { color: var(--aj-blue); }
  #${PANEL_ID} .aj-stat--applied  b { color: var(--aj-accent); }
  #${PANEL_ID} .aj-stat--skipped  b { color: var(--aj-amber); }
  #${PANEL_ID} .aj-stat--failed   b { color: var(--aj-red); }

  /* ── 当前状态条 ── */
  #${PANEL_ID} .aj-current {
    margin: 0 0 14px;
    padding: 8px 10px;
    border-radius: var(--aj-radius-sm);
    background: var(--aj-accent-soft);
    color: var(--aj-accent-hover);
    border: 1px solid #f4d9c5;
    word-break: break-word;
    font-size: 12.5px;
    line-height: 1.5;
  }

  /* ── 分区容器(细线分隔,取代卡片框) ── */
  #${PANEL_ID} .aj-section {
    padding: 0 0 14px 0;
    margin-bottom: 14px;
    border-bottom: 1px solid var(--aj-border);
  }
  #${PANEL_ID} .aj-section:last-child {
    padding-bottom: 0;
    margin-bottom: 0;
    border-bottom: 0;
  }
  #${PANEL_ID} .aj-section-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--aj-secondary);
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* ── 可折叠分组(<details>) ── */
  #${PANEL_ID} .aj-details {
    padding: 0 0 12px 0;
    margin-bottom: 12px;
    border-bottom: 1px solid var(--aj-border);
  }
  #${PANEL_ID} .aj-details:last-of-type {
    padding-bottom: 0;
    margin-bottom: 0;
    border-bottom: 0;
  }
  #${PANEL_ID} .aj-details > summary {
    list-style: none;
    cursor: pointer;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 0;
    margin-bottom: 0;
    font-size: 11px;
    font-weight: 600;
    color: var(--aj-secondary);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    transition: color 0.15s;
  }
  #${PANEL_ID} .aj-details > summary::-webkit-details-marker { display: none; }
  #${PANEL_ID} .aj-details > summary::marker { content: ""; }
  #${PANEL_ID} .aj-details > summary:hover {
    color: var(--aj-accent);
  }
  #${PANEL_ID} .aj-details > summary .aj-chevron {
    display: inline-block;
    font-size: 10px;
    line-height: 1;
    color: var(--aj-muted);
    transition: transform 0.18s ease;
    transform: rotate(-90deg);
    margin-left: auto;
  }
  #${PANEL_ID} .aj-details[open] > summary .aj-chevron {
    transform: rotate(0deg);
    color: var(--aj-accent);
  }
  #${PANEL_ID} .aj-details > summary .aj-summary-hint {
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    font-size: 10.5px;
    color: var(--aj-muted);
    margin-left: 8px;
  }
  #${PANEL_ID} .aj-details[open] > summary {
    margin-bottom: 10px;
  }

  /* ── 表单 ── */
  #${PANEL_ID} .aj-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  /* 复选框行(2 列) */
  #${PANEL_ID} .aj-checks {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px 12px;
  }
  #${PANEL_ID} .aj-check {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    color: var(--aj-text);
    cursor: pointer;
    padding: 3px 4px;
    border-radius: 4px;
    margin: 0 -4px;
    transition: opacity 0.15s;
  }
  #${PANEL_ID} .aj-check:hover { opacity: 0.75; }
  #${PANEL_ID} .aj-check input {
    accent-color: var(--aj-accent);
    width: 14px;
    height: 14px;
    margin: 0;
  }

  /* 数字字段(2 列) */
  #${PANEL_ID} .aj-numbers {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 10px;
  }
  #${PANEL_ID} .aj-num-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  #${PANEL_ID} .aj-num-field label {
    font-size: 11.5px;
    color: var(--aj-secondary);
    display: flex;
    align-items: baseline;
    gap: 3px;
  }
  #${PANEL_ID} .aj-num-field .aj-unit {
    font-size: 10.5px;
    color: var(--aj-muted);
    margin-left: 1px;
  }

  /* 输入控件(同一样式) */
  #${PANEL_ID} input[type="text"],
  #${PANEL_ID} input[type="number"],
  #${PANEL_ID} textarea {
    width: 100%;
    padding: 7px 9px;
    border: 1px solid var(--aj-border);
    border-radius: var(--aj-radius-sm);
    outline: none;
    font: inherit;
    font-size: 13px;
    background: var(--aj-surface);
    color: var(--aj-text);
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    color-scheme: light;
  }
  #${PANEL_ID} textarea {
    min-height: 48px;
    resize: vertical;
    line-height: 1.55;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
  }
  #${PANEL_ID} input:focus,
  #${PANEL_ID} textarea:focus {
    border-color: var(--aj-accent);
    background: var(--aj-bg);
    box-shadow: 0 0 0 3px rgba(217, 119, 87, 0.15);
  }
  #${PANEL_ID} input::placeholder,
  #${PANEL_ID} textarea::placeholder {
    color: var(--aj-placeholder);
    opacity: 1;
  }
  #${PANEL_ID} input[type="number"] {
    font-variant-numeric: tabular-nums;
  }
  /* autofill 避免浏览器把它变黄 */
  #${PANEL_ID} input:-webkit-autofill,
  #${PANEL_ID} textarea:-webkit-autofill {
    -webkit-box-shadow: 0 0 0 1000px var(--aj-surface) inset !important;
    -webkit-text-fill-color: var(--aj-text) !important;
    caret-color: var(--aj-text);
  }

  /* ── 操作按钮 ── */
  #${PANEL_ID} .aj-actions {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: 8px;
    margin: 14px 0;
  }
  #${PANEL_ID} .aj-btn {
    border: 1px solid var(--aj-border);
    border-radius: var(--aj-radius-sm);
    padding: 9px 10px;
    cursor: pointer;
    font-weight: 600;
    font-size: 13px;
    color: var(--aj-text);
    background: var(--aj-surface);
    transition: all 0.15s ease;
    font-family: inherit;
  }
  #${PANEL_ID} .aj-btn:hover {
    background: var(--aj-surface-2);
    filter: none;
  }
  #${PANEL_ID} .aj-btn:active {
    transform: scale(0.98);
  }
  #${PANEL_ID} .aj-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  #${PANEL_ID} .aj-btn-primary {
    background: var(--aj-accent);
    color: var(--aj-on-accent);
    border-color: var(--aj-accent);
  }
  #${PANEL_ID} .aj-btn-primary:hover:not(:disabled) {
    background: var(--aj-accent-hover);
    border-color: var(--aj-accent-hover);
  }
  #${PANEL_ID} .aj-btn-danger {
    background: var(--aj-bg);
    color: var(--aj-red);
    border-color: var(--aj-border);
  }
  #${PANEL_ID} .aj-btn-danger:hover:not(:disabled) {
    background: var(--aj-red-bg);
    border-color: var(--aj-red);
  }

  /* 缩放按钮组(头部) */
  #${PANEL_ID} .aj-scale-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  #${PANEL_ID} .aj-scale-btn {
    width: 22px;
    height: 22px;
    border: 1px solid var(--aj-border);
    border-radius: 4px;
    background: var(--aj-bg);
    color: var(--aj-secondary);
    cursor: pointer;
    font-size: 12px;
    line-height: 1;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.12s ease;
  }
  #${PANEL_ID} .aj-scale-btn:hover {
    background: var(--aj-surface);
    color: var(--aj-accent);
    border-color: var(--aj-accent);
  }

  /* ── 日志区(深底暖灰,字大一点便于扫读) ── */
  #${PANEL_ID} .aj-logs {
    max-height: 220px;
    overflow: auto;
    border: 1px solid var(--aj-border);
    border-radius: var(--aj-radius-sm);
    background: #2a2723;
    padding: 10px 12px;
  }
  #${PANEL_ID} .aj-log {
    color: #d4cfc7;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 13px;
    line-height: 1.65;
    padding: 2px 0;
    white-space: pre-wrap;
    word-break: break-word;
  }
  #${PANEL_ID} .aj-log-success { color: #b3d9b8; }
  #${PANEL_ID} .aj-log-warn    { color: #e6c894; }
  #${PANEL_ID} .aj-log-error   { color: #e8a59a; }
  #${PANEL_ID} .aj-log-debug   { color: #98b3cc; }
  #${PANEL_ID} .aj-log-info    { color: #d4cfc7; }
  /* 时间戳弱化 */
  #${PANEL_ID} .aj-log-time {
    color: #8b857c;
    margin-right: 6px;
  }

  /* 自定义滚动条(整个面板) */
  #${PANEL_ID} ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  #${PANEL_ID} ::-webkit-scrollbar-track {
    background: transparent;
  }
  #${PANEL_ID} ::-webkit-scrollbar-thumb {
    background: var(--aj-border);
    border-radius: 3px;
  }
  #${PANEL_ID} ::-webkit-scrollbar-thumb:hover {
    background: var(--aj-muted);
  }

  /* 折叠态:只保留头部 */
  #${PANEL_ID}.is-collapsed {
    width: 280px;
  }
`;

  if (typeof GM_addStyle === "function") {
    GM_addStyle(css);
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

export const PANEL_SELECTOR = `#${PANEL_ID}`;
