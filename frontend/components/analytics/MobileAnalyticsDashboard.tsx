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
      return "结果页";
    case "mobile_compare":
      return "横向对比";
    case "my_use":
      return "我的在用";
    default:
      return valueOrEmpty(page) || "unknown";
  }
}

function resultCtaLabel(value?: string | null): string {
  switch (valueOrEmpty(value)) {
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

function rageTargetLabel(item: MobileAnalyticsRageClickTargetItem): string {
  const raw = valueOrEmpty(item.target_id) || "unknown";
  if (raw.startsWith("result:cta:")) {
    return `结果页 · ${raw.replace("result:cta:", "")}`;
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

export default function MobileAnalyticsDashboard() {
  const [sinceHours, setSinceHours] = useState<number>(24 * 7);
  const [category, setCategory] = useState<string>("all");
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

  useEffect(() => {
    let cancelled = false;
    const baseQuery: MobileAnalyticsQuery = {
      sinceHours,
      category: category === "all" ? undefined : category,
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
        fetchMobileAnalyticsOverview(baseQuery),
        fetchMobileAnalyticsFunnel(baseQuery),
        fetchMobileAnalyticsErrors(baseQuery),
        fetchMobileAnalyticsFeedback(baseQuery),
        fetchMobileAnalyticsExperience(baseQuery),
        fetchMobileAnalyticsSessions({ ...baseQuery, limit: 10 }),
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
              ...baseQuery,
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
  }, [category, refreshNonce, sinceHours]);

  async function loadSessionDetail(next: { sessionId?: string; compareId?: string }) {
    const baseQuery: MobileAnalyticsQuery = {
      sinceHours,
      category: category === "all" ? undefined : category,
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

  return (
    <section className="mt-8 space-y-6">
      <div className="rounded-[32px] border border-black/10 bg-white px-6 py-6 shadow-[0_18px_44px_rgba(16,24,40,0.06)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-black/42">Live Dashboard</div>
            <h2 className="mt-2 text-[30px] font-semibold tracking-[-0.03em] text-black/88">真实数据面板</h2>
            <p className="mt-2 max-w-[720px] text-[14px] leading-[1.7] text-black/62">
              这里开始展示真实聚合结果。现在已经能直接看 overview、漏斗、体验信号、阶段错误、反馈分布和会话时间线，不再停留在文档层。
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
              onChange={(event) => startTransition(() => setCategory(event.target.value))}
              className="bg-transparent text-[13px] font-semibold text-black/82 outline-none"
            >
              {CATEGORY_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
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
          title="活跃会话"
          value={formatNumber(overview.data?.sessions)}
          detail={`设备 ${formatNumber(overview.data?.owners)} · 事件 ${formatNumber(overview.data?.total_events)}`}
          loading={overview.loading}
          error={overview.error}
          accent="emerald"
        />
        <DashboardMetricCard
          title="CTA 点击率"
          value={formatPercent(overview.data?.cta_ctr)}
          detail={`${formatNumber(overview.data?.cta_click)} / ${formatNumber(overview.data?.cta_expose)} 会话`}
          loading={overview.loading}
          error={overview.error}
          accent="amber"
        />
        <DashboardMetricCard
          title="use → compare"
          value={formatPercent(overview.data?.use_to_compare_rate)}
          detail={`${formatNumber(overview.data?.compare_run_start)} 次开始分析`}
          loading={overview.loading}
          error={overview.error}
          accent="slate"
        />
        <DashboardMetricCard
          title="分析完成率"
          value={formatPercent(overview.data?.compare_completion_rate)}
          detail={`结果页到达 ${formatPercent(overview.data?.result_reach_rate)}`}
          loading={overview.loading}
          error={overview.error}
          accent="stone"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <PanelCard title="Funnel" subtitle="从百科详情到结果页的真实漏斗">
          {funnel.error ? (
            <PanelError message={funnel.error} />
          ) : funnel.loading ? (
            <PanelLoading />
          ) : funnel.data && funnel.data.steps.length > 0 ? (
            <div className="space-y-4">
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

        <PanelCard title="Overview 补充" subtitle="把关键行为和反馈转成经营信号">
          {overview.error ? (
            <PanelError message={overview.error} />
          ) : overview.loading ? (
            <PanelLoading />
          ) : overview.data ? (
            <div className="grid gap-3 md:grid-cols-2">
              <CompactStat title="百科详情页会话" value={formatNumber(overview.data.wiki_detail_views)} />
              <CompactStat title="use 页会话" value={formatNumber(overview.data.use_page_views)} />
              <CompactStat title="品类点击会话" value={formatNumber(overview.data.use_category_clicks)} />
              <CompactStat title="compare 成功" value={formatNumber(overview.data.compare_run_success)} />
              <CompactStat title="结果页到达" value={formatNumber(overview.data.compare_result_view)} />
              <CompactStat title="反馈提交率" value={formatPercent(overview.data.feedback_submit_rate)} />
            </div>
          ) : (
            <EmptyHint label="当前筛选下还没有概览数据。" />
          )}
        </PanelCard>
      </section>

      <PanelCard title="Experience Signals" subtitle="列表兴趣、结果阅读与误触停滞">
        {experience.error ? (
          <PanelError message={experience.error} />
        ) : experience.loading ? (
          <PanelLoading />
        ) : experience.data ? (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <CompactStat
                title="产品列表 CTR"
                value={`${formatPercent(experience.data.wiki_product_ctr)} · ${formatNumber(experience.data.wiki_product_clicks)}/${formatNumber(experience.data.wiki_product_list_views)}`}
              />
              <CompactStat
                title="成分列表 CTR"
                value={`${formatPercent(experience.data.wiki_ingredient_ctr)} · ${formatNumber(experience.data.wiki_ingredient_clicks)}/${formatNumber(experience.data.wiki_ingredient_list_views)}`}
              />
              <CompactStat title="结果页平均停留" value={formatDurationMs(experience.data.avg_result_dwell_ms)} />
              <CompactStat
                title="结果页深读率"
                value={`${formatPercent(experience.data.result_scroll_75_rate)} · 75% / ${formatPercent(experience.data.result_scroll_100_rate)} · 100%`}
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-5">
                <div>
                  <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-black/42">阅读与离开</div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <article className="rounded-[20px] border border-black/10 bg-[#f7f8fb] px-4 py-4">
                      <div className="text-[12px] text-black/48">结果页离开</div>
                      <div className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-black/86">
                        {formatNumber(experience.data.compare_result_leaves)}
                      </div>
                      <div className="mt-2 text-[12px] text-black/52">
                        结果页访问 {formatNumber(experience.data.compare_result_views)}
                      </div>
                    </article>
                    <article className="rounded-[20px] border border-black/10 bg-[#f7f8fb] px-4 py-4">
                      <div className="text-[12px] text-black/48">结果页 P50 停留</div>
                      <div className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-black/86">
                        {formatDurationMs(experience.data.p50_result_dwell_ms)}
                      </div>
                      <div className="mt-2 text-[12px] text-black/52">
                        rage {formatNumber(experience.data.rage_clicks)} · stall {formatNumber(experience.data.stall_detected)}
                      </div>
                    </article>
                  </div>
                </div>

                <div>
                  <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-black/42">结果页 CTA 点击</div>
                  {experience.data.result_cta_clicks.length === 0 ? (
                    <EmptyHint label="当前筛选下还没有结果页 CTA 点击。" />
                  ) : (
                    <div className="space-y-3">
                      {experience.data.result_cta_clicks.map((item) => (
                        <div key={item.key}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[13px] font-medium text-black/72">{resultCtaLabel(item.key)}</div>
                            <div className="text-[12px] text-black/52">
                              {formatNumber(item.count)} · {formatPercent(item.rate)}
                            </div>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-black/6">
                            <div
                              className="h-2 rounded-full bg-[#0f7c59]"
                              style={{ width: item.count > 0 ? `${Math.max(8, Math.round(item.rate * 100))}%` : "0%" }}
                            />
                          </div>
                        </div>
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
                </div>
                {sessionDetail.data.timeline.map((item) => (
                  <TimelineItem key={item.event_id} item={item} />
                ))}
              </div>
            ) : (
              <EmptyHint label="还没有选中的会话时间线。" />
            )}
          </div>
        </div>
      </PanelCard>
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

function TimelineItem({ item }: { item: MobileAnalyticsSessionEventItem }) {
  return (
    <article className="rounded-[20px] border border-black/10 bg-[#f7f8fb] px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[15px] font-semibold tracking-[-0.02em] text-black/84">{item.name}</div>
          <div className="mt-1 text-[12px] text-black/48">
            {formatDateTime(item.created_at)} {item.page ? `· ${item.page}` : ""}
          </div>
        </div>
        <div className="text-right text-[12px] text-black/52">
          {item.stage ? <div>stage: {item.stage}</div> : null}
          {item.error_code ? <div>error: {item.error_code}</div> : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-black/52">
        {item.category ? <span>{categoryLabel(item.category)}</span> : null}
        {item.compare_id ? <span>compare {item.compare_id}</span> : null}
        {typeof item.dwell_ms === "number" ? <span>dwell {item.dwell_ms}ms</span> : null}
        {item.trigger_reason ? <span>trigger {item.trigger_reason}</span> : null}
        {item.reason_label ? <span>reason {item.reason_label}</span> : null}
      </div>
      {item.detail ? <p className="mt-3 text-[13px] leading-[1.65] text-black/64">{item.detail}</p> : null}
    </article>
  );
}
