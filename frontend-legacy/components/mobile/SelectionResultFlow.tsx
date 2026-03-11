"use client";

import Image from "next/image";
import Link from "next/link";
import {
  MobileSelectionFitExplanationItem,
  MobileSelectionResolveResponse,
  resolveImageUrl,
} from "@/lib/api";
import { describeMobileRouteFocus } from "@/lib/mobile/routeCopy";

const SOURCE_LABELS: Record<string, string> = {
  featured_slot: "主推槽位",
  route_mapping: "类型映射",
  category_fallback: "品类兜底",
};

const FIT_LEVEL_LABELS: Record<string, string> = {
  high: "高匹配",
  medium: "中匹配",
  low: "低匹配",
};

type Props = {
  titlePrefix: string;
  emptyImageLabel: string;
  startHref: string;
  profileHref: string;
  resolved: MobileSelectionResolveResponse;
  explanation?: MobileSelectionFitExplanationItem | null;
  explanationError?: string | null;
};

export default function SelectionResultFlow({
  titlePrefix,
  emptyImageLabel,
  startHref,
  profileHref,
  resolved,
  explanation,
  explanationError,
}: Props) {
  const product = resolved.recommended_product;
  const matrix = explanation?.matrix_analysis || resolved.matrix_analysis;
  const routeFocus = describeMobileRouteFocus(resolved.category, resolved.route.key);
  const matrixRoutes = [...matrix.routes].sort((a, b) => a.rank - b.rank);
  const nonExcludedScores = matrixRoutes
    .map((item) => item.score_after_mask)
    .filter((value): value is number => typeof value === "number");
  const minScore = nonExcludedScores.length > 0 ? Math.min(...nonExcludedScores) : 0;
  const maxScore = nonExcludedScores.length > 0 ? Math.max(...nonExcludedScores) : 1;
  const scoreSpan = Math.max(1, maxScore - minScore);

  return (
    <section className="pb-12">
      <div className="text-[13px] font-medium text-black/45">{titlePrefix} · 推荐解释</div>
      <h1 className="mt-2 text-[30px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/92">
        {resolved.route.title}
      </h1>
      <p className="mt-3 text-[15px] leading-[1.65] text-black/66">{routeFocus}</p>

      <article className="mt-6 rounded-3xl border border-black/10 bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[#cfe2ff] bg-[#f4f8ff] px-3 py-1 text-[11px] text-[#244f9e]">
            {resolved.route.title}
          </span>
          <span className="rounded-full border border-black/12 bg-[#fafafa] px-3 py-1 text-[11px] text-black/58">
            推荐来源：{SOURCE_LABELS[explanation?.recommendation_source || resolved.recommendation_source] || "未知"}
          </span>
          <span className="rounded-full border border-black/12 bg-[#fafafa] px-3 py-1 text-[11px] text-black/58">
            规则版本：{resolved.rules_version}
          </span>
          {explanation?.needs_review ? (
            <span className="rounded-full border border-[#f4dfb1] bg-[#fffaf0] px-3 py-1 text-[11px] text-[#8c5a00]">
              待复核
            </span>
          ) : null}
        </div>

        <h2 className="mt-3 text-[22px] leading-[1.3] font-semibold tracking-[-0.02em] text-black/88">
          {explanation?.summary_headline || `你当前更适合 ${resolved.route.title}`}
        </h2>
        <p className="mt-2 text-[14px] leading-[1.65] text-black/66">
          {explanation?.summary_text || "系统已根据你的选择收敛到当前路线，并据此挑出主推产品。"}
        </p>

        <div className="mt-5 flex items-start gap-4">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-black/[0.03]">
            {product.image_url ? (
              <Image
                src={resolveImageUrl(product)}
                alt={product.name ?? product.brand ?? "产品图片"}
                fill
                className="object-contain p-2"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[12px] text-black/40">{emptyImageLabel}</div>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-medium text-black/50">当前主推</div>
            <div className="mt-1 text-[19px] leading-[1.3] font-semibold tracking-[-0.01em] text-black/90">
              {product.brand || "未知品牌"}
            </div>
            <div className="mt-1 text-[15px] leading-[1.45] text-black/75">{product.name || "未命名产品"}</div>
          </div>
        </div>

        <section className="mt-6 rounded-2xl bg-black/[0.03] px-4 py-3">
          <h2 className="text-[14px] font-semibold text-black/85">你的选择记录</h2>
          <ul className="mt-2 space-y-1.5">
            {resolved.choices.map((item) => (
              <li key={`${item.key}-${item.value}`} className="text-[13px] leading-[1.5] text-black/68">
                {item.key} · {item.label}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[14px] font-semibold text-black/85">各二级路线得分</h2>
            {matrix.top2.length >= 2 ? (
              <div className="text-[11px] text-black/48">
                Top2 差值 {Math.max(0, matrix.top2[0].score_after_mask - matrix.top2[1].score_after_mask)}
              </div>
            ) : null}
          </div>
          <div className="mt-3 space-y-2">
            {matrixRoutes.map((item) => {
              const renderScore = typeof item.score_after_mask === "number" ? item.score_after_mask : item.score_before_mask;
              const widthPct = Math.max(12, Math.min(100, ((renderScore - minScore) / scoreSpan) * 100));
              return (
                <div
                  key={item.route_key}
                  className={`rounded-2xl border px-3 py-3 ${item.is_excluded ? "border-[#f0d6d2] bg-[#fff7f6]" : "border-black/8 bg-[#fafafa]"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-black/84">
                        #{item.rank} {item.route_title}
                      </div>
                      <div className="mt-0.5 text-[11px] text-black/52">{item.route_key}</div>
                    </div>
                    <div className="shrink-0 text-right text-[11px] text-black/56">
                      <div>原始 {item.score_before_mask}</div>
                      <div>{item.is_excluded ? "已屏蔽" : `生效 ${item.score_after_mask}`}</div>
                    </div>
                  </div>
                  <div className="mt-2 h-2.5 rounded-full bg-black/[0.06]">
                    <div
                      className={`h-2.5 rounded-full ${item.is_excluded ? "bg-[#e3b3a9]" : "bg-black/70"}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {matrix.triggered_vetoes.length > 0 ? (
            <div className="mt-3 rounded-2xl border border-[#f4dfb1] bg-[#fffaf0] px-3 py-3">
              <div className="text-[13px] font-semibold text-[#8c5a00]">防线触发</div>
              <ul className="mt-2 space-y-1.5 text-[12px] leading-[1.55] text-[#7a5500]">
                {matrix.triggered_vetoes.map((item, idx) => (
                  <li key={`${item.trigger}-${idx}`}>
                    {item.note || item.trigger}；排除{" "}
                    {item.excluded_routes.map((route) => route.route_title).join("、") || "无"}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        {explanation ? (
          <>
            <section className="mt-6">
              <h2 className="text-[14px] font-semibold text-black/85">为什么判到这条路线</h2>
              <ul className="mt-2 space-y-2">
                {explanation.route_rationale.map((item) => (
                  <li key={`${item.question_key}-${item.answer_label}`} className="rounded-2xl border border-black/8 bg-[#fafafa] px-3 py-3">
                    <div className="text-[13px] font-semibold text-black/84">
                      {item.question_title} · {item.answer_label}
                    </div>
                    <div className="mt-1 text-[12px] text-black/56">对当前路线贡献 {item.route_delta >= 0 ? "+" : ""}{item.route_delta}</div>
                    <div className="mt-1 text-[12px] leading-[1.55] text-black/60">{item.reason}</div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-6">
              <h2 className="text-[14px] font-semibold text-black/85">主推和你的关系</h2>
              {explanation.product_fit.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {explanation.product_fit.map((item) => (
                    <div key={item.diagnostic_key} className="rounded-2xl border border-black/8 bg-[#fafafa] px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[13px] font-semibold text-black/84">{item.diagnostic_label}</div>
                        <div className="text-[11px] text-black/56">
                          期望 {item.desired_level} · 当前 {item.product_score}/5 · {FIT_LEVEL_LABELS[item.fit_level]}
                        </div>
                      </div>
                      <div className="mt-1 text-[12px] leading-[1.55] text-black/60">{item.reason}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[13px] text-black/56">当前主推还缺少足够的产品侧分析，暂时只能解释路线，不能精确解释产品适配度。</p>
              )}
            </section>

            <div className="mt-6 grid grid-cols-1 gap-3">
              <ListCard title="当前匹配点" items={explanation.matched_points} tone="green" />
              <ListCard title="你需要知道的边界" items={explanation.tradeoffs} tone="amber" />
              <ListCard title="系统防线与提醒" items={explanation.guardrails} tone="blue" />
            </div>
          </>
        ) : explanationError ? (
          <section className="mt-6 rounded-2xl border border-[#f0d6d2] bg-[#fff7f6] px-4 py-3 text-[13px] leading-[1.55] text-[#9a3d2e]">
            推荐解释加载失败：{explanationError}
          </section>
        ) : null}

        {!explanation ? (
          <section className="mt-6">
            <h2 className="text-[14px] font-semibold text-black/85">规则命中</h2>
            <ul className="mt-2 space-y-2">
              {resolved.rule_hits.map((hit, idx) => (
                <li key={`${hit.rule}-${idx}`} className="text-[13px] leading-[1.55] text-black/67">
                  {hit.rule} · {hit.effect}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>

      <div className="mt-8 flex flex-wrap gap-2.5">
        <Link
          href={resolved.links.product}
          className="inline-flex h-11 items-center justify-center rounded-full bg-black px-5 text-[15px] font-semibold tracking-[-0.01em] text-white active:opacity-90"
        >
          查看产品详情
        </Link>
        <Link
          href={resolved.links.wiki}
          className="inline-flex h-11 items-center justify-center rounded-full border border-black/15 px-5 text-[15px] font-semibold text-black/80 active:bg-black/[0.03]"
        >
          查看成份百科
        </Link>
        <Link
          href={startHref}
          className="inline-flex h-11 items-center justify-center rounded-full border border-black/15 px-5 text-[15px] font-semibold text-black/80 active:bg-black/[0.03]"
        >
          重新判断一次
        </Link>
        <Link
          href={profileHref}
          className="inline-flex h-11 items-center justify-center rounded-full border border-black/15 px-5 text-[15px] font-semibold text-black/80 active:bg-black/[0.03]"
        >
          修改个人选项
        </Link>
        <Link
          href={`/m/compare?category=${encodeURIComponent(resolved.category)}`}
          className="inline-flex h-11 items-center justify-center rounded-full border border-black/15 px-5 text-[15px] font-semibold text-black/80 active:bg-black/[0.03]"
        >
          和我在用的对比
        </Link>
      </div>
    </section>
  );
}

function ListCard({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "green" | "amber" | "blue";
}) {
  const toneClass =
    tone === "green"
      ? "border-[#d5eadb] bg-[#f4fbf5]"
      : tone === "amber"
        ? "border-[#f4dfb1] bg-[#fffaf0]"
        : "border-[#d3e2ff] bg-[#f5f8ff]";
  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <div className="text-[13px] font-semibold text-black/84">{title}</div>
      <ul className="mt-2 space-y-1.5 text-[12px] leading-[1.55] text-black/62">
        {items.length > 0 ? items.map((item) => <li key={item}>• {item}</li>) : <li>-</li>}
      </ul>
    </div>
  );
}
