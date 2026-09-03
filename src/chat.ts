// ============================================================
// chat.ts - Boss 沟通页面增强:在每条 chat 旁注入"查企"链接
//
// 工作流程:
//   1. 扫描聊天列表里的每一条对话,提取公司名
//   2. 在每个 chat item 末尾插入一个 "查企" 链接
//   3. 点击在新标签页打开 https://www.qcc.com/web/search?key={公司名}
//   4. MutationObserver 监听列表变化(加载更多、滚动加载)持续注入
//
// 由于 Boss 的聊天 DOM 结构我没法在写代码时直接看到,这里用一组兜底
// 选择器 + 文本启发式来提取公司名。如果首次启动 console 报告"找到 0 条",
// 用户可以打开 DevTools 检查 chat item 的真实 class 并加进 selectors 列表。
// ============================================================

import { APP_ID } from "./types";

const QCC_SEARCH_URL = "https://www.qcc.com/web/search?key=";

/** 聊天项容器候选选择器(从最可能到最宽松) */
const CHAT_ITEM_SELECTORS = [
  ".chat-item",
  ".conversation-item",
  ".chat-conversation",
  ".chat-list-item",
  ".list-item",
  '[class*="chat"][class*="item"]',
  '[class*="conversation"][class*="item"]',
  '[class*="Chat"][class*="Item"]',
];

/** 公司名所在元素候选选择器 */
const COMPANY_NAME_SELECTORS = [
  ".company-name",
  ".brand-name",
  ".recruiter-company",
  ".company",
  ".brand",
  '[class*="company-name"]',
  '[class*="brand-name"]',
  '[class*="companyName"]',
  '[class*="brandName"]',
  '[class*="company"]',
  '[class*="brand"]',
];

/** 标签内部 anchor/div,排除"立即沟通"按钮等带 class=action 的元素 */
function findCompanyNameIn(item: HTMLElement): string {
  for (const sel of COMPANY_NAME_SELECTORS) {
    const el = item.querySelector(sel);
    const text = el?.textContent?.trim() || "";
    // 排除过短或太通用的字符串
    if (text && text.length >= 2 && text.length <= 40) return text;
  }
  return "";
}

function findChatItems(): HTMLElement[] {
  const all: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();
  for (const sel of CHAT_ITEM_SELECTORS) {
    document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
      if (!seen.has(el)) {
        seen.add(el);
        all.push(el);
      }
    });
  }
  return all;
}

function injectQccLink(item: HTMLElement, companyName: string): void {
  if (item.querySelector(":scope > .aj-qcc-link")) return;
  const link = document.createElement("a");
  link.className = "aj-qcc-link";
  link.href = `${QCC_SEARCH_URL}${encodeURIComponent(companyName)}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "查企";
  link.title = `在企查查搜索:${companyName}`;
  // 内联 fallback 样式 —— 即便 styles.ts 加载失败也能看见
  link.style.cssText =
    "display:inline-block;margin-left:6px;padding:1px 7px;font-size:10.5px;" +
    "color:#c56544;background:#fbeee6;border:1px solid #f4d9c5;" +
    "border-radius:8px;text-decoration:none;transition:all .15s ease;" +
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;" +
    "vertical-align:middle;line-height:1.4;";
  item.appendChild(link);
}

let injectedCount = 0;

function runOnce(): number {
  const items = findChatItems();
  let added = 0;
  for (const item of items) {
    const name = findCompanyNameIn(item);
    if (!name) continue;
    injectQccLink(item, name);
    added += 1;
  }
  injectedCount += added;
  return added;
}

export function startChatPage(): void {
  // 首次扫描
  const added = runOnce();
  console.log(
    `[${APP_ID}] chat 页面:找到 ${added} 条聊天,已注入查企链接(总计 ${injectedCount})`,
  );

  // 监听列表 DOM 变化(滚动加载、点开新对话等)
  let pending: number | null = null;
  const observer = new MutationObserver(() => {
    if (pending !== null) window.clearTimeout(pending);
    pending = window.setTimeout(() => {
      const n = runOnce();
      if (n > 0) {
        console.log(`[${APP_ID}] 新注入 ${n} 条查企链接`);
      }
    }, 250);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}