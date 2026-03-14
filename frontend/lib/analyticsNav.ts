export type AnalyticsSectionKey = "dashboard" | "signals" | "blueprint" | "northstar";

export type AnalyticsSectionDef = {
  key: AnalyticsSectionKey;
  href: string;
  navLabelZh: string;
  navLabelEn: string;
  titleZh: string;
  summaryZh: string;
  bulletsZh: string[];
};

export const ANALYTICS_SECTIONS: AnalyticsSectionDef[] = [
  {
    key: "dashboard",
    href: "/analytics#analytics-dashboard",
    navLabelZh: "实时看板",
    navLabelEn: "Dashboard",
    titleZh: "实时看板",
    summaryZh: "基于真实事件聚合，优先看结果到达、结果动作、utility 回流与排障上下文。",
    bulletsZh: ["Overview", "Funnel", "Experience", "Stage Errors", "Session Explorer"],
  },
  {
    key: "signals",
    href: "/analytics#live-signals",
    navLabelZh: "信号地图",
    navLabelEn: "Signals",
    titleZh: "信号地图",
    summaryZh: "把当前已接事件、可回答问题和数据基座放到一屏，先确认可观测边界。",
    bulletsZh: ["现有能力", "可回答问题", "数据基座", "后置信号"],
  },
  {
    key: "blueprint",
    href: "/analytics#v1-panels",
    navLabelZh: "结构蓝图",
    navLabelEn: "Blueprint",
    titleZh: "结构蓝图",
    summaryZh: "按使用动作拆解首版分析台的功能块和实施节奏。",
    bulletsZh: ["面板结构", "使用路径", "建设阶段", "功能分块"],
  },
  {
    key: "northstar",
    href: "/analytics#final-state",
    navLabelZh: "完全体",
    navLabelEn: "North Star",
    titleZh: "完全体",
    summaryZh: "明确分析台最终形态，保持增长、体验、质量一体化闭环。",
    bulletsZh: ["Command Center", "Reliability Atlas", "Quality Loop", "North Star"],
  },
];
