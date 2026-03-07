"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Product,
  ProductRouteMappingBuildResponse,
  SSEEvent,
  buildProductRouteMappingStream,
} from "@/lib/api";
import { CATEGORY_CONFIG } from "@/lib/catalog";

type RouteMappingCategory = "all" | "shampoo" | "bodywash" | "conditioner" | "lotion" | "cleanser";

export default function ProductRouteMappingGenerator({
  initialProducts,
}: {
  initialProducts: Product[];
}) {
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressHint, setProgressHint] = useState("");
  const [rawText, setRawText] = useState("");
  const [prettyText, setPrettyText] = useState("");
  const [result, setResult] = useState<ProductRouteMappingBuildResponse | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<RouteMappingCategory>("all");
  const [forceRegenerate, setForceRegenerate] = useState(false);
  const [onlyUnmapped, setOnlyUnmapped] = useState(false);

  const queueRef = useRef<string[]>([]);
  const timerRef = useRef<number | null>(null);

  const supportedProducts = useMemo(() => {
    return initialProducts.filter((item) => {
      const category = String(item.category || "").trim().toLowerCase();
      return category === "shampoo" || category === "bodywash" || category === "conditioner" || category === "lotion" || category === "cleanser";
    });
  }, [initialProducts]);

  const categoryStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of supportedProducts) {
      const key = (item.category || "unknown").trim().toLowerCase();
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [supportedProducts]);

  useEffect(() => {
    return () => {
      stopDrainer();
      queueRef.current = [];
    };
  }, []);

  async function startBuild() {
    setBuilding(true);
    setError(null);
    setResult(null);
    setProgressHint("准备扫描产品并建立类型映射...");
    setRawText("");
    setPrettyText("");
    queueRef.current = [];
    stopDrainer();

    try {
      const payload = {
        category: selectedCategory === "all" ? undefined : selectedCategory,
        force_regenerate: forceRegenerate,
        only_unmapped: onlyUnmapped,
      };
      const res = await buildProductRouteMappingStream(payload, (event) => onStreamEvent(event));
      setResult(res);
      setPrettyText(buildSummary(res));
      setProgressHint(`完成：created=${res.created} updated=${res.updated} skipped=${res.skipped} failed=${res.failed}`);
      if (!rawText.trim()) {
        const failLine = res.failures.slice(0, 20).join("\n");
        if (failLine) enqueueText(`\n失败明细:\n${failLine}`);
      }
    } catch (err) {
      setError(formatErrorDetail(err));
    } finally {
      setBuilding(false);
    }
  }

  function onStreamEvent(event: SSEEvent) {
    if (event.event !== "progress") return;
    const step = String(event.data.step || "");
    const text = String(event.data.text || "");
    const delta = String(event.data.delta || "");

    if (step === "route_mapping_model_delta" && delta) {
      enqueueText(delta);
    } else if (text) {
      enqueueText(`${text}\n`);
    }
    setProgressHint(formatProgressHint(event.data));
  }

  function enqueueText(value: string) {
    const chunk = String(value || "");
    if (!chunk) return;
    queueRef.current.push(chunk);
    if (timerRef.current != null) return;

    timerRef.current = window.setInterval(() => {
      const queue = queueRef.current;
      if (queue.length === 0) {
        stopDrainer();
        return;
      }
      const head = queue[0];
      if (!head) {
        queue.shift();
        return;
      }
      const nextChar = head[0];
      queue[0] = head.slice(1);
      if (!queue[0]) queue.shift();
      setRawText((prev) => prev + nextChar);
    }, 16);
  }

  function stopDrainer() {
    if (timerRef.current == null) return;
    window.clearInterval(timerRef.current);
    timerRef.current = null;
  }

  return (
    <section className="mt-8 rounded-[30px] border border-black/10 bg-gradient-to-br from-[#f7fbff] via-white to-[#f2f8f2] p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
          Stage D · 产品类型映射（流式）
        </span>
        <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
          类型映射模型固定：Doubao Pro
        </span>
      </div>

      <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.02em] text-black/90">产品类型映射台</h2>
      <p className="mt-2 text-[14px] leading-[1.6] text-black/65">
        按决策模型对单品做类型映射，输出主类/次类与全量置信度，用于 mobile 端按分类结果精准选品。
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] font-medium text-black/72">
          支持产品数：{supportedProducts.length}
        </span>
        {categoryStats.map(([category, count]) => (
          <span key={category} className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] text-black/66">
            {categoryLabel(category)} · {count}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(["all", "shampoo", "bodywash", "conditioner", "lotion", "cleanser"] as RouteMappingCategory[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setSelectedCategory(item)}
            disabled={building}
            className={`rounded-full border px-3 py-1 text-[12px] ${
              selectedCategory === item
                ? "border-black bg-black text-white"
                : "border-black/12 bg-white text-black/68"
            } disabled:opacity-40`}
          >
            {item === "all" ? "全部品类" : categoryLabel(item)}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-black/66">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={forceRegenerate}
            onChange={(event) => setForceRegenerate(event.target.checked)}
            disabled={building}
          />
          强制重跑（忽略已有指纹）
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={onlyUnmapped}
            onChange={(event) => setOnlyUnmapped(event.target.checked)}
            disabled={building}
          />
          仅处理未映射产品
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={startBuild}
          disabled={building || supportedProducts.length === 0}
          className="inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-[13px] font-semibold text-white disabled:bg-black/25"
        >
          {building ? "豆包映射中..." : "一键构建类型映射"}
        </button>
      </div>

      {progressHint ? <div className="mt-3 text-[12px] text-black/64">{progressHint}</div> : null}
      {error ? <div className="mt-2 text-[13px] text-[#b42318]">{error}</div> : null}

      {(rawText || prettyText || building) && (
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-black/10 bg-[#fbfcff] p-2.5">
            <div className="text-[11px] font-semibold text-[#3151d8]">实时文本</div>
            <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap text-[12px] leading-[1.55] text-black/74">
              {rawText || (building ? "等待模型输出..." : "-")}
            </pre>
          </div>
          <div className="rounded-xl border border-black/10 bg-white p-2.5">
            <div className="text-[11px] font-semibold text-[#3151d8]">最终美化文本</div>
            <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap text-[12px] leading-[1.55] text-black/74">
              {prettyText || (building ? "分析中..." : "-")}
            </pre>
          </div>
        </div>
      )}

      {result ? (
        <div className="mt-4 rounded-2xl border border-black/10 bg-white px-4 py-3 text-[13px] text-black/70">
          状态：{result.status}；扫描产品 {result.scanned_products} 条；提交模型 {result.submitted_to_model} 条。
        </div>
      ) : null}
    </section>
  );
}

function categoryLabel(category?: string | null): string {
  if (!category) return "-";
  const key = category.toLowerCase() as keyof typeof CATEGORY_CONFIG;
  return CATEGORY_CONFIG[key]?.zh || category;
}

function formatProgressHint(data: Record<string, unknown>): string {
  const step = String(data.step || "");
  if (step === "route_mapping_build_start") {
    return `已启动：扫描产品 ${Number(data.scanned_products || 0)} 条。`;
  }
  if (step === "route_mapping_start") {
    return `映射中：${String(data.category || "-")} / ${String(data.product_id || "-")} (${Number(data.index || 0)}/${Number(data.total || 0)})`;
  }
  if (step === "route_mapping_done") {
    return `完成：${String(data.product_id || "-")}（${String(data.status || "created")}）`;
  }
  if (step === "route_mapping_skip") {
    return String(data.text || "已跳过已有映射。");
  }
  if (step === "route_mapping_error") {
    return "部分映射失败，已继续后续任务。";
  }
  if (step === "route_mapping_model_step") {
    return "模型执行中...";
  }
  if (step === "route_mapping_build_done") {
    return String(data.text || "产品类型映射构建完成。");
  }
  return "豆包映射中...";
}

function buildSummary(result: ProductRouteMappingBuildResponse): string {
  const lines: string[] = [];
  lines.push(`状态: ${result.status}`);
  lines.push(`扫描产品: ${result.scanned_products}`);
  lines.push(`提交模型: ${result.submitted_to_model}`);
  lines.push(`created=${result.created}, updated=${result.updated}, skipped=${result.skipped}, failed=${result.failed}`);

  const createdOrUpdated = result.items.filter((item) => item.status === "created" || item.status === "updated");
  if (createdOrUpdated.length > 0) {
    lines.push("");
    lines.push("本次写入:");
    for (const item of createdOrUpdated.slice(0, 30)) {
      const primary = item.primary_route?.route_title || item.primary_route?.route_key || "-";
      const secondary = item.secondary_route?.route_title || item.secondary_route?.route_key || "-";
      lines.push(
        `- ${item.category} / ${item.product_id} -> 主类: ${primary}, 次类: ${secondary}, 存储: ${item.storage_path || "-"}`,
      );
    }
  }

  if (result.failures.length > 0) {
    lines.push("");
    lines.push(`失败: ${result.failures.length}`);
    for (const failure of result.failures.slice(0, 10)) {
      lines.push(`- ${failure}`);
    }
  }
  return lines.join("\n");
}

function formatErrorDetail(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
