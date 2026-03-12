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

  return (
    <section className="pb-12">
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

      <div className="text-[13px] font-medium text-black/45">{titlePrefix} · 预生成结果</div>
      <h1 className="mt-2 text-[30px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/92">
        {result.route.title}
      </h1>
      <p className="mt-3 text-[15px] leading-[1.65] text-black/66">{routeFocus}</p>

      <article className="mt-6 rounded-3xl border border-black/10 bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[#cfe2ff] bg-[#f4f8ff] px-3 py-1 text-[11px] text-[#244f9e]">
            {result.route.title}
          </span>
          <span className="rounded-full border border-black/12 bg-[#fafafa] px-3 py-1 text-[11px] text-black/58">
            推荐来源：{SOURCE_LABELS[result.recommendation_source] || "未知"}
          </span>
          <span className="rounded-full border border-black/12 bg-[#fafafa] px-3 py-1 text-[11px] text-black/58">
            规则版本：{result.rules_version}
          </span>
          <span className="rounded-full border border-black/12 bg-[#fafafa] px-3 py-1 text-[11px] text-black/58">
            渲染器：{result.renderer_variant}
          </span>
        </div>

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

        <div className="mt-6 space-y-3">
          {result.display_order.length > 0 ? (
            result.display_order.map((entry) => {
              if (entry === "ctas") {
                return (
                  <SelectionResultCTASection
                    key="ctas"
                    ctas={result.ctas}
                    result={result}
                    startHref={startHref}
                    profileHref={profileHref}
                  />
                );
              }
              const block = blocksById.get(entry);
              if (!block) {
                return (
                  <SelectionResultRuntimeErrorCard
                    key={`missing-${entry}`}
                    title="结果配置错误"
                    detail={`display_order 引用了不存在的 block：${entry}`}
                  />
                );
              }
              return <SelectionResultBlockCard key={block.id} block={block} />;
            })
          ) : (
            <SelectionResultRuntimeErrorCard title="结果配置缺失" detail="当前场景已发布，但 display_order 为空。" />
          )}
        </div>
      </article>
    </section>
  );
}

function SelectionResultBlockCard({ block }: { block: MobileSelectionResultBlock }) {
  const payload = block.payload || {};
  const eyebrow = readString(payload, ["eyebrow"]);
  const title = readString(payload, ["title", "headline", "label"]) || humanizeKind(block.kind);
  const subtitle = readString(payload, ["subtitle", "description", "body", "text"]);
  const note = readString(payload, ["note", "hint"]);
  const items = readStringArray(payload, ["items", "bullets", "points", "list"]);
  const rawJson = JSON.stringify(payload, null, 2);

  if (block.kind === "hero") {
    return (
      <section className="rounded-3xl border border-[#d9e5ff] bg-[linear-gradient(180deg,#f8fbff_0%,#eef5ff_100%)] px-4 py-4">
        {eyebrow ? <div className="text-[12px] font-semibold tracking-[0.04em] text-[#315fbd]">{eyebrow}</div> : null}
        <h2 className="mt-1 text-[24px] leading-[1.2] font-semibold tracking-[-0.02em] text-black/90">{title}</h2>
        {subtitle ? <p className="mt-2 text-[14px] leading-[1.6] text-black/68">{subtitle}</p> : null}
        {items.length > 0 ? (
          <ul className="mt-3 space-y-1.5 text-[13px] leading-[1.55] text-black/72">
            {items.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        ) : null}
      </section>
    );
  }

  return (
    <section className={`rounded-2xl border px-4 py-3 ${toneClass(block.kind)}`}>
      <div className="text-[14px] font-semibold text-black/86">{title}</div>
      {subtitle ? <p className="mt-2 text-[13px] leading-[1.6] text-black/65">{subtitle}</p> : null}
      {items.length > 0 ? (
        <ul className="mt-2 space-y-1.5 text-[13px] leading-[1.55] text-black/68">
          {items.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      ) : null}
      {note ? <p className="mt-2 text-[12px] leading-[1.55] text-black/52">{note}</p> : null}
      {!subtitle && items.length === 0 && !note ? (
        <pre className="mt-2 overflow-x-auto rounded-xl bg-white/80 px-3 py-2 text-[11px] leading-[1.45] text-[#7a2d21]">
          {rawJson}
        </pre>
      ) : null}
    </section>
  );
}

function SelectionResultCTASection({
  ctas,
  result,
  startHref,
  profileHref,
}: {
  ctas: MobileSelectionResultCTA[];
  result: MobileSelectionPublishedResult;
  startHref: string;
  profileHref: string;
}) {
  if (!ctas.length) {
    return <SelectionResultRuntimeErrorCard title="CTA 配置缺失" detail="display_order 包含 ctas，但当前场景没有 CTA。" />;
  }
  return (
    <div className="flex flex-wrap gap-2.5 pt-1">
      {ctas.map((cta) => {
        const href = resolveCtaHref(cta, result, startHref, profileHref);
        if (!href) {
          return (
            <div
              key={cta.id}
              className="inline-flex h-11 items-center justify-center rounded-full border border-[#f0d6d2] bg-[#fff7f6] px-5 text-[14px] font-semibold text-[#9a3d2e]"
            >
              CTA 配置错误：{cta.label}
            </div>
          );
        }
        const primary = cta.action === "product";
        return (
          <Link
            key={cta.id}
            href={href}
            className={
              primary
                ? "inline-flex h-11 items-center justify-center rounded-full bg-black px-5 text-[15px] font-semibold tracking-[-0.01em] text-white active:opacity-90"
                : "inline-flex h-11 items-center justify-center rounded-full border border-black/15 px-5 text-[15px] font-semibold text-black/80 active:bg-black/[0.03]"
            }
          >
            {cta.label}
          </Link>
        );
      })}
    </div>
  );
}

function SelectionResultRuntimeErrorCard({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <section className="rounded-2xl border border-[#f0d6d2] bg-[#fff7f6] px-4 py-3">
      <div className="text-[13px] font-semibold text-[#9a3d2e]">{title}</div>
      <p className="mt-1 text-[12px] leading-[1.55] text-[#9a3d2e]">{detail}</p>
    </section>
  );
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

function humanizeKind(kind: string): string {
  const normalized = String(kind || "").trim().toLowerCase();
  if (normalized === "explanation") return "解释";
  if (normalized === "strategy") return "推荐策略";
  if (normalized === "warning") return "提醒";
  if (normalized === "hero") return "核心结论";
  return normalized || "结果模块";
}

function toneClass(kind: string): string {
  const normalized = String(kind || "").trim().toLowerCase();
  if (normalized === "warning") return "border-[#f4dfb1] bg-[#fffaf0]";
  if (normalized === "strategy") return "border-[#d3e2ff] bg-[#f5f8ff]";
  if (normalized === "explanation") return "border-black/8 bg-[#fafafa]";
  return "border-black/8 bg-white";
}
