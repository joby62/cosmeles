"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import {
  ingestProduct,
  ingestProductStage1Stream,
  ingestProductStage1SupplementStream,
  ingestProductStage2Stream,
  SSEEvent,
} from "@/lib/api";

const CATEGORIES = [
  { value: "shampoo", label: "洗发水" },
  { value: "bodywash", label: "沐浴露" },
  { value: "conditioner", label: "护发素" },
  { value: "lotion", label: "润肤霜" },
  { value: "cleanser", label: "洗面奶" },
] as const;

const MODEL_TIERS = [
  { value: "mini", label: "Mini" },
  { value: "lite", label: "Lite" },
  { value: "pro", label: "Pro" },
] as const;

const SAMPLE_JSON = `{
  "category": "shampoo",
  "brand": "示例品牌",
  "name": "示例产品名",
  "summary": {
    "one_sentence": "一句话总结这个产品的定位",
    "pros": ["优点1", "优点2"],
    "cons": ["注意点1"],
    "who_for": ["适合人群1"],
    "who_not_for": ["不适合人群1"]
  },
  "ingredients": [
    {
      "name": "烟酰胺",
      "type": "活性成分",
      "functions": ["提亮", "修护"],
      "risk": "low",
      "notes": "可选说明"
    }
  ]
}`;

type ModelTier = "mini" | "lite" | "pro";
type BatchStatus = "queued" | "stage1" | "stage2" | "waiting_more" | "done" | "error";

type BatchRunItem = {
  index: number;
  fileName: string;
  traceId?: string;
  status: BatchStatus;
  error?: string;
  resultId?: string;
  category?: string;
  imagePath?: string | null;
  jsonPath?: string | null;
  models?: { vision?: string; struct?: string } | null;
  artifacts?: { vision?: string | null; struct?: string | null; context?: string | null } | null;
  stage1Text?: string | null;
  stage2Text?: string | null;
  needsMoreImages?: boolean;
  missingFields?: string[];
  requiredView?: string | null;
};

