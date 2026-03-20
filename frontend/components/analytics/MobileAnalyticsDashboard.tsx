"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  fetchMobileAnalyticsErrors,
  fetchMobileAnalyticsExperience,
  fetchMobileAnalyticsFeedback,
  fetchMobileAnalyticsFunnel,
  fetchMobileAnalyticsOverview,
  fetchMobileAnalyticsSessions,
  type MobileAnalyticsCountItem,
  type MobileAnalyticsErrors,
  type MobileAnalyticsExperience,
  type MobileAnalyticsFeedback,
  type MobileAnalyticsFunnel,
  type MobileAnalyticsOverview,
  type MobileAnalyticsQuery,
  type MobileAnalyticsRageClickTargetItem,
  type MobileAnalyticsSessionEventItem,
  type MobileAnalyticsSessions,
} from "@/lib/api";
import { CATEGORY_CONFIG } from "@/lib/catalog";

type ResourceState<T> = {
  loading: boolean;
  data: T | null;
  error: string | null;
};

type SessionTimelinePhase = "entry" | "action" | "analysis" | "result" | "feedback" | "exit" | "issue";

type SessionTimelineNarrative = {
  eventName: string;
  phase: SessionTimelinePhase;
  title: string;
  flowLabel: string;
  summary: string | null;
  significant: boolean;
  meta: string[];
  rawMeta: string[];
};

type SessionTimelineGroup = {
  key: string;
  phase: SessionTimelinePhase;
  items: Array<SessionTimelineNarrative & { stepNumber: number }>;
};

type SessionTimelinePresentation = {
  headline: string;
  summary: string;
  heroPhase: SessionTimelinePhase;
  flowSteps: string[];
  groups: SessionTimelineGroup[];
};

const TIME_WINDOWS = [
  { label: "24h", value: 24 },
  { label: "7d", value: 24 * 7 },
  { label: "30d", value: 24 * 30 },
] as const;

const CATEGORY_OPTIONS = [
  { value: "all", label: "全部品类" },
  { value: "shampoo", label: CATEGORY_CONFIG.shampoo.zh },
  { value: "bodywash", label: CATEGORY_CONFIG.bodywash.zh },
  { value: "conditioner", label: CATEGORY_CONFIG.conditioner.zh },
  { value: "lotion", label: CATEGORY_CONFIG.lotion.zh },
  { value: "cleanser", label: CATEGORY_CONFIG.cleanser.zh },
] as const;

const LOCATION_PRESENCE_OPTIONS = [
  { value: "all", label: "全部位置" },
  { value: "with_location", label: "仅已识别位置" },
  { value: "without_location", label: "仅位置缺省" },
] as const;

const ANALYTICS_STAGE_LABELS: Record<string, string> = {
  uploading: "上传当前在用产品",
  prepare: "准备对比任务",
  resolve_targets: "读取待对比产品",
  resolve_target: "整理产品信息",
  stage1_vision: "识别图片文字",
  stage2_struct: "结构化成分信息",
  pair_compare: "生成两两分析",
  finalize: "整理最终结论",
  done: "对比完成",
};

const FEEDBACK_TRIGGER_LABELS: Record<string, string> = {
  compare_upload_fail: "上传失败",
  compare_stage_error: "分析阶段报错",
  compare_restore_failed: "恢复历史任务失败",
};

const FEEDBACK_REASON_LABELS: Record<string, string> = {
  upload_problem: "上传有问题",
  dont_know_what_to_upload: "不确定拍什么",
  too_much_work: "太麻烦",
  leave_for_now: "先不做了",
  hard_to_understand: "看不懂",
  too_slow: "太慢了",
  not_confident: "不信结果",
  restore_unclear: "恢复逻辑不清楚",
};

function createResourceState<T>(data: T | null = null): ResourceState<T> {
  return {
    loading: data == null,
    data,
    error: null,
  };
}

function formatError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function formatNumber(value?: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("zh-CN").format(Math.round(value));
}

