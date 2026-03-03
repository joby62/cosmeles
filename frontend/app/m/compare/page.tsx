"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchMobileCompareBootstrap,
  recordMobileCompareEvent,
  runMobileCompareJobStream,
  type MobileCompareProductLibraryItem,
  type MobileSelectionCategory,
  uploadMobileCompareCurrentProduct,
} from "@/lib/api";

const CATEGORY_ORDER: MobileSelectionCategory[] = ["shampoo", "bodywash", "conditioner", "lotion", "cleanser"];
const CATEGORY_LABEL_ZH: Record<MobileSelectionCategory, string> = {
  shampoo: "洗发水",
  bodywash: "沐浴露",
  conditioner: "护发素",
  lotion: "润肤霜",
  cleanser: "洗面奶",
};

export default function MobileComparePage() {
  const router = useRouter();
  const [category, setCategory] = useState<MobileSelectionCategory>("shampoo");
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrap, setBootstrap] = useState<Awaited<ReturnType<typeof fetchMobileCompareBootstrap>> | null>(null);

  const [sourceMode, setSourceMode] = useState<"upload_new" | "history_product">("upload_new");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [brand, setBrand] = useState("");
  const [name, setName] = useState("");

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [progressHint, setProgressHint] = useState("等待开始");
  const [liveText, setLiveText] = useState("");
  const [stageText, setStageText] = useState("");
  const [traceId, setTraceId] = useState<string | null>(null);

  const recommendationReady = Boolean(bootstrap?.recommendation?.exists);
  const hasHistoryProfile = Boolean(bootstrap?.profile?.has_history_profile);
  const canRunBySource = sourceMode === "upload_new" ? Boolean(file) : Boolean(selectedProductId);
  const canStart = !running && !bootstrapLoading && recommendationReady && hasHistoryProfile && canRunBySource;
  const currentCategoryLabel = CATEGORY_LABEL_ZH[category];
  const libraryItems = useMemo(() => bootstrap?.product_library?.items || [], [bootstrap?.product_library?.items]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = new URLSearchParams(window.location.search).get("category");
    const normalized = (raw || "").trim().toLowerCase() as MobileSelectionCategory;
    if (CATEGORY_ORDER.includes(normalized)) {
      setCategory(normalized);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBootstrapLoading(true);
    setBootstrapError(null);
    setBootstrap(null);
    setRunError(null);
    setProgressHint("等待开始");
    setLiveText("");
    setStageText("");
    setTraceId(null);
    setSelectedProductId(null);
    setSourceMode("upload_new");

    void fetchMobileCompareBootstrap(category)
      .then((data) => {
        if (cancelled) return;
        setBootstrap(data);
        if (data.selected_category && data.selected_category !== category) {
          setCategory(data.selected_category);
        }
        const recommendationId = String(data.product_library?.recommendation_product_id || "").trim();
        const mostUsedId = String(data.product_library?.most_used_product_id || "").trim();
        const fallbackHistoryId = mostUsedId || recommendationId;
        if (fallbackHistoryId) setSelectedProductId(fallbackHistoryId);
      })
      .catch((err) => {
        if (cancelled) return;
        setBootstrapError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setBootstrapLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [category]);

  async function startCompare() {
    if (running) return;
    setRunError(null);
    setRunning(true);
    setProgressHint(sourceMode === "upload_new" ? "开始上传当前在用产品..." : "开始读取产品库中的在用品...");
    setLiveText("");
    setStageText("");
    setTraceId(null);

    void safeTrack("compare_run_start", {
      category,
      profile_mode: "reuse_latest",
      current_product_source: sourceMode,
      selected_product_id: selectedProductId || "",
    });
    try {
      let currentProduct: { source: "upload_new" | "history_product"; upload_id?: string; product_id?: string };

      if (sourceMode === "upload_new") {
        if (!file) {
          throw new Error("请先选择你正在用产品的图片。");
        }
        const uploaded = await uploadMobileCompareCurrentProduct({
          category,
          image: file,
          brand: brand.trim() || undefined,
          name: name.trim() || undefined,
        });
        setTraceId(uploaded.trace_id);
        setProgressHint("上传完成，正在分析中...");
        currentProduct = {
          source: "upload_new",
          upload_id: uploaded.upload_id,
        };
        void safeTrack("compare_upload_success", { category, upload_id: uploaded.upload_id });
      } else {
        if (!selectedProductId) {
          throw new Error("请先在产品库勾选你正在使用的产品。");
        }
        currentProduct = {
          source: "history_product",
          product_id: selectedProductId,
        };
      }

      const result = await runMobileCompareJobStream(
        {
          category,
          profile_mode: "reuse_latest",
          current_product: currentProduct,
          options: {
            include_inci_order_diff: true,
            include_function_rank_diff: true,
          },
        },
        (event) => {
          if (event.event === "progress") {
            const message = String(event.data.message || "").trim();
            const stage = String(event.data.stage || "").trim();
            if (message) setProgressHint(message);
            if (stage) setStageText((prev) => `${prev}\n[${stage}] ${message || "-"}`.trim());
            const currentTrace = String(event.data.trace_id || "").trim();
            if (currentTrace) setTraceId(currentTrace);
            return;
          }
          if (event.event === "partial_text") {
            const chunk = String(event.data.text || "");
            if (chunk) setLiveText((prev) => prev + chunk);
          }
        },
      );

      void safeTrack("compare_run_success", {
        category,
        compare_id: result.compare_id,
        current_product_source: sourceMode,
        selected_product_id: selectedProductId || "",
      });
      router.push(`/m/compare/result/${encodeURIComponent(result.compare_id)}`);
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setRunError(text);
      void safeTrack("compare_run_error", { category, error: text, current_product_source: sourceMode });
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="pb-10">
      <h1 className="text-[30px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/90">专业对比</h1>
      <p className="mt-3 text-[15px] leading-[1.55] text-black/60">
        上传你正在用的产品，或直接从产品库勾选，我们会和历史首推做专业对比，给你明确结论：继续用、替换，还是分场景并用。
      </p>

      <div className="mt-5 rounded-2xl border border-black/10 bg-white p-4">
        <h2 className="text-[14px] font-semibold text-black/84">1. 先选品类</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {CATEGORY_ORDER.map((item) => {
            const active = item === category;
            const label = CATEGORY_LABEL_ZH[item];
            return (
              <button
                key={item}
                type="button"
                disabled={running}
                onClick={() => {
                  setCategory(item);
                  void safeTrack("compare_category_selected", { category: item });
                }}
                className={`inline-flex h-9 items-center rounded-full border px-4 text-[13px] font-medium ${
                  active ? "border-black/20 bg-black text-white" : "border-black/12 text-black/75 active:bg-black/[0.03]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4">
        <h2 className="text-[14px] font-semibold text-black/84">2. 个人情况（自动沿用）</h2>
        {bootstrapLoading ? (
          <div className="mt-3 text-[13px] text-black/55">正在加载你的最近一次个人情况...</div>
        ) : hasHistoryProfile ? (
          <>
            <div className="mt-2 text-[13px] text-black/72">本次对比将自动沿用该品类下你最近一次已填写的个人情况。</div>
            {bootstrap?.profile?.summary?.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {bootstrap.profile.summary.map((item, idx) => (
                  <span key={`${idx}-${item}`} className="inline-flex rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-[12px] text-black/70">
                    {item}
                  </span>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="mt-3 text-[13px] leading-[1.5] text-[#b53a3a]">
            当前设备在“{currentCategoryLabel}”下还没有历史个人情况，先去完成一次开始选择后再来对比。
          </div>
        )}
        <div className="mt-3 text-[12px] text-black/55">
          想更新个人情况可前往{" "}
          <Link href={`/m/${category}/start`} className="font-medium text-black/78 underline">
            {currentCategoryLabel}路径
          </Link>
          。
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[14px] font-semibold text-black/84">3. 上传你正在用的产品</h2>
          <button
            type="button"
            disabled={running}
            onClick={() => setSourceMode("upload_new")}
            className={`inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-medium ${
              sourceMode === "upload_new" ? "border-[#0b63f6]/30 bg-[#eaf2ff] text-[#0b63f6]" : "border-black/12 text-black/64"
            }`}
          >
            {sourceMode === "upload_new" ? "当前来源" : "用上传来源"}
          </button>
        </div>
        <p className="mt-2 text-[13px] leading-[1.5] text-black/62">
          {bootstrap?.source_guide?.title || "上传你正在用的产品，系统会给出可执行的专业对比建议。"}
        </p>
        <ul className="mt-2 space-y-1 text-[12px] leading-[1.5] text-black/58">
          {(bootstrap?.source_guide?.value_points || []).map((item, idx) => (
            <li key={`${idx}-${item}`}>• {item}</li>
          ))}
        </ul>

        <div className="mt-4 rounded-2xl border border-black/10 bg-[#f7f8fb] p-2.5">
          <div className="flex items-center gap-2">
            <label
              htmlFor="mobile-compare-file"
              className="inline-flex h-10 shrink-0 cursor-pointer items-center rounded-xl bg-white px-4 text-[13px] font-medium text-black/80 shadow-[0_1px_0_rgba(0,0,0,0.04)]"
            >
              选取文件
            </label>
            <div className="min-w-0 flex-1 truncate text-[13px] text-black/62">{file?.name || "支持相册/拍照/文件，建议清晰拍到成分表"}</div>
            {file ? (
              <button
                type="button"
                onClick={() => setFile(null)}
                className="inline-flex h-8 items-center rounded-full border border-black/10 px-3 text-[12px] text-black/60"
              >
                清除
              </button>
            ) : null}
          </div>
          <input
            id="mobile-compare-file"
            type="file"
            accept="image/*"
            disabled={running}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
          />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3">
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            disabled={running}
            placeholder="品牌（可选）"
            className="h-10 rounded-xl border border-black/12 bg-white px-3 text-[13px] text-black/78 outline-none"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={running}
            placeholder="产品名（可选）"
            className="h-10 rounded-xl border border-black/12 bg-white px-3 text-[13px] text-black/78 outline-none"
          />
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[14px] font-semibold text-black/84">4. 产品库（同品类）</h2>
          <button
            type="button"
            disabled={running || libraryItems.length === 0}
            onClick={() => setSourceMode("history_product")}
            className={`inline-flex h-8 items-center rounded-full border px-3 text-[12px] font-medium ${
              sourceMode === "history_product" ? "border-[#0b63f6]/30 bg-[#eaf2ff] text-[#0b63f6]" : "border-black/12 text-black/64"
            }`}
          >
            {sourceMode === "history_product" ? "当前来源" : "用产品库来源"}
          </button>
        </div>
        <p className="mt-2 text-[13px] text-black/62">先勾选你正在用的产品，再和历史首推做专业对比。</p>

        {bootstrapLoading ? (
          <div className="mt-3 text-[13px] text-black/55">正在加载产品库...</div>
        ) : bootstrapError ? (
          <div className="mt-3 text-[13px] text-[#b53a3a]">{bootstrapError}</div>
        ) : libraryItems.length === 0 ? (
          <div className="mt-3 text-[13px] text-black/55">该品类暂时还没有可用产品。</div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-2.5">
            {libraryItems.map((item) => {
              const pid = String(item.product.id || "").trim();
              const selected = selectedProductId === pid;
              return (
                <ProductLibraryCard
                  key={pid}
                  item={item}
                  selected={selected}
                  onPick={() => {
                    setSelectedProductId(pid);
                    setSourceMode("history_product");
                    void safeTrack("compare_library_pick", {
                      category,
                      product_id: pid,
                      is_recommendation: item.is_recommendation,
                      is_most_used: item.is_most_used,
                    });
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {recommendationReady ? null : (
        <div className="mt-3 rounded-2xl border border-[#ff8f8f]/45 bg-[#ff5f5f]/10 px-4 py-3 text-[13px] text-[#b53a3a]">
          当前设备在“{currentCategoryLabel}”下还没有历史首推，请先完成一次对应问答路径。
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            void startCompare();
          }}
          disabled={!canStart}
          className="inline-flex h-11 items-center justify-center rounded-full bg-black px-5 text-[15px] font-semibold text-white disabled:bg-black/25"
        >
          {running ? "分析中..." : "开始专业对比"}
        </button>
      </div>

      <div className="mt-3 text-[12px] text-black/55">
        当前状态：{progressHint}
        {traceId ? ` · trace_id: ${traceId}` : ""}
      </div>

      {runError ? (
        <div className="mt-3 rounded-2xl border border-[#ff8f8f]/45 bg-[#ff5f5f]/10 px-4 py-3 text-[13px] text-[#b53a3a]">
          {runError}
        </div>
      ) : null}

      {(liveText || stageText || running) && (
        <div className="mt-4 grid grid-cols-1 gap-3">
          <div className="rounded-xl border border-black/10 bg-[#fbfcff] p-3">
            <div className="text-[11px] font-semibold text-[#3151d8]">实时文本</div>
            <pre className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap text-[12px] leading-[1.55] text-black/74">
              {liveText || (running ? "等待模型输出..." : "-")}
            </pre>
          </div>
          <div className="rounded-xl border border-black/10 bg-white p-3">
            <div className="text-[11px] font-semibold text-[#3151d8]">阶段进度</div>
            <pre className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap text-[12px] leading-[1.55] text-black/68">
              {stageText || "-"}
            </pre>
          </div>
        </div>
      )}
    </section>
  );
}

function ProductLibraryCard({
  item,
  selected,
  onPick,
}: {
  item: MobileCompareProductLibraryItem;
  selected: boolean;
  onPick: () => void;
}) {
  const image = resolveProductImage(item.product.image_url);
  const title = [item.product.brand, item.product.name].filter(Boolean).join(" ").trim() || "未命名产品";
  return (
    <button
      type="button"
      onClick={onPick}
      className={`w-full rounded-2xl border px-3 py-3 text-left ${
        selected ? "border-[#0b63f6]/35 bg-[#edf4ff]" : "border-black/10 bg-white active:bg-black/[0.02]"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="relative h-14 w-14 overflow-hidden rounded-xl bg-[linear-gradient(140deg,#f2f4f8,#dbe4ef)]">
          {image ? (
            <Image src={image} alt={title} fill sizes="56px" className="object-contain p-1.5" />
          ) : (
            <div className="flex h-full items-center justify-center text-[11px] text-black/35">无图</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1.5">
            {item.is_recommendation ? (
              <span className="inline-flex rounded-full border border-[#d0daf9] bg-[#edf3ff] px-2 py-0.5 text-[10px] font-medium text-[#2856c8]">
                历史首推
              </span>
            ) : null}
            {item.is_most_used ? (
              <span className="inline-flex rounded-full border border-[#e7dcc0] bg-[#fff9e9] px-2 py-0.5 text-[10px] font-medium text-[#8a6814]">
                最多人用
              </span>
            ) : null}
          </div>
          <div className="mt-1 truncate text-[13px] font-medium text-black/86">{title}</div>
          <div className="mt-0.5 truncate text-[12px] text-black/55">{item.product.one_sentence || "暂无一句话摘要"}</div>
          {item.usage_count > 0 ? <div className="mt-1 text-[11px] text-black/45">被标记在用 {item.usage_count} 次</div> : null}
        </div>
        <div
          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${
            selected ? "border-[#0b63f6] bg-[#0b63f6] text-white" : "border-black/18 text-transparent"
          }`}
        >
          ✓
        </div>
      </div>
    </button>
  );
}

function resolveProductImage(raw?: string | null): string | null {
  const value = String(raw || "").trim();
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/")) return value;
  return `/${value}`;
}

async function safeTrack(name: string, props: Record<string, unknown>) {
  try {
    await recordMobileCompareEvent(name, props);
  } catch {
    // 埋点失败不阻塞主流程
  }
}
