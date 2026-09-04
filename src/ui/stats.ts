// ============================================================
// ui/stats.ts - 统计 Tab 内容渲染
// ============================================================

import { computeStats } from "../stats";
import { AllHistory } from "../types";
import { htmlEscape } from "../dom";

/** 饼图分类对应颜色(暖色调,跟主题一致) */
const PIE_COLORS = ["#d97757", "#5b8db8", "#c08a45", "#6a9b71", "#8b7bab", "#cc5a4a", "#bfbab3"];

export function renderStatsTab(history: AllHistory, disabled = false): string {
  const { summary, companies, salaries, reasons } = computeStats(history);
  const daysCovered = history.days.filter((d) => d.records.length > 0).length;

  if (summary.totalRecords === 0) {
    return `
      <div class="aj-empty">
        <div class="aj-empty-icon">📊</div>
        <div class="aj-empty-title">还没有数据</div>
        <div class="aj-empty-hint">点击"开始"运行一次后,这里会显示投递统计</div>
      </div>
    `;
  }

  return `
    <!-- 工具栏 -->
    <div class="aj-stats-toolbar">
      <span class="aj-stats-meta">累计 ${summary.totalRecords} 条 · 覆盖 ${daysCovered} 天</span>
      <button class="aj-btn aj-btn-ghost aj-btn-sm" data-action="clear-stats" ${disabled ? "disabled" : ""} title="清除所有统计记录 + 重置内存计数;不影响各日已投递计数">重置统计</button>
    </div>

    <!-- 概况 -->
    <div class="aj-stats-summary">
      <div class="aj-stat-tile aj-stat-tile--applied">
        <b>${summary.totalApplied}</b><span>投递</span>
      </div>
      <div class="aj-stat-tile aj-stat-tile--skipped">
        <b>${summary.totalSkipped}</b><span>跳过</span>
      </div>
      <div class="aj-stat-tile aj-stat-tile--failed">
        <b>${summary.totalFailed}</b><span>失败</span>
      </div>
      ${
        summary.dryRunRecords > 0
          ? `<div class="aj-stat-tile aj-stat-tile--dry">
        <b>${summary.dryRunRecords}</b><span>预演</span>
      </div>`
          : ""
      }
    </div>

    <!-- 公司 TOP -->
    <div class="aj-chart-section">
      <div class="aj-chart-title">投递公司 TOP 6</div>
      ${renderCompanies(companies)}
    </div>

    <!-- 薪资分布 -->
    <div class="aj-chart-section">
      <div class="aj-chart-title">薪资分布(已投递)</div>
      ${renderSalaryHistogram(salaries)}
    </div>

    <!-- 跳过原因 -->
    <div class="aj-chart-section">
      <div class="aj-chart-title">跳过原因</div>
      ${renderReasonPie(reasons)}
    </div>
  `;
}

function renderCompanies(companies: Array<{ name: string; count: number }>): string {
  if (companies.length === 0) {
    return '<div class="aj-chart-empty">暂无投递记录</div>';
  }
  const max = Math.max(...companies.map((c) => c.count));
  return companies
    .map(
      (c) => `
        <div class="aj-bar-row">
          <div class="aj-bar-label" title="${htmlEscape(c.name)}">${htmlEscape(c.name)}</div>
          <div class="aj-bar-track">
            <div class="aj-bar-fill" style="width: ${(c.count / max) * 100}%"></div>
          </div>
          <div class="aj-bar-count">${c.count}</div>
        </div>
      `,
    )
    .join("");
}

function renderSalaryHistogram(
  buckets: Array<{ label: string; count: number }>,
): string {
  const max = Math.max(...buckets.map((b) => b.count));
  if (max === 0) {
    return '<div class="aj-chart-empty">暂无数据</div>';
  }
  return `
    <div class="aj-histogram">
      ${buckets
        .map(
          (b) => `
        <div class="aj-hist-col">
          <div class="aj-hist-value">${b.count}</div>
          <div class="aj-hist-bar-track">
            <div class="aj-hist-bar-fill" style="height: ${(b.count / max) * 100}%"></div>
          </div>
          <div class="aj-hist-label">${b.label}</div>
        </div>
      `,
        )
        .join("")}
    </div>
  `;
}

function renderReasonPie(reasons: Array<{ category: string; count: number; examples: string[] }>): string {
  if (reasons.length === 0) {
    return '<div class="aj-chart-empty">暂无跳过记录</div>';
  }
  const total = reasons.reduce((sum, r) => sum + r.count, 0);
  if (total === 0) return '<div class="aj-chart-empty">暂无跳过记录</div>';

  // 用 conic-gradient 构造饼图
  let cursor = 0;
  const segments = reasons
    .map((r, i) => {
      const pct = (r.count / total) * 100;
      const start = cursor;
      cursor += pct;
      return `${PIE_COLORS[i % PIE_COLORS.length]} ${start.toFixed(1)}% ${cursor.toFixed(1)}%`;
    })
    .join(", ");

  const legend = reasons
    .map(
      (r, i) => `
        <div class="aj-pie-legend-item" title="${htmlEscape(r.examples.join(" / "))}">
          <span class="aj-pie-swatch" style="background:${PIE_COLORS[i % PIE_COLORS.length]}"></span>
          <span class="aj-pie-name">${htmlEscape(r.category)}</span>
          <span class="aj-pie-pct">${r.count} (${((r.count / total) * 100).toFixed(0)}%)</span>
        </div>
      `,
    )
    .join("");

  return `
    <div class="aj-pie-wrap">
      <div class="aj-pie" style="background: conic-gradient(${segments})"></div>
      <div class="aj-pie-legend">${legend}</div>
    </div>
  `;
}