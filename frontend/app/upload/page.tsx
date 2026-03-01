"use client";

import { FormEvent, useMemo, useState } from "react";
import { ingestProduct } from "@/lib/api";

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
  const [category, setCategory] = useState("shampoo");
  const [brand, setBrand] = useState("");
  const [name, setName] = useState("");
  const [source, setSource] = useState<"manual" | "doubao" | "auto">("doubao");
  const [jsonText, setJsonText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    if (!image && !jsonText.trim()) return false;
    return true;
  }, [image, jsonText, submitting]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const ingestResult = await ingestProduct({
        image: image || undefined,
        category,
        brand: brand.trim() || undefined,
        name: name.trim() || undefined,
        source,
        metaJson: jsonText.trim() || undefined,
      });
      setResult(ingestResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败，请稍后再试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[960px] px-6 py-12">
      <h1 className="text-[40px] leading-[1.08] font-semibold tracking-[-0.02em] text-black/92">产品上传</h1>
      <p className="mt-3 max-w-[760px] text-[17px] leading-[1.6] text-black/62">
        统一走后端 <span className="font-medium text-black/78">/api/upload</span>。支持图片、产品 JSON 或二者同时上传；
        用于后续豆包解析、产品比对和结果页展示。
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5 rounded-[28px] border border-black/10 bg-white p-6">
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
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-black/72">品牌（可选）</span>
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="h-11 rounded-xl border border-black/12 bg-white px-3 text-[14px] text-black/86 outline-none placeholder:text-black/30 focus:border-black/35"
              placeholder="如：CeraVe"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-black/72">产品名（可选）</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-xl border border-black/12 bg-white px-3 text-[14px] text-black/86 outline-none placeholder:text-black/30 focus:border-black/35"
              placeholder="如：温和保湿沐浴露"
            />
          </label>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-black/72">产品图片（可选）</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImage(e.target.files?.[0] || null)}
            className="h-11 rounded-xl border border-black/12 bg-white px-3 py-2 text-[13px] text-black/76 file:mr-3 file:rounded-lg file:border-0 file:bg-black/6 file:px-2.5 file:py-1.5 file:text-[12px] file:font-medium"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-black/72">产品 JSON（可选）</span>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            className="min-h-[220px] rounded-2xl border border-black/12 bg-white px-3 py-2.5 text-[13px] leading-[1.6] text-black/82 outline-none placeholder:text-black/30 focus:border-black/35"
            placeholder={SAMPLE_JSON}
          />
        </label>

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex h-11 items-center justify-center rounded-full bg-black px-6 text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-black/25"
        >
          {submitting ? "上传中..." : "上传到后端"}
        </button>

        {error ? <p className="text-[13px] leading-[1.5] text-[#b42318]">{error}</p> : null}

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
