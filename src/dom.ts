// ============================================================
// dom.ts - 通用工具:文本处理、选择器、Vue 反射取值
// ============================================================

import { SELECTORS } from "./types";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function randomBetween(min: number, max: number): number {
  if (max <= min) return min;
  return min + Math.random() * (max - min);
}

export function isBossJobPage(): boolean {
  return /https:\/\/www\.zhipin\.com\/web\/geek\/(job|jobs|job-recommend|overseas)/.test(
    location.href,
  );
}

export function isBossChatPage(): boolean {
  return /https:\/\/www\.zhipin\.com\/web\/geek\/chat/.test(location.href);
}

export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/** "Vue,React;外包\nJava" → ["vue", "react", "外包", "java"] */
export function splitKeywords(value: string): string[] {
  return String(value || "")
    .split(/[，,\n;]/)
    .map((item) => normalizeText(item).toLowerCase())
    .filter(Boolean);
}

export function textHasAny(text: string, keywords: string[]): boolean {
  const normalized = normalizeText(text).toLowerCase();
  return keywords.some((kw) => normalized.includes(kw));
}

export function textHasInclude(text: string, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  return textHasAny(text, keywords);
}

export function htmlEscape(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Vue 组件实例的内部字段(运行时反射) */
interface VueInstance {
  __vue__?: unknown;
  __vue_app__?: unknown;
  __vueParentComponent?: unknown;
  _vnode?: unknown;
}

function asVue(node: HTMLElement): VueInstance {
  return node as unknown as VueInstance;
}

/** 去重职位卡片:同一 DOM 节点多次命中的处理 */
export function getJobCardElements(): HTMLElement[] {
  const rawElements: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();
  for (const selector of SELECTORS.jobCards) {
    for (const item of document.querySelectorAll<HTMLElement>(selector)) {
      if (!seen.has(item)) {
        seen.add(item);
        rawElements.push(item);
      }
    }
  }

  const result: HTMLElement[] = [];
  for (const item of rawElements) {
    const isDescendant = rawElements.some(
      (other) => other !== item && other.contains(item),
    );
    if (!isDescendant) result.push(item);
  }
  return result;
}

/** BFS 在 Vue 组件实例里找带有投递所需字段的对象 */
export function pickJobData(card: HTMLElement): Record<string, unknown> | null {
  const candidates: unknown[] = [];
  const vue = asVue(card);

  const directKeys: (keyof VueInstance)[] = [
    "__vue__",
    "__vue_app__",
    "__vueParentComponent",
    "_vnode",
  ];
  for (const key of directKeys) {
    const value = vue[key];
    if (value) candidates.push(value);
  }

  const vueInstance = vue.__vue__ as
    | { data?: unknown; _data?: unknown; _props?: unknown; $props?: unknown }
    | undefined;
  if (vueInstance) {
    candidates.push(
      vueInstance.data,
      vueInstance._data,
      vueInstance._props,
      vueInstance.$props,
    );
  }
  const parentComponent = vue.__vueParentComponent as
    | {
        props?: unknown;
        ctx?: unknown;
        setupState?: unknown;
        proxy?: unknown;
      }
    | undefined;
  if (parentComponent) {
    candidates.push(
      parentComponent.props,
      parentComponent.ctx,
      parentComponent.setupState,
      parentComponent.proxy,
    );
  }

  return findJobLikeObject(candidates);
}

function findJobLikeObject(seedList: unknown[]): Record<string, unknown> | null {
  const queue = seedList
    .filter(Boolean)
    .map((value) => ({ value: value as object, depth: 0 }));
  const seen = new WeakSet<object>();

  while (queue.length) {
    const { value, depth } = queue.shift()!;
    if (!value || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);

    if (looksLikeJobData(value)) return value as Record<string, unknown>;
    if (depth >= 4) continue;

    const values = Object.values(value as Record<string, unknown>).slice(0, 80);
    for (const child of values) {
      if (child && typeof child === "object") {
        queue.push({ value: child as object, depth: depth + 1 });
      }
    }
  }
  return null;
}

function looksLikeJobData(obj: unknown): boolean {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  const hasApplyFields = Boolean(
    (o.securityId || o.securityID) && (o.encryptJobId || o.jobId) && o.lid,
  );
  const hasJobText = Boolean(
    o.jobName || o.jobTitle || o.title || o.brandName || o.companyName,
  );
  return hasApplyFields || (hasJobText && Boolean(o.securityId || o.lid));
}

export function pickDomText(root: Element, selectors: string[]): string {
  for (const selector of selectors) {
    const element = root.querySelector(selector);
    const text = normalizeText(element?.textContent ?? "");
    if (text) return text;
  }
  return "";
}

export function pickFirstString(obj: unknown, keys: string[]): string {
  for (const key of keys) {
    const value = getDeepValue(obj, key);
    if (value !== undefined && value !== null && String(value).trim() !== "")
      return String(value).trim();
  }
  return "";
}

export function pickBoolean(obj: unknown, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = getDeepValue(obj, key);
    if (typeof value === "boolean") return value;
    if (value === 0 || value === 1) return Boolean(value);
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return undefined;
}

export function getDeepValue(obj: unknown, wantedKey: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, wantedKey))
    return (obj as Record<string, unknown>)[wantedKey];

  const queue: unknown[] = [obj];
  const seen = new WeakSet<object>();
  let guard = 0;
  while (queue.length && guard < 120) {
    guard += 1;
    const current = queue.shift();
    if (!current || typeof current !== "object" || seen.has(current as object)) continue;
    seen.add(current as object);
    if (Object.prototype.hasOwnProperty.call(current, wantedKey))
      return (current as Record<string, unknown>)[wantedKey];
    const values = Object.values(current as Record<string, unknown>).slice(0, 40);
    for (const v of values) {
      if (v && typeof v === "object") queue.push(v);
    }
  }
  return undefined;
}
