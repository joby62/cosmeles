"use client";

import { FormEvent, useMemo, useState } from "react";
import { ingestProduct, ingestProductStage1, ingestProductStage2 } from "@/lib/api";

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

export default function UploadPage() {
  const [useJsonOverride, setUseJsonOverride] = useState(false);
  const [category, setCategory] = useState("shampoo");
  const [brand, setBrand] = useState("");
  const [name, setName] = useState("");
  const [source, setSource] = useState<"manual" | "doubao" | "auto">("doubao");
  const [jsonText, setJsonText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<"idle" | "stage1" | "stage2" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [stage1Preview, setStage1Preview] = useState<null | {
    trace_id: string;
    vision_text?: string | null;
    models?: { vision?: string; struct?: string } | null;
    artifacts?: { vision?: string | null; context?: string | null } | null;
  }>(null);
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
      artifacts?: { vision?: string | null; struct?: string | null } | null;
    } | null;
  }>(null);

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (useJsonOverride) return !!jsonText.trim();
    if (!image) return false;
    return true;
  }, [image, jsonText, submitting, useJsonOverride]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setPhase("idle");
    setError(null);
    setStage1Preview(null);
    setResult(null);

    try {
      const finalBrand = useJsonOverride ? brand.trim() || undefined : undefined;
      const finalName = useJsonOverride ? name.trim() || undefined : undefined;
      const finalCategory = useJsonOverride ? category : undefined;
      const finalJson = useJsonOverride ? jsonText.trim() || undefined : undefined;

      // Doubao 两阶段：先展示 mini 识别，再等待 mini 结构化
      if (source === "doubao" && image && !finalJson) {
        setPhase("stage1");
        const stage1 = await ingestProductStage1({
          image,
        });

        setStage1Preview({
          trace_id: stage1.trace_id,
          vision_text: stage1.doubao?.vision_text,
          models: stage1.doubao?.models || null,
          artifacts: stage1.doubao?.artifacts || null,
        });

        setPhase("stage2");
        const ingestResult = await ingestProductStage2({
          traceId: stage1.trace_id,
        });
        setResult(ingestResult);
      } else {
        const ingestResult = await ingestProduct({
          image: image || undefined,
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
      setError(err instanceof Error ? err.message : "上传失败，请稍后再试。");
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
            onChange={(e) => setImage(e.target.files?.[0] || null)}
            className="h-11 rounded-xl border border-black/12 bg-white px-3 py-2 text-[13px] text-black/76 file:mr-3 file:rounded-lg file:border-0 file:bg-black/6 file:px-2.5 file:py-1.5 file:text-[12px] file:font-medium"
          />
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

        {phase === "stage2" && stage1Preview ? (
          <div className="rounded-2xl border border-[#8ea3ff]/30 bg-[#eef2ff] px-4 py-3.5 text-[13px] leading-[1.65] text-black/76">
            <div className="font-medium text-black/80">阶段1完成：已提取图片文字</div>
            <div className="mt-1">模型：{stage1Preview.models?.vision || "-"}</div>
            <div>落盘(阶段1)：{stage1Preview.artifacts?.vision || "-"}</div>
            <div className="mt-2 animate-pulse font-medium text-[#3151d8]">
              正在进行阶段2结构化分析，请等待片刻...
            </div>
            {stage1Preview.vision_text ? (
              <details className="mt-2">
                <summary className="cursor-pointer font-medium text-black/78">查看阶段1识别文本</summary>
                <pre className="mt-1 max-h-48 overflow-auto rounded-xl border border-black/10 bg-white p-2 text-[12px] leading-[1.5] text-black/72 whitespace-pre-wrap">
                  {stage1Preview.vision_text}
                </pre>
              </details>
            ) : null}
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
          </div>
        ) : null}
      </form>
    </main>
  );
}