function formatPercent(value?: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

function formatDateTime(value?: string | null): string {
  const text = String(value || "").trim();
  if (!text) return "-";
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function formatDurationSeconds(value?: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  if (value < 60) return `${value.toFixed(1)}s`;
  return `${(value / 60).toFixed(1)}m`;
}

function formatDurationMs(value?: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  if (value < 1000) return `${Math.round(value)}ms`;
  return formatDurationSeconds(value / 1000);
}

function categoryLabel(category?: string | null): string {
  if (!category) return "全部品类";
  const config = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG];
  return config?.zh || category;
}

function pageLabel(page?: string | null): string {
  switch (valueOrEmpty(page)) {
    case "wiki_list":
      return "百科列表";
    case "compare_result":
      return "对比结果";
    case "selection_result":
      return "测配结果";
    case "mobile_compare":
      return "横向对比";
    case "mobile_compare_library":
      return "对比库";
    case "my_use":
      return "我的在用";
    case "wiki_product_detail":
      return "产品百科详情";
    case "wiki_category":
      return "品类百科";
    case "product_showcase":
      return "产品详情页";
    default:
      return valueOrEmpty(page) || "unknown";
  }
}

function resultCtaLabel(value?: string | null): string {
  switch (valueOrEmpty(value)) {
    case "bag_add":
      return "加入购物袋";
    case "compare":
      return "和我现在在用的比一下";
    case "rationale":
      return "看为什么推荐这款";
    case "retry_same_category":
      return "重测这类";
    case "switch_category":
      return "测其他品类";
    case "reason_gallery_anchor":
      return "看原因";
    case "rerun_compare":
      return "再做一次对比";
    case "open_full_card":
      return "展开建议卡";
    case "recommendation_product":
      return "查看推荐产品";
    case "recommendation_wiki":
      return "查看成分百科";
    default:
      return valueOrEmpty(value) || "unknown";
  }
}

function loopActionLabel(value?: string | null): string {
  switch (valueOrEmpty(value)) {
    case "rationale":
      return "看为什么推荐这款";
    case "retry_same_category":
      return "重测这类";
    case "switch_category":
      return "测其他品类";
    case "wiki":
      return "进入百科";
    case "compare":
      return "进入对比";
    case "me":
      return "进入我的";
    case "bag":
      return "进入购物袋";
    case "bag_add":
      return "加入购物袋";
    case "new_test":
      return "测新的";
    case "review_result":
      return "回看上次结果";
    case "resume":
      return "继续上次进度";
    case "in_use_compare":
      return "和当前在用做对比";
    case "compare_return":
      return "从对比返回测配结果";
    case "compare_library_return":
      return "从对比库返回测配结果";
    case "wiki_return":
      return "从百科返回测配结果";
    default:
      return valueOrEmpty(value) || "unknown";
  }
}

function normalizedResultLoopActionKey(item: Pick<MobileAnalyticsSessionEventItem, "name" | "action" | "result_cta">): string | null {
  const eventName = valueOrEmpty(item.name);
  const actionKey = valueOrEmpty(item.action);
  const resultCta = valueOrEmpty(item.result_cta);
  if (eventName === "result_rationale_entry_click") return "rationale";
  if (eventName === "result_secondary_loop_click" && resultCta === "rationale" && (!actionKey || actionKey === "wiki")) {
    return "rationale";
  }
  return actionKey || null;
}

function rageTargetLabel(item: MobileAnalyticsRageClickTargetItem): string {
  const raw = valueOrEmpty(item.target_id) || "unknown";
  if (raw.startsWith("result:cta:")) {
    return `对比结果 · ${raw.replace("result:cta:", "")}`;
  }
  if (raw.startsWith("wiki:")) {
    return `百科 · ${raw.replace("wiki:", "")}`;
  }
  return `${pageLabel(item.page)} · ${raw}`;
}

function valueOrEmpty(value?: string | null): string {
  return String(value || "").trim();
}

function outcomeLabel(value?: string | null): string {
  switch (value) {
    case "result_viewed":
      return "已看到结果";
    case "feedback_submitted":
      return "失败后留了反馈";
    case "compare_failed":
      return "对比失败";
    case "compare_completed":
      return "对比成功";
    case "cta_engaged":
      return "点击了 CTA";
    default:
      return "浏览中";
  }
}

function toneForOutcome(value?: string | null): string {
  switch (value) {
    case "result_viewed":
      return "border-[#c9e6d7] bg-[#eff8f2] text-[#1f6a4e]";
    case "compare_failed":
      return "border-[#eed1cd] bg-[#fff1ef] text-[#9b3d32]";
    case "feedback_submitted":
      return "border-[#d7d4f0] bg-[#f3f1ff] text-[#5c4ea0]";
    default:
      return "border-black/10 bg-[#f4f5f8] text-black/60";
  }
}

function stageLabel(value?: string | null): string {
  const key = valueOrEmpty(value);
  return ANALYTICS_STAGE_LABELS[key] || key || "未知阶段";
}

function feedbackTriggerLabel(value?: string | null): string {
  const key = valueOrEmpty(value);
  return FEEDBACK_TRIGGER_LABELS[key] || key || "未标注触发原因";
}

function feedbackReasonLabel(value?: string | null): string {
  const key = valueOrEmpty(value);
  return FEEDBACK_REASON_LABELS[key] || key || "未标注原因";
}

function compactText(value: string, maxLength = 88): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function buildLocationBadgeLabel(locationLabel?: string | null, timeZone?: string | null): string {
  const label = valueOrEmpty(locationLabel);
  if (label) return compactText(label, 42);
  const tz = valueOrEmpty(timeZone);
  if (tz) return `时区 ${tz}`;
  return "位置缺省";
}

function hasLocationContext(locationLabel?: string | null, timeZone?: string | null): boolean {
  return Boolean(valueOrEmpty(locationLabel) || valueOrEmpty(timeZone));
}

function formatCompareId(value?: string | null): string {
  const raw = valueOrEmpty(value);
  if (!raw) return "";
  if (raw.length <= 12) return raw;
  return `${raw.slice(0, 8)}…${raw.slice(-4)}`;
}

function pushUniqueLabel(target: string[], value?: string | null) {
  const text = valueOrEmpty(value);
  if (!text) return;
  if (!target.includes(text)) target.push(text);
}

function humanizeEventName(value?: string | null): string {
  const raw = valueOrEmpty(value);
  if (!raw) return "未命名事件";
  return raw.split("_").filter(Boolean).join(" ");
}

function inferPagePhase(page?: string | null): SessionTimelinePhase {
  switch (valueOrEmpty(page)) {
    case "compare_result":
    case "product_showcase":
      return "result";
    case "mobile_compare":
      return "analysis";
    case "my_use":
    case "wiki_list":
    case "wiki_product_detail":
    case "wiki_category":
      return "entry";
    default:
      return "entry";
  }
}

function inferEventPhase(item: MobileAnalyticsSessionEventItem): SessionTimelinePhase {
  const name = valueOrEmpty(item.name);
  if (item.error_code || name.includes("error") || name.includes("fail")) return "issue";
  if (name.startsWith("feedback_")) return "feedback";
  if (name === "page_exit" || name.endsWith("_leave") || name.includes("reset_to_intro")) return "exit";
  if (
    name.includes("result") ||
    name.startsWith("profile_") ||
    name.startsWith("bag_") ||
    name.startsWith("product_showcase_")
  ) {
    return "result";
  }
  if (
    name.includes("run_") ||
    name.includes("stage_") ||
    name.startsWith("compare_")
  ) {
    return "analysis";
  }
  if (
    name.includes("click") ||
    name.includes("pick") ||
    name.includes("select") ||
    name.includes("upload")
  ) {
    return "action";
  }
  return inferPagePhase(item.page);
}

function buildIssueSummary(item: MobileAnalyticsSessionEventItem, detail: string): string {
  const fragments: string[] = [];
  if (item.stage) fragments.push(`卡在“${stageLabel(item.stage)}”`);
  if (item.error_code) fragments.push(`错误码 ${item.error_code}`);
  if (detail) fragments.push(compactText(detail, 72));
  return fragments.length > 0 ? fragments.join("；") : "本次操作没有继续成功。";
}

function describeTimelineEvent(item: MobileAnalyticsSessionEventItem): SessionTimelineNarrative {
  const eventName = valueOrEmpty(item.name);
  const page = pageLabel(item.page);
  const detail = valueOrEmpty(item.detail);
  const dwell = typeof item.dwell_ms === "number" ? formatDurationMs(item.dwell_ms) : "";
  const category = item.category ? categoryLabel(item.category) : "当前品类";
  const meta: string[] = [];
  const rawMeta: string[] = [];

  if (item.category) pushUniqueLabel(meta, categoryLabel(item.category));
  if (item.compare_id) pushUniqueLabel(meta, `compare ${formatCompareId(item.compare_id)}`);
  if (dwell) pushUniqueLabel(meta, `停留 ${dwell}`);
  if (item.stage) pushUniqueLabel(meta, stageLabel(item.stage));
  if (item.error_code) pushUniqueLabel(meta, `错误 ${item.error_code}`);
  if (item.reason_label) pushUniqueLabel(meta, `反馈 ${feedbackReasonLabel(item.reason_label)}`);
  if (item.trigger_reason) pushUniqueLabel(meta, `触发 ${feedbackTriggerLabel(item.trigger_reason)}`);
  if (item.result_cta) pushUniqueLabel(meta, `意图 ${resultCtaLabel(item.result_cta)}`);
  const normalizedActionKey = normalizedResultLoopActionKey(item);
  if (normalizedActionKey) pushUniqueLabel(meta, `动作 ${loopActionLabel(normalizedActionKey)}`);
  if (item.target_path) pushUniqueLabel(meta, `去向 ${item.target_path}`);
  if (hasLocationContext(item.location_label, item.location_time_zone)) {
    pushUniqueLabel(meta, buildLocationBadgeLabel(item.location_label, item.location_time_zone));
  }
  if (item.location_geocode_status === "failed") pushUniqueLabel(meta, "城市解析失败");
  if (item.location_geocode_status === "unconfigured") pushUniqueLabel(meta, "城市解析未配置");

  pushUniqueLabel(rawMeta, `event ${eventName || "unknown"}`);
  if (item.page) pushUniqueLabel(rawMeta, `page ${valueOrEmpty(item.page)}`);
  if (item.route) pushUniqueLabel(rawMeta, `route ${valueOrEmpty(item.route)}`);
  if (item.stage) pushUniqueLabel(rawMeta, `stage ${valueOrEmpty(item.stage)}`);
  if (item.error_code) pushUniqueLabel(rawMeta, `error ${item.error_code}`);
  if (item.result_cta) pushUniqueLabel(rawMeta, `result_cta ${valueOrEmpty(item.result_cta)}`);
  if (item.action) pushUniqueLabel(rawMeta, `action ${valueOrEmpty(item.action)}`);
  if (item.target_path) pushUniqueLabel(rawMeta, `target ${valueOrEmpty(item.target_path)}`);
  if (item.location_label) pushUniqueLabel(rawMeta, `location ${valueOrEmpty(item.location_label)}`);
  if (item.location_time_zone) pushUniqueLabel(rawMeta, `tz ${valueOrEmpty(item.location_time_zone)}`);
  if (item.location_geocode_status) pushUniqueLabel(rawMeta, `geocode ${valueOrEmpty(item.location_geocode_status)}`);
  if (item.location_geocode_error) pushUniqueLabel(rawMeta, `geo_error ${valueOrEmpty(item.location_geocode_error)}`);

  switch (eventName) {
    case "page_view": {
      const title = page === "结果页" ? "进入对比结果页" : `进入${page}页`;
      const summary =
        page === "横向对比"
          ? "用户已经进入核心对比链路。"
          : page === "产品百科详情"
            ? "用户正在查看具体商品的信息和分析入口。"
            : `这是一次新的页面浏览，当前停留在${page}。`;
      return {
        eventName,
        phase: inferPagePhase(item.page),
        title,
        flowLabel: title.replace("页", ""),
        summary,
        significant: true,
        meta,
        rawMeta,
      };
    }
    case "page_exit":
      return {
        eventName,
        phase: "exit",
        title: `离开${page}页`,
        flowLabel: `离开${page}`,
        summary: dwell ? `本页停留 ${dwell} 后离开。` : "本次浏览在这里结束。",
        significant: true,
        meta,
        rawMeta,
      };
    case "wiki_list_view":
      return {
        eventName,
        phase: "entry",
        title: "进入百科列表",
        flowLabel: "进入百科列表",
        summary: "用户正在浏览可进一步进入的百科内容。",
        significant: true,
        meta,
        rawMeta,
      };
    case "wiki_upload_cta_expose":
      return {
        eventName,
        phase: "entry",
        title: "看到“上传一键分析”入口",
        flowLabel: "看到上传入口",
        summary: "说明百科页已经把上传动作暴露给用户。",
        significant: true,
        meta,
        rawMeta,
      };
    case "wiki_upload_cta_click":
      return {
        eventName,
        phase: "action",
        title: "点击“上传一键分析”",
        flowLabel: "点击上传一键分析",
        summary: "用户从百科页进入上传 / 对比链路。",
        significant: true,
        meta,
        rawMeta,
      };
    case "wiki_category_ingredient_click":
      return {
        eventName,
        phase: "action",
        title: "点开成分词条",
        flowLabel: "点开成分词条",
        summary: "用户对更细的成分信息产生了兴趣。",
        significant: true,
        meta,
        rawMeta,
      };
    case "wiki_category_choose_click":
      return {
        eventName,
        phase: "action",
        title: `进入${category}挑选流程`,
        flowLabel: `进入${category}挑选`,
        summary: "用户从百科进一步进入该品类的选择动作。",
        significant: true,
        meta,
        rawMeta,
      };
    case "my_use_category_card_click":
      return {
        eventName,
        phase: "action",
        title: `在“我的在用”里选择了${category}`,
        flowLabel: `选择${category}`,
        summary: "用户准备进入这一品类的后续对比。",
        significant: true,
        meta,
        rawMeta,
      };
    case "compare_intro_start_clicked":
      return {
        eventName,
        phase: "action",
        title: "点击开始对比",
        flowLabel: "点击开始对比",
        summary: "用户明确愿意继续进入选品或上传步骤。",
        significant: true,
        meta,
        rawMeta,
      };
    case "compare_category_selected":
      return {
        eventName,
        phase: "action",
        title: `切换到${category}`,
        flowLabel: `切换到${category}`,
        summary: "当前会话的对比目标已经落在这个品类上。",
        significant: true,
        meta,
        rawMeta,
      };
    case "compare_entry_view":
      return {
        eventName,
        phase: "action",
        title: "进入 Compare 裁决入口",
        flowLabel: "进入 Compare",
        summary: "用户从结果链路进入 compare 裁决闭环。",
        significant: true,
        meta,
        rawMeta,
      };
    case "compare_library_pick":
      return {
        eventName,
        phase: "action",
        title: "从库内商品中做了选择",
        flowLabel: "选择库内商品",
        summary: "用户优先走现成商品对比，而不是上传图片。",
        significant: true,
        meta,
        rawMeta,
      };
    case "compare_upload_pick":
      return {
        eventName,
        phase: "action",
        title: "选择图片准备分析",
        flowLabel: "选择图片",
        summary: "用户开始走图片识别链路。",
        significant: true,
        meta,
        rawMeta,
      };
    case "compare_upload_start":
      return {
        eventName,
        phase: "analysis",
        title: "开始上传当前产品",
        flowLabel: "开始上传",
        summary: "compare 裁决流程已进入上传与识别准备阶段。",
        significant: true,
        meta,
        rawMeta,
      };
    case "compare_upload_success":
      return {
        eventName,
        phase: "analysis",
        title: "上传完成，准备识别内容",
        flowLabel: "上传完成",
        summary: "图片已经进入识别和结构化处理流程。",
        significant: true,
        meta,
        rawMeta,
      };
    case "location_context_captured":
      return {
        eventName,
        phase: "action",
        title: "记录用户近似位置",
        flowLabel: "允许位置授权",
        summary:
          (hasLocationContext(item.location_label, item.location_time_zone)
            ? `${buildLocationBadgeLabel(item.location_label, item.location_time_zone)}，后续分析与呈现都可以把它作为上下文。`
            : detail || "已记录近似位置，后续内容可以把它作为呈现依据之一。"),
        significant: true,
        meta,
        rawMeta,
      };
    case "compare_run_start":
      return {
        eventName,
        phase: "analysis",
        title: "正式发起对比分析",
        flowLabel: "发起对比分析",
        summary: "系统开始执行识别、结构化和两两比对。",
        significant: true,
        meta,
        rawMeta,
      };
    case "compare_stage_progress": {
      const label = stageLabel(item.stage);
      return {
        eventName,
        phase: "analysis",
        title: `分析推进到“${label}”`,
        flowLabel: `推进到${label}`,
        summary: detail || "对比链路正在向下一阶段推进。",
        significant: true,
        meta,
        rawMeta,
      };
    }
    case "compare_run_success":
      return {
        eventName,
        phase: "result",
        title: "对比分析完成",
        flowLabel: "分析完成",
        summary: "系统已经产出最终结论，等待用户查看结果。",
        significant: true,
        meta,
        rawMeta,
      };
    case "compare_result_view":
      return {
        eventName,
        phase: "result",
        title: "查看 Compare 结果",
        flowLabel: "查看 Compare 结果",
        summary: "用户已经到达 compare 裁决结果页；它是 compare closure 的 canonical 事件，但在第一屏 P0 里只作为 supporting context。",
        significant: true,
        meta,
        rawMeta,
      };
    case "compare_result_leave":
      return {
        eventName,
        phase: "exit",
        title: "离开对比结果页（兼容）",
        flowLabel: "离开结果页（兼容）",
        summary: dwell ? `兼容对比结果页停留 ${dwell} 后离开。` : "兼容上下文：用户看完对比结果后离开。",
        significant: true,
        meta,
        rawMeta,
      };
    case "compare_result_cta_click":
      return {
        eventName,
        phase: "result",
        title: "Compare 兼容 CTA 点击",
        flowLabel: "点击兼容 CTA",
        summary: "legacy compare_result_cta_click 桥接事件，仅用于兼容 compare closure 的派生口径。",
        significant: true,
        meta,
        rawMeta,
      };
    case "compare_result_cta_land":
      return {
        eventName,
        phase: "result",
        title: "Compare 兼容 CTA 落地",
        flowLabel: "兼容 CTA 落地",
        summary: "legacy compare_result_cta_land 桥接事件，仅用于兼容已有 compare 落地率面板。",
        significant: true,
        meta,
        rawMeta,
      };
    case "compare_result_accept_recommendation":
      return {
        eventName,
        phase: "result",
        title: "Compare 裁决：接受推荐",
        flowLabel: "接受推荐",
        summary: "用户在 compare 裁决后选择了推荐方案。",
        significant: true,
        meta,
        rawMeta,
      };
    case "compare_result_keep_current":
      return {
        eventName,
        phase: "result",
        title: "Compare 裁决：保留当前",
        flowLabel: "保留当前",
        summary: "用户在 compare 裁决后选择继续使用当前产品。",
        significant: true,
        meta,
        rawMeta,
      };
    case "compare_result_hold_current":
      return {
        eventName,
        phase: "result",
        title: "Compare：先保留当前方案",
        flowLabel: "先保留当前",
        summary: "用户暂不切换推荐品，先继续保留当前使用中的产品。",
        significant: true,
        meta,
        rawMeta,
      };
    case "compare_result_view_key_differences":
      return {
        eventName,
        phase: "result",
        title: "Compare：查看关键差异",
        flowLabel: "查看关键差异",
        summary: "用户还在消化两款产品差异，尚未直接收口。",
        significant: true,
        meta,
        rawMeta,
      };
    case "compare_result_open_rationale":
      return {
        eventName,
        phase: "result",
        title: "Compare：打开推荐依据",
        flowLabel: "打开推荐依据",
        summary:
          valueOrEmpty(item.target_path)
            ? `用户从 compare 结果继续查看推荐依据，目标 ${valueOrEmpty(item.target_path)}。`
            : "用户从 compare 结果进入 rationale，继续确认推荐理由。",
        significant: true,
        meta,
        rawMeta,
      };
    case "compare_result_retry_current_product":
      return {
        eventName,
        phase: "action",
        title: "Compare：换一个当前产品再比",
        flowLabel: "重试当前产品",
        summary: "用户没有直接收口，选择更换当前产品继续裁决。",
        significant: true,
        meta,
        rawMeta,
      };
    case "compare_result_switch_category_click":
      return {
        eventName,
        phase: "action",
        title: "Compare：切换到其他品类",
        flowLabel: "切换品类",
        summary: "用户从 compare 裁决切到新的决策任务。",
        significant: true,
        meta,
        rawMeta,
      };
    case "compare_result_accept_recommendation_land":
      return {
        eventName,
        phase: "result",
        title: "Compare：接受推荐并落地",
        flowLabel: "推荐方案落地",
        summary:
          valueOrEmpty(item.target_path)
            ? `推荐方案已经真正落到 ${valueOrEmpty(item.target_path)}。`
            : "用户接受推荐后，已经成功落到了后续目标页。",
        significant: true,
        meta,
        rawMeta,
      };
    case "compare_result_keep_current_land":
      return {
        eventName,
        phase: "result",
        title: "Compare：保留当前并回写",
        flowLabel: "保留当前并回写",
        summary:
          valueOrEmpty(item.target_path)
            ? `当前产品状态已经回写到 ${valueOrEmpty(item.target_path)}。`
            : "用户保留当前产品后，状态已经被成功回写。",
        significant: true,
        meta,
        rawMeta,
      };
    case "rationale_view":
      return {
        eventName,
        phase: "result",
        title: "进入推荐依据页",
        flowLabel: "进入推荐依据页",
        summary: "用户开始查看“为什么推荐这款”的依据说明。",
        significant: true,
        meta,
        rawMeta,
      };
    case "rationale_to_bag_click":
      return {
        eventName,
        phase: "result",
        title: "依据页：加入购物袋",
        flowLabel: "依据页加入购物袋",
        summary: "用户在依据页直接完成“先收下”动作。",
        significant: true,
        meta,
        rawMeta,
      };
    case "rationale_to_compare_click":
      return {
        eventName,
        phase: "result",
        title: "依据页：去 compare 裁决",
        flowLabel: "依据页去 compare",
        summary: "用户在依据页仍有疑虑，转入 compare 裁决路径。",
        significant: true,
        meta,
        rawMeta,
      };
    case "result_view":
      return {
        eventName,
        phase: "result",
        title: "查看决策结果",
        flowLabel: "查看决策结果",
        summary: "用户已经到达固定结构的测配结果页。",
        significant: true,
        meta,
        rawMeta,
      };
    case "result_add_to_bag_click":
      return {
        eventName,
        phase: "result",
        title: "结果闭环：加入购物袋",
        flowLabel: "结果加袋",
        summary:
          valueOrEmpty(item.target_path)
            ? `用户沿着 canonical 结果闭环加袋，目标 ${valueOrEmpty(item.target_path)}。`
            : "用户接受当前推荐，直接进入加袋闭环。",
        significant: true,
        meta,
        rawMeta,
      };
    case "result_compare_entry_click":
      return {
        eventName,
        phase: "result",
        title: "结果闭环：进入 Compare",
        flowLabel: "进入 Compare",
        summary:
          valueOrEmpty(item.target_path)
            ? `用户从结果页进入 compare 裁决，目标 ${valueOrEmpty(item.target_path)}。`
            : "用户从结果页进入 compare 裁决路径。",
        significant: true,
        meta,
        rawMeta,
      };
    case "result_rationale_entry_click":
      return {
        eventName,
        phase: "result",
        title: "结果闭环：进入推荐依据",
        flowLabel: "进入推荐依据",
        summary:
          valueOrEmpty(item.target_path)
            ? `用户从结果页进入 rationale，目标 ${valueOrEmpty(item.target_path)}。`
            : "用户从结果页进入推荐依据路径。",
        significant: true,
        meta,
        rawMeta,
      };
    case "result_retry_same_category_click":
      return {
        eventName,
        phase: "action",
        title: "结果闭环：重试同品类",
        flowLabel: "重试同品类",
        summary:
          valueOrEmpty(item.target_path)
            ? `用户决定重测当前品类，目标 ${valueOrEmpty(item.target_path)}。`
            : "用户没有直接收口，转去重测当前品类。",
        significant: true,
        meta,
        rawMeta,
      };
    case "result_switch_category_click":
      return {
        eventName,
        phase: "action",
        title: "结果闭环：切换品类",
        flowLabel: "切换品类",
        summary:
          valueOrEmpty(item.target_path)
            ? `用户决定切到其他品类继续测配，目标 ${valueOrEmpty(item.target_path)}。`
            : "用户从当前结果切到新的品类任务。",
        significant: true,
        meta,
        rawMeta,
      };
    case "result_primary_cta_click":
      return {
        eventName,
        phase: "result",
        title: "结果加袋桥接（兼容）",
        flowLabel: "结果加袋（兼容）",
        summary:
          item.result_cta || item.target_path
            ? `legacy result_primary_cta_click 桥接到 result_add_to_bag_click；意图 ${item.result_cta ? resultCtaLabel(item.result_cta) : "未标注"}，目标 ${valueOrEmpty(item.target_path) || "未标注"}。`
            : "legacy result_primary_cta_click 兼容输入，当前 summary 会把它桥接到 result_add_to_bag_click。",
        significant: true,
        meta,
        rawMeta,
      };
    case "result_secondary_loop_click": {
      const legacyLoopActionKey = normalizedResultLoopActionKey(item);
      return {
        eventName,
        phase: "result",
        title: "结果次级入口桥接（兼容）",
        flowLabel: "结果次级入口（兼容）",
        summary:
          item.action || item.result_cta || item.target_path
            ? `legacy result_secondary_loop_click 会按 result_cta 桥接到 canonical result entry；动作 ${legacyLoopActionKey ? loopActionLabel(legacyLoopActionKey) : "未标注"}，意图 ${item.result_cta ? resultCtaLabel(item.result_cta) : "未标注"}，目标 ${valueOrEmpty(item.target_path) || "未标注"}。`
            : "legacy result_secondary_loop_click 兼容输入，当前会桥接到 compare / rationale / retry / switch 的 canonical result entry。",
        significant: true,
        meta,
        rawMeta,
      };
    }
    case "utility_return_click":
      return {
        eventName,
        phase: "result",
        title: "从 utility 返回决策链路",
        flowLabel: "返回决策链路",
        summary:
          item.action || item.result_cta || item.target_path
            ? `回流动作 ${item.action ? loopActionLabel(item.action) : "未标注"}，意图 ${item.result_cta ? resultCtaLabel(item.result_cta) : "未标注"}，目标 ${valueOrEmpty(item.target_path) || "未标注"}。`
            : "utility 页把用户送回了测配结果或后续决策步骤。",
        significant: true,
        meta,
        rawMeta,
      };
    case "home_workspace_quick_action_click":
      return {
        eventName,
        phase: "action",
        title: "首页 workspace 快捷动作",
        flowLabel: "首页快捷动作",
        summary:
          item.action || item.target_path
            ? `老用户从首页 workspace 触发 ${loopActionLabel(item.action)}，目标 ${valueOrEmpty(item.target_path) || "未标注"}。`
            : "老用户从首页 workspace 触发了快捷动作。",
        significant: true,
        meta,
        rawMeta,
      };
    case "bag_add_success":
      return {
        eventName,
        phase: "result",
        title: "加入购物袋",
        flowLabel: "加入购物袋",
        summary: "已经发生了明确的购买意图动作。",
        significant: true,
        meta,
        rawMeta,
      };
    case "product_showcase_continue_upload_click":
      return {
        eventName,
        phase: "result",
        title: "从产品详情继续上传解析",
        flowLabel: "继续上传解析",
        summary: "用户愿意回到上传链路，继续做更深入的分析。",
        significant: true,
        meta,
        rawMeta,
      };
    case "product_showcase_governance_click":
      return {
        eventName,
        phase: "result",
        title: "从产品详情回到产品治理",
        flowLabel: "回到产品治理",
        summary: "这是偏运营 / 管理侧的后续动作。",
        significant: true,
        meta,
        rawMeta,
      };
    case "feedback_prompt_show":
      return {
        eventName,
        phase: "feedback",
        title: "看到反馈卡",
        flowLabel: "看到反馈卡",
        summary: `系统判断这里值得收集反馈${item.trigger_reason ? `，触发原因是“${feedbackTriggerLabel(item.trigger_reason)}”` : ""}。`,
        significant: true,
        meta,
        rawMeta,
      };
    case "feedback_submit": {
      const reason = item.reason_label ? feedbackReasonLabel(item.reason_label) : "";
      const summaryParts = [reason ? `反馈原因是“${reason}”` : "", detail ? compactText(detail, 72) : ""].filter(Boolean);
      return {
        eventName,
        phase: "feedback",
        title: "提交了反馈",
        flowLabel: "提交反馈",
        summary: summaryParts.join("；") || "用户补充了主观反馈，方便后续定位问题。",
        significant: true,
        meta,
        rawMeta,
      };
    }
    case "feedback_skip":
      return {
        eventName,
        phase: "feedback",
        title: "跳过了反馈",
        flowLabel: "跳过反馈",
        summary: "用户没有留下进一步说明。",
        significant: true,
        meta,
        rawMeta,
      };
    case "compare_stage_error":
      return {
        eventName,
        phase: "issue",
        title: `分析在“${stageLabel(item.stage)}”失败`,
        flowLabel: `${stageLabel(item.stage)}失败`,
        summary: buildIssueSummary(item, detail),
        significant: true,
        meta,
        rawMeta,
      };
    case "compare_upload_fail":
      return {
        eventName,
        phase: "issue",
        title: "上传失败",
        flowLabel: "上传失败",
        summary: buildIssueSummary(item, detail),
        significant: true,
        meta,
        rawMeta,
      };
    case "compare_run_error":
      return {
        eventName,
        phase: "issue",
        title: "对比任务失败",
        flowLabel: "对比任务失败",
        summary: buildIssueSummary(item, detail),
        significant: true,
        meta,
        rawMeta,
      };
    case "compare_reset_to_intro":
      return {
        eventName,
        phase: "exit",
        title: "从异常状态回到开始页",
        flowLabel: "回到开始页",
        summary: "用户或系统把流程重置到了最开始的位置。",
        significant: true,
        meta,
        rawMeta,
      };
    case "stall_detected":
      return {
        eventName,
        phase: "issue",
        title: "页面出现停滞",
        flowLabel: "页面停滞",
        summary: `用户在${page}遇到了明显卡顿或无进展的状态。`,
        significant: true,
        meta,
        rawMeta,
      };
    case "rage_click":
      return {
        eventName,
        phase: "issue",
        title: "用户连续点击但没有得到反馈",
        flowLabel: "连续点击无反馈",
        summary: "这通常意味着界面反馈不够明显，或用户不知道下一步是否成功。",
        significant: true,
        meta,
        rawMeta,
      };
    case "dead_click":
      return {
        eventName,
        phase: "issue",
        title: "用户点击了无响应区域",
        flowLabel: "点击无响应区域",
        summary: "可能存在误导性的视觉元素，或点击区域没有真正接上交互。",
        significant: true,
        meta,
        rawMeta,
      };
    case "scroll_depth":
      return {
        eventName,
        phase: "action",
        title: "继续向下浏览",
        flowLabel: "继续浏览",
        summary: "用户还在主动消费当前页面内容。",
        significant: false,
        meta,
        rawMeta,
      };
    default:
      return {
        eventName,
        phase: inferEventPhase(item),
        title: humanizeEventName(eventName),
        flowLabel: humanizeEventName(eventName),
        summary: detail || "这是一个已经采集到的原始信号，目前还没有单独翻译成业务文案。",
        significant: !eventName.startsWith("scroll_"),
        meta,
        rawMeta,
      };
  }
}

function findLastMatching<T>(items: T[], predicate: (item: T) => boolean): T | null {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) return items[index];
  }
  return null;
}

