"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchMobileCompareBootstrap,
  recordMobileCompareEvent,
  runMobileCompareJobStream,
  type MobileSelectionCategory,
  uploadMobileCompareCurrentProduct,
} from "@/lib/api";

const CATEGORY_ORDER: MobileSelectionCategory[] = ["shampoo", "bodywash", "conditioner", "lotion", "cleanser"];

export default function MobileComparePage() {
  const router = useRouter();
  const [category, setCategory] = useState<MobileSelectionCategory>("shampoo");
  const [profileMode, setProfileMode] = useState<"reuse_latest" | "skip">("reuse_latest");
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrap, setBootstrap] = useState<Awaited<ReturnType<typeof fetchMobileCompareBootstrap>> | null>(null);

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
  const currentCategoryLabel = useMemo(() => {
    const hit = bootstrap?.categories.find((item) => item.key === category);
    return hit?.label || category;
  }, [bootstrap?.categories, category]);

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

    void fetchMobileCompareBootstrap(category)
      .then((data) => {
        if (cancelled) return;
        setBootstrap(data);
        if (data.selected_category && data.selected_category !== category) {
          setCategory(data.selected_category);
        }
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
    if (!file || running) return;
    setRunError(null);
    setRunning(true);
    setProgressHint("开始上传当前在用产品...");
    setLiveText("");
    setStageText("");
    setTraceId(null);

    void safeTrack("compare_run_start", { category, profile_mode: profileMode });
    try {
      const uploaded = await uploadMobileCompareCurrentProduct({
        category,
        image: file,
        brand: brand.trim() || undefined,
        name: name.trim() || undefined,
      });
      setTraceId(uploaded.trace_id);
      setProgressHint("上传完成，正在分析中...");
      void safeTrack("compare_upload_success", { category, upload_id: uploaded.upload_id });

      const result = await runMobileCompareJobStream(
        {
          category,
          profile_mode: profileMode,
          current_product: {
            source: "upload_new",
            upload_id: uploaded.upload_id,
          },
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

      void safeTrack("compare_run_success", { category, compare_id: result.compare_id });
      router.push(`/m/compare/result/${encodeURIComponent(result.compare_id)}`);
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      setRunError(text);
      void safeTrack("compare_run_error", { category, error: text });
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="pb-10">
      <h1 className="text-[30px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/90">专业对比</h1>
      <p className="mt-3 text-[15px] leading-[1.55] text-black/60">
        上传你正在用的产品，我们会和历史首推做专业对比，告诉你继续用、替换，还是分场景并用更合适。
      </p>

      <div className="mt-5 rounded-2xl border border-black/10 bg-white p-4">
        <h2 className="text-[14px] font-semibold text-black/84">1. 先选品类</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {CATEGORY_ORDER.map((item) => {
            const active = item === category;
            const label = bootstrap?.categories.find((x) => x.key === item)?.label || item;
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
        <h2 className="text-[14px] font-semibold text-black/84">2. 个人情况（可跳过）</h2>
        <div className="mt-3 space-y-2">
          <label className="flex items-center gap-2 text-[13px] text-black/78">
            <input
              type="radio"
              name="profile_mode"
              checked={profileMode === "reuse_latest"}
              onChange={() => {
                setProfileMode("reuse_latest");
                void safeTrack("compare_profile_choice", { category, profile_mode: "reuse_latest" });
              }}
              disabled={running}
            />
            沿用最近一次已填写的个人情况
          </label>
          <label className="flex items-center gap-2 text-[13px] text-black/78">
            <input
              type="radio"
              name="profile_mode"
              checked={profileMode === "skip"}
              onChange={() => {
                setProfileMode("skip");
                void safeTrack("compare_profile_choice", { category, profile_mode: "skip" });
              }}
              disabled={running}
            />
            这次先不补充，先看基础成分差异
          </label>
        </div>
        <div className="mt-3 text-[12px] text-black/55">
          想重新填写可前往{" "}
          <Link href={`/m/${category}/start`} className="font-medium text-black/78 underline">
            {currentCategoryLabel}路径
          </Link>
          。
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4">
        <h2 className="text-[14px] font-semibold text-black/84">3. 上传你正在用的产品</h2>
        <p className="mt-2 text-[13px] leading-[1.5] text-black/62">
          {bootstrap?.source_guide?.title || "上传你正在用的产品，系统会给出可执行的专业对比建议。"}
        </p>
        <ul className="mt-2 space-y-1 text-[12px] leading-[1.5] text-black/58">
          {(bootstrap?.source_guide?.value_points || []).map((item, idx) => (
            <li key={`${idx}-${item}`}>• {item}</li>
          ))}
        </ul>

        <div className="mt-4 grid grid-cols-1 gap-3">
          <input
            type="file"
            accept="image/*"
            disabled={running}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="h-11 rounded-xl border border-black/12 bg-white px-3 py-2 text-[13px] text-black/76 file:mr-3 file:rounded-lg file:border-0 file:bg-black/6 file:px-2.5 file:py-1.5 file:text-[12px] file:font-medium"
          />
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
        <h2 className="text-[14px] font-semibold text-black/84">历史首推状态</h2>
        {bootstrapLoading ? (
          <div className="mt-2 text-[13px] text-black/55">正在加载...</div>
        ) : bootstrapError ? (
          <div className="mt-2 text-[13px] text-[#b53a3a]">{bootstrapError}</div>
        ) : recommendationReady ? (
          <div className="mt-2 text-[13px] leading-[1.5] text-black/67">
            已找到历史首推：{bootstrap?.recommendation?.product?.brand || "未知品牌"} {bootstrap?.recommendation?.product?.name || "未命名产品"}
            {" · "}路线：{bootstrap?.recommendation?.route_title || "-"}
          </div>
        ) : (
          <div className="mt-2 text-[13px] leading-[1.5] text-[#b53a3a]">
            当前设备在“{currentCategoryLabel}”下还没有历史首推，请先完成一次对应问答路径。
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            void startCompare();
          }}
          disabled={running || !file || !recommendationReady || bootstrapLoading}
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

async function safeTrack(name: string, props: Record<string, unknown>) {
  try {
    await recordMobileCompareEvent(name, props);
  } catch {
    // 埋点失败不阻塞主流程
  }
}