export default function ProductIngestWorkbench() {
  const [useJsonOverride, setUseJsonOverride] = useState(false);
  const [category, setCategory] = useState("shampoo");
  const [brand, setBrand] = useState("");
  const [name, setName] = useState("");
  const [source, setSource] = useState<"manual" | "doubao" | "auto">("doubao");
  const [stage1ModelTier, setStage1ModelTier] = useState<ModelTier>("mini");
  const [stage2ModelTier, setStage2ModelTier] = useState<ModelTier>("mini");
  const [jsonText, setJsonText] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<"idle" | "stage1" | "stage2" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [batchRuns, setBatchRuns] = useState<BatchRunItem[]>([]);
  const [supplementFiles, setSupplementFiles] = useState<Record<number, File | null>>({});
  const [supplementingIndex, setSupplementingIndex] = useState<number | null>(null);
  const [result, setResult] = useState<null | {
    id: string;
    status: string;
    mode?: string;
    category?: string;
    image_path?: string | null;
    json_path?: string | null;
    doubao?: {
      pipeline_mode?: string | null;
      models?: { vision?: string; struct?: string } | null;
      vision_text?: string | null;
      struct_text?: string | null;
      artifacts?: { vision?: string | null; struct?: string | null; context?: string | null } | null;
    } | null;
  }>(null);

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (images.length === 0) return false;
    if (useJsonOverride) return !!jsonText.trim();
    return true;
  }, [images.length, jsonText, submitting, useJsonOverride]);

  const latestModels = useMemo(() => {
    for (let i = batchRuns.length - 1; i >= 0; i -= 1) {
      const item = batchRuns[i];
      if (item.models?.vision || item.models?.struct) {
        return {
          stage1: item.models.vision || null,
          stage2: item.models.struct || null,
        };
      }
    }
    return {
      stage1: result?.doubao?.models?.vision || null,
      stage2: result?.doubao?.models?.struct || null,
    };
  }, [batchRuns, result]);

  function updateBatchRun(index: number, patch: Partial<BatchRunItem>) {
    setBatchRuns((prev) => prev.map((item) => (item.index === index ? { ...item, ...patch } : item)));
  }

  function pushProgress(index: number, event: SSEEvent) {
    if (event.event !== "progress") return;
    setBatchRuns((prev) =>
      prev.map((item) =>
        item.index === index
          ? {
              ...item,
              stage1Text: appendDeltaText(item.stage1Text, event.data, "stage1_vision"),
              stage2Text: appendDeltaText(item.stage2Text, event.data, "stage2_struct"),
            }
          : item,
      ),
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setPhase("idle");
    setError(null);
    setResult(null);
    setBatchRuns([]);
    setSupplementFiles({});
    setSupplementingIndex(null);

    try {
      const finalBrand = useJsonOverride ? brand.trim() || undefined : undefined;
      const finalName = useJsonOverride ? name.trim() || undefined : undefined;
      const finalCategory = useJsonOverride ? category : undefined;
      const finalJson = useJsonOverride ? jsonText.trim() || undefined : undefined;

      if (source === "doubao" && !finalJson) {
        const initial = images.map((file, i) => ({
          index: i,
          fileName: file.name,
          status: "queued" as BatchStatus,
        }));
        setBatchRuns(initial);

        let failed = 0;
        let waitingMore = 0;
        let succeeded = 0;
        let lastResult: (typeof result) | null = null;

        for (let i = 0; i < images.length; i += 1) {
          const file = images[i];
          setPhase("stage1");
          updateBatchRun(i, { status: "stage1", error: undefined });

          let stage1TraceId: string | null = null;
          try {
            const stage1 = await ingestProductStage1Stream(
              { image: file, modelTier: stage1ModelTier },
              (event) => pushProgress(i, event),
            );
            stage1TraceId = stage1.trace_id;
            const needsMoreImages = stage1.status === "needs_more_images" || !!stage1.needs_more_images;
            if (needsMoreImages) {
              waitingMore += 1;
              updateBatchRun(i, {
                status: "waiting_more",
                traceId: stage1.trace_id,
                models: stage1.doubao?.models || null,
                artifacts: stage1.doubao?.artifacts || null,
                stage1Text: stage1.doubao?.vision_text,
                needsMoreImages: true,
                missingFields: stage1.missing_fields || [],
                requiredView: stage1.required_view || null,
                error: undefined,
              });
              continue;
            }
            updateBatchRun(i, {
              status: "stage2",
              traceId: stage1.trace_id,
              models: stage1.doubao?.models || null,
              artifacts: stage1.doubao?.artifacts || null,
              stage1Text: stage1.doubao?.vision_text,
              needsMoreImages: false,
              missingFields: [],
              requiredView: null,
            });
          } catch (err) {
            failed += 1;
            updateBatchRun(i, { status: "error", error: formatError(err) });
            continue;
          }

          setPhase("stage2");
          if (!stage1TraceId) {
            failed += 1;
            updateBatchRun(i, { status: "error", error: "Stage1 未返回 trace_id。" });
            continue;
          }
          try {
            const ingestResult = await ingestProductStage2Stream(
              { traceId: stage1TraceId, modelTier: stage2ModelTier },
              (event) => pushProgress(i, event),
            );
            lastResult = ingestResult;
            updateBatchRun(i, {
              status: "done",
              resultId: ingestResult.id,
              category: ingestResult.category,
              imagePath: ingestResult.image_path || null,
              jsonPath: ingestResult.json_path || null,
              models: ingestResult.doubao?.models || null,
              artifacts: ingestResult.doubao?.artifacts || null,
              stage1Text: ingestResult.doubao?.vision_text,
              stage2Text: ingestResult.doubao?.struct_text,
            });
            succeeded += 1;
          } catch (err) {
            failed += 1;
            updateBatchRun(i, { status: "error", error: formatError(err) });
          }
        }

        if (lastResult) setResult(lastResult);
        if (failed > 0 || waitingMore > 0) {
          setError(`批量完成：${succeeded}/${images.length} 成功，${failed} 失败，${waitingMore} 待补拍。`);
        }
      } else {
        const firstImage = images[0];
        const ingestResult = await ingestProduct({
          image: firstImage || undefined,
          category: finalCategory,
          brand: finalBrand,
          name: finalName,
          source,
          metaJson: finalJson,
          stage1ModelTier,
          stage2ModelTier,
        });
        setResult(ingestResult);
      }
      setPhase("done");
    } catch (err) {
      setError(formatError(err));
      setPhase("idle");
    } finally {
      setSubmitting(false);
    }
  }

  async function runSupplementForItem(index: number) {
    const target = batchRuns.find((item) => item.index === index);
    const supplementFile = supplementFiles[index];
    if (!target?.traceId || !supplementFile) return;

    setSupplementingIndex(index);
    setError(null);
    updateBatchRun(index, { status: "stage1", error: undefined });
    setPhase("stage1");
    try {
      const stage1 = await ingestProductStage1SupplementStream(
        {
          traceId: target.traceId,
          image: supplementFile,
          modelTier: stage1ModelTier,
        },
        (event) => pushProgress(index, event),
      );

      const needsMoreImages = stage1.status === "needs_more_images" || !!stage1.needs_more_images;
      if (needsMoreImages) {
        updateBatchRun(index, {
          status: "waiting_more",
          traceId: stage1.trace_id,
          models: stage1.doubao?.models || null,
          artifacts: stage1.doubao?.artifacts || null,
          stage1Text: stage1.doubao?.vision_text,
          needsMoreImages: true,
          missingFields: stage1.missing_fields || [],
          requiredView: stage1.required_view || null,
          error: "双图 stage1 仍缺关键信息，请更换更清晰角度后重试。",
        });
        return;
      }

      updateBatchRun(index, {
        status: "stage2",
        traceId: stage1.trace_id,
        models: stage1.doubao?.models || null,
        artifacts: stage1.doubao?.artifacts || null,
        stage1Text: stage1.doubao?.vision_text,
        needsMoreImages: false,
        missingFields: [],
        requiredView: null,
      });
      setPhase("stage2");

      const ingestResult = await ingestProductStage2Stream(
        { traceId: stage1.trace_id, modelTier: stage2ModelTier },
        (event) => pushProgress(index, event),
      );
      setResult(ingestResult);
      updateBatchRun(index, {
        status: "done",
        resultId: ingestResult.id,
        category: ingestResult.category,
        imagePath: ingestResult.image_path || null,
        jsonPath: ingestResult.json_path || null,
        models: ingestResult.doubao?.models || null,
        artifacts: ingestResult.doubao?.artifacts || null,
        stage1Text: ingestResult.doubao?.vision_text,
        stage2Text: ingestResult.doubao?.struct_text,
        needsMoreImages: false,
        missingFields: [],
        requiredView: null,
      });
      setSupplementFiles((prev) => ({ ...prev, [index]: null }));
    } catch (err) {
      updateBatchRun(index, { status: "error", error: formatError(err) });
    } finally {
      setSupplementingIndex(null);
      setPhase("done");
    }
  }

  return (
    <section
      id="product-ingest-workbench"
      className="mt-8 rounded-[30px] border border-black/10 bg-gradient-to-br from-[#f8fbff] via-white to-[#f2f8f1] p-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
          Stage A · 上传与成分解析（流式）
        </span>
        <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
          Stage1 档位：{stage1ModelTier.toUpperCase()}
        </span>
        <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
          Stage1 实际模型：{latestModels.stage1 || "-"}
        </span>
        <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
          Stage2 档位：{stage2ModelTier.toUpperCase()}
        </span>
        <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
          Stage2 实际模型：{latestModels.stage2 || "-"}
        </span>
      </div>

      <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.02em] text-black/90">产品上传台</h2>
      <p className="mt-2 text-[14px] leading-[1.6] text-black/65">
        先完成图片解析并入库，输出 Stage1/Stage2 实时文本与最终结构化结果，作为后续去重与映射的输入基础。
      </p>

      <form onSubmit={onSubmit} className="mt-5 space-y-5 rounded-[24px] border border-black/10 bg-white p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-black/72">来源模式</span>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as "manual" | "doubao" | "auto")}
              className="h-11 rounded-xl border border-black/12 bg-white px-3 text-[14px] text-black/86 outline-none focus:border-black/35"
            >
              <option value="doubao">doubao（图片走豆包解析）</option>
              <option value="manual">manual（手工 JSON 优先）</option>
              <option value="auto">auto（自动）</option>
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-black/72">Stage1 模型档位</span>
            <select
              value={stage1ModelTier}
              onChange={(e) => setStage1ModelTier(e.target.value as ModelTier)}
              className="h-11 rounded-xl border border-black/12 bg-white px-3 text-[14px] text-black/86 outline-none focus:border-black/35"
            >
              {MODEL_TIERS.map((item) => (
                <option key={`s1-${item.value}`} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-black/72">Stage2 模型档位</span>
            <select
              value={stage2ModelTier}
              onChange={(e) => setStage2ModelTier(e.target.value as ModelTier)}
              className="h-11 rounded-xl border border-black/12 bg-white px-3 text-[14px] text-black/86 outline-none focus:border-black/35"
            >
              {MODEL_TIERS.map((item) => (
                <option key={`s2-${item.value}`} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-black/72">产品图片（默认必传）</span>
          <input
            type="file"
            accept="image/*"
            multiple={!useJsonOverride}
            onChange={(e) => setImages(Array.from(e.target.files || []))}
            className="h-11 rounded-xl border border-black/12 bg-white px-3 py-2 text-[13px] text-black/76 file:mr-3 file:rounded-lg file:border-0 file:bg-black/6 file:px-2.5 file:py-1.5 file:text-[12px] file:font-medium"
          />
          {images.length > 0 ? (
            <div className="rounded-xl border border-black/8 bg-black/[0.02] px-3 py-2 text-[12px] text-black/66">
              已选 {images.length} 张：{images.map((f) => f.name).join("、")}
            </div>
          ) : null}
          {source === "doubao" && !useJsonOverride ? (
            <div className="text-[12px] text-black/52">批量严格串行：逐张 stage1 → stage2。</div>
          ) : null}
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2.5 text-[13px] text-black/78">
          <input
            type="checkbox"
            checked={useJsonOverride}
            onChange={(e) => setUseJsonOverride(e.target.checked)}
            className="h-4 w-4 rounded border border-black/25"
          />
          <span className="font-medium">使用 JSON 覆盖（才会提交品类/品牌/产品名）</span>
        </label>

        {useJsonOverride ? (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-[13px] font-semibold text-black/72">品类</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="h-11 rounded-xl border border-black/12 bg-white px-3 text-[14px] text-black/86 outline-none focus:border-black/35"
                >
                  {CATEGORIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-[13px] font-semibold text-black/72">品牌（可选）</span>
                <input
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="h-11 rounded-xl border border-black/12 bg-white px-3 text-[14px] text-black/86 outline-none placeholder:text-black/30 focus:border-black/35"
                  placeholder="如：CeraVe"
                />
              </label>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-black/72">产品名（可选）</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 rounded-xl border border-black/12 bg-white px-3 text-[14px] text-black/86 outline-none placeholder:text-black/30 focus:border-black/35"
                placeholder="如：温和保湿沐浴露"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-black/72">产品 JSON（必填）</span>
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                className="min-h-[220px] rounded-2xl border border-black/12 bg-white px-3 py-2.5 text-[13px] leading-[1.6] text-black/82 outline-none placeholder:text-black/30 focus:border-black/35"
                placeholder={SAMPLE_JSON}
              />
            </label>
          </>
        ) : null}

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex h-11 items-center justify-center rounded-full bg-black px-6 text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-black/25"
        >
          {submitting ? "上传中..." : "上传到后端"}
        </button>

        {error ? <p className="text-[13px] leading-[1.5] text-[#b42318]">{error}</p> : null}

        {batchRuns.length > 0 ? (
          <div className="rounded-2xl border border-[#8ea3ff]/30 bg-[#eef2ff] p-4">
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-semibold text-black/82">批量分析进度</span>
              <span className="text-black/58">
                当前阶段：{phase === "stage1" ? "Stage1 识别" : phase === "stage2" ? "Stage2 结构化" : phase === "done" ? "完成" : "等待"}
              </span>
            </div>
            <div className="mt-3 space-y-3">
              {batchRuns.map((item) => (
                <article key={`${item.fileName}-${item.index}`} className="rounded-xl border border-black/10 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="truncate text-[13px] font-medium text-black/82">
                      #{item.index + 1} {item.fileName}
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClassName(item.status)}`}>
                      {statusLabel(item.status)}
                    </span>
                  </div>

                  <div className="mt-1 text-[12px] text-black/58">
                    trace_id: {item.traceId || "-"} | 入库ID: {item.resultId || "-"} | 分类: {item.category || "-"}
                  </div>

                  {item.models ? (
                    <div className="mt-1 text-[12px] text-black/58">
                      模型: vision={item.models.vision || "-"} / struct={item.models.struct || "-"}
                    </div>
                  ) : null}

                  {item.error ? <div className="mt-2 text-[12px] text-[#b42318]">{item.error}</div> : null}

                  {item.status === "waiting_more" ? (
                    <div className="mt-2 rounded-xl border border-[#f3c178]/40 bg-[#fff8ef] p-2.5">
                      <div className="text-[12px] font-semibold text-[#9b5a00]">该条需补拍，当前已跳过队列并继续后续任务。</div>
                      <div className="mt-1 text-[12px] text-black/66">
                        缺失字段：{(item.missingFields || []).map((field) => missingFieldLabel(field)).join("、") || "-"}
                      </div>
                      <div className="mt-1 text-[12px] text-black/66">建议补拍：{item.requiredView || "补拍另一面"}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) =>
                            setSupplementFiles((prev) => ({
                              ...prev,
                              [item.index]: event.target.files?.[0] || null,
                            }))
                          }
                          className="h-8 rounded-lg border border-black/12 bg-white px-2 text-[12px] text-black/76 file:mr-2 file:rounded file:border-0 file:bg-black/6 file:px-2 file:py-1 file:text-[11px]"
                        />
                        <button
                          type="button"
                          disabled={supplementingIndex === item.index || !supplementFiles[item.index]}
                          onClick={() => runSupplementForItem(item.index)}
                          className="inline-flex h-8 items-center justify-center rounded-full bg-black px-3 text-[12px] font-semibold text-white disabled:bg-black/25"
                        >
                          {supplementingIndex === item.index ? "补拍处理中..." : "上传补拍并继续"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {item.stage1Text && (item.status === "stage1" || item.status === "stage2" || item.status === "waiting_more" || item.status === "done") ? (
                    <div className="mt-2 rounded-xl border border-black/10 bg-[#fbfcff] p-2">
                      <div className="text-[11px] font-semibold text-[#3151d8]">Stage1 实时文本</div>
                      <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap text-[12px] leading-[1.5] text-black/72">
                        {item.stage1Text}
                      </pre>
                    </div>
                  ) : null}

                  {item.stage2Text && (item.status === "stage2" || item.status === "done") ? (
                    <div className="mt-2 rounded-xl border border-black/10 bg-[#f8fafc] p-2">
                      <div className="text-[11px] font-semibold text-[#3151d8]">Stage2 实时文本</div>
                      <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap text-[12px] leading-[1.5] text-black/72">
                        {item.stage2Text}
                      </pre>
                    </div>
                  ) : null}

                  {item.stage1Text ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[12px] font-medium text-black/76">Stage1 识别文本（美化）</summary>
                      <div className="mt-2 rounded-xl border border-black/8 bg-[#fbfcff] p-2.5">
                        {toVisionSections(item.stage1Text).map((section, idx) => (
                          <div key={`${section.title}-${idx}`} className="mb-2 last:mb-0">
                            <div className="text-[11px] font-semibold text-[#3151d8]">{section.title}</div>
                            <pre className="mt-0.5 whitespace-pre-wrap text-[12px] leading-[1.55] text-black/74">
                              {section.body || "未识别"}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}

                  {item.stage2Text ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[12px] font-medium text-black/76">Stage2 结构化文本（格式化）</summary>
                      <pre className="mt-2 max-h-72 overflow-auto rounded-xl border border-black/10 bg-[#f8fafc] p-2.5 text-[12px] leading-[1.55] text-black/74 whitespace-pre-wrap">
                        {toPrettyStructText(item.stage2Text)}
                      </pre>
                    </details>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        ) : null}

        {phase === "done" && batchRuns.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/product"
              className="inline-flex h-9 items-center rounded-full border border-black/14 bg-white px-4 text-[12px] font-semibold text-black/78 transition-colors hover:bg-black/[0.03]"
            >
              查看全部产品
            </Link>
            {batchRuns
              .filter((item) => item.resultId)
              .slice(0, 1)
              .map((item) => (
                <Link
                  key={item.resultId}
                  href={`/product/${item.resultId}`}
                  className="inline-flex h-9 items-center rounded-full border border-black/14 bg-black px-4 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                >
                  查看最新详情
                </Link>
              ))}
          </div>
        ) : null}

        {result ? (
          <div className="rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3.5 text-[13px] leading-[1.65] text-black/76">
            <div>状态：{result.status}</div>
            <div>入库 ID：{result.id}</div>
            <div>模式：{result.mode || "-"}</div>
            <div>品类：{result.category || "-"}</div>
            <div>图片：{result.image_path || "-"}</div>
            <div>JSON：{result.json_path || "-"}</div>
            {result.doubao ? (
              <>
                <div className="mt-2 border-t border-black/8 pt-2">
                  Doubao 流程：{result.doubao.pipeline_mode || "-"}
                </div>
                <div>
                  模型：vision={result.doubao.models?.vision || "-"} / struct={result.doubao.models?.struct || "-"}
                </div>
                <div>落盘(阶段1)：{result.doubao.artifacts?.vision || "-"}</div>
                <div>落盘(阶段2)：{result.doubao.artifacts?.struct || "-"}</div>
                <div>落盘(context)：{result.doubao.artifacts?.context || "-"}</div>
              </>
            ) : null}
          </div>
        ) : null}
      </form>
    </section>
  );
}

function formatError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function statusLabel(status: BatchStatus): string {
  if (status === "queued") return "排队中";
  if (status === "stage1") return "Stage1";
  if (status === "stage2") return "Stage2";
  if (status === "waiting_more") return "待补拍";
  if (status === "done") return "成功";
  return "失败";
}

function statusClassName(status: BatchStatus): string {
  if (status === "done") return "bg-[#e7f6ec] text-[#027a48]";
  if (status === "error") return "bg-[#fdebec] text-[#b42318]";
  if (status === "waiting_more") return "bg-[#fff4e6] text-[#9b5a00]";
  if (status === "stage1" || status === "stage2") return "bg-[#eef2ff] text-[#3151d8]";
  return "bg-black/6 text-black/60";
}

function missingFieldLabel(field: string): string {
  if (field === "brand") return "品牌";
  if (field === "name") return "产品名";
  if (field === "ingredients") return "成分表";
  return field;
}

function toVisionSections(raw: string): Array<{ title: string; body: string }> {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const sections: Array<{ title: string; body: string }> = [];
  let currentTitle = "识别文本";
  let buffer: string[] = [];

  const flush = () => {
    sections.push({ title: currentTitle, body: buffer.join("\n").trim() });
    buffer = [];
  };

  for (const line of lines) {
    const match = line.match(/^【([^】]+)】\s*(.*)$/);
    if (match) {
      if (buffer.length > 0) flush();
      currentTitle = match[1].trim();
      if (match[2]) buffer.push(match[2]);
      continue;
    }
    buffer.push(line);
  }
  if (buffer.length > 0) flush();
  return sections.filter((s) => s.title || s.body);
}

function toPrettyStructText(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.stringify(JSON.parse(candidate), null, 2);
  } catch {
    return raw;
  }
}

function appendDeltaText(
  current: string | null | undefined,
  data: Record<string, unknown>,
  expectedStage: "stage1_vision" | "stage2_struct",
): string | null | undefined {
  const stage = typeof data.stage === "string" ? data.stage : "";
  const delta =
    (typeof data.delta === "string" ? data.delta : "") ||
    (typeof data.text === "string" ? data.text : "");
  const stageMatch =
    stage === expectedStage ||
    (expectedStage === "stage1_vision" && stage.includes("stage1")) ||
    (expectedStage === "stage2_struct" && stage.includes("stage2"));
  if (!delta || !stageMatch) return current;
  return `${current || ""}${delta}`;
}
