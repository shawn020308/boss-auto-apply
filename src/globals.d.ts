// ============================================================
// globals.d.ts - 声明 Tampermonkey/Violentmonkey API
// ============================================================

declare function GM_getValue(key: string, defaultValue?: string): string;
declare function GM_setValue(key: string, value: string): void;
declare function GM_addStyle(css: string): void;
declare function GM_registerMenuCommand(
  name: string,
  callback: () => void,
): void;
declare function GM_notification(options: {
  title?: string;
  text?: string;
  timeout?: number;
}): void;
