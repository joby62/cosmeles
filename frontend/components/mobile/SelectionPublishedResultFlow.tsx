import Image from "next/image";
import AddToBagButton from "@/components/mobile/AddToBagButton";
import MobileEventBeacon from "@/components/mobile/MobileEventBeacon";
import MobilePageAnalytics from "@/components/mobile/MobilePageAnalytics";
import MobileTrackedLink from "@/components/mobile/MobileTrackedLink";
import DecisionResultCompareEntryLink from "@/features/mobile-decision/DecisionResultCompareEntryLink";
import { appendMobileUtilityRouteState } from "@/features/mobile-utility/routeState";
import {
  fetchMobileUserProducts,
  MobileSelectionPublishedResult,
  MobileSelectionResultBlock,
  resolveImageUrl,
} from "@/lib/api";
import type { MobileSelectionCategory } from "@/lib/api";
import type { MobileResultCta } from "@/lib/mobile/resultCta";
import { describeMobileRouteFocus } from "@/lib/mobile/routeCopy";

type Props = {
  titlePrefix: string;
  emptyImageLabel: string;
  startHref: string;
  profileHref: string;
  resultHref: string;
  result: MobileSelectionPublishedResult;
  analyticsContext: {
    page: string;
    route: string;
    source: string;
  };
};

type ParsedBlock = {
  id: string;
  title: string;
  subtitle: string;
  note: string;
  items: string[];
};

type ResultReason = {
  id: string;
  title: string;
  body: string;
  details: string[];
};

type ResultAction = {
  eventName: string;
  resultCta: MobileResultCta;
  action: string;
  label: string;
  href: string;
};

