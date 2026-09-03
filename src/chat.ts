// ============================================================
// chat.ts - Boss 沟通页面增强:在每条 chat 旁注入"查企"链接
//
// 三层提取策略,只要其中一层命中即可:
//   1. 已知 class 选择器(常见命名约定)
//   2. Vue 组件内部数据(像 job card 那样反射 __vue__)
//   3. 位置启发式:item 内直系文本节点,取第 2 个短文本
//
// 所有匹配尝试都会在 console 报告,方便用户调 selector。
// ============================================================

import { APP_ID } from "./types";

const QCC_SEARCH_URL = "https://www.qcc.com/web/search?key=";

// ──────────────────────────────────────────────
// 聊天项容器选择器(尽可能多,顺序从特化到宽松)
// ──────────────────────────────────────────────
const CHAT_ITEM_SELECTORS = [
  ".chat-item",
  ".chat-list-item",
  ".chat-conversation",
  ".conversation-item",
  ".message-item",
  ".friend-card",
  ".list-item",
  ".item",
  // BEM / kebab-case
  '[class*="chat-item"]',
  '[class*="chatItem"]',
  '[class*="conversation-item"]',
  '[class*="conversationItem"]',
  '[class*="message-item"]',
  '[class*="messageItem"]',
  '[class*="ChatItem"]',
  // 兜底
  "li[role]",
  '[role="listitem"]',
];

// ──────────────────────────────────────────────
// 公司名 class 选择器
// ──────────────────────────────────────────────
const COMPANY_CLASS_SELECTORS = [
  ".company-name",
  ".brand-name",
  ".recruiter-company",
  ".company",
  ".brand",
  ".corp-name",
  ".corp",
  '[class*="company-name"]',
  '[class*="companyName"]',
  '[class*="brand-name"]',
  '[class*="brandName"]',
  '[class*="company"]',
  '[class*="brand"]',
  '[class*="corp"]',
  '[class*="Company"]',
  '[class*="Brand"]',
];

/** Vue 实例内部字段(运行时反射) */
interface VueInstance {
  __vue__?: {
    _data?: Record<string, unknown>;
    data?: Record<string, unknown>;
    _props?: Record<string, unknown>;
    $props?: Record<string, unknown>;
    $options?: { propsData?: Record<string, unknown> };
  };
}

function getDeepValue(obj: unknown, key: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, key)) {
    return (obj as Record<string, unknown>)[key];
  }
  for (const v of Object.values(obj as Record<string, unknown>)) {
    if (v && typeof v === "object") {
      const r = getDeepValue(v, key);
      if (r !== undefined) return r;
    }
  }
  return undefined;
}

/**
 * 从 Vue 组件实例里提取公司名
 * 常见路径:
 *   __vue__.data.brandName
 *   __vue__._data.brandName
 *   __vue__.data.friend.brandName
 *   __vue__.data.conversation.brandName
 *   __vue__.$options.propsData.brandName
 */
function extractFromVue(item: HTMLElement): string {
  // @ts-expect-error 运行时反射
  const vue = item.__vue__ as VueInstance["__vue__"] | undefined;
  if (!vue) return "";
  const sources = [
    vue._data,
    vue.data,
    vue._props,
    vue.$props,
    vue.$options?.propsData,
  ];
  for (const src of sources) {
    if (!src) continue;
    // 顶层 brandName
    const v =
      getDeepValue(src, "brandName") ||
      getDeepValue(src, "companyName") ||
      getDeepValue(src, "corpName") ||
      getDeepValue(src, "name");
    if (typeof v === "string" && v.trim().length >= 2) return v.trim();
  }
  return "";
}

/**
 * 位置启发式:取 item 内直系短文本节点的第 2 个
 * (Boss 的 chat item 模式通常是:name | company | role | ...)
 */
