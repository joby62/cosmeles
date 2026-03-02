"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import {
  ingestProduct,
  ingestProductStage1Stream,
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

type BatchStatus = "queued" | "stage1" | "stage2" | "done" | "error";

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
};

export default function UploadPage() {
  const [useJsonOverride, setUseJsonOverride] = useState(false);
  const [category, setCategory] = useState("shampoo");
  const [brand, setBrand] = useState("");
  const [name, setName] = useState("");
  const [source, setSource] = useState<"manual" | "doubao" | "auto">("doubao");
  const [jsonText, setJsonText] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<"idle" | "stage1" | "stage2" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [batchRuns, setBatchRuns] = useState<BatchRunItem[]>([]);
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

    try {
      const finalBrand = useJsonOverride ? brand.trim() || undefined : undefined;
      const finalName = useJsonOverride ? name.trim() || undefined : undefined;
      const finalCategory = useJsonOverride ? category : undefined;
      const finalJson = useJsonOverride ? jsonText.trim() || undefined : undefined;

      // Doubao 批量两阶段：严格串行（不并发），逐张跑 stage1 -> stage2
      if (source === "doubao" && !finalJson) {
        const initial = images.map((file, i) => ({
          index: i,
          fileName: file.name,
          status: "queued" as BatchStatus,
        }));
        setBatchRuns(initial);

        let failed = 0;
        let lastResult: (typeof result) | null = null;

        for (let i = 0; i < images.length; i += 1) {
          const file = images[i];
          setPhase("stage1");
          updateBatchRun(i, { status: "stage1", error: undefined });

          let stage1TraceId: string | null = null;
          try {
            const stage1 = await ingestProductStage1Stream({ image: file }, (event) => pushProgress(i, event));
            stage1TraceId = stage1.trace_id;
            updateBatchRun(i, {
              status: "stage2",
              traceId: stage1.trace_id,
              models: stage1.doubao?.models || null,
              artifacts: stage1.doubao?.artifacts || null,
              stage1Text: stage1.doubao?.vision_text,
            });
          } catch (err) {
            failed += 1;
            updateBatchRun(i, { status: "error", error: formatError(err) });
            continue;
          }

          setPhase("stage2");
          if (!stage1TraceId) {
            failed += 1;
            updateBatchRun(i, { status: "error", error: "Stage1 未返回有效 trace_id，已跳过该图片。" });
            continue;
          }
          try {
            const ingestResult = await ingestProductStage2Stream({ traceId: stage1TraceId }, (event) => pushProgress(i, event));
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
          } catch (err) {
            failed += 1;
            updateBatchRun(i, { status: "error", error: formatError(err) });
          }
        }

        if (lastResult) setResult(lastResult);
        if (failed > 0) {
          setError(`批量完成：${images.length - failed}/${images.length} 成功，${failed} 失败。`);
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

  return (
    <main className="mx-auto min-h-screen w-full max-w-[960px] px-6 py-12">
      <h1 className="text-[40px] leading-[1.08] font-semibold tracking-[-0.02em] text-black/92">产品上传</h1>
      <p className="mt-3 max-w-[760px] text-[17px] leading-[1.6] text-black/62">
        默认只上传图片，由豆包自动识别品类与信息。勾选 JSON 覆盖后，才会提交品类/品牌/产品名与 JSON。
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5 rounded-[28px] border border-black/10 bg-white p-6">
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
            <div className="text-[12px] text-black/52">批量会按顺序逐张分析（stage1→stage2），不会并发。</div>
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

                  {item.stage1Text && (item.status === "stage1" || item.status === "stage2" || item.status === "done") ? (
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
                {result.doubao.vision_text ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer font-medium text-black/78">阶段1 图片识别文本</summary>
                    <pre className="mt-1 max-h-48 overflow-auto rounded-xl border border-black/10 bg-white p-2 text-[12px] leading-[1.5] text-black/72 whitespace-pre-wrap">
                      {result.doubao.vision_text}
                    </pre>
                  </details>
                ) : null}
                {result.doubao.struct_text ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer font-medium text-black/78">阶段2 结构化输出文本</summary>
                    <pre className="mt-1 max-h-48 overflow-auto rounded-xl border border-black/10 bg-white p-2 text-[12px] leading-[1.5] text-black/72 whitespace-pre-wrap">
                      {result.doubao.struct_text}
                    </pre>
                  </details>
                ) : null}
              </>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2 border-t border-black/10 pt-3">
              <Link
                href="/product"
                className="inline-flex h-8 items-center rounded-full border border-black/14 bg-white px-3.5 text-[12px] font-semibold text-black/78 transition-colors hover:bg-black/[0.03]"
              >
                查看全部产品
              </Link>
              <Link
                href={`/product/${result.id}`}
                className="inline-flex h-8 items-center rounded-full border border-black/14 bg-black px-3.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                查看该产品详情
              </Link>
            </div>
          </div>
        ) : null}
      </form>
    </main>
  );
}

function formatError(err: unknown): string {
  if (!(err instanceof Error)) return "上传失败，请稍后再试。";
  return err.message || "上传失败，请稍后再试。";
}

function statusLabel(status: BatchStatus): string {
  if (status === "queued") return "排队中";
  if (status === "stage1") return "Stage1";
  if (status === "stage2") return "Stage2";
  if (status === "done") return "成功";
  return "失败";
}

function statusClassName(status: BatchStatus): string {
  if (status === "done") return "bg-[#e7f6ec] text-[#027a48]";
  if (status === "error") return "bg-[#fdebec] text-[#b42318]";
  if (status === "stage1" || status === "stage2") return "bg-[#eef2ff] text-[#3151d8]";
  return "bg-black/6 text-black/60";
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
