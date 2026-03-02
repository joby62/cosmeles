"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Product,
  IngredientLibraryBuildResponse,
  SSEEvent,
  buildIngredientLibraryStream,
} from "@/lib/api";
import { CATEGORY_CONFIG } from "@/lib/catalog";

export default function IngredientLibraryGenerator({
  initialProducts,
}: {
  initialProducts: Product[];
}) {
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressHint, setProgressHint] = useState("");
  const [rawText, setRawText] = useState("");
  const [prettyText, setPrettyText] = useState("");
  const [result, setResult] = useState<IngredientLibraryBuildResponse | null>(null);

  const queueRef = useRef<string[]>([]);
  const timerRef = useRef<number | null>(null);

  const categoryStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of initialProducts) {
      const key = (item.category || "unknown").trim().toLowerCase();
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [initialProducts]);

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
    setProgressHint("准备扫描全部产品成分并按品类生成成分库...");
    setRawText("");
    setPrettyText("");
    queueRef.current = [];
    stopDrainer();

    try {
      const res = await buildIngredientLibraryStream({}, (event) => onStreamEvent(event));
      setResult(res);
      setPrettyText(buildSummary(res));
      setProgressHint(`完成：created=${res.created} updated=${res.updated} skipped=${res.skipped} failed=${res.failed}`);
      if (!rawText.trim()) {
        const failLine = res.failures.slice(0, 20).join("\n");
        if (failLine) enqueueText(`\n失败明细:\n${failLine}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "成分库生成失败，请稍后重试。");
    } finally {
      setBuilding(false);
    }
  }

  function onStreamEvent(event: SSEEvent) {
    if (event.event !== "progress") return;
    const step = String(event.data.step || "");
    const text = String(event.data.text || "");
    const delta = String(event.data.delta || "");

    if (step === "ingredient_model_delta" && delta) {
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
    <section className="mt-8 rounded-[30px] border border-black/10 bg-gradient-to-br from-[#f8fbff] via-white to-[#f2f8f1] p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
          桌面端 AI 流式分析（实时文本 + 最终总结）
        </span>
        <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
          成分库模型固定：Doubao Pro
        </span>
      </div>

      <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.02em] text-black/90">成分库生成台</h2>
      <p className="mt-2 text-[14px] leading-[1.6] text-black/65">
        一键扫描当前全部产品成分，按“品类+成分名”生成独立成分条目；同名跨品类会拆分为不同成分并分别调用豆包 Pro。
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <span className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] font-medium text-black/72">
          当前产品数：{initialProducts.length}
        </span>
        {categoryStats.map(([category, count]) => (
          <span key={category} className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] text-black/66">
            {categoryLabel(category)} · {count}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={startBuild}
          disabled={building || initialProducts.length === 0}
          className="inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-[13px] font-semibold text-white disabled:bg-black/25"
        >
          {building ? "豆包生成中..." : "一键生成成分库（全量）"}
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
          状态：{result.status}；扫描产品 {result.scanned_products} 条；唯一成分 {result.unique_ingredients} 条。
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
  if (step === "ingredient_build_start") {
    return `已启动：产品 ${Number(data.scanned_products || 0)} 条，唯一成分 ${Number(data.unique_ingredients || 0)} 条。`;
  }
  if (step === "ingredient_start") {
    return `生成中：${String(data.category || "-")} / ${String(data.ingredient_id || "-")} (${Number(data.index || 0)}/${Number(data.total || 0)})`;
  }
  if (step === "ingredient_done") {
    return `完成：${String(data.ingredient_id || "-")}（${String(data.status || "created")}）`;
  }
  if (step === "ingredient_skip") {
    return String(data.text || "已跳过已有成分条目。");
  }
  if (step === "ingredient_error") {
    return "部分成分生成失败，已继续后续任务。";
  }
  if (step === "ingredient_model_step") {
    return "模型执行中...";
  }
  if (step === "ingredient_build_done") {
    return String(data.text || "成分库生成完成。");
  }
  return "豆包生成中...";
}

function buildSummary(result: IngredientLibraryBuildResponse): string {
  const lines: string[] = [];
  lines.push(`状态: ${result.status}`);
  lines.push(`扫描产品: ${result.scanned_products}`);
  lines.push(`唯一成分: ${result.unique_ingredients}`);
  lines.push(`created=${result.created}, updated=${result.updated}, skipped=${result.skipped}, failed=${result.failed}`);

  const createdOrUpdated = result.items.filter((item) => item.status === "created" || item.status === "updated");
  if (createdOrUpdated.length > 0) {
    lines.push("");
    lines.push("本次写入:");
    for (const item of createdOrUpdated.slice(0, 30)) {
      lines.push(
        `- ${item.category} / ${item.ingredient_name} (${item.ingredient_id}) -> ${item.storage_path || "-"}`,
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
