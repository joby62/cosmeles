"use client";

import Image from "next/image";
import Link from "next/link";
import { memo, useEffect, useMemo, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import {
  fetchMobileCompareBootstrap,
  recordMobileCompareEvent,
  runMobileCompareJobStream,
  type MobileCompareJobTargetInput,
  type MobileCompareProductLibraryItem,
  type MobileSelectionCategory,
  uploadMobileCompareCurrentProduct,
} from "@/lib/api";

const CATEGORY_ORDER: MobileSelectionCategory[] = ["shampoo", "bodywash", "conditioner", "lotion", "cleanser"];
const MAX_TOTAL_SELECTION = 3;
const WAITING_STAGE_ORDER = [
  "prepare",
  "resolve_targets",
  "resolve_target",
  "stage1_vision",
  "stage2_struct",
  "pair_compare",
  "finalize",
  "done",
] as const;
type WaitingStage = (typeof WAITING_STAGE_ORDER)[number];
const WAITING_STAGE_LABEL: Record<WaitingStage, string> = {
  prepare: "准备对比任务",
  resolve_targets: "读取待对比产品",
  resolve_target: "整理产品信息",
  stage1_vision: "识别图片文字",
  stage2_struct: "结构化成分信息",
  pair_compare: "生成两两分析",
  finalize: "整理最终结论",
  done: "对比完成",
};
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

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [brand, setBrand] = useState("");
  const [name, setName] = useState("");

  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [progressHint, setProgressHint] = useState("等待开始");
  const [activeStage, setActiveStage] = useState<WaitingStage>("prepare");
  const [activeStageLabel, setActiveStageLabel] = useState(WAITING_STAGE_LABEL.prepare);
  const [progressPercent, setProgressPercent] = useState(0);
  const [pairProgress, setPairProgress] = useState<{ index: number; total: number } | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const recommendationReady = Boolean(bootstrap?.recommendation?.exists);
  const hasHistoryProfile = Boolean(bootstrap?.profile?.has_history_profile);
  const profileBasis = bootstrap?.profile?.basis || "none";
  const currentCategoryLabel = CATEGORY_LABEL_ZH[category];
  const orderedLibraryItems = useMemo(() => orderProductLibraryItems(bootstrap?.product_library?.items || []), [bootstrap?.product_library?.items]);
  const selectedSet = useMemo(() => new Set(selectedProductIds), [selectedProductIds]);
  const selectedCount = selectedProductIds.length;
  const hasUpload = Boolean(file);
  const totalSelectedCount = selectedCount + (hasUpload ? 1 : 0);
  const maxLibrarySelection = hasUpload ? MAX_TOTAL_SELECTION - 1 : MAX_TOTAL_SELECTION;
  const minLibrarySelection = hasUpload ? 1 : 2;
  const canStart =
    !running &&
    !bootstrapLoading &&
    recommendationReady &&
    hasHistoryProfile &&
    selectedCount >= minLibrarySelection &&
    totalSelectedCount >= 2 &&
    totalSelectedCount <= MAX_TOTAL_SELECTION;
  const selectionSummary = useMemo(() => {
    if (totalSelectedCount < 2) {
      return "至少选择 2 款再开始。你可以上传 1 款并从产品库选 1~2 款，或直接从产品库选 2~3 款。";
    }
    if (hasUpload) {
      return `当前已选：上传 1 款 + 产品库 ${selectedCount} 款（共 ${totalSelectedCount} 款）。`;
    }
    return `当前已从产品库选择 ${selectedCount} 款（共 ${totalSelectedCount} 款）。`;
  }, [hasUpload, selectedCount, totalSelectedCount]);
  const sourceGuideTitle = bootstrap?.source_guide?.title || "上传你正在用的产品，系统会给出可执行的专业对比建议。";
  const profileBasisHint =
    profileBasis === "pinned"
      ? "本次对比将自动沿用你置顶的个人情况。"
      : profileBasis === "latest"
        ? "本次对比将自动沿用该品类下你最近一次已填写的个人情况。"
        : "本次对比将自动沿用你最近一次可用个人情况。";

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
    setActiveStage("prepare");
    setActiveStageLabel(WAITING_STAGE_LABEL.prepare);
    setProgressPercent(0);
    setPairProgress(null);
    setElapsedSeconds(0);
    setSelectedProductIds([]);

    void fetchMobileCompareBootstrap(category)
      .then((data) => {
        if (cancelled) return;
        setBootstrap(data);
        if (data.selected_category && data.selected_category !== category) {
          setCategory(data.selected_category);
        }
        const recommendationId = String(data.product_library?.recommendation_product_id || "").trim();
        const mostUsedId = String(data.product_library?.most_used_product_id || "").trim();
        const fallbackHistoryId = recommendationId || mostUsedId;
        if (fallbackHistoryId) setSelectedProductIds([fallbackHistoryId]);
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

  useEffect(() => {
    if (selectedProductIds.length <= maxLibrarySelection) return;
    setSelectedProductIds((prev) => prev.slice(0, maxLibrarySelection));
  }, [maxLibrarySelection, selectedProductIds.length]);

  useEffect(() => {
    if (!running) {
      setElapsedSeconds(0);
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [running]);

  async function startCompare() {
    if (running) return;
    setRunError(null);
    setRunning(true);
    setProgressHint("开始准备对比产品...");
    setActiveStage("prepare");
    setActiveStageLabel(WAITING_STAGE_LABEL.prepare);
    setProgressPercent(4);
    setPairProgress(null);

    void safeTrack("compare_run_start", {
      category,
      profile_mode: "reuse_latest",
      has_upload: hasUpload,
      selected_library_count: selectedCount,
      total_count: totalSelectedCount,
    });

    try {
      const targets: MobileCompareJobTargetInput[] = [];
      if (file) {
        setProgressHint("正在上传你正在用的产品...");
        const uploaded = await uploadMobileCompareCurrentProduct({
          category,
          image: file,
          brand: brand.trim() || undefined,
          name: name.trim() || undefined,
        });
        targets.push({ source: "upload_new", upload_id: uploaded.upload_id });
        void safeTrack("compare_upload_success", { category, upload_id: uploaded.upload_id });
      }

      for (const productId of selectedProductIds) {
        targets.push({ source: "history_product", product_id: productId });
      }

      if (targets.length < 2 || targets.length > MAX_TOTAL_SELECTION) {
        throw new Error("请选择 2~3 款产品后再开始专业对比。");
      }

      const result = await runMobileCompareJobStream(
        {
          category,
          profile_mode: "reuse_latest",
          targets,
          options: {
            include_inci_order_diff: true,
            include_function_rank_diff: true,
          },
        },
        (event) => {
          if (event.event === "progress") {
            const message = String(event.data.message || "").trim();
            const stage = String(event.data.stage || "").trim();
            const stageLabel = String(event.data.stage_label || "").trim();
            const percent = Number(event.data.percent);
            const pairIndex = Number(event.data.pair_index);
            const pairTotal = Number(event.data.pair_total);
            if (message) setProgressHint(message);
            if (stage) {
              const normalizedStage = WAITING_STAGE_ORDER.includes(stage as WaitingStage) ? (stage as WaitingStage) : "pair_compare";
              setActiveStage(normalizedStage);
              setActiveStageLabel(stageLabel || WAITING_STAGE_LABEL[normalizedStage]);
            }
            if (Number.isFinite(percent)) {
              setProgressPercent(Math.max(0, Math.min(100, Math.round(percent))));
            }
            if (Number.isFinite(pairIndex) && Number.isFinite(pairTotal) && pairTotal > 0) {
              setPairProgress({ index: Math.max(1, Math.round(pairIndex)), total: Math.max(1, Math.round(pairTotal)) });
            }
            return;
          }
          if (event.event === "heartbeat") {
            const message = String(event.data.message || "").trim();
            if (message) setProgressHint(message);
          }
        },
      );

      void safeTrack("compare_run_success", {
        category,
        compare_id: result.compare_id,
        has_upload: hasUpload,
        selected_library_count: selectedCount,
        total_count: totalSelectedCount,
        pair_count: (result.pair_results || []).length,
      });
      router.push(`/m/compare/result/${encodeURIComponent(result.compare_id)}`);
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setRunError(text);
      void safeTrack("compare_run_error", {
        category,
        error: text,
        has_upload: hasUpload,
        selected_library_count: selectedCount,
        total_count: totalSelectedCount,
      });
    } finally {
      setRunning(false);
    }
  }

  function toggleSelected(pid: string) {
    setSelectedProductIds((prev) => {
      const exists = prev.includes(pid);
      if (exists) return prev.filter((id) => id !== pid);
      if (prev.length >= maxLibrarySelection) return prev;
      return [...prev, pid];
    });
  }

  return (
    <section className="m-compare-page pb-10">
      <h1 className="text-[30px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/90">专业对比</h1>
      <p className="mt-3 text-[15px] leading-[1.55] text-black/60">
        支持 2~3 款产品两两对比。可上传你正在用的 1 款，再从产品库补 1~2 款；也可不上传，直接从产品库选 2~3 款。
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
          <div className="mt-3 text-[13px] text-black/55">正在加载你的自动沿用个人情况...</div>
        ) : hasHistoryProfile ? (
          <>
            <div className="mt-2 text-[13px] text-black/72">{profileBasisHint}</div>
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
        <h2 className="text-[14px] font-semibold text-black/84">3. 上传你正在用的产品（可跳过）</h2>
        <p className="mt-2 text-[13px] leading-[1.5] text-black/62">
          {sourceGuideTitle}
        </p>
        <p className="mt-1 text-[12px] text-black/52">不上传也没关系，直接从产品库选择 2~3 款即可开始专业对比。</p>
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

        {file ? (
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
        ) : null}
      </div>

      <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4">
        <h2 className="text-[14px] font-semibold text-black/84">4. 产品库（可直接选你在用的）</h2>
        <p className="mt-2 text-[13px] text-black/62">
          当前最多可从产品库选 {maxLibrarySelection} 款（总上限 3 款，上传会占 1 个名额）。
        </p>
        <div className="m-compare-selection-tip mt-2 rounded-xl border px-3 py-2 text-[12px]">
          {selectionSummary}
          {selectedCount >= maxLibrarySelection ? " 已达当前可选上限。" : ""}
        </div>

        {bootstrapLoading ? (
          <div className="mt-3 text-[13px] text-black/55">正在加载产品库...</div>
        ) : bootstrapError ? (
          <div className="mt-3 text-[13px] text-[#b53a3a]">{bootstrapError}</div>
        ) : orderedLibraryItems.length === 0 ? (
          <div className="mt-3 text-[13px] text-black/55">该品类暂时还没有可用产品。</div>
        ) : (
          <div className="mt-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max gap-3 pr-2">
              {orderedLibraryItems.map((item) => {
                const pid = item.productId;
                const selected = selectedSet.has(pid);
                const disabled = !selected && selectedCount >= maxLibrarySelection;
                const canToggle = selected || selectedCount < maxLibrarySelection;
                return (
                  <ProductLibraryCard
                    key={pid}
                    item={item}
                    selected={selected}
                    disabled={running || disabled}
                    onPress={() => {
                      if (!canToggle) return;
                      toggleSelected(pid);
                      void safeTrack("compare_library_pick", {
                        category,
                        product_id: pid,
                        is_recommendation: item.isRecommendation,
                        is_most_used: item.isMostUsed,
                        selected: !selected,
                      });
                    }}
                    onToggle={(event) => {
                      event.stopPropagation();
                      if (!canToggle) return;
                      toggleSelected(pid);
                      void safeTrack("compare_library_pick", {
                        category,
                        product_id: pid,
                        is_recommendation: item.isRecommendation,
                        is_most_used: item.isMostUsed,
                        selected: !selected,
                      });
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {!bootstrapLoading && !bootstrapError && orderedLibraryItems.length > 0 ? (
          <div className="mt-3 text-[11px] text-black/48">
            根据你最近填写信息，为你首推；同类用户里最常被选择。其余产品只展示图片和名称，减少干扰。
          </div>
        ) : null}
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
          {running ? "分析中..." : `开始专业对比（${totalSelectedCount}/${MAX_TOTAL_SELECTION}）`}
        </button>
      </div>

      {runError ? (
        <div className="mt-3 rounded-2xl border border-[#ff8f8f]/45 bg-[#ff5f5f]/10 px-4 py-3 text-[13px] text-[#b53a3a]">
          {runError}
        </div>
      ) : null}

      {running ? (
        <CompareWaitingPanel
          stage={activeStage}
          stageLabel={activeStageLabel}
          hint={progressHint}
          percent={progressPercent}
          pairProgress={pairProgress}
          elapsedSeconds={elapsedSeconds}
        />
      ) : (
        <div className="mt-3 text-[12px] text-black/55">当前状态：{progressHint}</div>
      )}
    </section>
  );
}

function CompareWaitingPanel({
  stage,
  stageLabel,
  hint,
  percent,
  pairProgress,
  elapsedSeconds,
}: {
  stage: WaitingStage;
  stageLabel: string;
  hint: string;
  percent: number;
  pairProgress: { index: number; total: number } | null;
  elapsedSeconds: number;
}) {
  const currentStageIndex = WAITING_STAGE_ORDER.indexOf(stage);
  return (
    <div className="mt-4 overflow-hidden rounded-[26px] border border-black/10 bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_44%,#ffffff_100%)] p-4 shadow-[0_10px_28px_rgba(35,61,102,0.08)]">
      <div className="flex items-center justify-between">
        <span className="inline-flex h-7 items-center rounded-full border border-[#b7cef8] bg-[#eaf2ff] px-3 text-[11px] font-semibold text-[#2d5dbc]">
          豆包正在工作
        </span>
        <span className="text-[11px] font-medium text-black/50">{formatDuration(elapsedSeconds)}</span>
      </div>

      <h3 className="mt-3 text-[19px] font-semibold tracking-[-0.01em] text-black/90">{stageLabel || "正在分析中"}</h3>
      <p className="mt-1 text-[12px] leading-[1.5] text-black/62">{hint || "系统仍在分析中，请稍候。"}</p>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#82b3ff_0%,#3d7dff_55%,#1f5ce5_100%)] transition-all duration-500"
          style={{ width: `${Math.max(8, Math.min(100, percent || 8))}%` }}
        />
      </div>
      {pairProgress ? (
        <div className="mt-2 text-[11px] text-black/56">
          正在处理第 {pairProgress.index}/{pairProgress.total} 组对比
        </div>
      ) : null}

      <div className="mt-4 grid gap-2">
        {WAITING_STAGE_ORDER.map((item, idx) => {
          const done = idx < currentStageIndex;
          const active = item === stage;
          return (
            <div
              key={item}
              className={`flex items-center justify-between rounded-xl border px-3 py-2 text-[12px] ${
                active
                  ? "border-[#9cbcff]/70 bg-[#edf4ff] text-[#2d5dbc]"
                  : done
                    ? "border-[#d2dff5] bg-white/85 text-black/66"
                    : "border-black/8 bg-white/70 text-black/45"
              }`}
            >
              <span>{WAITING_STAGE_LABEL[item]}</span>
              <span className="text-[11px]">{active ? "进行中" : done ? "已完成" : "等待中"}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2">
        <div className="h-20 animate-pulse rounded-2xl border border-black/8 bg-white/75" />
        <div className="h-20 animate-pulse rounded-2xl border border-black/8 bg-white/75" />
      </div>
    </div>
  );
}

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

type ProductBadge = "recommendation_primary" | "most_used_primary" | "most_used_secondary";

type OrderedProductLibraryItem = {
  item: MobileCompareProductLibraryItem;
  productId: string;
  title: string;
  badges: ProductBadge[];
  emphasized: boolean;
  isRecommendation: boolean;
  isMostUsed: boolean;
};

const ProductLibraryCard = memo(function ProductLibraryCard({
  item,
  selected,
  disabled,
  onPress,
  onToggle,
}: {
  item: OrderedProductLibraryItem;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
  onToggle: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const image = resolveProductImage(item.item.product.image_url);
  return (
    <article
      className={`m-compare-product-card m-compare-product-card-press m-pressable group relative flex w-[clamp(108px,31vw,134px)] shrink-0 flex-col rounded-[22px] border text-left transition-[background-color,border-color,box-shadow,transform] duration-200 ${
        selected ? "m-compare-product-card-selected" : "m-compare-product-card-default"
      } ${item.emphasized ? "m-compare-product-card-emphasized px-2.5 pb-2.5 pt-3" : "px-2 pb-2 pt-2.5"} ${disabled ? "opacity-45" : "cursor-pointer active:scale-[0.985]"}`}
      onClick={() => {
        if (disabled) return;
        onPress();
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onPress();
        }
      }}
      role="button"
      tabIndex={disabled ? -1 : 0}
    >
      <div className="relative h-[86px] w-full overflow-hidden rounded-[16px] bg-[linear-gradient(148deg,#f4f6fb,#d9e3f1)]">
        {image ? (
          <Image src={image} alt={item.title} fill sizes="134px" className="object-contain p-2" />
        ) : (
          <div className="flex h-full items-center justify-center text-[11px] text-black/35">无图</div>
        )}
        <button
          type="button"
          disabled={disabled}
          aria-label={selected ? `取消选择 ${item.title}` : `选择 ${item.title}`}
          onClick={onToggle}
          className={`m-compare-check absolute right-1 top-1 z-[3] inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
            selected ? "m-compare-check-selected" : "m-compare-check-unselected"
          }`}
        >
          <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full text-[11px] leading-none">
            ✓
          </span>
        </button>
      </div>

      <div className="mt-2 min-h-[54px]">
        {item.badges.length > 0 ? (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {item.badges.map((badge) => (
              <ProductBadgePill key={`${item.productId}-${badge}`} badge={badge} />
            ))}
          </div>
        ) : null}
        <div className="line-clamp-2 text-[13px] leading-[1.28] font-medium text-black/86">{item.title}</div>
      </div>
    </article>
  );
});

function ProductBadgePill({ badge }: { badge: ProductBadge }) {
  if (badge === "recommendation_primary") {
    return (
      <span className="m-compare-badge m-compare-badge-reco inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-semibold">
        与你更匹配
      </span>
    );
  }
  if (badge === "most_used_primary") {
    return (
      <span className="m-compare-badge m-compare-badge-most inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-semibold">
        同类用户常用
      </span>
    );
  }
  return (
    <span className="m-compare-badge m-compare-badge-most-sub inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-semibold">
      同类用户常用
    </span>
  );
}

function orderProductLibraryItems(items: MobileCompareProductLibraryItem[]): OrderedProductLibraryItem[] {
  const normalized = items
    .map((item) => {
      const productId = String(item.product.id || "").trim();
      if (!productId) return null;
      const title = [item.product.brand, item.product.name].filter(Boolean).join(" ").trim() || "未命名产品";
      return { item, productId, title };
    })
    .filter((item): item is { item: MobileCompareProductLibraryItem; productId: string; title: string } => Boolean(item));

  if (normalized.length === 0) return [];

  const recommendation = normalized.find((entry) => entry.item.is_recommendation) || null;
  const mostUsed = normalized.find((entry) => entry.item.is_most_used) || null;
  const used = new Set<string>();
  const ordered: OrderedProductLibraryItem[] = [];

  if (recommendation) {
    used.add(recommendation.productId);
    const sameAsMost = mostUsed && mostUsed.productId === recommendation.productId;
    ordered.push({
      ...recommendation,
      badges: sameAsMost ? ["recommendation_primary", "most_used_secondary"] : ["recommendation_primary"],
      emphasized: true,
      isRecommendation: true,
      isMostUsed: Boolean(sameAsMost),
    });
  }

  if (mostUsed && !used.has(mostUsed.productId)) {
    used.add(mostUsed.productId);
    ordered.push({
      ...mostUsed,
      badges: ["most_used_primary"],
      emphasized: true,
      isRecommendation: false,
      isMostUsed: true,
    });
  }

  for (const entry of normalized) {
    if (used.has(entry.productId)) continue;
    ordered.push({
      ...entry,
      badges: [],
      emphasized: false,
      isRecommendation: false,
      isMostUsed: false,
    });
  }

  return ordered;
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