function buildSessionTimelinePresentation(items: MobileAnalyticsSessionEventItem[]): SessionTimelinePresentation {
  const narratives = items.map((item) => describeTimelineEvent(item));
  const flowSteps: string[] = [];
  const groups: SessionTimelineGroup[] = [];

  narratives.forEach((narrative, index) => {
    if (narrative.significant && flowSteps[flowSteps.length - 1] !== narrative.flowLabel) {
      flowSteps.push(narrative.flowLabel);
    }

    const previousGroup = groups[groups.length - 1];
    const withStep = {
      ...narrative,
      stepNumber: index + 1,
    };
    if (!previousGroup || previousGroup.phase !== narrative.phase) {
      groups.push({
        key: `${narrative.phase}-${index}`,
        phase: narrative.phase,
        items: [withStep],
      });
      return;
    }
    previousGroup.items.push(withStep);
  });

  const hasResult = narratives.some((item) =>
    [
      "compare_run_success",
      "compare_result_view",
      "result_view",
      "result_add_to_bag_click",
      "result_compare_entry_click",
      "result_rationale_entry_click",
      "result_retry_same_category_click",
      "result_switch_category_click",
      "result_primary_cta_click",
      "result_secondary_loop_click",
      "utility_return_click",
      "bag_add_success",
      "compare_result_accept_recommendation",
      "compare_result_keep_current",
      "compare_result_hold_current",
      "compare_result_view_key_differences",
      "compare_result_open_rationale",
      "compare_result_accept_recommendation_land",
      "compare_result_keep_current_land",
      "rationale_to_bag_click",
      "rationale_to_compare_click",
    ].includes(item.eventName),
  );
  const issueEvent = findLastMatching(narratives, (item) => item.phase === "issue");
  const exitEvent = findLastMatching(narratives, (item) => item.phase === "exit");
  const firstStep = flowSteps[0] || "开始浏览";
  const lastStep = flowSteps[flowSteps.length - 1] || firstStep;

  let heroPhase: SessionTimelinePhase = "entry";
  let headline = "这次会话主要停留在浏览阶段";
  if (hasResult) {
    heroPhase = "result";
    headline = "这次会话已经走到结果或后续转化动作";
  } else if (issueEvent) {
    heroPhase = "issue";
    headline = issueEvent.title;
  } else if (exitEvent) {
    heroPhase = "exit";
    headline = exitEvent.title;
  } else if (narratives.some((item) => item.phase === "analysis")) {
    heroPhase = "analysis";
    headline = "这次会话还停留在分析链路中";
  } else if (narratives.some((item) => item.phase === "action")) {
    heroPhase = "action";
    headline = "这次会话已经从浏览进入操作阶段";
  }

  const summaryParts = [`从“${firstStep}”开始`];
  if (flowSteps.length > 1) summaryParts.push(`共走过 ${flowSteps.length} 个关键节点`);
  if (hasResult) {
    summaryParts.push(`最终停在“${lastStep}”`);
  } else if (issueEvent) {
    summaryParts.push(`最终卡在“${issueEvent.flowLabel}”`);
  } else if (exitEvent) {
    summaryParts.push(`最终停在“${exitEvent.flowLabel}”`);
  } else {
    summaryParts.push(`当前最新动作是“${lastStep}”`);
  }

  return {
    headline,
    summary: `${summaryParts.join("，")}。`,
    heroPhase,
    flowSteps: flowSteps.slice(0, 6),
    groups,
  };
}

