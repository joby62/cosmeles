import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import MobileTrackedLink from "@/components/mobile/MobileTrackedLink";
import { fetchIngredientLibraryItem } from "@/lib/api";
import { isWikiCategoryKey, type WikiCategoryKey, WIKI_MAP } from "@/lib/mobile/ingredientWiki";
import {
  appendMobileUtilityRouteState,
  describeMobileUtilityReturnLabel,
  hasMobileUtilityResultContext,
  hasMobileUtilityRouteContext,
  parseMobileUtilityRouteState,
  resolveMobileUtilityReturnHref,
  resolveMobileUtilitySource,
} from "@/features/mobile-utility/routeState";
import { InsightSheetCard } from "./insight-sheet-card";

type Params = { category: string; slug: string };
const INGREDIENT_ID_PATTERN = /^ing-[a-f0-9]{20}$/;
type Search = Record<string, string | string[] | undefined>;

type CategoryTheme = {
  heroClass: string;
  hazeClass: string;
  accentClass: string;
};

const CATEGORY_THEME: Record<WikiCategoryKey, CategoryTheme> = {
  shampoo: {
    heroClass:
      "bg-[radial-gradient(circle_at_25%_18%,rgba(235,250,255,0.96),rgba(186,222,238,0.9)_45%,rgba(133,181,206,0.94)_100%)]",
    hazeClass: "bg-[radial-gradient(circle_at_70%_80%,rgba(16,53,80,0.42),rgba(10,20,36,0)_64%)]",
    accentClass: "bg-[#8fd3f2]",
  },
  bodywash: {
    heroClass:
      "bg-[radial-gradient(circle_at_70%_18%,rgba(242,248,255,0.96),rgba(194,211,246,0.9)_44%,rgba(121,143,210,0.94)_100%)]",
    hazeClass: "bg-[radial-gradient(circle_at_22%_82%,rgba(28,38,92,0.42),rgba(10,20,36,0)_64%)]",
    accentClass: "bg-[#9fb5ff]",
  },
  conditioner: {
    heroClass:
      "bg-[radial-gradient(circle_at_24%_16%,rgba(248,244,255,0.97),rgba(214,198,245,0.91)_44%,rgba(152,129,216,0.94)_100%)]",
    hazeClass: "bg-[radial-gradient(circle_at_72%_82%,rgba(56,24,102,0.42),rgba(10,20,36,0)_64%)]",
    accentClass: "bg-[#bea1ff]",
  },
  lotion: {
    heroClass:
      "bg-[radial-gradient(circle_at_24%_18%,rgba(255,248,232,0.97),rgba(246,220,173,0.91)_44%,rgba(217,168,96,0.94)_100%)]",
    hazeClass: "bg-[radial-gradient(circle_at_70%_82%,rgba(90,56,18,0.4),rgba(10,20,36,0)_64%)]",
    accentClass: "bg-[#e7bd72]",
  },
  cleanser: {
    heroClass:
      "bg-[radial-gradient(circle_at_24%_18%,rgba(242,252,255,0.97),rgba(189,223,236,0.9)_44%,rgba(117,176,203,0.94)_100%)]",
    hazeClass: "bg-[radial-gradient(circle_at_72%_82%,rgba(16,66,84,0.42),rgba(10,20,36,0)_64%)]",
    accentClass: "bg-[#87c7dd]",
  },
};

type NameParts = {
  main: string;
  sub: string | null;
};

type ConfidenceMeta = {
  label: string;
  hint: string;
  chipClass: string;
};

function splitIngredientName(raw: string): NameParts {
  const text = raw.trim();
  const idx = text.indexOf("(");
  if (idx <= 0) {
    return { main: text, sub: null };
  }
  return {
    main: text.slice(0, idx).trim(),
    sub: text.slice(idx).trim() || null,
  };
}

function titleClassByLength(length: number): string {
  if (length > 56) return "text-[32px] leading-[1.06]";
  if (length > 34) return "text-[36px] leading-[1.04]";
  return "text-[42px] leading-[1.02]";
}

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function takeUnique(lines: string[], limit = 99): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of lines) {
    const line = normalizeLine(raw);
    if (!line || seen.has(line)) continue;
    seen.add(line);
    out.push(line);
    if (out.length >= limit) break;
  }
  return out;
}

function splitSentences(text: string): string[] {
  return text
    .split(/[。！？!?.]/)
    .map((line) => normalizeLine(line))
    .filter(Boolean);
}

function splitLead(text: string): { lead: string; rest: string } {
  const line = normalizeLine(text);
  const matched = line.match(/^(.{2,16}?)[，、；：:]/);
  if (matched) {
    const lead = matched[1];
    const rest = normalizeLine(line.slice(matched[0].length));
    return { lead, rest };
  }
  if (line.length > 16) {
    return { lead: line.slice(0, 16), rest: line.slice(16).trim() };
  }
  return { lead: line, rest: "" };
}

