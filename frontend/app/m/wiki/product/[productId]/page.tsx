import Image from "next/image";
import Link from "next/link";
import AddToBagButton from "@/components/mobile/AddToBagButton";
import { fetchMobileWikiProductAnalysis, fetchMobileWikiProductDetail, resolveImageUrl } from "@/lib/api";
import { formatRuntimeError } from "@/lib/error";

const DIAGNOSTIC_LABELS: Record<string, string> = {
  cleanse_intensity: "清洁强度",
  oil_control_support: "控油支持",
  dandruff_itch_support: "去屑止痒支持",
  scalp_soothing_support: "头皮舒缓支持",
  hair_strengthening_support: "强韧支持",
  moisture_balance_support: "水油平衡支持",
  daily_use_friendliness: "高频使用友好度",
  residue_weight: "残留厚重感",
  barrier_repair_support: "屏障修护支持",
  body_acne_support: "痘肌支持",
  keratin_softening_support: "粗糙角质支持",
  brightening_support: "提亮支持",
  fragrance_presence: "香氛存在感",
  rinse_afterfeel_nourishment: "洗后柔润感",
  detangling_support: "解结支持",
  anti_frizz_support: "抗躁支持",
  airy_light_support: "轻盈蓬松支持",
  repair_density: "修护密度",
  color_lock_support: "锁色支持",
  basic_hydration_support: "基础保湿支持",
  fine_hair_burden: "细软压塌风险",
  light_hydration_support: "轻盈保湿支持",
  heavy_repair_support: "重度修护支持",
  aha_renew_support: "焕肤支持",
  occlusive_weight: "封闭厚重感",
  apg_support: "APG体系支持",
  amino_support: "氨基酸体系支持",
  soap_blend_strength: "皂氨复配强度",
  bha_support: "BHA净肤支持",
  clay_support: "泥类净化支持",
  enzyme_support: "酵素抛光支持",
  barrier_friendliness: "屏障友好度",
  makeup_residue_support: "防晒彩妆残留处理",
};

const MISSING_CODE_LABELS: Record<string, string> = {
  route_support_missing: "当前二级类目支撑不足",
  evidence_too_sparse: "证据过少",
  active_strength_unclear: "活性强度不明",
  ingredient_order_unclear: "成分排序不明",
  formula_signal_conflict: "配方信号冲突",
  ingredient_library_absent: "缺少成分库摘要",
  summary_signal_too_weak: "摘要信号偏弱",
};

const VERDICT_LABELS: Record<string, string> = {
  strong_fit: "高度匹配",
  fit_with_limits: "匹配但有边界",
  weak_fit: "弱匹配",
  mismatch: "明显不匹配",
};

function fmtTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export default async function MobileWikiProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }> | { productId: string };
}) {
  const { productId } = await Promise.resolve(params);

  let data: Awaited<ReturnType<typeof fetchMobileWikiProductDetail>> | null = null;
  let loadError: string | null = null;
  let analysisData: Awaited<ReturnType<typeof fetchMobileWikiProductAnalysis>> | null = null;
  let analysisError: string | null = null;
  try {
    data = await fetchMobileWikiProductDetail(productId);
  } catch (err) {
    loadError = formatRuntimeError(err);
  }
  if (data) {
    try {
      analysisData = await fetchMobileWikiProductAnalysis(productId);
    } catch (err) {
      const text = formatRuntimeError(err);
      if (!text.startsWith("API 404:")) {
        analysisError = text;
      }
    }
  }

  if (!data) {
    return (
      <section className="pb-24">
        <article className="rounded-[24px] border border-[#ffb39e]/55 bg-[#fff7f3] px-4 py-4 text-[#7a2d21]">
          <h1 className="text-[22px] font-semibold">产品百科加载失败</h1>
          <p className="mt-2 text-[13px] leading-[1.55]">未做降级，已展示真实错误：</p>
          <p className="mt-2 rounded-xl border border-[#f6c6bc] bg-white/85 px-3 py-2 text-[12px] leading-[1.55]">
            {loadError || "unknown"}
          </p>
          <div className="mt-3 flex gap-2">
            <Link
              href="/m/wiki"
              className="inline-flex h-9 items-center rounded-full border border-black/15 bg-white px-4 text-[12px] font-semibold text-black/75"
            >
              返回百科
            </Link>
            <Link
              href="/m/choose"
              className="inline-flex h-9 items-center rounded-full border border-black/15 bg-white px-4 text-[12px] font-semibold text-black/75"
            >
              去智能推荐
            </Link>
          </div>
        </article>
      </section>
    );
  }

  const item = data.item;
  const product = item.product;
  const uploadCtaHref = `/m/me/use?category=${encodeURIComponent(product.category)}&source=wiki_product_detail&product_id=${encodeURIComponent(product.id)}&return_to=${encodeURIComponent(`/m/wiki/product/${product.id}`)}`;
  const ingredientRefByIndex = new Map((item.ingredient_refs || []).map((ref) => [ref.index, ref]));
  const analysis = analysisData?.item.profile || null;
  const diagnosticsEntries = analysis ? Object.entries(analysis.diagnostics || {}) : [];

  return (
    <section className="pb-28">
      <Link
        href="/m/wiki"
        className="inline-flex h-9 items-center rounded-full border border-black/15 bg-white px-4 text-[12px] font-semibold text-black/75 active:bg-black/[0.03]"
      >
        返回百科
      </Link>

      <article className="mt-3 overflow-hidden rounded-[26px] border border-black/10 bg-white">
        <div className="relative aspect-[4/3] bg-[#f4f5f9]">
          <Image
            src={resolveImageUrl(product)}
            alt={product.name || product.id}
            fill
            sizes="100vw"
            className="object-cover"
          />
        </div>
        <div className="px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-black/[0.05] px-3 py-1 text-[11px] text-black/64">{item.category_label}</span>
            {item.target_type_title ? (
              <span className="rounded-full border border-[#cfe2ff] bg-[#f4f8ff] px-3 py-1 text-[11px] text-[#244f9e]">
                {item.target_type_title}
              </span>
            ) : null}
            {item.is_featured ? (
              <span className="rounded-full border border-[#1f7a45]/35 bg-[#eaf8ef] px-3 py-1 text-[11px] text-[#116a3f]">
                当前主推
              </span>
            ) : null}
          </div>
          <h1 className="mt-3 text-[24px] leading-[1.24] font-semibold tracking-[-0.02em] text-black/90">
            {product.name || "未命名产品"}
          </h1>
          <p className="mt-1 text-[14px] text-black/58">{product.brand || "品牌未识别"}</p>
          <div className="mt-3">
            <Link
              href={uploadCtaHref}
              className="inline-flex max-w-full items-center rounded-full border border-[#cfe2ff] bg-[linear-gradient(180deg,#f7faff_0%,#eef5ff_100%)] px-4 py-2 text-[12px] font-semibold leading-[1.45] text-[#2450a3] shadow-[0_8px_22px_rgba(36,80,163,0.08)] active:translate-y-[1px]"
            >
              没有你的产品？点击上传一键分析
            </Link>
          </div>
          <p className="mt-3 text-[14px] leading-[1.55] text-black/68">
            {product.one_sentence || "暂无一句话摘要。"}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2 text-[12px] text-black/56">
            <div className="rounded-xl border border-black/8 bg-[#fafafa] px-3 py-2">
              <div>映射状态</div>
              <div className="mt-1 font-medium text-black/78">{item.mapping_ready ? "已完成" : "未完成"}</div>
            </div>
            <div className="rounded-xl border border-black/8 bg-[#fafafa] px-3 py-2">
              <div>主类置信度</div>
              <div className="mt-1 font-medium text-black/78">{typeof item.primary_confidence === "number" ? `${item.primary_confidence}%` : "-"}</div>
            </div>
            <div className="rounded-xl border border-black/8 bg-[#fafafa] px-3 py-2">
              <div>创建时间</div>
              <div className="mt-1 font-medium text-black/78">{fmtTime(product.created_at)}</div>
            </div>
            <div className="rounded-xl border border-black/8 bg-[#fafafa] px-3 py-2">
              <div>产品 ID</div>
              <div className="mt-1 line-clamp-1 font-medium text-black/78">{product.id}</div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <AddToBagButton productId={product.id} />
            <Link
              href={`/product/${encodeURIComponent(product.id)}`}
              className="inline-flex h-10 items-center rounded-full border border-black/15 bg-white px-4 text-[12px] font-semibold text-black/75 active:bg-black/[0.03]"
            >
              打开完整产品页
            </Link>
          </div>
        </div>
      </article>

      <article className="mt-4 rounded-[24px] border border-black/10 bg-white px-4 py-4">
        <h2 className="text-[18px] font-semibold text-black/88">增强分析</h2>
        {analysis ? (
          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#cfe2ff] bg-[#f4f8ff] px-3 py-1 text-[11px] text-[#244f9e]">
                {analysis.route_title || analysis.route_key}
              </span>
              <span className="rounded-full border border-black/10 bg-[#fafafa] px-3 py-1 text-[11px] text-black/62">
                {VERDICT_LABELS[analysis.subtype_fit_verdict] || analysis.subtype_fit_verdict}
              </span>
              <span className="rounded-full border border-black/10 bg-[#fafafa] px-3 py-1 text-[11px] text-black/62">
                置信度 {analysis.confidence}%
              </span>
              {analysis.needs_review ? (
                <span className="rounded-full border border-[#f9c97a] bg-[#fff8eb] px-3 py-1 text-[11px] text-[#8c5a00]">
                  待人工复核
                </span>
              ) : null}
            </div>
            <h3 className="mt-3 text-[20px] leading-[1.35] font-semibold text-black/88">{analysis.headline}</h3>
            <p className="mt-2 text-[13px] leading-[1.65] text-black/66">{analysis.positioning_summary}</p>
            <p className="mt-2 text-[12px] leading-[1.6] text-black/54">{analysis.subtype_fit_reason}</p>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <MobileListCard title="更适合" items={analysis.best_for} tone="green" />
              <MobileListCard title="不太适合" items={analysis.not_ideal_for} tone="amber" />
              <MobileListCard title="使用建议" items={analysis.usage_tips} tone="blue" />
              <MobileListCard title="注意点" items={analysis.watchouts} tone="red" />
            </div>

            <div className="mt-4">
              <div className="text-[14px] font-semibold text-black/84">诊断维度</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {diagnosticsEntries.map(([key, value]) => (
                  <div key={key} className="rounded-xl border border-black/8 bg-[#fafafa] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-semibold leading-[1.35] text-black/82">
                        {DIAGNOSTIC_LABELS[key] || key}
                      </div>
                      <div className="text-[11px] font-medium text-black/58">{value.score}/5</div>
                    </div>
                    <div className="mt-1 text-[11px] leading-[1.55] text-black/54">{value.reason}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-[18px] border border-black/8 bg-[#fafafa] px-3 py-3">
              <div className="text-[14px] font-semibold text-black/84">关键成分</div>
              {analysis.key_ingredients.length === 0 ? (
                <p className="mt-2 text-[12px] text-black/54">暂无关键成分摘要。</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {analysis.key_ingredients.map((entry) => (
                    <li key={`${entry.rank}-${entry.ingredient_name_cn}-${entry.ingredient_name_en}`}>
                      <div className="text-[12px] font-semibold text-black/82">
                        #{entry.rank} {entry.ingredient_name_cn || entry.ingredient_name_en}
                      </div>
                      <div className="mt-0.5 text-[11px] text-black/56">{entry.role}</div>
                      <div className="mt-0.5 text-[11px] leading-[1.55] text-black/54">{entry.impact}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-4 rounded-[18px] border border-black/8 bg-[#fafafa] px-3 py-3">
              <div className="text-[14px] font-semibold text-black/84">证据缺口</div>
              {analysis.evidence.missing_codes.length === 0 ? (
                <p className="mt-2 text-[12px] text-[#116a3f]">当前分析未标记明显缺口。</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {analysis.evidence.missing_codes.map((code) => (
                    <span
                      key={code}
                      className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] text-black/58"
                    >
                      {MISSING_CODE_LABELS[code] || code}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-3 text-[11px] leading-[1.6] text-black/54">{analysis.confidence_reason}</p>
            </div>
          </div>
        ) : analysisError ? (
          <p className="mt-2 text-[13px] leading-[1.55] text-[#b42318]">增强分析加载失败：{analysisError}</p>
        ) : (
          <p className="mt-2 text-[13px] leading-[1.55] text-black/58">该产品的增强分析尚未生成。</p>
        )}
      </article>

      <article className="mt-4 rounded-[24px] border border-black/10 bg-white px-4 py-4">
        <h2 className="text-[18px] font-semibold text-black/88">成分列表</h2>
        {item.doc.ingredients.length === 0 ? (
          <p className="mt-2 text-[13px] text-black/58">无可用成分数据。</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {item.doc.ingredients.map((ing, idx) => (
              <li key={`${ing.name}-${idx}`} className="rounded-xl border border-black/8 bg-[#fafafa] px-3 py-2">
                {(() => {
                  const ref = ingredientRefByIndex.get(idx + 1);
                  const resolved = ref?.status === "resolved" && ref?.ingredient_id;
                  if (resolved) {
                    return (
                      <Link
                        href={`/m/wiki/${encodeURIComponent(product.category || item.product.category || "shampoo")}/${encodeURIComponent(String(ref.ingredient_id))}`}
                        className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#0f4aa8] underline underline-offset-2"
                      >
                        {ing.name || "未命名成分"}
                        <span className="rounded-full border border-[#b6ccff] bg-[#eef4ff] px-2 py-0.5 text-[10px] text-[#2d4f92]">
                          查看成分百科
                        </span>
                      </Link>
                    );
                  }
                  return (
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-[13px] font-semibold text-black/84">{ing.name || "未命名成分"}</div>
                      {ref?.status === "conflict" ? (
                        <span className="rounded-full border border-[#f9c97a] bg-[#fff8eb] px-2 py-0.5 text-[10px] text-[#8c5a00]">映射冲突</span>
                      ) : (
                        <span className="rounded-full border border-black/12 bg-white px-2 py-0.5 text-[10px] text-black/56">未映射</span>
                      )}
                    </div>
                  );
                })()}
                <div className="mt-1 text-[12px] text-black/56">
                  类型：{ing.type || "-"} · 风险：{ing.risk || "-"}
                </div>
                {ing.functions?.length ? (
                  <div className="mt-1 text-[12px] text-black/56">功能：{ing.functions.join(" / ")}</div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}

function MobileListCard({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "green" | "amber" | "blue" | "red";
}) {
  const toneClass =
    tone === "green"
      ? "border-[#d5eadb] bg-[#f4fbf5]"
      : tone === "amber"
        ? "border-[#f4dfb1] bg-[#fffaf0]"
        : tone === "blue"
          ? "border-[#d3e2ff] bg-[#f5f8ff]"
          : "border-[#f0d6d2] bg-[#fff7f6]";

  return (
    <div className={`rounded-[18px] border px-3 py-3 ${toneClass}`}>
      <div className="text-[13px] font-semibold text-black/84">{title}</div>
      <ul className="mt-2 space-y-1 text-[12px] leading-[1.55] text-black/62">
        {items.length > 0 ? items.map((item) => <li key={item}>• {item}</li>) : <li>-</li>}
      </ul>
    </div>
  );
}