function phaseLabel(phase: SessionTimelinePhase): string {
  switch (phase) {
    case "entry":
      return "进入";
    case "action":
      return "操作";
    case "analysis":
      return "分析";
    case "result":
      return "结果";
    case "feedback":
      return "反馈";
    case "exit":
      return "离开";
    case "issue":
      return "异常";
    default:
      return "时间线";
  }
}

function phaseDotClass(phase: SessionTimelinePhase): string {
  switch (phase) {
    case "entry":
      return "bg-[#8e7654]";
    case "action":
      return "bg-[#2874db]";
    case "analysis":
      return "bg-[#5864d8]";
    case "result":
      return "bg-[#1e8f63]";
    case "feedback":
      return "bg-[#8b63ce]";
    case "exit":
      return "bg-[#c2871b]";
    case "issue":
      return "bg-[#cb4b3b]";
    default:
      return "bg-black/28";
  }
}

function phaseSectionClasses(phase: SessionTimelinePhase): string {
  switch (phase) {
    case "entry":
      return "border-[#e7ddd0] bg-[#fbf7f1]";
    case "action":
      return "border-[#d7e6fb] bg-[#f7fbff]";
    case "analysis":
      return "border-[#dde1fb] bg-[#f7f8ff]";
    case "result":
      return "border-[#d2e7db] bg-[#f4fbf7]";
    case "feedback":
      return "border-[#e3daf7] bg-[#faf8ff]";
    case "exit":
      return "border-[#eedec0] bg-[#fffaf0]";
    case "issue":
      return "border-[#efd1cd] bg-[#fff5f3]";
    default:
      return "border-black/10 bg-[#f7f8fb]";
  }
}

