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

type DisclosureGroup = {
  id: string;
  title: string;
  preview: string;
  tone: "neutral" | "blue" | "amber";
  blocks: MobileSelectionResultBlock[];
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
  const heroBlock =
    orderedBlocks.find((item) => item.id === "hero" || normalizeKind(item.kind) === "hero") || null;
  const heroContent = heroBlock ? parseBlockContent(heroBlock) : null;
  const heroTitle = heroContent?.title || `你当前更适合先走 ${result.route.title} 这条线`;
  const heroSupport =
    previewText(result.micro_summary, 34) ||
    previewText(heroContent?.subtitle, 34) ||
    previewText(routeFocus, 34) ||
    `先按 ${result.route.title} 这条线开始。`;

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
      {
        id: "compare",
        label: "和我在用的对比",
        action: "compare",
        href: `/m/compare?category=${encodeURIComponent(result.category)}`,
      },
    ],
    [primaryCta.href, secondaryCta.href],
  );
  const generatedAt = formatGeneratedAt(result.meta?.generated_at);
  const disclosureGroups = [
    buildDisclosureGroup("why", "为什么会是这个结果", explanationBlocks, "neutral"),
    buildDisclosureGroup("how", "先怎么做更稳", actionBlocks, "blue"),
    buildDisclosureGroup("warning", "先避开什么", warningBlocks, "amber"),
  ].filter((group): group is DisclosureGroup => Boolean(group));

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

      <section className="rounded-[36px] border border-[#e4ecf8] bg-[linear-gradient(180deg,#ffffff_0%,#f5f8fe_100%)] px-6 pb-6 pt-6 shadow-[0_22px_52px_rgba(30,59,114,0.08)]">
        <span className="inline-flex rounded-full border border-[#dde7f7] bg-white/88 px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.03em] text-[#3f5f94]">
          {heroContent?.eyebrow || `${titlePrefix}结果`}
        </span>

        <h1 className="mt-5 text-[34px] leading-[1.08] font-semibold tracking-[-0.04em] text-[#142036]">
          {heroTitle}
        </h1>
        <p className="mt-4 max-w-[26rem] text-[15px] leading-[1.75] text-[#53647d]">{heroSupport}</p>

        <div className="mt-8 rounded-[30px] border border-white/90 bg-white/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
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

          <div className="mt-6">
            <div className="text-[12px] font-medium text-[#607089]">先从这款开始</div>
            {product.brand ? <div className="mt-2 text-[13px] font-medium text-[#6b7d97]">{product.brand}</div> : null}
            <div className="mt-1 text-[23px] leading-[1.32] font-semibold tracking-[-0.03em] text-[#162339]">
              {product.name || "未命名产品"}
            </div>
          </div>

          <div className="mt-6">
            <Link
              href={primaryCta.href}
              className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[#0a84ff] px-5 text-[16px] font-semibold tracking-[-0.02em] text-white shadow-[0_14px_28px_rgba(10,132,255,0.24)] active:opacity-90"
            >
              {primaryCta.label}
            </Link>
            {secondaryCta ? (
              <div className="mt-4 text-center">
                <Link
                  href={secondaryCta.href}
                  className="text-[14px] font-semibold text-[#355f9d] active:opacity-75"
                >
                  {secondaryCta.label}
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {disclosureGroups.map((group) => (
        <DisclosureCard key={group.id} group={group} />
      ))}

      <details className="mt-5 rounded-[28px] border border-black/8 bg-white/84 px-5 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
        <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[19px] leading-[1.25] font-semibold tracking-[-0.02em] text-[#18253b]">
                需要时再看更多
              </p>
              <p className="mt-2 text-[14px] leading-[1.65] text-black/52">
                补充操作和结果说明都收在这里，不抢首屏注意力。
              </p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f4f6fa] text-[18px] text-[#667993]">
              +
            </span>
          </div>
        </summary>
        <div className="mt-5 space-y-4">
          {extraActions.length > 0 ? (
            <div className="flex flex-wrap gap-2.5">
              {extraActions.map((action) => (
                <Link
                  key={`${action.action}-${action.href}`}
                  href={action.href}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white/90 px-4 text-[14px] font-semibold text-black/74 active:bg-black/[0.03]"
                >
                  {action.label}
                </Link>
              ))}
            </div>
          ) : null}

          <details className="rounded-[22px] border border-black/8 bg-[#fafbfd] px-4 py-3">
            <summary className="list-none cursor-pointer text-[14px] font-semibold text-black/76 [&::-webkit-details-marker]:hidden">
              这次结果说明
            </summary>
            <ul className="mt-3 space-y-2 text-[13px] leading-[1.65] text-black/56">
              <li>这次先按 {result.route.title} 这条主线给出建议。</li>
              <li>推荐来源：{SOURCE_LABELS[result.recommendation_source] || "未知"}。</li>
              <li>
                规则版本：{result.rules_version}
                {generatedAt ? ` · 生成于 ${generatedAt}` : ""}。
              </li>
              <li>{routeFocus}</li>
              {normalizeText(result.share_copy.caption) ? <li>{normalizeText(result.share_copy.caption)}</li> : null}
            </ul>
          </details>

          {overflowBlocks.length > 0 ? (
            <div className="space-y-3">
              {overflowBlocks.map((block) => (
                <SelectionResultBlockCard key={block.id} block={block} tone="neutral" compact />
              ))}
            </div>
          ) : null}
        </div>
      </details>
    </section>
  );
}

function DisclosureCard({ group }: { group: DisclosureGroup }) {
  return (
    <details className="mt-5 rounded-[28px] border border-black/8 bg-white/90 px-5 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
      <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[20px] leading-[1.24] font-semibold tracking-[-0.02em] text-[#18253b]">
              {group.title}
            </p>
            <p className="mt-2 text-[14px] leading-[1.65] text-black/52">{group.preview}</p>
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f4f6fa] text-[18px] text-[#667993]">
            +
          </span>
        </div>
      </summary>
      <div className="mt-5 space-y-3">
        {group.blocks.map((block) => (
          <SelectionResultBlockCard key={block.id} block={block} tone={group.tone} compact />
        ))}
      </div>
    </details>
  );
}

function SelectionResultBlockCard({
  block,
  tone,
  compact = false,
}: {
  block: MobileSelectionResultBlock;
  tone: "neutral" | "blue" | "amber";
  compact?: boolean;
}) {
  const content = parseBlockContent(block);
  const rawLead = normalizeText(content.subtitle) || normalizeText(content.items[0] || "") || normalizeText(content.note);
  const lead = previewText(rawLead);
  const extraItems = content.items.filter((item) => item !== rawLead).slice(0, compact ? 2 : 4);
  const cardTone =
    tone === "blue"
      ? "border-[#d8e6ff] bg-[linear-gradient(180deg,#fbfdff_0%,#f4f8ff_100%)]"
      : tone === "amber"
        ? "border-[#f4dfb1] bg-[#fffaf1]"
        : "border-black/8 bg-white";

  return (
    <section className={`rounded-[26px] border px-4 py-4 ${cardTone}`}>
      {content.eyebrow ? (
        <div className="text-[11px] font-semibold tracking-[0.04em] text-[#5f7597]">{content.eyebrow}</div>
      ) : null}
      <h3
        className={`text-[#18253b] ${content.eyebrow ? "mt-1" : ""} ${
          compact ? "text-[18px] leading-[1.34]" : "text-[21px] leading-[1.3] tracking-[-0.02em]"
        }`}
      >
        {content.title}
      </h3>
      {lead ? <p className="mt-2 text-[14px] leading-[1.7] text-[#55677f]">{lead}</p> : null}
      {extraItems.length > 0 ? (
        <ul className="mt-3 space-y-2 text-[13px] leading-[1.6] text-[#344660]">
          {extraItems.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#6c86ac]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {content.note && content.note !== lead ? (
        <p className="mt-3 text-[12px] leading-[1.55] text-[#6a7d98]">{content.note}</p>
      ) : null}
      {!lead && extraItems.length === 0 && !content.note ? (
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

function buildDisclosureGroup(
  id: string,
  title: string,
  blocks: MobileSelectionResultBlock[],
  tone: "neutral" | "blue" | "amber",
): DisclosureGroup | null {
  if (blocks.length === 0) return null;
  const preview = summarizeBlock(blocks[0]) || "展开后再看这一部分。";
  return {
    id,
    title,
    preview,
    tone,
    blocks,
  };
}

function summarizeBlock(block: MobileSelectionResultBlock): string {
  const content = parseBlockContent(block);
  return (
    previewText(content.subtitle) ||
    previewText(content.items[0] || "") ||
    previewText(content.note) ||
    previewText(content.title)
  );
}

function previewText(value: string | null | undefined, limit = 30): string {
  const text = normalizeText(value);
  if (!text) return "";
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trimEnd()}…`;
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
