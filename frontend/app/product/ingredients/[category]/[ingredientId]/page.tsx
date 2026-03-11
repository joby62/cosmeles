import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchIngredientLibraryItem } from "@/lib/api";
import { isWikiCategoryKey, WIKI_MAP, type WikiCategoryKey } from "@/lib/mobile/ingredientWiki";

type Params = { category: string; ingredientId: string };

const INGREDIENT_ID_PATTERN = /^ing-[a-f0-9]{20}$/;

type CategoryTheme = {
  heroClass: string;
  accentClass: string;
  hazeClass: string;
};

const CATEGORY_THEME: Record<WikiCategoryKey, CategoryTheme> = {
  shampoo: {
    heroClass: "from-[#eef8ff] via-white to-[#d8ecf8]",
    accentClass: "bg-[#8fd3f2]",
    hazeClass: "bg-[radial-gradient(circle_at_72%_78%,rgba(80,140,176,0.18),rgba(255,255,255,0)_64%)]",
  },
  bodywash: {
    heroClass: "from-[#f2f7ff] via-white to-[#dce7ff]",
    accentClass: "bg-[#9fb5ff]",
    hazeClass: "bg-[radial-gradient(circle_at_72%_78%,rgba(88,108,188,0.18),rgba(255,255,255,0)_64%)]",
  },
  conditioner: {
    heroClass: "from-[#f6f1ff] via-white to-[#e6dcff]",
    accentClass: "bg-[#bea1ff]",
    hazeClass: "bg-[radial-gradient(circle_at_72%_78%,rgba(123,94,189,0.18),rgba(255,255,255,0)_64%)]",
  },
  lotion: {
    heroClass: "from-[#fff7ea] via-white to-[#f7e3bf]",
    accentClass: "bg-[#e7bd72]",
    hazeClass: "bg-[radial-gradient(circle_at_72%_78%,rgba(177,133,56,0.18),rgba(255,255,255,0)_64%)]",
  },
  cleanser: {
    heroClass: "from-[#eefbff] via-white to-[#d7edf4]",
    accentClass: "bg-[#87c7dd]",
    hazeClass: "bg-[radial-gradient(circle_at_72%_78%,rgba(74,132,156,0.18),rgba(255,255,255,0)_64%)]",
  },
};

type NameParts = {
  main: string;
  sub: string | null;
};

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

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