export default function MobileAnalyticsDashboard() {
  const [sinceHours, setSinceHours] = useState<number>(24 * 7);
  const [category, setCategory] = useState<string>("all");
  const [locationPresence, setLocationPresence] = useState<string>("all");
  const [locationTimeZone, setLocationTimeZone] = useState<string>("");
  const [sessionLocationRegionKey, setSessionLocationRegionKey] = useState("");
  const [overview, setOverview] = useState<ResourceState<MobileAnalyticsOverview>>(createResourceState());
  const [funnel, setFunnel] = useState<ResourceState<MobileAnalyticsFunnel>>(createResourceState());
  const [errors, setErrors] = useState<ResourceState<MobileAnalyticsErrors>>(createResourceState());
  const [feedback, setFeedback] = useState<ResourceState<MobileAnalyticsFeedback>>(createResourceState());
  const [experience, setExperience] = useState<ResourceState<MobileAnalyticsExperience>>(createResourceState());
  const [sessionList, setSessionList] = useState<ResourceState<MobileAnalyticsSessions>>(createResourceState());
  const [sessionDetail, setSessionDetail] = useState<ResourceState<MobileAnalyticsSessions>>(createResourceState());
  const [sessionQuery, setSessionQuery] = useState("");
  const [compareQuery, setCompareQuery] = useState("");
  const [activeSessionId, setActiveSessionId] = useState("");
  const [activeCompareId, setActiveCompareId] = useState("");
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [isPending, startTransition] = useTransition();
  const activeSessionIdRef = useRef("");
  const activeCompareIdRef = useRef("");

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    activeCompareIdRef.current = activeCompareId;
  }, [activeCompareId]);

  const locationTimeZoneOptions = experience.data?.location_time_zones || [];

  const activeLocationRegionLabel =
    experience.data?.location_regions.find((item) => item.key === sessionLocationRegionKey)?.label || sessionLocationRegionKey;

  function scrollToSessionExplorer() {
    globalThis.document?.getElementById("analytics-session-explorer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    let cancelled = false;
    const dashboardQuery: MobileAnalyticsQuery = {
      sinceHours,
      category: category === "all" ? undefined : category,
      locationPresence: locationPresence === "all" ? undefined : locationPresence,
      locationTimeZone: locationPresence === "without_location" ? undefined : locationTimeZone || undefined,
    };
    const sessionQuery: MobileAnalyticsQuery = {
      ...dashboardQuery,
      locationRegion: sessionLocationRegionKey || undefined,
    };

    async function loadDashboard() {
      setOverview((current) => ({ ...current, loading: true, error: null }));
      setFunnel((current) => ({ ...current, loading: true, error: null }));
      setErrors((current) => ({ ...current, loading: true, error: null }));
      setFeedback((current) => ({ ...current, loading: true, error: null }));
      setExperience((current) => ({ ...current, loading: true, error: null }));
      setSessionList((current) => ({ ...current, loading: true, error: null }));
      setSessionDetail((current) => ({ ...current, loading: true, error: null }));

      const [overviewResult, funnelResult, errorsResult, feedbackResult, experienceResult, sessionsResult] = await Promise.allSettled([
        fetchMobileAnalyticsOverview(dashboardQuery),
        fetchMobileAnalyticsFunnel(dashboardQuery),
        fetchMobileAnalyticsErrors(dashboardQuery),
        fetchMobileAnalyticsFeedback(dashboardQuery),
        fetchMobileAnalyticsExperience(dashboardQuery),
        fetchMobileAnalyticsSessions({ ...sessionQuery, limit: 10 }),
      ]);

      if (cancelled) return;

      setOverview({
        loading: false,
        data: overviewResult.status === "fulfilled" ? overviewResult.value : null,
        error: overviewResult.status === "fulfilled" ? null : formatError(overviewResult.reason),
      });
      setFunnel({
        loading: false,
        data: funnelResult.status === "fulfilled" ? funnelResult.value : null,
        error: funnelResult.status === "fulfilled" ? null : formatError(funnelResult.reason),
      });
      setErrors({
        loading: false,
        data: errorsResult.status === "fulfilled" ? errorsResult.value : null,
        error: errorsResult.status === "fulfilled" ? null : formatError(errorsResult.reason),
      });
      setFeedback({
        loading: false,
        data: feedbackResult.status === "fulfilled" ? feedbackResult.value : null,
        error: feedbackResult.status === "fulfilled" ? null : formatError(feedbackResult.reason),
      });
      setExperience({
        loading: false,
        data: experienceResult.status === "fulfilled" ? experienceResult.value : null,
        error: experienceResult.status === "fulfilled" ? null : formatError(experienceResult.reason),
      });
      if (sessionsResult.status === "fulfilled") {
        setSessionList({
          loading: false,
          data: sessionsResult.value,
          error: null,
        });
        if (activeSessionIdRef.current || activeCompareIdRef.current) {
          try {
            const detail = await fetchMobileAnalyticsSessions({
              ...sessionQuery,
              sessionId: activeSessionIdRef.current || undefined,
              compareId: activeCompareIdRef.current || undefined,
              limit: 10,
            });
            if (!cancelled) {
              setSessionDetail({
                loading: false,
                data: detail,
                error: null,
              });
            }
          } catch (error) {
            if (!cancelled) {
              setSessionDetail({
                loading: false,
                data: null,
                error: formatError(error),
              });
            }
          }
        } else {
          setSessionDetail({
            loading: false,
            data: sessionsResult.value,
            error: null,
          });
        }
      } else {
        const message = formatError(sessionsResult.reason);
        setSessionList({
          loading: false,
          data: null,
          error: message,
        });
        setSessionDetail({
          loading: false,
          data: null,
          error: message,
        });
      }
      setLastLoadedAt(new Date().toISOString());
    }

    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [category, locationPresence, locationTimeZone, refreshNonce, sessionLocationRegionKey, sinceHours]);

  async function loadSessionDetail(next: { sessionId?: string; compareId?: string }) {
    const baseQuery: MobileAnalyticsQuery = {
      sinceHours,
      category: category === "all" ? undefined : category,
      locationPresence: locationPresence === "all" ? undefined : locationPresence,
      locationTimeZone: locationPresence === "without_location" ? undefined : locationTimeZone || undefined,
      locationRegion: sessionLocationRegionKey || undefined,
      sessionId: next.sessionId,
      compareId: next.compareId,
      limit: 10,
    };
    setSessionDetail((current) => ({ ...current, loading: true, error: null }));
    try {
      const detail = await fetchMobileAnalyticsSessions(baseQuery);
      setSessionDetail({
        loading: false,
        data: detail,
        error: null,
      });
      setActiveSessionId(next.sessionId || "");
      setActiveCompareId(next.compareId || "");
    } catch (error) {
      setSessionDetail({
        loading: false,
        data: null,
        error: formatError(error),
      });
    }
  }

  function renderCountList(items: MobileAnalyticsCountItem[], tone: "emerald" | "amber" = "emerald") {
    if (items.length === 0) {
      return <EmptyHint label="当前筛选下还没有对应数据。" />;
    }
    return (
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.key}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-[13px] font-medium text-black/72">{item.label}</div>
              <div className="text-[12px] text-black/52">
                {formatNumber(item.count)} · {formatPercent(item.rate)}
              </div>
            </div>
            <div className="mt-2 h-2 rounded-full bg-black/6">
              <div
                className={`h-2 rounded-full ${tone === "emerald" ? "bg-[#0f7c59]" : "bg-[#a86919]"}`}
                style={{ width: item.count > 0 ? `${Math.max(8, Math.round(item.rate * 100))}%` : "0%" }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderSelectableCountList(
    items: MobileAnalyticsCountItem[],
    options: {
      activeKey?: string;
      tone?: "emerald" | "amber";
      emptyLabel: string;
      onSelect: (item: MobileAnalyticsCountItem) => void;
    },
  ) {
    if (items.length === 0) {
      return <EmptyHint label={options.emptyLabel} />;
    }
    const tone = options.tone || "emerald";
    return (
      <div className="space-y-2">
        {items.map((item) => {
          const active = options.activeKey === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => options.onSelect(item)}
              className={`block w-full rounded-[18px] border px-4 py-3 text-left transition ${
                active
                  ? "border-black bg-black text-white"
                  : "border-black/10 bg-[#f7f8fb] text-black/72 hover:bg-[#eef3f8]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="text-[13px] font-medium">{item.label}</div>
                <div className={`text-[12px] ${active ? "text-white/78" : "text-black/52"}`}>
                  {formatNumber(item.count)} · {formatPercent(item.rate)}
                </div>
              </div>
              <div className={`mt-2 h-2 rounded-full ${active ? "bg-white/18" : "bg-black/6"}`}>
                <div
                  className={`h-2 rounded-full ${active ? "bg-white" : tone === "emerald" ? "bg-[#0f7c59]" : "bg-[#a86919]"}`}
                  style={{ width: item.count > 0 ? `${Math.max(8, Math.round(item.rate * 100))}%` : "0%" }}
                />
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  const sessionTimelinePresentation =
    sessionDetail.data && sessionDetail.data.timeline.length > 0
      ? buildSessionTimelinePresentation(sessionDetail.data.timeline)
      : null;
  const selectedSessionSummary =
    (sessionDetail.data?.items.find((item) => item.session_id === sessionDetail.data?.selected_session_id) ??
      sessionList.data?.items.find((item) => item.session_id === sessionDetail.data?.selected_session_id)) ||
    null;
  const chooseStartRate = overview.data?.choose_start_rate_from_choose_view;
  const resultViewRateFromHome = overview.data?.result_view_rate_from_home_primary_cta;
  const resultPrimaryCtaRate = overview.data?.result_primary_cta_rate_from_result_view;
  const resultLoopEntryRate = overview.data?.result_loop_entry_rate_from_result_view;
  const utilityReturnRateFromLoop = overview.data?.utility_return_rate_from_result_loop;
  const questionDropoffTop = overview.data?.question_dropoff_top || null;
  const questionDropoffByCategory = overview.data?.question_dropoff_by_category || [];
  const questionDropoffLive = Boolean(overview.data && overview.data.question_dropoff_status === "live" && questionDropoffTop);

  return (
    <section className="mt-8 space-y-6">
      <div className="rounded-[32px] border border-black/10 bg-white px-6 py-6 shadow-[0_18px_44px_rgba(16,24,40,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-black/42">Live Dashboard</div>
            <h2 className="mt-2 text-[30px] font-semibold tracking-[-0.03em] text-black/88">真实数据面板</h2>
            <p className="mt-2 max-w-[720px] text-[14px] leading-[1.7] text-black/62">
              第一屏严格对齐 P0 contract：优先回答 5 个问题；`question_dropoff` 在有有效 stepful 数据时切换为 live。
            </p>
          </div>
          <div className="text-right text-[12px] text-black/46">
            <div>{isPending ? "筛选切换中…" : "数据已接入"}</div>
            <div className="mt-1">{lastLoadedAt ? `上次刷新 ${formatDateTime(lastLoadedAt)}` : "等待首轮加载"}</div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {TIME_WINDOWS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => startTransition(() => setSinceHours(item.value))}
                className={`inline-flex h-10 items-center rounded-full border px-4 text-[13px] font-semibold ${
                  sinceHours === item.value
                    ? "border-black bg-black text-white"
                    : "border-black/10 bg-white text-black/68 hover:bg-black/[0.03]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <label className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#f7f8fb] px-4 py-2 text-[13px] text-black/68">
            <span>品类</span>
            <select
              value={category}
              onChange={(event) =>
                startTransition(() => {
                  setCategory(event.target.value);
                  setSessionLocationRegionKey("");
                })
              }
              className="bg-transparent text-[13px] font-semibold text-black/82 outline-none"
            >
              {CATEGORY_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-[#f7f8fb] px-4 py-2 text-[13px] text-black/68">
            <span>位置</span>
            <select
              value={locationPresence}
              onChange={(event) =>
                startTransition(() => {
                  const nextValue = event.target.value;
                  setLocationPresence(nextValue);
                  if (nextValue === "without_location") setLocationTimeZone("");
                  setSessionLocationRegionKey("");
                })
              }
              className="bg-transparent text-[13px] font-semibold text-black/82 outline-none"
            >
              {LOCATION_PRESENCE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] ${
              locationPresence === "without_location"
                ? "border-black/8 bg-[#fbfbfc] text-black/34"
                : "border-black/10 bg-[#f7f8fb] text-black/68"
            }`}
          >
            <span>时区</span>
            <select
              value={locationTimeZone}
              disabled={locationPresence === "without_location"}
              onChange={(event) =>
                startTransition(() => {
                  setLocationTimeZone(event.target.value);
                  setSessionLocationRegionKey("");
                })
              }
              className="bg-transparent text-[13px] font-semibold text-black/82 outline-none disabled:text-black/34"
            >
              <option value="">全部时区</option>
              {locationTimeZoneOptions.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => setRefreshNonce((value) => value + 1)}
            className="inline-flex h-10 items-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-semibold text-black/68 hover:bg-black/[0.03]"
          >
            手动刷新
          </button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          title="Q1 进入主链路会话"
          value={formatNumber(overview.data?.home_primary_cta_click_sessions)}
          detail={`进入 choose ${formatNumber(overview.data?.choose_view_sessions)} · 总事件 ${formatNumber(overview.data?.total_events)}`}
          loading={overview.loading}
          error={overview.error}
          accent="emerald"
        />
        <DashboardMetricCard
          title="Q2 choose 后开始答题"
          value={formatNumber(overview.data?.choose_start_click_sessions)}
          detail={`canonical choose_category_start_click · choose 会话 ${formatNumber(overview.data?.choose_view_sessions)} · 转化 ${formatPercent(chooseStartRate)}`}
          loading={overview.loading}
          error={overview.error}
          accent="amber"
        />
        <DashboardMetricCard
          title="Q4 成功到达结果页"
          value={formatNumber(overview.data?.result_view_sessions)}
          detail={`从首页 CTA 转化 ${formatPercent(resultViewRateFromHome)} · 完成答题 ${formatNumber(overview.data?.questionnaire_completed_sessions)}`}
          loading={overview.loading}
          error={overview.error}
          accent="slate"
        />
        <DashboardMetricCard
          title="Q5 结果主闭环（加袋）"
          value={formatNumber(overview.data?.result_primary_cta_click_sessions)}
          detail={`次级入口 ${formatNumber(overview.data?.result_secondary_loop_click_sessions)} · utility 回流 ${formatNumber(overview.data?.utility_return_click_sessions)}`}
          loading={overview.loading}
          error={overview.error}
          accent="stone"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <PanelCard title="Funnel" subtitle="P0 主链路漏斗（home CTA → choose → 开始答题 → 完成答题 → result_view）">
          {funnel.error ? (
            <PanelError message={funnel.error} />
          ) : funnel.loading ? (
            <PanelLoading />
          ) : funnel.data && funnel.data.steps.length > 0 ? (
            <div className="space-y-4">
              <div className="rounded-[18px] border border-[#d6e6ff] bg-[#f4f8ff] px-4 py-3 text-[12px] leading-[1.7] text-[#305a98]">
                {questionDropoffLive ? (
                  <span>
                    `question_dropoff` 已 live：当前最高流失为 {categoryLabel(questionDropoffTop?.category)} · 第
                    {formatNumber(questionDropoffTop?.step)} 题（流失 {formatNumber(questionDropoffTop?.dropoff_sessions)} /{" "}
                    {formatNumber(questionDropoffTop?.questionnaire_view_sessions)}，{formatPercent(questionDropoffTop?.dropoff_rate)}）。
                  </span>
                ) : (
                  <span>`question_dropoff` 当前 blocked：{overview.data?.question_dropoff_reason || "暂无有效 step 数据。"}</span>
                )}
                <div className="mt-1">`compare_result_view` 是 compare closure canonical 事件，但在第一屏主 KPI 中只作为 supporting context。</div>
              </div>
              {funnel.data.steps.map((step) => (
                <article key={step.step_key} className="rounded-[22px] border border-black/10 bg-[#f7f8fb] px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[16px] font-semibold tracking-[-0.02em] text-black/86">{step.step_label}</div>
                      <div className="mt-1 text-[12px] text-black/48">{step.step_key}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[22px] font-semibold tracking-[-0.03em] text-black/88">{formatNumber(step.count)}</div>
                      <div className="text-[12px] text-black/52">从上一步 {formatPercent(step.from_prev_rate)}</div>
                    </div>
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-black/6">
                    <div
                      className="h-2 rounded-full bg-[#0f7c59]"
                      style={{ width: step.count > 0 ? `${Math.max(8, Math.round(step.from_first_rate * 100))}%` : "0%" }}
                    />
                  </div>
                  <div className="mt-2 text-[12px] text-black/52">从第一步保留 {formatPercent(step.from_first_rate)}</div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyHint label="当前筛选下还没有漏斗数据。" />
          )}
        </PanelCard>

        <PanelCard title="P0 五问状态" subtitle="question_dropoff 按 contract 在 live / blocked 之间切换">
          {overview.error ? (
            <PanelError message={overview.error} />
          ) : overview.loading ? (
            <PanelLoading />
          ) : overview.data ? (
            <div className="space-y-3">
              <article className="rounded-[18px] border border-black/10 bg-[#f7f8fb] px-4 py-4">
                <div className="text-[13px] text-black/52">Q1 /m 首页 CTA 进入主链路</div>
                <div className="mt-2 text-[20px] font-semibold tracking-[-0.02em] text-black/86">
                  {formatNumber(overview.data.home_primary_cta_click_sessions)}
                </div>
              </article>

              <article className="rounded-[18px] border border-black/10 bg-[#f7f8fb] px-4 py-4">
                <div className="text-[13px] text-black/52">Q2 进入 choose 后开始答题</div>
                <div className="mt-2 text-[20px] font-semibold tracking-[-0.02em] text-black/86">
                  {formatNumber(overview.data.choose_start_click_sessions)}
                  <span className="ml-2 text-[13px] font-medium text-black/55">
                    / {formatNumber(overview.data.choose_view_sessions)} · {formatPercent(chooseStartRate)}
                  </span>
                </div>
                <div className="mt-1 text-[12px] text-black/46">current truth：choose_category_start_click；旧 key 仅作兼容 summary shape</div>
              </article>

              {questionDropoffLive ? (
                <article className="rounded-[18px] border border-[#cce7db] bg-[#eff8f2] px-4 py-4">
                  <div className="text-[13px] text-[#1f6a4e]">Q3 哪一道题流失最高</div>
                  <div className="mt-2 inline-flex items-center rounded-full border border-[#b8decd] bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#1f6a4e]">
                    live
                  </div>
                  <div className="mt-2 text-[15px] font-semibold text-[#174f3b]">
                    {categoryLabel(questionDropoffTop?.category)} · 第{formatNumber(questionDropoffTop?.step)}题 · {questionDropoffTop?.question_title}
                  </div>
                  <div className="mt-1 text-[13px] text-[#2f6d58]">
                    流失 {formatNumber(questionDropoffTop?.dropoff_sessions)} / 浏览 {formatNumber(questionDropoffTop?.questionnaire_view_sessions)} ·{" "}
                    {formatPercent(questionDropoffTop?.dropoff_rate)}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {questionDropoffByCategory.map((item) => (
                      <span key={`${item.category}-${item.step}`} className="rounded-full border border-[#b8decd] bg-white px-2.5 py-1 text-[11px] text-[#2f6d58]">
                        {categoryLabel(item.category)} 第{item.step}题：流失 {item.dropoff_sessions}
                      </span>
                    ))}
                  </div>
                </article>
              ) : (
                <article className="rounded-[18px] border border-[#f1d9c7] bg-[#fff7ef] px-4 py-4">
                  <div className="text-[13px] text-[#8e4f1f]">Q3 哪一道题流失最高</div>
                  <div className="mt-2 inline-flex items-center rounded-full border border-[#e7c7ad] bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8e4f1f]">
                    blocked
                  </div>
                  <p className="mt-2 text-[13px] leading-[1.65] text-[#7d5b43]">{overview.data.question_dropoff_reason}</p>
                </article>
              )}

              <article className="rounded-[18px] border border-black/10 bg-[#f7f8fb] px-4 py-4">
                <div className="text-[13px] text-black/52">Q4 成功到达结果页</div>
                <div className="mt-2 text-[20px] font-semibold tracking-[-0.02em] text-black/86">
                  {formatNumber(overview.data.result_view_sessions)}
                  <span className="ml-2 text-[13px] font-medium text-black/55">{formatPercent(resultViewRateFromHome)}</span>
                </div>
              </article>

              <article className="rounded-[18px] border border-black/10 bg-[#f7f8fb] px-4 py-4">
                <div className="text-[13px] text-black/52">Q5 到达结果后继续动作</div>
                <div className="mt-2 text-[20px] font-semibold tracking-[-0.02em] text-black/86">
                  加袋闭环 {formatNumber(overview.data.result_primary_cta_click_sessions)}
                  <span className="ml-2 text-[13px] font-medium text-black/55">{formatPercent(resultPrimaryCtaRate)}</span>
                </div>
                <div className="mt-1 text-[12px] text-black/58">
                  次级入口 {formatNumber(overview.data.result_secondary_loop_click_sessions)}（{formatPercent(resultLoopEntryRate)}） · utility 回流{" "}
                  {formatNumber(overview.data.utility_return_click_sessions)}（{formatPercent(utilityReturnRateFromLoop)}）
                </div>
                <div className="mt-2 text-[12px] text-black/46">
                  canonical result events 驱动 summary；compare_result_view {formatNumber(overview.data.compare_result_view_sessions)} 仅作 compare closure supporting context
                </div>
              </article>
            </div>
          ) : (
            <EmptyHint label="当前筛选下还没有概览数据。" />
          )}
        </PanelCard>
      </section>

      <PanelCard title="Experience Signals" subtitle="决策结果动作、对比结果阅读与误触停滞">
        {experience.error ? (
          <PanelError message={experience.error} />
        ) : experience.loading ? (
          <PanelLoading />
        ) : experience.data ? (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <CompactStat
                title="产品列表 CTR"
                value={`${formatPercent(experience.data.wiki_product_ctr)} · ${formatNumber(experience.data.wiki_product_clicks)}/${formatNumber(experience.data.wiki_product_list_views)}`}
              />
              <CompactStat
                title="成分列表 CTR"
                value={`${formatPercent(experience.data.wiki_ingredient_ctr)} · ${formatNumber(experience.data.wiki_ingredient_clicks)}/${formatNumber(experience.data.wiki_ingredient_list_views)}`}
              />
              <CompactStat
                title="结果到达 / 加袋"
                value={`${formatNumber(experience.data.decision_result_views)} · 加袋 ${formatNumber(experience.data.decision_result_primary_cta_clicks)}`}
              />
              <CompactStat
                title="utility 回流"
                value={`${formatNumber(experience.data.utility_return_clicks)} / 次级入口 ${formatNumber(experience.data.decision_result_secondary_loop_clicks)}`}
              />
              <CompactStat
                title="首页快捷动作"
                value={formatNumber(experience.data.home_workspace_quick_action_clicks)}
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-5">
                <div>
                  <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-black/42">Compare 结果阅读与停留</div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <article className="rounded-[20px] border border-black/10 bg-[#f7f8fb] px-4 py-4">
                      <div className="text-[12px] text-black/48">Compare 结果访问</div>
                      <div className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-black/86">
                        {formatNumber(experience.data.compare_result_views)}
                      </div>
                      <div className="mt-2 text-[12px] text-black/52">
                        离开 {formatNumber(experience.data.compare_result_leaves)} · compare_result_view 已进入 canonical closure
                      </div>
                    </article>
                    <article className="rounded-[20px] border border-black/10 bg-[#f7f8fb] px-4 py-4">
                      <div className="text-[12px] text-black/48">对比结果 P50 停留</div>
                      <div className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-black/86">
                        {formatDurationMs(experience.data.p50_result_dwell_ms)}
                      </div>
                      <div className="mt-2 text-[12px] text-black/52">
                        rage {formatNumber(experience.data.rage_clicks)} · dead {formatNumber(experience.data.dead_clicks)} · stall {formatNumber(experience.data.stall_detected)}
                      </div>
                    </article>
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-black/42">Decision Result Canonical</div>
                  <div className="mb-3 text-[12px] leading-[1.6] text-black/50">
                    这里的结果动作已经按 phase-13 canonical result events 聚合；legacy `result_primary_cta_click` / `result_secondary_loop_click` 只作为桥接输入。
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <article className="rounded-[20px] border border-black/10 bg-[#f7f8fb] px-4 py-4">
                      <div className="text-[12px] text-black/48">结果加袋闭环（result_add_to_bag_click）</div>
                      <div className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-black/86">
                        {formatNumber(experience.data.decision_result_primary_cta_clicks)}
                      </div>
                      <div className="mt-3 text-[12px] text-black/48">闭环类型</div>
                      <div className="mt-2">
                        {renderCountList(experience.data.result_primary_cta_result_ctas, "emerald")}
                      </div>
                      <div className="mt-3 text-[12px] text-black/48">目标分布</div>
                      <div className="mt-2">
                        {renderCountList(experience.data.result_primary_cta_target_paths, "amber")}
                      </div>
                    </article>
                    <article className="rounded-[20px] border border-black/10 bg-[#f7f8fb] px-4 py-4">
                      <div className="text-[12px] text-black/48">结果次级入口（compare / rationale / retry / switch）</div>
                      <div className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-black/86">
                        {formatNumber(experience.data.decision_result_secondary_loop_clicks)}
                      </div>
                      <div className="mt-3 text-[12px] text-black/48">入口分布</div>
                      <div className="mt-3">
                        {renderCountList(
                          experience.data.result_secondary_loop_actions.map((item) => ({
                            ...item,
                            label: loopActionLabel(item.key),
                          })),
                          "amber",
                        )}
                      </div>
                      <div className="mt-3 text-[12px] text-black/48">兼容映射标签</div>
                      <div className="mt-2">{renderCountList(experience.data.result_secondary_loop_result_ctas, "emerald")}</div>
                      <div className="mt-3 text-[12px] text-black/48">目标分布</div>
                      <div className="mt-2">{renderCountList(experience.data.result_secondary_loop_target_paths, "amber")}</div>
                    </article>
                    <article className="rounded-[20px] border border-black/10 bg-[#f7f8fb] px-4 py-4">
                      <div className="text-[12px] text-black/48">从 utility 返回决策（utility_return_click）</div>
                      <div className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-black/86">
                        {formatNumber(experience.data.utility_return_clicks)}
                      </div>
                      <div className="mt-3 text-[12px] text-black/48">动作分布</div>
                      <div className="mt-3">
                        {renderCountList(
                          experience.data.utility_return_actions.map((item) => ({
                            ...item,
                            label: loopActionLabel(item.key),
                          })),
                          "emerald",
                        )}
                      </div>
                      <div className="mt-3 text-[12px] text-black/48">意图分布</div>
                      <div className="mt-2">{renderCountList(experience.data.utility_return_result_ctas, "emerald")}</div>
                      <div className="mt-3 text-[12px] text-black/48">目标分布</div>
                      <div className="mt-2">{renderCountList(experience.data.utility_return_target_paths, "amber")}</div>
                    </article>
                  </div>
                  <div className="mt-3">
                    <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-black/42">首页 workspace 快捷动作（supporting）</div>
                    {renderCountList(
                      experience.data.home_workspace_quick_actions.map((item) => ({
                        ...item,
                        label: loopActionLabel(item.key),
                      })),
                      "emerald",
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-black/42">Compare / Rationale Closure</div>
                  <div className="mb-3 text-[12px] leading-[1.6] text-black/50">
                    compare 与 rationale 已切到 phase-13 canonical closure 词表；compare_result_cta_* 只保留为兼容桥接。
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <article className="rounded-[20px] border border-black/10 bg-[#f7f8fb] px-4 py-4">
                      <div className="text-[12px] text-black/48">Compare canonical closure</div>
                      <div className="mt-2 text-[20px] font-semibold tracking-[-0.02em] text-black/86">
                        接受推荐 {formatNumber(experience.data.compare_closure_accept_recommendation)}
                      </div>
                      <div className="mt-1 text-[12px] text-black/58">
                        保留当前 {formatNumber(experience.data.compare_closure_keep_current)}
                      </div>
                      <div className="mt-3">{renderCountList(experience.data.compare_closure_actions, "emerald")}</div>
                    </article>
                    <article className="rounded-[20px] border border-black/10 bg-[#f7f8fb] px-4 py-4">
                      <div className="text-[12px] text-black/48">Rationale canonical closure</div>
                      <div className="mt-2 text-[20px] font-semibold tracking-[-0.02em] text-black/86">
                        去购物袋 {formatNumber(experience.data.rationale_to_bag_click)}
                      </div>
                      <div className="mt-1 text-[12px] text-black/58">
                        去对比 {formatNumber(experience.data.rationale_to_compare_click)} · 浏览 {formatNumber(experience.data.rationale_view)}
                      </div>
                      <div className="mt-3">{renderCountList(experience.data.rationale_closure_actions, "amber")}</div>
                    </article>
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-black/42">Compare CTA 落地桥接</div>
                  <div className="mb-3 text-[12px] leading-[1.6] text-black/50">仅用于兼容已有 compare CTA 落地率视图，不代表当前 canonical compare closure 词表。</div>
                  {experience.data.result_cta_followthrough.length === 0 ? (
                    <EmptyHint label="当前筛选下还没有对比结果 CTA 落地数据。" />
                  ) : (
                    <div className="space-y-3">
                      {experience.data.result_cta_followthrough.map((item) => (
                        <div key={item.cta}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[13px] font-medium text-black/72">{resultCtaLabel(item.cta)}</div>
                            <div className="text-[12px] text-black/52">
                              落地 {formatNumber(item.landings)} / 点击 {formatNumber(item.clicks)} · {formatPercent(item.landing_rate)}
                            </div>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-black/6">
                            <div
                              className="h-2 rounded-full bg-[#0f7c59]"
                              style={{ width: item.clicks > 0 ? `${Math.max(8, Math.round(item.landing_rate * 100))}%` : "0%" }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-black/42">对比结果落地后的真实动作（兼容上下文）</div>
                  {experience.data.result_cta_completions.length === 0 ? (
                    <EmptyHint label="当前筛选下还没有落地后的真实动作样本。" />
                  ) : (
                    <div className="space-y-2.5">
                      {experience.data.result_cta_completions.map((item) => (
                        <article
                          key={`${item.cta}:${item.completion_key}`}
                          className="rounded-[18px] border border-black/10 bg-[#f7f8fb] px-4 py-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-[13px] font-medium text-black/78">{resultCtaLabel(item.cta)}</div>
                              <div className="mt-1 text-[12px] text-black/52">{item.completion_label}</div>
                            </div>
                            <div className="text-right text-[12px] text-black/52">
                              <div>完成 {formatNumber(item.completions)} / 落地 {formatNumber(item.landings)}</div>
                              <div>点击 {formatNumber(item.clicks)}</div>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-black/56">
                            <span>从落地完成 {formatPercent(item.completion_rate_from_land)}</span>
                            <span>从点击完成 {formatPercent(item.completion_rate_from_click)}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-black/42">页面阅读深度</div>
                  {experience.data.scroll_depth_by_page.length === 0 ? (
                    <EmptyHint label="当前筛选下还没有阅读深度样本。" />
                  ) : (
                    <div className="overflow-x-auto rounded-[22px] border border-black/10">
                      <table className="min-w-full border-separate border-spacing-0">
                        <thead className="bg-[#f7f8fb]">
                          <tr>
                            <th className="border-b border-black/10 px-4 py-3 text-left text-[11px] uppercase tracking-[0.08em] text-black/45">Page</th>
                            <th className="border-b border-black/10 px-4 py-3 text-right text-[11px] uppercase tracking-[0.08em] text-black/45">Depth</th>
                            <th className="border-b border-black/10 px-4 py-3 text-right text-[11px] uppercase tracking-[0.08em] text-black/45">Count</th>
                            <th className="border-b border-black/10 px-4 py-3 text-right text-[11px] uppercase tracking-[0.08em] text-black/45">Rate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {experience.data.scroll_depth_by_page.map((item) => (
                            <tr key={`${item.page}:${item.depth_percent}`}>
                              <td className="border-b border-black/[0.06] px-4 py-3 text-[13px] text-black/76">{pageLabel(item.page)}</td>
                              <td className="border-b border-black/[0.06] px-4 py-3 text-right text-[13px] text-black/64">{item.depth_percent}%</td>
                              <td className="border-b border-black/[0.06] px-4 py-3 text-right text-[13px] font-semibold text-black/82">{formatNumber(item.count)}</td>
                              <td className="border-b border-black/[0.06] px-4 py-3 text-right text-[12px] text-black/58">{formatPercent(item.rate)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-black/42">停滞页面</div>
                    {renderCountList(experience.data.stall_by_page)}
                  </div>
                  <div>
                    <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-black/42">Top Rage Targets</div>
                    {experience.data.rage_click_targets.length === 0 ? (
                      <EmptyHint label="当前筛选下还没有 rage click。" />
                    ) : (
                      <div className="space-y-2">
                        {experience.data.rage_click_targets.map((item) => (
                          <div
                            key={`${item.page}:${item.target_id}`}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-black/10 bg-[#f7f8fb] px-4 py-3"
                          >
                            <div className="text-[13px] text-black/72">{rageTargetLabel(item)}</div>
                            <div className="text-[12px] text-black/52">
                              {formatNumber(item.count)} · {formatPercent(item.rate)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-black/42">Top Dead Targets</div>
                    {experience.data.dead_click_targets.length === 0 ? (
                      <EmptyHint label="当前筛选下还没有 dead click。" />
                    ) : (
                      <div className="space-y-2">
                        {experience.data.dead_click_targets.map((item) => (
                          <div
                            key={`${item.page}:${item.target_id}`}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-black/10 bg-[#fff6f2] px-4 py-3"
                          >
                            <div className="text-[13px] text-black/72">{rageTargetLabel(item)}</div>
                            <div className="text-[12px] text-black/52">
                              {formatNumber(item.count)} · {formatPercent(item.rate)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-black/42">对比结果 CTA 点击分布</div>
                    {experience.data.result_cta_clicks.length === 0 ? (
                      <EmptyHint label="当前筛选下还没有对比结果 CTA 点击。" />
                    ) : (
                      renderCountList(
                        experience.data.result_cta_clicks.map((item) => ({
                          ...item,
                          label: resultCtaLabel(item.key),
                        })),
                      )
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-black/42">地理识别</div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <article className="rounded-[20px] border border-black/10 bg-[#f7f8fb] px-4 py-4">
                      <div className="text-[12px] text-black/48">已识别位置会话</div>
                      <div className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-black/86">
                        {formatNumber(experience.data.sessions_with_location)}
                      </div>
                      <div className="mt-2 text-[12px] text-black/52">
                        授权成功会话 {formatNumber(experience.data.location_capture_sessions)}
                      </div>
                    </article>
                    <article className="rounded-[20px] border border-black/10 bg-[#f7f8fb] px-4 py-4">
                      <div className="text-[12px] text-black/48">位置覆盖率</div>
                      <div className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-black/86">
                        {formatPercent(experience.data.location_coverage_rate)}
                      </div>
                      <div className="mt-2 text-[12px] text-black/52">
                        缺省会话 {formatNumber(experience.data.sessions_without_location)}
                      </div>
                    </article>
                    <article className="rounded-[20px] border border-black/10 bg-[#f7f8fb] px-4 py-4">
                      <div className="text-[12px] text-black/48">位置授权事件</div>
                      <div className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-black/86">
                        {formatNumber(experience.data.location_capture_events)}
                      </div>
                      <div className="mt-2 text-[12px] text-black/52">
                        仅用户同意后才会出现
                      </div>
                    </article>
                    <article className="rounded-[20px] border border-black/10 bg-[#f7f8fb] px-4 py-4">
                      <div className="text-[12px] text-black/48">位置缺省保留</div>
                      <div className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-black/86">
                        {formatNumber(experience.data.sessions_without_location)}
                      </div>
                      <div className="mt-2 text-[12px] text-black/52">
                        未授权或未上报时保持为空
                      </div>
                    </article>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-[18px] border border-[#d9e4f8] bg-[#f4f8ff] px-4 py-3 text-[12px] leading-[1.7] text-[#305a98]">
                      下方“补充时区 / 城市 / 经纬度 / 定位精度”的占比，分母都是当前筛选下
                      <span className="font-semibold">已识别位置会话 {formatNumber(experience.data.sessions_with_location)}</span>
                      ，位置缺省不计入分母。
                    </div>
                    <div className="rounded-[18px] border border-[#efe4c8] bg-[#fffaf0] px-4 py-3 text-[12px] leading-[1.7] text-[#8b6a21]">
                      有地级市解析时优先展示
                      <span className="font-semibold">城市名</span>
                      ；没有城市时回退到
                      <span className="font-semibold">1 位小数经纬度聚类</span>
                      ，量级约 10km。
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div>
                      <div className="mb-3 flex items-center gap-2 text-[12px] text-black/48">
                        <span>城市 / 经纬度</span>
                        <HoverHint label="优先展示地级市；没有城市时展示经纬度聚类。点击后只下钻 Session Explorer，不改上面的整体漏斗与概览。" />
                      </div>
                      {renderSelectableCountList(experience.data.location_regions, {
                        activeKey: sessionLocationRegionKey,
                        tone: "amber",
                        emptyLabel: "当前筛选下还没有城市 / 经纬度样本。",
                        onSelect: (item) => {
                          const shouldClear = sessionLocationRegionKey === item.key;
                          startTransition(() => {
                            setSessionLocationRegionKey(shouldClear ? "" : item.key);
                          });
                          if (!shouldClear) {
                            globalThis.requestAnimationFrame?.(() => {
                              scrollToSessionExplorer();
                            });
                          }
                        },
                      })}
                    </div>
                    <div>
                      <div className="mb-3 flex items-center gap-2 text-[12px] text-black/48">
                        <span>补充时区</span>
                        <HoverHint label="这是补充维度，不是主位置标签。点击后会联动整个 dashboard，适合对比更大范围区域差异。" />
                      </div>
                      {renderSelectableCountList(experience.data.location_time_zones, {
                        activeKey: locationTimeZone,
                        emptyLabel: "当前筛选下还没有时区样本。",
                        onSelect: (item) => {
                          const shouldClear = locationTimeZone === item.key && locationPresence !== "without_location";
                          startTransition(() => {
                            setLocationPresence("with_location");
                            setLocationTimeZone(shouldClear ? "" : item.key);
                            setSessionLocationRegionKey("");
                          });
                        },
                      })}
                    </div>
                    <div>
                      <div className="mb-3 flex items-center gap-2 text-[12px] text-black/48">
                        <span>定位精度</span>
                        <HoverHint label="这里反映的是浏览器返回的位置精度区间，不等于用户主动输入地址。" />
                      </div>
                      {renderCountList(experience.data.location_accuracy_buckets)}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-black/42">环境切片</div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <div className="mb-3 text-[12px] text-black/48">Browser</div>
                      {renderCountList(experience.data.browser_families)}
                    </div>
                    <div>
                      <div className="mb-3 text-[12px] text-black/48">OS</div>
                      {renderCountList(experience.data.os_families)}
                    </div>
                    <div>
                      <div className="mb-3 text-[12px] text-black/48">Device</div>
                      {renderCountList(experience.data.device_types)}
                    </div>
                    <div>
                      <div className="mb-3 text-[12px] text-black/48">Viewport</div>
                      {renderCountList(experience.data.viewport_buckets)}
                    </div>
                    <div>
                      <div className="mb-3 text-[12px] text-black/48">Network</div>
                      {renderCountList(experience.data.network_types)}
                    </div>
                    <div>
                      <div className="mb-3 text-[12px] text-black/48">Language</div>
                      {renderCountList(experience.data.languages)}
                    </div>
                    <div>
                      <div className="mb-3 text-[12px] text-black/48">Memory</div>
                      {renderCountList(experience.data.device_memory_buckets)}
                    </div>
                    <div>
                      <div className="mb-3 text-[12px] text-black/48">CPU</div>
                      {renderCountList(experience.data.cpu_core_buckets)}
                    </div>
                    <div>
                      <div className="mb-3 text-[12px] text-black/48">Touch</div>
                      {renderCountList(experience.data.touch_points_buckets)}
                    </div>
                    <div>
                      <div className="mb-3 text-[12px] text-black/48">Online</div>
                      {renderCountList(experience.data.online_states)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <EmptyHint label="当前筛选下还没有体验信号数据。" />
        )}
      </PanelCard>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <PanelCard title="Stage Errors" subtitle="阶段失败、错误码与时长估算">
          {errors.error ? (
            <PanelError message={errors.error} />
          ) : errors.loading ? (
            <PanelLoading />
          ) : errors.data ? (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-black/42">By Stage</div>
                  {renderCountList(errors.data.by_stage, "amber")}
                </div>
                <div>
                  <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-black/42">By Error Code</div>
                  {renderCountList(errors.data.by_error_code, "amber")}
                </div>
              </div>

              <div>
                <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-black/42">Stage × Error</div>
                {errors.data.stage_error_matrix.length === 0 ? (
                  <EmptyHint label="当前筛选下没有阶段错误矩阵。" />
                ) : (
                  <div className="overflow-x-auto rounded-[22px] border border-black/10">
                    <table className="min-w-full border-separate border-spacing-0">
                      <thead className="bg-[#f7f8fb]">
                        <tr>
                          <th className="border-b border-black/10 px-4 py-3 text-left text-[11px] uppercase tracking-[0.08em] text-black/45">Stage</th>
                          <th className="border-b border-black/10 px-4 py-3 text-left text-[11px] uppercase tracking-[0.08em] text-black/45">Error Code</th>
                          <th className="border-b border-black/10 px-4 py-3 text-right text-[11px] uppercase tracking-[0.08em] text-black/45">Count</th>
                          <th className="border-b border-black/10 px-4 py-3 text-right text-[11px] uppercase tracking-[0.08em] text-black/45">Share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {errors.data.stage_error_matrix.map((item) => (
                          <tr key={`${item.stage}:${item.error_code}`}>
                            <td className="border-b border-black/[0.06] px-4 py-3 text-[13px] text-black/76">{item.stage_label}</td>
                            <td className="border-b border-black/[0.06] px-4 py-3 text-[12px] text-black/62">{item.error_code}</td>
                            <td className="border-b border-black/[0.06] px-4 py-3 text-right text-[13px] font-semibold text-black/82">{formatNumber(item.count)}</td>
                            <td className="border-b border-black/[0.06] px-4 py-3 text-right text-[12px] text-black/58">{formatPercent(item.rate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-black/42">Stage Duration Estimates</div>
                {errors.data.stage_duration_estimates.length === 0 ? (
                  <EmptyHint label="当前筛选下还没有足够的阶段时长样本。" />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {errors.data.stage_duration_estimates.map((item) => (
                      <article key={item.stage} className="rounded-[20px] border border-black/10 bg-[#f7f8fb] px-4 py-4">
                        <div className="text-[15px] font-semibold text-black/84">{item.stage_label}</div>
                        <div className="mt-1 text-[12px] text-black/46">{item.stage}</div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-[12px] text-black/58">
                          <div>
                            <div>均值</div>
                            <div className="mt-1 text-[14px] font-semibold text-black/84">{formatDurationSeconds(item.avg_seconds)}</div>
                          </div>
                          <div>
                            <div>P50</div>
                            <div className="mt-1 text-[14px] font-semibold text-black/84">{formatDurationSeconds(item.p50_seconds)}</div>
                          </div>
                          <div>
                            <div>P95</div>
                            <div className="mt-1 text-[14px] font-semibold text-black/84">{formatDurationSeconds(item.p95_seconds)}</div>
                          </div>
                        </div>
                        <div className="mt-3 text-[12px] text-black/46">样本 {formatNumber(item.samples)}</div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <EmptyHint label="当前筛选下还没有错误数据。" />
          )}
        </PanelCard>

        <PanelCard title="Feedback" subtitle="主观反馈与失败触发原因">
          {feedback.error ? (
            <PanelError message={feedback.error} />
          ) : feedback.loading ? (
            <PanelLoading />
          ) : feedback.data ? (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-black/42">By Trigger</div>
                  {renderCountList(feedback.data.by_trigger_reason)}
                </div>
                <div>
                  <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-black/42">By Reason</div>
                  {renderCountList(feedback.data.by_reason_label)}
                </div>
              </div>

              <div>
                <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-black/42">Trigger × Reason</div>
                {feedback.data.trigger_reason_matrix.length === 0 ? (
                  <EmptyHint label="当前筛选下还没有反馈交叉数据。" />
                ) : (
                  <div className="space-y-2">
                    {feedback.data.trigger_reason_matrix.map((item) => (
                      <div
                        key={`${item.trigger_reason}:${item.reason_label}`}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-black/10 bg-[#f7f8fb] px-4 py-3"
                      >
                        <div className="text-[13px] text-black/72">
                          <span className="font-semibold text-black/84">{item.trigger_reason}</span>
                          <span className="mx-2 text-black/34">→</span>
                          <span>{item.reason_label}</span>
                        </div>
                        <div className="text-[12px] text-black/52">
                          {formatNumber(item.count)} · {formatPercent(item.rate)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-black/42">Recent Text Samples</div>
                {feedback.data.recent_text_samples.length === 0 ? (
                  <EmptyHint label="当前筛选下还没有文本反馈。" />
                ) : (
                  <div className="space-y-3">
                    {feedback.data.recent_text_samples.map((sample) => (
                      <article key={sample.event_id} className="rounded-[20px] border border-black/10 bg-[#fffaf3] px-4 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-black/48">
                          <span>{formatDateTime(sample.created_at)}</span>
                          <span>{categoryLabel(sample.category)}</span>
                        </div>
                        <div className="mt-2 text-[13px] font-semibold text-black/82">
                          {sample.trigger_reason || "unknown"} · {sample.reason_label || "unknown"}
                        </div>
                        <p className="mt-2 text-[14px] leading-[1.65] text-black/66">{sample.reason_text}</p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <EmptyHint label="当前筛选下还没有反馈数据。" />
          )}
        </PanelCard>
      </section>

      <div id="analytics-session-explorer">
      <PanelCard title="Session Explorer" subtitle="会话摘要与事件时间线">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <input
            value={sessionQuery}
            onChange={(event) => setSessionQuery(event.target.value)}
            placeholder="按 session_id 查"
            className="h-11 min-w-[220px] rounded-full border border-black/10 bg-white px-4 text-[13px] text-black/82 outline-none placeholder:text-black/34"
          />
          <input
            value={compareQuery}
            onChange={(event) => setCompareQuery(event.target.value)}
            placeholder="按 compare_id 查"
            className="h-11 min-w-[220px] rounded-full border border-black/10 bg-white px-4 text-[13px] text-black/82 outline-none placeholder:text-black/34"
          />
          <button
            type="button"
            onClick={() => {
              const nextSession = sessionQuery.trim();
              const nextCompare = compareQuery.trim();
              void loadSessionDetail({
                sessionId: nextSession || undefined,
                compareId: nextSession ? undefined : nextCompare || undefined,
              });
            }}
            className="inline-flex h-11 items-center rounded-full bg-black px-4 text-[13px] font-semibold text-white hover:bg-black/88"
          >
            查看时间线
          </button>
          <button
            type="button"
            onClick={() => {
              setSessionQuery("");
              setCompareQuery("");
              setActiveSessionId("");
              setActiveCompareId("");
              setSessionLocationRegionKey("");
              setSessionDetail({
                loading: false,
                data: sessionList.data,
                error: sessionList.error,
              });
            }}
            className="inline-flex h-11 items-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-semibold text-black/68 hover:bg-black/[0.03]"
          >
            回到最近会话
          </button>
        </div>

        {sessionLocationRegionKey ? (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[20px] border border-[#d9e4f8] bg-[#f4f8ff] px-4 py-3">
            <div className="text-[13px] text-[#305a98]">
              会话已按城市 / 经纬度筛选：<span className="font-semibold">{activeLocationRegionLabel}</span>
            </div>
            <button
              type="button"
              onClick={() =>
                startTransition(() => {
                  setSessionLocationRegionKey("");
                })
              }
              className="inline-flex h-8 items-center rounded-full border border-[#c4d6f6] bg-white px-3 text-[12px] font-semibold text-[#305a98]"
            >
              清除区域钻取
            </button>
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-3">
            <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-black/42">Recent Sessions</div>
            {sessionList.error ? (
              <PanelError message={sessionList.error} />
            ) : sessionList.loading ? (
              <PanelLoading />
            ) : sessionList.data && sessionList.data.items.length > 0 ? (
              sessionList.data.items.map((item) => (
                <button
                  key={item.session_id}
                  type="button"
                  onClick={() =>
                    void loadSessionDetail(
                      item.session_id.startsWith("compare::")
                        ? { compareId: item.compare_id || undefined }
                        : { sessionId: item.session_id },
                    )
                  }
                  className="block w-full rounded-[22px] border border-black/10 bg-[#f7f8fb] px-4 py-4 text-left hover:bg-[#f0f3f7]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-[15px] font-semibold tracking-[-0.02em] text-black/84">{item.session_id}</div>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneForOutcome(item.outcome)}`}>
                      {outcomeLabel(item.outcome)}
                    </span>
                  </div>
                  <div className="mt-2 text-[13px] text-black/60">
                    {categoryLabel(item.category)} · {item.owner_label || "匿名设备"} · {formatDateTime(item.last_event_at)}
                  </div>
                  <div className="mt-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] ${
                        hasLocationContext(item.latest_location_label, item.latest_location_time_zone)
                          ? "border-[#d6e6ff] bg-[#f4f8ff] text-[#305a98]"
                          : "border-black/10 bg-white text-black/48"
                      }`}
                    >
                      {buildLocationBadgeLabel(item.latest_location_label, item.latest_location_time_zone)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-black/52">
                    <span>事件 {formatNumber(item.event_count)}</span>
                    <span>时长 {formatDurationSeconds(item.duration_seconds)}</span>
                    {item.compare_id ? <span>compare {item.compare_id}</span> : null}
                    {item.latest_error_code ? <span>错误 {item.latest_error_code}</span> : null}
                  </div>
                </button>
              ))
            ) : (
              <EmptyHint label="当前筛选下还没有会话。" />
            )}
          </div>

          <div>
            <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-black/42">Timeline</div>
            {sessionDetail.error ? (
              <PanelError message={sessionDetail.error} />
            ) : sessionDetail.loading ? (
              <PanelLoading />
            ) : sessionDetail.data && sessionDetail.data.timeline.length > 0 ? (
              <div className="space-y-3">
                <div className="rounded-[22px] border border-black/10 bg-white px-4 py-4">
                  <div className="text-[14px] font-semibold text-black/84">
                    当前会话 {sessionDetail.data.selected_session_id || "-"}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[12px] text-black/52">
                    {sessionDetail.data.selected_compare_id ? <span>compare {sessionDetail.data.selected_compare_id}</span> : null}
                    <span>事件数 {formatNumber(sessionDetail.data.timeline.length)}</span>
                  </div>
                  <div className="mt-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium ${
                        hasLocationContext(
                          selectedSessionSummary?.latest_location_label,
                          selectedSessionSummary?.latest_location_time_zone,
                        )
                          ? "border-[#d6e6ff] bg-[#f4f8ff] text-[#305a98]"
                          : "border-black/10 bg-[#f7f8fb] text-black/48"
                      }`}
                    >
                      {buildLocationBadgeLabel(
                        selectedSessionSummary?.latest_location_label,
                        selectedSessionSummary?.latest_location_time_zone,
                      )}
                    </span>
                  </div>
                </div>
                {sessionTimelinePresentation ? (
                  <div className={`rounded-[24px] border px-4 py-4 ${phaseSectionClasses(sessionTimelinePresentation.heroPhase)}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-black/45">Journey Summary</div>
                        <div className="mt-2 text-[20px] font-semibold tracking-[-0.03em] text-black/86">
                          {sessionTimelinePresentation.headline}
                        </div>
                        <p className="mt-2 max-w-[680px] text-[13px] leading-[1.7] text-black/64">
                          {sessionTimelinePresentation.summary}
                        </p>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/72 px-3 py-1 text-[11px] font-semibold text-black/58">
                        <span className={`h-2.5 w-2.5 rounded-full ${phaseDotClass(sessionTimelinePresentation.heroPhase)}`} />
                        {phaseLabel(sessionTimelinePresentation.heroPhase)}
                      </div>
                    </div>

                    <div className="mt-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-medium ${
                          hasLocationContext(
                            selectedSessionSummary?.latest_location_label,
                            selectedSessionSummary?.latest_location_time_zone,
                          )
                            ? "border-[#d6e6ff] bg-white/80 text-[#305a98]"
                            : "border-black/10 bg-white/70 text-black/48"
                        }`}
                      >
                        {buildLocationBadgeLabel(
                          selectedSessionSummary?.latest_location_label,
                          selectedSessionSummary?.latest_location_time_zone,
                        )}
                      </span>
                    </div>

                    {sessionTimelinePresentation.flowSteps.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {sessionTimelinePresentation.flowSteps.map((step, index) => (
                          <div
                            key={`${step}-${index}`}
                            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3 py-2 text-[12px] font-medium text-black/72"
                          >
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black text-[11px] font-semibold text-white">
                              {index + 1}
                            </span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {sessionTimelinePresentation?.groups.map((group) => (
                  <section key={group.key} className={`rounded-[22px] border px-4 py-4 ${phaseSectionClasses(group.phase)}`}>
                    <div className="mb-3 flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${phaseDotClass(group.phase)}`} />
                      <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-black/45">{phaseLabel(group.phase)}</div>
                    </div>
                    <div className="space-y-3">
                      {group.items.map((item) => (
                        <TimelineItem key={`${group.key}-${item.stepNumber}`} item={item} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <EmptyHint label="还没有选中的会话时间线。" />
            )}
          </div>
        </div>
      </PanelCard>
      </div>
    </section>
  );
}

function DashboardMetricCard({
  title,
  value,
  detail,
  loading,
  error,
  accent,
}: {
  title: string;
  value: string;
  detail: string;
  loading: boolean;
  error: string | null;
  accent: "emerald" | "amber" | "slate" | "stone";
}) {
  const tone =
    accent === "emerald"
      ? "bg-[#eff8f2] text-[#16553f]"
      : accent === "amber"
        ? "bg-[#fff5df] text-[#8f5a10]"
        : accent === "slate"
          ? "bg-[#eef3f8] text-[#30485f]"
          : "bg-[#f4efe8] text-[#65584b]";

  return (
    <article className="rounded-[28px] border border-black/10 bg-white px-5 py-5 shadow-[0_18px_44px_rgba(16,24,40,0.06)]">
      <div className="text-[12px] tracking-[0.08em] text-black/45">{title}</div>
      {error ? (
        <div className="mt-4 rounded-[18px] border border-[#f0b3ab] bg-[#fff4f2] px-3 py-3 text-[13px] leading-[1.6] text-[#7f2b21]">
          {error}
        </div>
      ) : loading ? (
        <div className="mt-4 h-14 animate-pulse rounded-[18px] bg-black/6" />
      ) : (
        <>
          <div className="mt-3 flex items-center gap-3">
            <div className="text-[34px] font-semibold tracking-[-0.04em] text-black/88">{value}</div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.06em] ${tone}`}>LIVE</span>
          </div>
          <div className="mt-3 text-[13px] leading-[1.6] text-black/60">{detail}</div>
        </>
      )}
    </article>
  );
}

function PanelCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[32px] border border-black/10 bg-white px-6 py-6 shadow-[0_18px_44px_rgba(16,24,40,0.06)]">
      <div className="mb-5">
        <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-black/42">{title}</div>
        <h3 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-black/88">{subtitle}</h3>
      </div>
      {children}
    </section>
  );
}

function CompactStat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-black/10 bg-[#f7f8fb] px-4 py-4">
      <div className="text-[12px] text-black/48">{title}</div>
      <div className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-black/86">{value}</div>
    </div>
  );
}

function PanelError({ message }: { message: string }) {
  return <div className="rounded-[22px] border border-[#f0b3ab] bg-[#fff4f2] px-4 py-4 text-[13px] leading-[1.65] text-[#7f2b21]">{message}</div>;
}

function PanelLoading() {
  return (
    <div className="space-y-3">
      <div className="h-24 animate-pulse rounded-[22px] bg-black/6" />
      <div className="h-24 animate-pulse rounded-[22px] bg-black/6" />
      <div className="h-24 animate-pulse rounded-[22px] bg-black/6" />
    </div>
  );
}

function EmptyHint({ label }: { label: string }) {
  return <div className="rounded-[20px] border border-dashed border-black/12 bg-[#fafbfc] px-4 py-5 text-[13px] leading-[1.65] text-black/54">{label}</div>;
}

function HoverHint({ label }: { label: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-black/10 bg-white text-[11px] font-semibold text-black/48"
        aria-label={label}
      >
        ?
      </button>
      <span className="pointer-events-none absolute left-0 top-full z-10 mt-2 w-[220px] rounded-[14px] border border-black/10 bg-white px-3 py-2 text-[11px] leading-[1.6] text-black/62 opacity-0 shadow-[0_12px_30px_rgba(16,24,40,0.08)] transition group-hover:opacity-100 group-focus-within:opacity-100">
        {label}
      </span>
    </span>
  );
}

function TimelineItem({ item }: { item: SessionTimelineNarrative & { stepNumber: number } }) {
  return (
    <article className="rounded-[20px] border border-black/10 bg-white/78 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-black px-2 text-[11px] font-semibold text-white">
              {item.stepNumber}
            </span>
            <div className="text-[15px] font-semibold tracking-[-0.02em] text-black/84">{item.title}</div>
          </div>
          <div className="mt-2 text-[12px] text-black/48">
            关键节点 · {item.flowLabel}
          </div>
        </div>
        <div className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-[11px] font-semibold text-black/58">
          {phaseLabel(item.phase)}
        </div>
      </div>

      {item.summary ? <p className="mt-3 text-[13px] leading-[1.7] text-black/66">{item.summary}</p> : null}

      {item.meta.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-black/58">
          {item.meta.map((metaItem) => (
            <span key={metaItem} className="rounded-full border border-black/10 bg-[#f7f8fb] px-2.5 py-1">
              {metaItem}
            </span>
          ))}
        </div>
      ) : null}

      {item.rawMeta.length > 0 ? (
        <div className="mt-3 text-[11px] leading-[1.6] text-black/42">
          原始信号：{item.rawMeta.join(" · ")}
        </div>
      ) : null}
    </article>
  );
}
