// ============================================================
// route.ts - SPA 路由监听
// ============================================================

import { isBossJobPage } from "./dom";

export function installRouteWatcher(onEnterJobPage: () => void): void {
  const rerender = (): void => {
    window.setTimeout(() => {
      if (isBossJobPage()) onEnterJobPage();
    }, 500);
  };

  const rawPushState = history.pushState.bind(history);
  history.pushState = function patchedPushState(...args: Parameters<typeof rawPushState>) {
    const result = rawPushState(...args);
    rerender();
    return result;
  };

  const rawReplaceState = history.replaceState.bind(history);
  history.replaceState = function patchedReplaceState(...args: Parameters<typeof rawReplaceState>) {
    const result = rawReplaceState(...args);
    rerender();
    return result;
  };

  window.addEventListener("popstate", rerender);
}