function splitSentences(text: string): string[] {
  return text
    .split(/[。！？!?.]/)
    .map((line) => normalizeLine(line))
    .filter(Boolean);
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

function shortText(text: string, max = 48): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}...`;
}

function buildPanelSummary(lines: string[], fallback: string): string {
  if (lines.length === 0) return fallback;
  const { lead, rest } = splitLead(lines[0]);
  if (!rest) return lead;
  return `${lead}，${shortText(rest, 34)}`;
}

function phraseTags(lines: string[], max = 6): string[] {
  const tokens: string[] = [];
  for (const raw of lines) {
    const parts = raw
      .split(/[；;。]/)
      .map((part) => normalizeLine(part))
      .filter(Boolean);
    for (const part of parts) {
      tokens.push(part);
      if (tokens.length >= max * 2) break;
    }
    if (tokens.length >= max * 2) break;
  }
  return takeUnique(tokens.map((token) => shortText(token, 20)), max);
}

function parseConfidence(value: number | string): number {
  const n = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (Number.isNaN(n)) return 0;
  return n;
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function confidenceTone(confidence: number): { label: string; className: string } {
  if (confidence >= 80) {
    return { label: "证据较强", className: "border-[#b7e6c8] bg-[#eefaf2] text-[#116a3f]" };
  }
  if (confidence >= 60) {
    return { label: "证据中等", className: "border-[#f3d49a] bg-[#fff7e9] text-[#9a6308]" };
  }
  return { label: "证据较弱", className: "border-[#f1c2bc] bg-[#fff4f2] text-[#b42318]" };
}

export default async function DesktopIngredientDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const raw = await Promise.resolve(params);
  const category = raw.category.trim().toLowerCase();
  const ingredientId = raw.ingredientId.trim().toLowerCase();

  if (!isWikiCategoryKey(category) || !INGREDIENT_ID_PATTERN.test(ingredientId)) {
    notFound();
  }

  let detail;
  try {
    detail = await fetchIngredientLibraryItem(category, ingredientId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith("API 404")) notFound();
    throw error;
  }

  const item = detail.item;
  const profile = item.profile;
  const name = splitIngredientName(item.ingredient_name);
  const categoryInfo = WIKI_MAP[category];
  const theme = CATEGORY_THEME[category];
  const benefits = takeUnique(profile.benefits);
  const risks = takeUnique(profile.risks);
  const tips = takeUnique(profile.usage_tips);
  const suitable = takeUnique(profile.suitable_for);
  const avoid = takeUnique(profile.avoid_for);
  const summarySentences = splitSentences(profile.summary || "");
  const leadSummary = summarySentences[0] || "当前样本支持该成分在对应品类中有明确用途。";
  const secondSummary = summarySentences[1] || "";
  const confidence = parseConfidence(profile.confidence);
  const confidenceMeta = confidenceTone(confidence);
  const keyBenefit = benefits[0] || "暂无关键收益";
  const keyRisk = risks[0] || "暂无明确风险";
  const keyTip = tips[0] || "按产品说明正常使用";
  const mainSample = item.source_samples[0];
  const restSamples = item.source_samples.slice(1, 5);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1180px] px-6 py-12">
      <Link
        href="/product/ingredients#ingredient-visualization-panel"
        className="inline-flex h-10 items-center rounded-full border border-black/12 bg-white px-4 text-[13px] font-semibold text-black/72 hover:bg-black/[0.03]"
      >
        返回成分治理
      </Link>

      <section className={`relative mt-5 overflow-hidden rounded-[34px] border border-black/10 bg-gradient-to-br ${theme.heroClass} px-8 py-8`}>
        <div className={`pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full ${theme.accentClass} opacity-16 blur-3xl`} />
        <div className={`pointer-events-none absolute inset-0 ${theme.hazeClass}`} />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-[760px]">
            <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3 py-1 text-[12px] font-semibold text-black/62">
              <span>INGREDIENT DETAIL</span>
              <span>{categoryInfo.label}</span>
            </div>
            <h1 className="mt-4 text-[44px] font-semibold tracking-[-0.04em] text-black/92">{name.main}</h1>
            {name.sub ? <p className="mt-2 text-[20px] font-semibold text-black/66">{name.sub}</p> : null}
            <p className="mt-4 max-w-[680px] text-[18px] leading-[1.55] text-black/72">{leadSummary}</p>
            {secondSummary ? <p className="mt-2 max-w-[640px] text-[14px] leading-[1.6] text-black/56">{secondSummary}</p> : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <span className={`inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-semibold ${confidenceMeta.className}`}>
                {confidenceMeta.label}
              </span>
              <KeyDigest label="重点收益" value={shortText(splitLead(keyBenefit).lead, 14)} tone="good" />
              <KeyDigest label="注意" value={shortText(splitLead(keyRisk).lead, 14)} tone="warn" />
              <KeyDigest label="建议" value={shortText(splitLead(keyTip).lead, 14)} tone="info" />
            </div>
          </div>

          <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-[28px] border border-white/55 bg-white/70 shadow-[0_20px_46px_rgba(16,24,40,0.12)]">
            <Image
              src={`/m/categories/${category}.png`}
              alt={categoryInfo.label}
              fill
              sizes="112px"
              className="object-cover"
            />
          </div>
        </div>

        <div className="relative mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="被产品引用" value={`${item.source_count}`} note="按成分库样本聚合" />
          <MetricCard label="模型把握" value={`${confidence}`} note={confidenceMeta.label} />
          <MetricCard label="一级分类" value={categoryInfo.label} note={categoryInfo.summary} />
          <MetricCard label="最近生成" value={formatDate(item.generated_at)} note={`ID ${item.ingredient_id}`} />
        </div>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1.12fr_0.88fr]">
        <article className="rounded-[28px] border border-black/10 bg-white p-6 shadow-[0_18px_44px_rgba(16,24,40,0.06)]">
          <div className="text-[12px] font-semibold tracking-[0.12em] text-black/42">ONE-MINUTE</div>
          <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.03em] text-black/90">一分钟结论</h2>
          {confidence < 60 ? (
            <div className="mt-4 rounded-2xl border border-[#f1c2bc] bg-[#fff4f2] px-4 py-3 text-[13px] leading-[1.55] text-[#b42318]">
              证据较弱，建议先小范围试用，再结合具体产品体系判断。
            </div>
          ) : null}
          <p className="mt-4 text-[22px] leading-[1.5] tracking-[-0.02em] text-black/88">{shortText(leadSummary, 120)}</p>
          <p className="mt-3 text-[14px] leading-[1.7] text-black/62">{profile.reason || "未提供模型结论。"}</p>
        </article>

        <article className="rounded-[28px] border border-black/10 bg-white p-6 shadow-[0_18px_44px_rgba(16,24,40,0.06)]">
          <div className="text-[12px] font-semibold tracking-[0.12em] text-black/42">SOURCES</div>
          <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-black/90">来源样本</h2>
          {mainSample ? (
            <div className="mt-4 rounded-2xl border border-black/10 bg-[#f8fafc] px-4 py-4">
              <div className="text-[14px] font-semibold text-black/86">
                {mainSample.brand || "未知品牌"} · {mainSample.name || "未知产品"}
              </div>
              <p className="mt-2 text-[13px] leading-[1.6] text-black/62">{mainSample.one_sentence || "无一句话描述"}</p>
            </div>
          ) : (
            <div className="mt-4 text-[14px] text-black/52">暂无来源样本。</div>
          )}

          {restSamples.length > 0 ? (
            <div className="mt-3 space-y-2">
              {restSamples.map((sample) => (
                <div key={`${sample.trace_id}-${sample.name}`} className="rounded-2xl border border-black/10 bg-white px-4 py-3">
                  <div className="text-[13px] font-semibold text-black/82">
                    {sample.brand || "未知品牌"} · {sample.name || "未知产品"}
                  </div>
                  <p className="mt-1 text-[12px] leading-[1.55] text-black/58">{sample.one_sentence || "无一句话描述"}</p>
                </div>
              ))}
            </div>
          ) : null}
        </article>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-3">
        <InsightCard title="主要收益" summary={buildPanelSummary(benefits, "暂无收益描述。")} items={benefits} tags={phraseTags(benefits, 3)} emptyText="暂无收益描述。" tone="good" />
        <InsightCard title="潜在风险" summary={buildPanelSummary(risks, "暂无风险描述。")} items={risks} tags={phraseTags(risks, 3)} emptyText="暂无风险描述。" tone="warn" />
        <InsightCard title="使用建议" summary={buildPanelSummary(tips, "暂无使用建议。")} items={tips} tags={phraseTags(tips, 3)} emptyText="暂无使用建议。" tone="info" />
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <TagGroup title="更适合" tags={phraseTags(suitable, 8)} emptyText="暂无适配人群标签。" tone="good" />
        <TagGroup title="需规避" tags={phraseTags(avoid, 8)} emptyText="暂无规避人群标签。" tone="warn" />
      </section>

      <details className="mt-6 rounded-[28px] border border-black/10 bg-white px-6 py-5 shadow-[0_18px_44px_rgba(16,24,40,0.06)]">
        <summary className="cursor-pointer text-[15px] font-semibold text-black/84">查看完整分析依据</summary>
        <div className="mt-4 space-y-3 border-t border-black/8 pt-4 text-[14px] leading-[1.7] text-black/64">
          <p><span className="font-semibold text-black/88">核心摘要：</span>{profile.summary || "未提供"}</p>
          <p><span className="font-semibold text-black/88">模型结论：</span>{profile.reason || "未提供"}</p>
          <p><span className="font-semibold text-black/88">分析文本：</span>{profile.analysis_text || "未提供"}</p>
        </div>
      </details>
    </main>
  );
}

function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-[22px] border border-black/10 bg-white/86 px-4 py-4 backdrop-blur-xl">
      <div className="text-[11px] text-black/46">{label}</div>
      <div className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-black/88">{value}</div>
      <div className="mt-1 line-clamp-2 text-[12px] leading-[1.45] text-black/52">{note}</div>
    </div>
  );
}

function KeyDigest({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "warn" | "info";
}) {
  const className =
    tone === "good"
      ? "border-[#b7e6c8] bg-[#eefaf2] text-[#116a3f]"
      : tone === "warn"
        ? "border-[#f1c2bc] bg-[#fff4f2] text-[#b42318]"
        : "border-[#d7e8ff] bg-[#f4f8ff] text-[#2450a0]";

  return (
    <span className={`inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[12px] font-semibold ${className}`}>
      <span>{label}</span>
      <span>{value}</span>
    </span>
  );
}

function InsightCard({
  title,
  summary,
  items,
  tags,
  emptyText,
  tone,
}: {
  title: string;
  summary: string;
  items: string[];
  tags: string[];
  emptyText: string;
  tone: "good" | "warn" | "info";
}) {
  const accent =
    tone === "good"
      ? "text-[#116a3f]"
      : tone === "warn"
        ? "text-[#b42318]"
        : "text-[#2450a0]";

  const tagClass =
    tone === "good"
      ? "border-[#b7e6c8] bg-[#eefaf2] text-[#116a3f]"
      : tone === "warn"
        ? "border-[#f1c2bc] bg-[#fff4f2] text-[#b42318]"
        : "border-[#d7e8ff] bg-[#f4f8ff] text-[#2450a0]";

  return (
    <article className="rounded-[28px] border border-black/10 bg-white p-6 shadow-[0_18px_44px_rgba(16,24,40,0.06)]">
      <div className="text-[12px] font-semibold tracking-[0.12em] text-black/42">{title.toUpperCase()}</div>
      <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.02em] text-black/90">{title}</h2>
      <p className={`mt-3 text-[15px] leading-[1.55] ${accent}`}>{summary}</p>
      {tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className={`inline-flex h-7 items-center rounded-full border px-2.5 text-[12px] font-semibold ${tagClass}`}>
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {items.length > 0 ? (
        <ul className="mt-4 space-y-2 text-[13px] leading-[1.6] text-black/64">
          {items.slice(0, 6).map((item) => (
            <li key={item} className="rounded-2xl border border-black/8 bg-[#f8fafc] px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-[13px] text-black/52">{emptyText}</p>
      )}
    </article>
  );
}

function TagGroup({
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
  const tagClass =
    tone === "good"
      ? "border-[#b7e6c8] bg-[#eefaf2] text-[#116a3f]"
      : "border-[#f1c2bc] bg-[#fff4f2] text-[#b42318]";

  return (
    <article className="rounded-[28px] border border-black/10 bg-white p-6 shadow-[0_18px_44px_rgba(16,24,40,0.06)]">
      <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-black/90">{title}</h2>
      {tags.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className={`inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-semibold ${tagClass}`}>
              {tag}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-black/52">{emptyText}</p>
      )}
    </article>
  );
}