export default async function SelectionPublishedResultFlow({
  titlePrefix,
  emptyImageLabel,
  startHref,
  resultHref,
  result,
  analyticsContext,
}: Props) {
  const routeFocus = describeMobileRouteFocus(result.category, result.route.key);
  const orderedBlocks = orderBlocks(result.blocks, result.display_order);
  const hero = findBlock(orderedBlocks, "hero");
  const shareTitle = normalizeText(result.share_copy.title);
  const shareSubtitle = normalizeText(result.share_copy.subtitle);
  const shareCaption = normalizeText(result.share_copy.caption);
  const summaryHeadline =
    shareTitle ||
    hero?.title ||
    shareSubtitle ||
    `你当前更适合先走 ${result.route.title} 这条线`;
  const summaryBody =
    shareSubtitle ||
    hero?.subtitle ||
    shareCaption ||
    normalizeText(result.micro_summary) ||
    routeFocus ||
    `先按 ${result.route.title} 这条线判断当前更适合你的护理方向。`;
  const summaryHighlights = buildSummaryHighlights(hero, summaryBody, shareCaption);

  const reasons = buildReasons(orderedBlocks, result);
  const doubtResolutionActions = buildDoubtResolutionActions(result, resultHref, analyticsContext.source);
  const taskSwitchActions = buildTaskSwitchActions(startHref);
  const generatedAt = formatGeneratedAt(result.meta?.generated_at);
  const product = result.recommended_product;
  let currentUploadId: string | null = null;

  try {
    const currentProducts = await fetchMobileUserProducts({
      category: result.category as MobileSelectionCategory,
      limit: 6,
    });
    currentUploadId =
      currentProducts.items.find((item) => normalizeText(item.source_upload_id))?.source_upload_id || null;
  } catch {
    currentUploadId = null;
  }

  return (
    <section className="pb-14">
      <MobilePageAnalytics
        page={analyticsContext.page}
        route={analyticsContext.route}
        source={analyticsContext.source}
        category={result.category}
      />
      <MobileEventBeacon
        name="result_view"
        props={{
          page: analyticsContext.page,
          route: analyticsContext.route,
          source: analyticsContext.source,
          category: result.category,
          scenario_id: result.scenario_id,
        }}
      />

      <section className="rounded-[34px] border border-[#e4ecf8] bg-[linear-gradient(180deg,#ffffff_0%,#f5f8fe_100%)] px-6 pb-6 pt-6 shadow-[0_22px_52px_rgba(30,59,114,0.08)]">
        <div className="inline-flex rounded-full border border-[#dde7f7] bg-white/88 px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.03em] text-[#3f5f94]">
          {titlePrefix}结果
        </div>
        <h1 className="mt-5 text-[33px] leading-[1.08] font-semibold tracking-[-0.04em] text-[#142036]">
          {summaryHeadline}
        </h1>
        <p className="mt-4 max-w-[29rem] text-[15px] leading-[1.75] text-[#53647d]">{summaryBody}</p>
        {summaryHighlights.length > 0 ? (
          <ul className="mt-4 space-y-2 text-[14px] leading-[1.65] text-[#51627a]">
            {summaryHighlights.map((item) => (
              <li key={item} className="rounded-[18px] border border-[#dfe8f8] bg-white/86 px-4 py-3">
                {item}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-8 rounded-[30px] border border-white/90 bg-white/92 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
          <div className="text-[12px] font-medium text-[#607089]">一个结果</div>
          <div className="mt-4 grid gap-5 sm:grid-cols-[248px,1fr] sm:items-center">
            <div className="relative mx-auto h-44 w-full max-w-[248px] overflow-hidden rounded-[26px] border border-black/6 bg-[#f4f7fc]">
              {product.image_url ? (
                <Image
                  src={resolveImageUrl(product)}
                  alt={product.name ?? product.brand ?? "产品图片"}
                  fill
                  className="object-contain p-4"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[12px] text-black/40">
                  {emptyImageLabel}
                </div>
              )}
            </div>

            <div>
              <div className="text-[12px] font-medium text-[#607089]">当前更适合先从这款或这类承接</div>
              {product.brand ? <div className="mt-2 text-[13px] font-medium text-[#6b7d97]">{product.brand}</div> : null}
              <div className="mt-1 text-[23px] leading-[1.32] font-semibold tracking-[-0.03em] text-[#162339]">
                {product.name || "未命名产品"}
              </div>
              <p className="mt-3 text-[14px] leading-[1.7] text-[#55677f]">
                {shareCaption || "这一步先让产品服务于当前路线，而不是反过来拿产品定义你。"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-[28px] border border-black/8 bg-white/90 px-5 py-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
        <div className="text-[12px] font-semibold tracking-[0.06em] text-black/42">三个理由</div>
        <div className="mt-4 space-y-3">
          {reasons.map((reason, index) => (
            <article
              key={reason.id}
              className="rounded-[24px] border border-black/8 bg-[#fafbfd] px-4 py-4"
            >
              <div className="text-[11px] font-semibold tracking-[0.06em] text-[#5f7597]">理由 {index + 1}</div>
              <h2 className="mt-2 text-[18px] leading-[1.34] font-semibold tracking-[-0.02em] text-[#18253b]">
                {reason.title}
              </h2>
              <p className="mt-2 text-[14px] leading-[1.72] text-[#55677f]">{reason.body}</p>
              {reason.details.length > 0 ? (
                <ul className="mt-3 space-y-2 text-[13px] leading-[1.68] text-[#60708a]">
                  {reason.details.map((detail) => (
                    <li key={detail} className="rounded-[16px] bg-white px-3 py-2">
                      {detail}
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-[28px] border border-[#d8e6ff] bg-[linear-gradient(180deg,#fbfdff_0%,#f4f8ff_100%)] px-5 py-5 shadow-[0_14px_30px_rgba(10,132,255,0.08)]">
        <div className="text-[12px] font-semibold tracking-[0.06em] text-[#4d6b95]">先收下当前推荐</div>
        <h2 className="mt-3 text-[24px] leading-[1.24] font-semibold tracking-[-0.03em] text-[#18253b]">
          加入购物袋
        </h2>
        <p className="mt-3 text-[14px] leading-[1.72] text-[#55677f]">
          先收下，后续仍可继续对比或查看依据。
        </p>
        <div className="mt-5">
          <AddToBagButton
            productId={product.id}
            className="w-full"
            buttonClassName="m-pressable h-12 w-full rounded-full border-0 bg-[#0a84ff] px-5 text-[16px] font-semibold tracking-[-0.02em] text-white shadow-[0_14px_28px_rgba(10,132,255,0.24)] active:opacity-90"
            clickEventName="result_add_to_bag_click"
            clickEventProps={{
              page: analyticsContext.page,
              route: analyticsContext.route,
              source: analyticsContext.source,
              category: result.category,
              scenario_id: result.scenario_id,
              result_cta: "bag_add",
              target_path: "/m/me/bag",
            }}
            analyticsProps={{
              page: analyticsContext.page,
              route: analyticsContext.route,
              source: analyticsContext.source,
              category: result.category,
              scenario_id: result.scenario_id,
              result_cta: "bag_add",
            }}
          />
        </div>
      </section>

      <section className="mt-5 rounded-[28px] border border-black/8 bg-white/90 px-5 py-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
        <div className="text-[12px] font-semibold tracking-[0.06em] text-black/42">还想再确认</div>
        <div className="mt-4 grid gap-2.5">
          {doubtResolutionActions.map((action) =>
            action.resultCta === "compare" ? (
              <DecisionResultCompareEntryLink
                key={`${action.action}:${action.href}`}
                category={result.category as MobileSelectionCategory}
                recommendationProductId={normalizeText(product.id) || null}
                currentUploadId={currentUploadId}
                fallbackHref={action.href}
                resultHref={resultHref}
                page={analyticsContext.page}
                route={analyticsContext.route}
                source={analyticsContext.source}
                scenarioId={result.scenario_id}
                analyticsId="result:cta:compare-entry"
                className="m-pressable flex min-h-12 w-full items-center justify-between rounded-[18px] border border-black/10 bg-white px-4 py-3 text-[14px] font-semibold text-black/78 active:bg-black/[0.03] disabled:opacity-70"
              >
                {action.label}
              </DecisionResultCompareEntryLink>
            ) : (
              <MobileTrackedLink
                key={`${action.action}:${action.href}`}
                href={action.href}
                eventName={action.eventName}
                eventProps={{
                  page: analyticsContext.page,
                  route: analyticsContext.route,
                  source: analyticsContext.source,
                  category: result.category,
                  scenario_id: result.scenario_id,
                  result_cta: action.resultCta,
                  target_path: action.href,
                  action: action.action,
                }}
                className="m-pressable flex min-h-12 items-center justify-between rounded-[18px] border border-black/10 bg-white px-4 py-3 text-[14px] font-semibold text-black/78 active:bg-black/[0.03]"
              >
                <span>{action.label}</span>
                <span className="text-black/34">→</span>
              </MobileTrackedLink>
            ),
          )}
        </div>
      </section>

      <section className="mt-5 rounded-[28px] border border-black/8 bg-white/90 px-5 py-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
        <div className="text-[12px] font-semibold tracking-[0.06em] text-black/42">换一个任务</div>
        <div className="mt-4 grid gap-2.5">
          {taskSwitchActions.map((action) => (
            <MobileTrackedLink
              key={`${action.action}:${action.href}`}
              href={action.href}
              eventName={action.eventName}
              eventProps={{
                page: analyticsContext.page,
                route: analyticsContext.route,
                source: analyticsContext.source,
                category: result.category,
                scenario_id: result.scenario_id,
                result_cta: action.resultCta,
                target_path: action.href,
                action: action.action,
              }}
              className="m-pressable flex min-h-12 items-center justify-between rounded-[18px] border border-black/10 bg-white px-4 py-3 text-[14px] font-semibold text-black/78 active:bg-black/[0.03]"
            >
              <span>{action.label}</span>
              <span className="text-black/34">→</span>
            </MobileTrackedLink>
          ))}
        </div>
      </section>

      <div className="mt-4 text-[12px] leading-[1.6] text-black/44">
        规则版本 {result.rules_version}
        {generatedAt ? ` · 更新于 ${generatedAt}` : ""}
        {result.recommendation_source ? ` · 来源 ${humanizeRecommendationSource(result.recommendation_source)}` : ""}
      </div>
    </section>
  );
}

function buildSummaryHighlights(block: ParsedBlock | null, summaryBody: string, shareCaption: string): string[] {
  return uniqueText([
    ...(block?.items || []),
    normalizeText(shareCaption) !== normalizeText(summaryBody) ? shareCaption : "",
  ]).slice(0, 3);
}

function buildReasons(
  blocks: MobileSelectionResultBlock[],
  result: MobileSelectionPublishedResult,
): ResultReason[] {
  const picked: ResultReason[] = [];

  for (const rawBlock of blocks) {
    if (picked.length >= 3) break;
    if (rawBlock.id === "hero") continue;
    const block = parseBlock(rawBlock);
    const body = primaryBlockText(block);
    if (!block.title || !body) continue;
    picked.push({
      id: block.id,
      title: block.title,
      body,
      details: secondaryBlockTexts(block, body).slice(0, 2),
    });
  }

  const fallbackBodies = [
    describeMobileRouteFocus(result.category, result.route.key),
    normalizeText(result.micro_summary),
    normalizeText(result.share_copy.caption),
  ].filter(Boolean);

  while (picked.length < 3) {
    const fallbackIndex = picked.length;
    picked.push({
      id: `fallback-${fallbackIndex + 1}`,
      title:
        fallbackIndex === 0
          ? "当前路线更站得住"
          : fallbackIndex === 1
            ? "这一步先收敛方向"
            : "产品是用来承接路线的",
      body:
        fallbackBodies[fallbackIndex] ||
        (fallbackIndex === 2
          ? "先用当前主推承接这条路线，再决定是否继续扩展更多候选。"
          : "系统会优先收敛到更适合你的护理方向，而不是先把商品堆给你。"),
      details: [],
    });
  }

  return picked.slice(0, 3);
}

function buildDoubtResolutionActions(
  result: MobileSelectionPublishedResult,
  resultHref: string,
  source: string,
): ResultAction[] {
  const compareHref = buildResultUtilityHref({
    href: `/m/compare?category=${encodeURIComponent(result.category)}`,
    source,
    resultHref,
    scenarioId: result.scenario_id,
    resultCta: "compare",
  });
  const rationaleHref = buildResultUtilityHref({
    href: result.links.wiki || `/m/wiki?category=${encodeURIComponent(result.category)}`,
    source,
    resultHref,
    scenarioId: result.scenario_id,
    resultCta: "rationale",
  });
  return [
    {
      eventName: "result_compare_entry_click",
      resultCta: "compare",
      action: "compare",
      label: "和我现在在用的比一下",
      href: compareHref,
    },
    {
      eventName: "result_rationale_entry_click",
      resultCta: "rationale",
      action: "rationale",
      label: "看为什么推荐这款",
      href: rationaleHref,
    },
  ];
}

function buildTaskSwitchActions(startHref: string): ResultAction[] {
  return [
    {
      eventName: "result_retry_same_category_click",
      resultCta: "retry_same_category",
      action: "retry_same_category",
      label: "重测这类",
      href: appendQueryParams(startHref, {
        result_cta: "retry_same_category",
      }),
    },
    {
      eventName: "result_switch_category_click",
      resultCta: "switch_category",
      action: "switch_category",
      label: "测其他品类",
      href: appendQueryParams("/m/choose", {
        result_cta: "switch_category",
      }),
    },
  ];
}

function buildResultUtilityHref({
  href,
  source,
  resultHref,
  scenarioId,
  resultCta,
}: {
  href: string;
  source: string;
  resultHref: string;
  scenarioId: string;
  resultCta: MobileResultCta;
}): string {
  return appendMobileUtilityRouteState(href, {
    source: normalizeText(source) || null,
    returnTo: resultHref,
    scenarioId,
    resultCta,
    compareId: null,
  });
}

function orderBlocks(blocks: MobileSelectionResultBlock[], displayOrder: string[]): MobileSelectionResultBlock[] {
  const byId = new Map<string, MobileSelectionResultBlock>();
  for (const block of blocks) {
    const key = normalizeText(block.id);
    if (!key || byId.has(key)) continue;
    byId.set(key, block);
  }

  const ordered: MobileSelectionResultBlock[] = [];
  const seen = new Set<string>();
  for (const id of displayOrder) {
    const key = normalizeText(id);
    if (!key || key === "ctas" || seen.has(key)) continue;
    const block = byId.get(key);
    if (!block) continue;
    ordered.push(block);
    seen.add(key);
  }

  for (const block of blocks) {
    const key = normalizeText(block.id);
    if (!key || seen.has(key)) continue;
    ordered.push(block);
    seen.add(key);
  }

  return ordered;
}

function findBlock(blocks: MobileSelectionResultBlock[], id: string): ParsedBlock | null {
  const target = blocks.find((item) => item.id === id);
  return target ? parseBlock(target) : null;
}

function parseBlock(block: MobileSelectionResultBlock): ParsedBlock {
  const payload = block.payload || {};
  return {
    id: block.id,
    title: readString(payload, ["title", "headline", "label"]) || humanizeBlockId(block.id),
    subtitle: readString(payload, ["subtitle", "description", "body", "text"]),
    note: readString(payload, ["note", "hint"]),
    items: readStringArray(payload, ["items", "bullets", "points", "list"]),
  };
}

function primaryBlockText(block: ParsedBlock | null): string {
  if (!block) return "";
  return normalizeText(block.subtitle) || normalizeText(block.items[0] || "") || normalizeText(block.note);
}

function secondaryBlockTexts(block: ParsedBlock | null, primaryText: string): string[] {
  if (!block) return [];
  return uniqueText([
    ...block.items.filter((item) => normalizeText(item) !== normalizeText(primaryText)),
    normalizeText(block.note) !== normalizeText(primaryText) ? block.note : "",
  ]);
}

function appendQueryParams(path: string, params: Record<string, string>): string {
  const [pathname, hash = ""] = path.split("#", 2);
  const [basePath, query = ""] = pathname.split("?", 2);
  const searchParams = new URLSearchParams(query);
  for (const [key, value] of Object.entries(params)) {
    if (!normalizeText(value)) continue;
    searchParams.set(key, value);
  }
  const nextQuery = searchParams.toString();
  return `${basePath}${nextQuery ? `?${nextQuery}` : ""}${hash ? `#${hash}` : ""}`;
}

function readString(payload: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function readStringArray(payload: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const value = payload[key];
    if (!Array.isArray(value)) continue;
    const items = value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
    if (items.length > 0) return items;
  }
  return [];
}

function humanizeBlockId(id: string): string {
  if (id === "situation") return "你现在更像什么情况";
  if (id === "evidence") return "为什么系统这样判断";
  if (id === "product_bridge") return "为什么先给你这类或这款";
  if (id === "attention") return "你当前最该抓住什么";
  if (id === "pitfalls") return "你现在最该少踩的坑";
  return "结果说明";
}

function humanizeRecommendationSource(source: string): string {
  if (source === "featured_slot") return "主推槽位";
  if (source === "route_mapping") return "类型映射";
  if (source === "category_fallback") return "品类兜底";
  return source;
}

function uniqueText(values: string[]): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const value of values) {
    const text = normalizeText(value);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    items.push(text);
  }
  return items;
}

function normalizeText(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function formatGeneratedAt(value: string | null | undefined): string {
  const text = normalizeText(value);
  if (!text) return "";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