function extractByPosition(item: HTMLElement): string {
  const texts: string[] = [];
  const walk = (el: Element, depth: number): void => {
    if (depth > 4) return;
    // 只统计叶节点(没有子元素的)
    if (el.children.length === 0) {
      const t = el.textContent?.trim() || "";
      if (t && t.length >= 2 && t.length <= 30 && !/^\d{1,2}:\d{2}$/.test(t)) {
        texts.push(t);
      }
      return;
    }
    for (const child of el.children) walk(child, depth + 1);
  };
  walk(item, 0);
  // 第 2 个文本通常是公司
  if (texts.length >= 2) return texts[1];
  return "";
}

function findCompanyNameIn(item: HTMLElement): { name: string; source: string } {
  // 策略 1:class 选择器
  for (const sel of COMPANY_CLASS_SELECTORS) {
    const el = item.querySelector(sel);
    const text = el?.textContent?.trim() || "";
    if (text && text.length >= 2 && text.length <= 40) {
      return { name: text, source: `class:${sel}` };
    }
  }
  // 策略 2:Vue 反射
  const vueName = extractFromVue(item);
  if (vueName) return { name: vueName, source: "vue" };
  // 策略 3:位置启发式
  const posName = extractByPosition(item);
  if (posName) return { name: posName, source: "position" };
  return { name: "", source: "none" };
}

function findChatItems(): HTMLElement[] {
  const all: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();
  for (const sel of CHAT_ITEM_SELECTORS) {
    const found = document.querySelectorAll<HTMLElement>(sel);
    if (found.length > 0) {
      console.log(`[${APP_ID}] selector "${sel}" matched ${found.length} items`);
    }
    for (const el of found) {
      if (!seen.has(el)) {
        seen.add(el);
        all.push(el);
      }
    }
  }
  return all;
}

function injectQccLink(item: HTMLElement, companyName: string): void {
  if (item.querySelector(":scope > .aj-qcc-link")) return;

  // 让 item 成为定位上下文(原 CSS 是 static 的)
  const cs = window.getComputedStyle(item);
  if (cs.position === "static" || cs.position === "") {
    item.style.position = "relative";
  }
  item.classList.add("aj-qcc-host");

  const link = document.createElement("a");
  link.className = "aj-qcc-link";
  link.href = `${QCC_SEARCH_URL}${encodeURIComponent(companyName)}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "🔍 查企";
  link.title = `在企查查搜索:${companyName}`;
  link.style.cssText = [
    "position:absolute",
    "right:8px",
    "top:50%",
    "transform:translateY(-50%) translateX(6px)",
    "display:inline-flex",
    "align-items:center",
    "gap:3px",
    "padding:3px 9px",
    "font-size:11px",
    "font-weight:600",
    "line-height:1",
    "color:#c56544",
    "background:#fbeee6",
    "border:1px solid #f4d9c5",
    "border-radius:10px",
    "text-decoration:none",
    "white-space:nowrap",
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    "box-shadow:0 1px 3px rgba(0,0,0,.06)",
  ].join(";");

  item.appendChild(link);
}

let injectedCount = 0;

function runOnce(): { added: number; failed: number } {
  const items = findChatItems();
  let added = 0;
  let failed = 0;
  for (const item of items) {
    if (item.querySelector(":scope > .aj-qcc-link")) continue; // 已有
    const { name, source } = findCompanyNameIn(item);
    if (!name) {
      failed += 1;
      continue;
    }
    injectQccLink(item, name);
    added += 1;
    console.log(`[${APP_ID}] 注入 → "${name}" (via ${source})`);
  }
  injectedCount += added;
  return { added, failed };
}

export function startChatPage(): void {
  console.log(`[${APP_ID}] chat page 启动,准备注入查企链接...`);
  const r = runOnce();
  console.log(
    `[${APP_ID}] chat 首次扫描:候选 ${r.added + r.failed} 条,成功 ${r.added},失败 ${r.failed}`,
  );

  let pending: number | null = null;
  const observer = new MutationObserver(() => {
    if (pending !== null) window.clearTimeout(pending);
    pending = window.setTimeout(() => {
      const r = runOnce();
      if (r.added > 0) {
        console.log(`[${APP_ID}] 新注入 ${r.added} 条查企链接`);
      }
    }, 300);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}