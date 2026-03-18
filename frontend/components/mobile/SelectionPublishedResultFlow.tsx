import Image from "next/image";
import MobileEventBeacon from "@/components/mobile/MobileEventBeacon";
import MobilePageAnalytics from "@/components/mobile/MobilePageAnalytics";
import MobileTrackedLink from "@/components/mobile/MobileTrackedLink";
import {
  MobileSelectionPublishedResult,
  MobileSelectionResultBlock,
  MobileSelectionResultCTA,
  resolveImageUrl,
} from "@/lib/api";
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
  action: string;
  label: string;
  href: string;
};

type NextStepSupport = {
  title: string;
  body: string;
  details: string[];
};

export default function SelectionPublishedResultFlow({
  titlePrefix,
  emptyImageLabel,
  startHref,
  profileHref,
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

  const primaryAction = resolvePrimaryAction(result.ctas, result, startHref, profileHref);
  const { reasons, usedBlockIds } = buildReasons(orderedBlocks, result);
  const nextStepSupport = buildNextStepSupport(orderedBlocks, usedBlockIds, result, routeFocus);
  const cautionText = buildCautionText(orderedBlocks, usedBlockIds, nextStepSupport.body);
  const secondaryLoops = buildSecondaryLoops(result, resultHref, primaryAction);
  const generatedAt = formatGeneratedAt(result.meta?.generated_at);
  const product = result.recommended_product;

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
        <div className="text-[12px] font-semibold tracking-[0.06em] text-[#4d6b95]">一个下一步</div>
        {nextStepSupport.title ? (
          <div className="mt-3 text-[12px] font-medium tracking-[0.03em] text-[#5f7597]">{nextStepSupport.title}</div>
        ) : null}
        <h2 className="mt-3 text-[24px] leading-[1.24] font-semibold tracking-[-0.03em] text-[#18253b]">
          {primaryAction.label}
        </h2>
        <p className="mt-3 text-[14px] leading-[1.72] text-[#55677f]">{nextStepSupport.body}</p>
        {nextStepSupport.details.length > 0 ? (
          <ul className="mt-3 space-y-2 text-[13px] leading-[1.68] text-[#5d6f88]">
            {nextStepSupport.details.map((detail) => (
              <li key={detail} className="rounded-[16px] bg-white/92 px-3 py-2">
                {detail}
              </li>
            ))}
          </ul>
        ) : null}
        {cautionText ? (
          <p className="mt-3 text-[13px] leading-[1.65] text-[#8a6435]">
            先注意：{cautionText}
          </p>
        ) : null}

        <div className="mt-5 grid gap-3">
          <MobileTrackedLink
            href={primaryAction.href}
            eventName="result_primary_cta_click"
            eventProps={{
              page: analyticsContext.page,
              route: analyticsContext.route,
              source: analyticsContext.source,
              category: result.category,
              scenario_id: result.scenario_id,
              target_path: primaryAction.href,
            }}
            className="m-pressable inline-flex h-12 items-center justify-center rounded-full bg-[#0a84ff] px-5 text-[16px] font-semibold tracking-[-0.02em] text-white shadow-[0_14px_28px_rgba(10,132,255,0.24)] active:opacity-90"
          >
            {primaryAction.label}
          </MobileTrackedLink>

          {secondaryLoops.length > 0 ? (
            <div className="flex flex-wrap gap-2.5">
              {secondaryLoops.map((loop) => (
                <MobileTrackedLink
                  key={`${loop.action}:${loop.href}`}
                  href={loop.href}
                  eventName="result_secondary_loop_click"
                  eventProps={{
                    page: analyticsContext.page,
                    route: analyticsContext.route,
                    source: analyticsContext.source,
                    category: result.category,
                    scenario_id: result.scenario_id,
                    target_path: loop.href,
                    action: loop.action,
                  }}
                  className="m-pressable inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white/92 px-4 text-[14px] font-semibold text-black/74 active:bg-black/[0.03]"
                >
                  {loop.label}
                </MobileTrackedLink>
              ))}
            </div>
          ) : null}
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
): { reasons: ResultReason[]; usedBlockIds: Set<string> } {
  const picked: ResultReason[] = [];
  const usedBlockIds = new Set<string>();

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
    usedBlockIds.add(block.id);
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

  return {
    reasons: picked.slice(0, 3),
    usedBlockIds,
  };
}

function buildNextStepSupport(
  blocks: MobileSelectionResultBlock[],
  usedBlockIds: Set<string>,
  result: MobileSelectionPublishedResult,
  routeFocus: string,
): NextStepSupport {
  const candidateIds = ["attention", "product_bridge", "pitfalls", "evidence", "situation"];
  for (const id of candidateIds) {
    if (usedBlockIds.has(id)) continue;
    const block = findBlock(blocks, id);
    const body = primaryBlockText(block);
    if (!block || !body) continue;
    return {
      title: block.title,
      body,
      details: secondaryBlockTexts(block, body).slice(0, 2),
    };
  }

  for (const rawBlock of blocks) {
    if (usedBlockIds.has(rawBlock.id) || rawBlock.id === "hero") continue;
    const block = parseBlock(rawBlock);
    const body = primaryBlockText(block);
    if (!body) continue;
    return {
      title: block.title,
      body,
      details: secondaryBlockTexts(block, body).slice(0, 2),
    };
  }

  return {
    title: "你当前更该先做什么",
    body: routeFocus || "先沿着当前结果给出的主线执行，再决定是否继续深挖。",
    details: [],
  };
}

function buildCautionText(
  blocks: MobileSelectionResultBlock[],
  usedBlockIds: Set<string>,
  nextStepBody: string,
): string {
  const pitfall = findBlock(blocks, "pitfalls");
  const primary = primaryBlockText(pitfall);
  if (!primary || primary === nextStepBody) return "";
  if (usedBlockIds.has("pitfalls")) {
    return secondaryBlockTexts(pitfall, primary)[0] || "";
  }
  return primary;
}

function resolvePrimaryAction(
  ctas: MobileSelectionResultCTA[],
  result: MobileSelectionPublishedResult,
  startHref: string,
  profileHref: string,
): ResultAction {
  const preferred = ctas[0] || null;
  const href = preferred
    ? resolvePrimaryActionHref(preferred.action, preferred.href, result, startHref, profileHref)
    : result.links.product;
  const label = normalizeText(preferred?.label) || "查看推荐产品";
  return {
    action: normalizeText(preferred?.action) || "product",
    label,
    href,
  };
}

function buildSecondaryLoops(
  result: MobileSelectionPublishedResult,
  resultHref: string,
  primaryAction: ResultAction,
): ResultAction[] {
  const sharedParams = {
    scenario_id: result.scenario_id,
    return_to: resultHref,
  };

  const published = result.ctas
    .slice(1)
    .map((item) => {
      const href = resolveSecondaryLoopHref(item, result);
      const action = resolveSecondaryLoopAction(item.action, href);
      if (!href || !action) return null;
      return {
        action,
        label: normalizeText(item.label) || humanizeSecondaryLoopAction(action),
        href: appendLoopContext(href, action, sharedParams),
      };
    })
    .filter((item): item is ResultAction => Boolean(item));

  const defaults: ResultAction[] = [
    {
      action: "compare",
      label: "和其他候选再对比",
      href: appendLoopContext(`/m/compare?category=${encodeURIComponent(result.category)}`, "compare", sharedParams),
    },
    {
      action: "wiki",
      label: "查看产品或成分百科",
      href: appendLoopContext(
        result.links.wiki || `/m/wiki?category=${encodeURIComponent(result.category)}`,
        "wiki",
        sharedParams,
      ),
    },
    {
      action: "me",
      label: "回到我的记录",
      href: appendLoopContext("/m/me/history", "me", sharedParams),
    },
  ];

  const source = published.length > 0 ? published : defaults;
  return dedupeActions(source).filter((item) => item.href !== primaryAction.href);
}

function appendLoopContext(
  href: string,
  action: string,
  sharedParams: { scenario_id: string; return_to: string },
): string {
  const normalizedAction = normalizeText(action).toLowerCase();
  const source =
    normalizedAction === "compare"
      ? "result_compare"
      : normalizedAction === "wiki"
        ? "result_wiki"
        : "result_me";
  const resultCta =
    normalizedAction === "compare"
      ? "compare"
      : normalizedAction === "wiki"
        ? "wiki"
        : "me";
  return appendQueryParams(href, {
    ...sharedParams,
    source,
    result_cta: resultCta,
  });
}

function resolveSecondaryLoopAction(action: string, href: string): string {
  const actionKey = normalizeText(action).toLowerCase();
  const hrefKey = normalizeText(href).toLowerCase();
  if (
    actionKey === "compare" ||
    actionKey === "restart" ||
    actionKey === "rerun" ||
    actionKey === "retry" ||
    hrefKey.includes("/compare")
  ) {
    return "compare";
  }
  if (actionKey === "wiki" || hrefKey.includes("/wiki")) {
    return "wiki";
  }
  if (
    actionKey === "me" ||
    actionKey === "profile" ||
    actionKey === "history" ||
    hrefKey.includes("/m/me")
  ) {
    return "me";
  }
  return "";
}

function dedupeActions(actions: ResultAction[]): ResultAction[] {
  const seen = new Set<string>();
  const items: ResultAction[] = [];
  for (const action of actions) {
    const key = `${action.action}:${action.href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(action);
  }
  return items;
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

function resolvePrimaryActionHref(
  action: string,
  explicitHref: string,
  result: MobileSelectionPublishedResult,
  startHref: string,
  profileHref: string,
): string {
  const cleanHref = normalizeText(explicitHref);
  const actionKey = normalizeText(action).toLowerCase();
  if (cleanHref) return cleanHref;
  if (actionKey === "wiki" || actionKey === "open_wiki") return result.links.wiki;
  if (actionKey === "restart" || actionKey === "rerun" || actionKey === "retry") return startHref;
  if (actionKey === "profile") return profileHref;
  if (actionKey === "me" || actionKey === "history") return "/m/me/history";
  if (actionKey === "compare") return `/m/compare?category=${encodeURIComponent(result.category)}`;
  return result.links.product;
}

function resolveSecondaryLoopHref(cta: MobileSelectionResultCTA, result: MobileSelectionPublishedResult): string {
  const cleanHref = normalizeText(cta.href);
  const actionKey = normalizeText(cta.action).toLowerCase();
  if (cleanHref) return cleanHref;
  if (actionKey === "wiki" || actionKey === "open_wiki") return result.links.wiki;
  if (actionKey === "me" || actionKey === "profile" || actionKey === "history") return "/m/me/history";
  if (actionKey === "compare" || actionKey === "restart" || actionKey === "rerun" || actionKey === "retry") {
    return `/m/compare?category=${encodeURIComponent(result.category)}`;
  }
  return "";
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

function humanizeSecondaryLoopAction(action: string): string {
  if (action === "compare") return "和其他候选再对比";
  if (action === "wiki") return "查看产品或成分百科";
  if (action === "me") return "回到我的记录";
  return "继续了解";
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
