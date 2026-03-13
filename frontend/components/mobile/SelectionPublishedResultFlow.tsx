import Image from "next/image";
import Link from "next/link";
import MobileEventBeacon from "@/components/mobile/MobileEventBeacon";
import {
  MobileSelectionPublishedResult,
  MobileSelectionResultBlock,
  MobileSelectionResultCTA,
  resolveImageUrl,
} from "@/lib/api";
import { describeMobileRouteFocus } from "@/lib/mobile/routeCopy";

const SOURCE_LABELS: Record<string, string> = {
  featured_slot: "主推槽位",
  route_mapping: "类型映射",
  category_fallback: "品类兜底",
};

type Props = {
  titlePrefix: string;
  emptyImageLabel: string;
  startHref: string;
  profileHref: string;
  result: MobileSelectionPublishedResult;
  analyticsContext?: {
    page: string;
    route: string;
    source: string;
    resultCta: string;
    fromCompareId: string;
  } | null;
};

type BlockContent = {
  id: string;
  kind: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  note: string;
  items: string[];
};

type ResolvedCTA = {
  id: string;
  label: string;
  action: string;
  href: string;
};

export default function SelectionPublishedResultFlow({
  titlePrefix,
  emptyImageLabel,
  startHref,
  profileHref,
  result,
  analyticsContext,
}: Props) {
  const product = result.recommended_product;
  const routeFocus = describeMobileRouteFocus(result.category, result.route.key);
  const blocksById = new Map(result.blocks.map((item) => [item.id, item]));
  const orderedBlocks = resolveOrderedBlocks(result.display_order, blocksById, result.blocks);
  const heroBlock = orderedBlocks.find((item) => item.id === "hero" || normalizeKind(item.kind) === "hero") || null;
  const heroContent = heroBlock ? parseBlockContent(heroBlock) : null;
  const heroTitle = heroContent?.title || `你当前更适合先走 ${result.route.title} 这条线`;
  const heroSubtitle = heroContent?.subtitle || routeFocus;
  const heroCaption = normalizeText(result.micro_summary) || normalizeText(result.share_copy.subtitle) || routeFocus;
  const heroItems = heroContent?.items.slice(0, 2) || [];

  const explanationBlocks: MobileSelectionResultBlock[] = [];
  const actionBlocks: MobileSelectionResultBlock[] = [];
  const warningBlocks: MobileSelectionResultBlock[] = [];
  const overflowBlocks: MobileSelectionResultBlock[] = [];

  for (const block of orderedBlocks) {
    if (heroBlock && block.id === heroBlock.id) continue;
    const normalizedKind = normalizeKind(block.kind);
    if (block.id === "pitfalls" || normalizedKind === "warning") {
      warningBlocks.push(block);
      continue;
    }
    if (block.id === "attention" || block.id === "product_bridge" || normalizedKind === "strategy") {
      actionBlocks.push(block);
      continue;
    }
    if (block.id === "situation" || block.id === "evidence" || normalizedKind === "explanation") {
      explanationBlocks.push(block);
      continue;
    }
    overflowBlocks.push(block);
  }

  const validCtas = resolveValidCtas(result.ctas, result, startHref, profileHref);
  const primaryCta =
    validCtas.find((item) => item.action === "product") ||
    validCtas[0] || {
      id: "fallback-product",
      label: "查看推荐产品",
      action: "product",
      href: result.links.product,
    };
  const secondaryCta =
    validCtas.find((item) => item.action === "wiki" && item.href !== primaryCta.href) ||
    validCtas.find((item) => item.href !== primaryCta.href) || {
      id: "fallback-wiki",
      label: "查看成分百科",
      action: "wiki",
      href: result.links.wiki,
    };
  const extraActions = dedupeActions(
    [
      ...validCtas.filter((item) => item.href !== primaryCta.href && item.href !== secondaryCta.href),
      { id: "restart", label: "重新判断一次", action: "restart", href: startHref },
      { id: "profile", label: "修改个人选项", action: "profile", href: profileHref },
      { id: "compare", label: "和我在用的对比", action: "compare", href: `/m/compare?category=${encodeURIComponent(result.category)}` },
    ],
    [primaryCta.href, secondaryCta.href],
  );
  const resultSummaryLabel = normalizeText(result.micro_summary) || result.route.title;
  const generatedAt = formatGeneratedAt(result.meta?.generated_at);

  return (
    <section className="pb-14">
      {analyticsContext ? (
        <MobileEventBeacon
          name="profile_result_view"
          props={{
            page: analyticsContext.page,
            route: analyticsContext.route,
            source: analyticsContext.source,
            category: result.category,
            compare_id: analyticsContext.fromCompareId,
            cta: analyticsContext.resultCta,
          }}
        />
      ) : null}

      <section className="rounded-[34px] border border-[#dbe7ff] bg-[linear-gradient(180deg,#fbfdff_0%,#eef5ff_100%)] px-5 pb-5 pt-5 shadow-[0_22px_52px_rgba(30,59,114,0.12)]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[#d7e5ff] bg-white/78 px-3 py-1 text-[11px] font-semibold tracking-[0.03em] text-[#2d5bb2]">
            {heroContent?.eyebrow || `${titlePrefix}结果`}
          </span>
          <span className="rounded-full border border-white/70 bg-white/70 px-3 py-1 text-[11px] text-[#4c638b]">
            {resultSummaryLabel}
          </span>
        </div>

        <h1 className="mt-4 text-[31px] leading-[1.12] font-semibold tracking-[-0.03em] text-[#142036]">
          {heroTitle}
        </h1>
        <p className="mt-3 text-[15px] leading-[1.65] text-[#445571]">{heroSubtitle}</p>
        <p className="mt-2 text-[13px] leading-[1.6] text-[#5d6d89]">{heroCaption}</p>

        {heroItems.length > 0 ? (
          <ul className="mt-4 space-y-2 text-[13px] leading-[1.55] text-[#334562]">
            {heroItems.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#2d5bb2]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-5 rounded-[28px] border border-white/80 bg-white/76 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
          <div className="flex items-start gap-4">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[22px] border border-black/6 bg-[#f4f7fc]">
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
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-medium text-[#5b6d89]">先从这款开始</div>
              <div className="mt-1 text-[20px] leading-[1.28] font-semibold tracking-[-0.02em] text-[#162339]">
                {product.brand || "未知品牌"}
              </div>
              <div className="mt-1 text-[15px] leading-[1.5] text-[#445571]">{product.name || "未命名产品"}</div>
              <div className="mt-3 inline-flex rounded-full border border-[#d7e5ff] bg-[#f5f8ff] px-3 py-1 text-[11px] text-[#3d5f94]">
                {result.route.title}
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2.5">
            <Link
              href={primaryCta.href}
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[#0a84ff] px-5 text-[16px] font-semibold tracking-[-0.02em] text-white shadow-[0_14px_28px_rgba(10,132,255,0.24)] active:opacity-90"
            >
              {primaryCta.label}
            </Link>
            {secondaryCta ? (
              <Link
                href={secondaryCta.href}
                className="inline-flex h-11 w-full items-center justify-center rounded-full border border-[#d6e3fb] bg-white/84 px-5 text-[15px] font-semibold text-[#20365d] active:bg-white"
              >
                {secondaryCta.label}
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {explanationBlocks.length > 0 ? (
        <section className="mt-8">
          <ResultSectionHeader eyebrow="为什么是它" title="先看这次判断依据" note="只保留会影响你决策的原因，不把所有系统过程都堆到前面。" />
          <div className="mt-3 space-y-3">
            {explanationBlocks.map((block, index) => (
              <SelectionResultBlockCard key={block.id} block={block} tone="neutral" emphasize={index === 0} />
            ))}
          </div>
        </section>
      ) : null}

      {actionBlocks.length > 0 ? (
        <section className="mt-8">
          <ResultSectionHeader eyebrow="现在怎么做" title="先按这条主线执行" note="先抓当前优先级，再决定是否继续扩展到次级诉求。" />
          <div className="mt-3 space-y-3">
            {actionBlocks.map((block, index) => (
              <SelectionResultBlockCard key={block.id} block={block} tone="blue" emphasize={index === 0} />
            ))}
          </div>
        </section>
      ) : null}

      {warningBlocks.length > 0 ? (
        <section className="mt-8">
          <ResultSectionHeader eyebrow="先别踩坑" title="使用时要留意的边界" note="真正影响体验的风险前置说清楚，避免你被相近路线或营销话术带偏。" />
          <div className="mt-3 space-y-3">
            {warningBlocks.map((block, index) => (
              <SelectionResultBlockCard key={block.id} block={block} tone="amber" emphasize={index === 0} />
            ))}
          </div>
        </section>
      ) : null}

      <details className="mt-8 rounded-[26px] border border-black/8 bg-white/84 px-4 py-4">
        <summary className="cursor-pointer list-none text-[15px] font-semibold text-[#18253b]">
          更多操作与结果说明
        </summary>
        <div className="mt-4 space-y-4">
          {extraActions.length > 0 ? (
            <div className="flex flex-wrap gap-2.5">
              {extraActions.map((action) => (
                <Link
                  key={`${action.action}-${action.href}`}
                  href={action.href}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-black/12 px-4 text-[14px] font-semibold text-black/78 active:bg-black/[0.03]"
                >
                  {action.label}
                </Link>
              ))}
            </div>
          ) : null}

          <div className="rounded-[22px] border border-black/8 bg-[#fafbfd] px-4 py-3">
            <div className="text-[13px] font-semibold text-black/84">结果说明</div>
            <ul className="mt-2 space-y-1.5 text-[12px] leading-[1.55] text-black/58">
              <li>本次先按 {result.route.title} 这条主线给出建议。</li>
              <li>推荐来源：{SOURCE_LABELS[result.recommendation_source] || "未知"}。</li>
              <li>规则版本：{result.rules_version}{generatedAt ? ` · 生成于 ${generatedAt}` : ""}。</li>
              <li>{routeFocus}</li>
              {normalizeText(result.share_copy.caption) ? <li>{normalizeText(result.share_copy.caption)}</li> : null}
            </ul>
          </div>

          {overflowBlocks.length > 0 ? (
            <div className="space-y-3">
              {overflowBlocks.map((block) => (
                <SelectionResultBlockCard key={block.id} block={block} tone="neutral" />
              ))}
            </div>
          ) : null}
        </div>
      </details>
    </section>
  );
}

function ResultSectionHeader({
  eyebrow,
  title,
  note,
}: {
  eyebrow: string;
  title: string;
  note: string;
}) {
  return (
    <div className="px-1">
      <div className="text-[12px] font-semibold tracking-[0.03em] text-[#59708f]">{eyebrow}</div>
      <h2 className="mt-1 text-[24px] leading-[1.22] font-semibold tracking-[-0.02em] text-[#142036]">{title}</h2>
      <p className="mt-2 text-[14px] leading-[1.6] text-[#566882]">{note}</p>
    </div>
  );
}

function SelectionResultBlockCard({
  block,
  tone,
  emphasize = false,
}: {
  block: MobileSelectionResultBlock;
  tone: "neutral" | "blue" | "amber";
  emphasize?: boolean;
}) {
  const content = parseBlockContent(block);
  const cardTone =
    tone === "blue"
      ? "border-[#d8e6ff] bg-[linear-gradient(180deg,#fbfdff_0%,#f4f8ff_100%)]"
      : tone === "amber"
        ? "border-[#f4dfb1] bg-[#fffaf1]"
        : "border-black/8 bg-white";

  return (
    <section className={`rounded-[26px] border px-4 py-4 ${cardTone}`}>
      {content.eyebrow ? <div className="text-[11px] font-semibold tracking-[0.04em] text-[#5f7597]">{content.eyebrow}</div> : null}
      <h3 className={`mt-1 text-[#18253b] ${emphasize ? "text-[22px] leading-[1.28] tracking-[-0.02em]" : "text-[17px] leading-[1.35]"}`}>
        {content.title}
      </h3>
      {content.subtitle ? <p className="mt-2 text-[14px] leading-[1.65] text-[#55677f]">{content.subtitle}</p> : null}
      {content.items.length > 0 ? (
        <ul className="mt-3 space-y-2 text-[13px] leading-[1.6] text-[#344660]">
          {content.items.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#6c86ac]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {content.note ? <p className="mt-3 text-[12px] leading-[1.55] text-[#6a7d98]">{content.note}</p> : null}
      {!content.subtitle && content.items.length === 0 && !content.note ? (
        <p className="mt-2 text-[13px] leading-[1.55] text-[#6a7d98]">这部分说明正在整理，先按当前主线执行即可。</p>
      ) : null}
    </section>
  );
}

function resolveOrderedBlocks(
  displayOrder: string[],
  blocksById: Map<string, MobileSelectionResultBlock>,
  blocks: MobileSelectionResultBlock[],
): MobileSelectionResultBlock[] {
  const orderedTokens = displayOrder.length > 0 ? displayOrder.filter((entry) => entry !== "ctas") : blocks.map((item) => item.id);
  const seen = new Set<string>();
  const resolved: MobileSelectionResultBlock[] = [];

  for (const token of orderedTokens) {
    const block = blocksById.get(token);
    if (!block || seen.has(block.id)) continue;
    resolved.push(block);
    seen.add(block.id);
  }

  for (const block of blocks) {
    if (seen.has(block.id)) continue;
    resolved.push(block);
    seen.add(block.id);
  }

  return resolved;
}

function resolveValidCtas(
  ctas: MobileSelectionResultCTA[],
  result: MobileSelectionPublishedResult,
  startHref: string,
  profileHref: string,
): ResolvedCTA[] {
  const seen = new Set<string>();
  const resolved: ResolvedCTA[] = [];

  for (const cta of ctas) {
    const href = resolveCtaHref(cta, result, startHref, profileHref);
    if (!href) continue;
    const label = normalizeText(cta.label);
    if (!label) continue;
    const key = `${cta.action}:${href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    resolved.push({
      id: cta.id,
      label,
      action: cta.action,
      href,
    });
  }

  return resolved;
}

function dedupeActions(actions: ResolvedCTA[], ignoredHrefs: string[]): ResolvedCTA[] {
  const ignored = new Set(ignoredHrefs.filter(Boolean));
  const seen = new Set<string>();
  const resolved: ResolvedCTA[] = [];

  for (const action of actions) {
    if (!action.href || ignored.has(action.href)) continue;
    const key = `${action.action}:${action.href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    resolved.push(action);
  }

  return resolved;
}

function parseBlockContent(block: MobileSelectionResultBlock): BlockContent {
  const payload = block.payload || {};
  return {
    id: block.id,
    kind: block.kind,
    eyebrow: readString(payload, ["eyebrow"]),
    title: readString(payload, ["title", "headline", "label"]) || humanizeKind(block.kind),
    subtitle: readString(payload, ["subtitle", "description", "body", "text"]),
    note: readString(payload, ["note", "hint"]),
    items: readStringArray(payload, ["items", "bullets", "points", "list"]),
  };
}

function resolveCtaHref(
  cta: MobileSelectionResultCTA,
  result: MobileSelectionPublishedResult,
  startHref: string,
  profileHref: string,
): string | null {
  const explicit = String(cta.href || "").trim();
  if (explicit) return explicit;
  if (cta.action === "product") return result.links.product;
  if (cta.action === "wiki") return result.links.wiki;
  if (cta.action === "restart") return startHref;
  if (cta.action === "profile") return profileHref;
  return null;
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

function normalizeKind(kind: string): string {
  return String(kind || "").trim().toLowerCase();
}

function humanizeKind(kind: string): string {
  const normalized = normalizeKind(kind);
  if (normalized === "explanation") return "结果说明";
  if (normalized === "strategy") return "使用建议";
  if (normalized === "warning") return "使用边界";
  if (normalized === "hero") return "核心结论";
  return normalized || "结果模块";
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
