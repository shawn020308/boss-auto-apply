// ============================================================
// types.ts - 全局类型定义 + 默认配置
// ============================================================

export const APP_ID = "boss-auto-apply-lite";
export const VERSION = "0.2.0";

/** 用户可调配置 */
export interface FilterConfig {
  /** 自动翻页 / 滚动加载更多 */
  autoNextPage: boolean;
  /** 是否请求岗位详情(用于活跃度 / 关键词过滤) */
  fetchDetail: boolean;
  /** 调试日志(控制台 + 面板) */
  debug: boolean;
  /** 跳过今日已投过的职位 */
  skipAppliedHistory: boolean;
  /** 过滤猎头岗位 */
  skipHeadhunter: boolean;
  /** 仅投递在线 BOSS */
  onlyOnlineBoss: boolean;
  /** 把"开聊提醒"二级弹窗视为投递成功 */
  treatChatRemindAsSuccess: boolean;
  /** 单次任务最大投递数(防止失控) */
  maxApplyCount: number;
  /** 每日投递上限 */
  dailyLimit: number;
  /** 投递间隔随机下限(秒) */
  delayMinSec: number;
  /** 投递间隔随机上限(秒) */
  delayMaxSec: number;
  /** 翻页/滚动后等待秒数 */
  pageDelaySec: number;
  /** 长尾暂停概率(0~1),0 = 关闭 */
  longPauseChance: number;
  /** 长尾暂停下限(秒) */
  longPauseMinSec: number;
  /** 长尾暂停上限(秒) */
  longPauseMaxSec: number;
  /** BOSS 活跃天数阈值(超过则跳过) */
  activeWithinDays: number;
  /** 岗位详情包含关键词(逗号/换行/分号分隔) */
  includeDescriptionKeywords: string;
  /** 岗位详情排除关键词 */
  excludeDescriptionKeywords: string;
  /** 薪资下限(K),0 = 不限 */
  salaryMinK: number;
  /** 薪资上限(K),0 = 不限 */
  salaryMaxK: number;
  /** 整体 UI 缩放系数(0.7 ~ 1.5),通过 zoom CSS 应用到面板根节点 */
  fontScale: number;
  /** 预演模式:只扫描+过滤,不实际调用投递接口 */
  dryRun: boolean;
}

export const DEFAULT_CONFIG: FilterConfig = {
  autoNextPage: true,
  fetchDetail: true,
  debug: false,
  skipAppliedHistory: true,
  skipHeadhunter: true,
  onlyOnlineBoss: false,
  treatChatRemindAsSuccess: true,
  maxApplyCount: 9999,
  dailyLimit: 150,
  delayMinSec: 4,
  delayMaxSec: 10,
  pageDelaySec: 3,
  longPauseChance: 0.15,
  longPauseMinSec: 12,
  longPauseMaxSec: 25,
  activeWithinDays: 14,
  includeDescriptionKeywords: "",
  excludeDescriptionKeywords: "",
  salaryMinK: 0,
  salaryMaxK: 0,
  fontScale: 1.0,
  dryRun: false,
};

/** 解析后的职位对象 */
export interface Job {
  index: number;
  card: HTMLElement;
  raw: Record<string, unknown>;
  rawText: string;
  securityId: string;
  encryptJobId: string;
  lid: string;
  encryptBossId: string;
  jobName: string;
  brandName: string;
  salaryDesc: string;
  cityName: string;
  areaDistrict: string;
  businessDistrict: string;
  brandScaleName: string;
  brandIndustry: string;
  jobLabels: string[];
  skills: string[];
  /** 列表上已显示"已沟通 / 继续沟通" */
  contact: boolean;
  bossOnline: boolean | undefined;
  goldHunter: unknown;
}

/** 详情接口返回的卡片数据 */
export interface JobDetail {
  activeTimeDesc?: string;
  postDescription?: string;
  address?: string;
  friendStatus?: number | string;
  [key: string]: unknown;
}

/** 运行期状态 */
export interface AppState {
  running: boolean;
  stopping: boolean;
  collapsed: boolean;
  scanned: number;
  matched: number;
  applied: number;
  skipped: number;
  failed: number;
  platformRemainingQuota: number | null;
  current: string;
  logs: LogEntry[];
  processedKeys: Set<string>;
  /** 镜像自 config.dailyLimit,用于面板副标题展示 */
  dailyLimit: number;
  /** 镜像自 config.debug,影响日志输出 */
  debug: boolean;
  /** 镜像自 config.dryRun,影响面板副标题 */
  dryRun: boolean;
  /** 当前激活的 Tab */
  activeTab: "run" | "stats";
}

export interface LogEntry {
  time: string;
  level: "info" | "warn" | "error" | "debug" | "success";
  message: string;
  data?: unknown;
}

/** 单次投递/跳过记录(用于统计 Tab) */
export interface JobRecord {
  /** 职位唯一键(用于去重 / appliedKeys 同步) */
  key: string;
  jobName: string;
  brandName: string;
  salaryDesc: string;
  timestamp: number;
  outcome: "applied" | "skipped" | "limited" | "failed";
  /** 仅 outcome=skipped 时有值 */
  skipReason?: string;
  /** 预演模式下产生的记录,不计入日上限 */
  dryRun: boolean;
}

/** 当天投递历史(供统计 + 去重使用) */
export interface DayHistory {
  date: string;
  dailyCount: number;
  appliedKeys: string[];
  records: JobRecord[];
}

/** 选择器常量(用于从 DOM 抽取职位卡片) */
export const SELECTORS = {
  jobCards: [
    ".job-card-wrapper",
    ".job-card-wrap",
    ".job-card-box",
    ".job-list-box .job-card-body",
    ".rec-job-list .job-card-wrapper",
  ],
  scrollContainers: [
    ".job-list-container",
    ".job-list",
    ".recommend-job-list",
    ".job-recommend-result",
    ".recommend-result-inner",
    ".page-job-inner",
  ],
  nextIcon: ".ui-icon-arrow-right",
} as const;