function shortText(text: string, max = 44): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function buildPanelSummary(lines: string[], fallback: string): string {
  if (lines.length === 0) return fallback;
  const { lead, rest } = splitLead(lines[0]);
  if (!rest) return lead;
  return `${lead}，${shortText(rest, 34)}`;
}

function parseConfidence(value: number | string): number {
  const n = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (Number.isNaN(n)) return 0;
  return n;
}

function getConfidenceMeta(confidence: number): ConfidenceMeta {
  if (confidence >= 80) {
    return {
      label: "证据较强",
      hint: "可直接参考",
      chipClass: "m-wiki-chip m-wiki-chip-strong",
    };
  }
  if (confidence >= 60) {
    return {
      label: "证据中等",
      hint: "建议结合场景",
      chipClass: "m-wiki-chip m-wiki-chip-medium",
    };
  }
  return {
    label: "证据较弱",
    hint: "先小范围尝试",
    chipClass: "m-wiki-chip m-wiki-chip-weak",
  };
}

function phraseTags(lines: string[], max = 6): string[] {
  const tokens: string[] = [];
  for (const raw of lines) {
    const parts = raw
      .split(/[；;。]/)
      .map((part) => normalizeLine(part))
      .filter(Boolean);
    if (parts.length === 0) continue;
    for (const part of parts) {
      tokens.push(part);
      if (tokens.length >= max * 2) break;
    }
    if (tokens.length >= max * 2) break;
  }
  return takeUnique(tokens.map((token) => shortText(token, 18)), max);
}

function queryValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function IngredientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams?: Promise<Search>;
}) {
  const raw = await Promise.resolve(params);
  const search = (await Promise.resolve(searchParams)) || {};

  if (!isWikiCategoryKey(raw.category)) {
    notFound();
  }

  const category = raw.category;
  const utilityRouteState = parseMobileUtilityRouteState(search);
  const analyticsSource = resolveMobileUtilitySource(utilityRouteState, "wiki_ingredient_detail");
  const showReturnAction = hasMobileUtilityRouteContext(utilityRouteState);
  const hasResultContext = hasMobileUtilityResultContext(utilityRouteState);
  const returnActionHref = resolveMobileUtilityReturnHref(utilityRouteState);
  const returnActionLabel = describeMobileUtilityReturnLabel(utilityRouteState);
  const returnTo = queryValue(search.return_to);
  const returnHrefBase = returnTo && returnTo.startsWith("/m/wiki") ? returnTo : `/m/wiki/${category}`;
  const returnHref = appendMobileUtilityRouteState(returnHrefBase, utilityRouteState, { includeReturnTo: false });
  const ingredientId = raw.slug.trim().toLowerCase();
  if (!INGREDIENT_ID_PATTERN.test(ingredientId)) {
    notFound();
  }

  let detail;
  try {
    detail = await fetchIngredientLibraryItem(category, ingredientId);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.startsWith("API 404")) {
      notFound();
    }
    throw e;
  }

  const item = detail.item;
  const profile = item.profile;
  const categoryLabel = WIKI_MAP[category].label;
  const theme = CATEGORY_THEME[category];
  const name = splitIngredientName(item.ingredient_name);

  const benefits = takeUnique(profile.benefits);
  const risks = takeUnique(profile.risks);
  const tips = takeUnique(profile.usage_tips);
  const suitable = takeUnique(profile.suitable_for);
  const avoid = takeUnique(profile.avoid_for);

  const summarySentences = splitSentences(profile.summary || "");
  const leadSummary = summarySentences[0] || "当前样本支持该成分在对应品类中有明确用途。";
  const secondSummary = summarySentences[1] || "";

  const confidenceNum = parseConfidence(profile.confidence);
  const confidenceMeta = getConfidenceMeta(confidenceNum);

  const keyBenefit = benefits[0] || "暂无关键收益";
  const keyRisk = risks[0] || "暂无明确风险";
  const keyTip = tips[0] || "按产品说明正常使用";
  const weakEvidence = confidenceNum < 60;
  const weakEvidenceNotice = "证据较弱，建议先小范围试用并观察头皮反应";

  const benefitSummary = buildPanelSummary(benefits, "暂无收益描述。");
  const riskSummary = buildPanelSummary(risks, "暂无风险描述。");
  const tipSummary = buildPanelSummary(tips, "暂无使用建议。");

  const benefitTags = phraseTags(benefits, 2);
  const riskTags = phraseTags(risks, 2);
  const tipTags = phraseTags(tips, 2);

  const mainSample = item.source_samples[0];
  const restSamples = item.source_samples.slice(1, 5);

  return (
    <section className="m-wiki-page -mx-4 -mt-6 min-h-[calc(100dvh-3rem)] bg-[color:var(--m-wiki-canvas)] pb-40 pt-4 text-white">
      <div className="flex flex-wrap gap-2 px-4">
        <Link
          href={returnHref}
          className="m-pressable inline-flex h-10 items-center rounded-full border border-white/16 bg-white/10 px-4 text-[13px] font-medium text-white/86 backdrop-blur-xl active:bg-white/15"
        >
          返回成份百科
        </Link>
        {showReturnAction ? (
          <MobileTrackedLink
            href={returnActionHref}
            eventName={hasResultContext ? "result_secondary_loop_click" : undefined}
            eventProps={
              hasResultContext && utilityRouteState.scenarioId
                ? {
                    page: "wiki_ingredient_detail",
                    route: `/m/wiki/${category}/${ingredientId}`,
                    source: analyticsSource,
                    category,
                    scenario_id: utilityRouteState.scenarioId,
                    target_path: returnActionHref,
                    action: "wiki_return",
                  }
                : undefined
            }
            className="m-pressable inline-flex h-10 items-center rounded-full border border-[#8fb9f5]/45 bg-[rgba(255,255,255,0.14)] px-4 text-[13px] font-semibold text-white/92 backdrop-blur-xl active:bg-white/[0.22]"
          >
            {returnActionLabel}
          </MobileTrackedLink>
        ) : null}
      </div>

      <article className="m-wiki-hero-card mt-4 overflow-hidden rounded-[32px]">
        <div className={`${theme.heroClass} relative h-[268px] w-full`}>
          <div className={`absolute inset-0 ${theme.hazeClass}`} />
          <div className={`absolute right-[-44px] top-[-34px] h-[170px] w-[170px] rounded-full ${theme.accentClass} opacity-30 blur-3xl`} />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.15)_0%,rgba(255,255,255,0)_35%,rgba(0,0,0,0.42)_100%)]" />

          <Image
            src={`/m/categories/${category}.png`}
            alt={categoryLabel}
            width={128}
            height={128}
            className="absolute right-6 top-8 h-[92px] w-[92px] rounded-[26px] object-cover opacity-85 shadow-[0_16px_36px_rgba(0,0,0,0.25)] ring-1 ring-white/25"
          />

          <div className="absolute left-5 top-5 rounded-full border border-white/35 bg-white/12 px-2.5 py-0.5 text-[12px] font-medium text-white/88 backdrop-blur-lg">
            {categoryLabel}
          </div>

          <div className="absolute bottom-5 left-5 right-5">
            <p className="m-wiki-kicker text-[13px] text-white/84">成分详情</p>
            <h1
              data-m-large-title={name.main}
              className={`mt-1 line-clamp-2 break-words font-semibold tracking-[-0.03em] text-white ${titleClassByLength(item.ingredient_name.length)}`}
            >
              {name.main}
            </h1>
            {name.sub ? <p className="mt-1 line-clamp-1 text-[17px] leading-[1.1] font-semibold text-white/92">{name.sub}</p> : null}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-px border-t border-white/10 bg-white/10 text-center">
          <div className="bg-black/28 px-2 py-3 backdrop-blur-xl">
            <p className="text-[11px] text-white/55">来源样本</p>
            <p className="mt-1 text-[18px] font-semibold text-white">{item.source_count}</p>
          </div>
          <div className="bg-black/28 px-2 py-3 backdrop-blur-xl">
            <p className="text-[11px] text-white/55">模型把握</p>
            <p className="mt-1 text-[18px] font-semibold text-white">{confidenceNum}</p>
          </div>
          <div className="bg-black/28 px-2 py-3 backdrop-blur-xl">
            <p className="text-[11px] text-white/55">所属分类</p>
            <p className="mt-1 text-[16px] font-semibold text-white">{categoryLabel}</p>
          </div>
        </div>
      </article>

      <div className="mt-5 space-y-3 px-4">
        <section className="m-wiki-card rounded-[24px] p-4 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-2">
            <p className="m-wiki-kicker text-[12px] text-[#4ea0ff]">一分钟结论</p>
            <span className={`inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] font-semibold ${confidenceMeta.chipClass}`}>{confidenceMeta.label}</span>
          </div>

          {weakEvidence ? (
            <div className="m-wiki-alert mt-3 flex items-start gap-2 rounded-2xl border px-3 py-2.5 text-[13px] leading-[1.45]">
              <span className="m-wiki-alert-dot mt-[0.42em] h-1.5 w-1.5 shrink-0 rounded-full" />
              <p>{weakEvidenceNotice}</p>
            </div>
          ) : null}

          <p className="mt-2 line-clamp-3 text-[21px] leading-[1.36] tracking-[-0.01em] text-white/94">{shortText(leadSummary, 88)}</p>
          {secondSummary ? <p className="mt-2 line-clamp-2 text-[14px] leading-[1.5] text-white/72">{shortText(secondSummary, 64)}</p> : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <KeyPill label="重点收益" value={shortText(splitLead(keyBenefit).lead, 12)} tone="good" />
            <KeyPill label="注意" value={shortText(splitLead(keyRisk).lead, 12)} tone="warn" />
            <KeyPill label="建议" value={shortText(splitLead(keyTip).lead, 12)} tone="info" />
          </div>
          <p className="mt-2 text-[12px] text-white/52">{confidenceMeta.hint}</p>
        </section>

        <section className="grid gap-3">
          <InsightSheetCard title="主要收益" tone="good" items={benefits} summary={benefitSummary} digestTags={benefitTags} emptyText="暂无收益描述。" />
          <InsightSheetCard
            title="潜在风险"
            tone="warn"
            items={risks}
            summary={riskSummary}
            digestTags={riskTags}
            emptyText="暂无风险描述。"
            showRiskLevel
          />
          <InsightSheetCard title="使用建议" tone="info" items={tips} summary={tipSummary} digestTags={tipTags} emptyText="暂无使用建议。" />
        </section>

        <section className="grid gap-3">
          <TagPanel title="更适合" tags={phraseTags(suitable)} emptyText="暂无适配人群标签。" tone="good" />
          <TagPanel title="需规避" tags={phraseTags(avoid)} emptyText="暂无规避人群标签。" tone="warn" />
        </section>

        <details className="m-wiki-card group rounded-[22px] px-4 py-4 backdrop-blur-xl">
          <summary className="list-none cursor-pointer text-[15px] font-semibold text-white/92">
            <span>查看完整分析依据</span>
            <span className="ml-2 text-[12px] text-white/50 group-open:hidden">展开</span>
            <span className="ml-2 hidden text-[12px] text-white/50 group-open:inline">收起</span>
          </summary>
          <div className="mt-3 space-y-3 border-t border-white/10 pt-3 text-[14px] leading-[1.6] text-white/72">
            <p><span className="font-semibold text-white/88">核心摘要：</span>{profile.summary || "未提供"}</p>
            <p><span className="font-semibold text-white/88">模型结论：</span>{profile.reason || "未提供"}</p>
          </div>
        </details>

        {mainSample ? (
          <section className="m-wiki-card rounded-[22px] px-4 py-4 backdrop-blur-xl">
            <h2 className="text-[16px] font-semibold text-white/92">来源样本</h2>
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <div className="text-[13px] font-medium text-white/84">
                {mainSample.brand || "未知品牌"} · {mainSample.name || "未知产品"}
              </div>
              <p className="mt-2 line-clamp-3 text-[13px] leading-[1.55] text-white/68">{mainSample.one_sentence || "无一句话描述"}</p>
            </div>

            {restSamples.length > 0 ? (
              <details className="group mt-3">
                <summary className="list-none cursor-pointer text-[13px] font-medium text-white/72">
                  查看更多样本（{restSamples.length}）
                </summary>
                <div className="mt-2 space-y-2.5">
                  {restSamples.map((sample) => (
                    <div key={`${sample.trace_id}-${sample.name}`} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                      <div className="text-[12px] font-medium text-white/82">
                        {sample.brand || "未知品牌"} · {sample.name || "未知产品"}
                      </div>
                      <p className="mt-1 text-[12px] leading-[1.5] text-white/64">{sample.one_sentence || "无一句话描述"}</p>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </section>
        ) : null}
      </div>
    </section>
  );
}

function KeyPill({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "info" }) {
  const cls =
    tone === "good"
      ? "m-wiki-pill m-wiki-pill-good"
      : tone === "warn"
        ? "m-wiki-pill m-wiki-pill-warn"
        : "m-wiki-pill m-wiki-pill-info";

  return (
    <span className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[12px] ${cls}`}>
      <span className="font-medium">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

function TagPanel({
  title,
  tags,
  emptyText,
  tone,
}: {
  title: string;
  tags: string[];
  emptyText: string;
  tone: "good" | "warn";
}) {
  const cls = tone === "good" ? "m-wiki-tag m-wiki-tag-good" : "m-wiki-tag m-wiki-tag-warn";

  return (
    <section className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4 backdrop-blur-xl">
      <h3 className="text-[16px] font-semibold text-white/92">{title}</h3>
      {tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className={`inline-flex h-7 items-center rounded-full border px-2.5 text-[12px] ${cls}`}>
              {tag}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[14px] text-white/52">{emptyText}</p>
      )}
    </section>
  );
}
