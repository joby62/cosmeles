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

export default function MobileComparePage() {
  const [category, setCategory] = useState("shampoo");
  const [brand, setBrand] = useState("");
  const [name, setName] = useState("");
  const [source, setSource] = useState<"manual" | "doubao" | "auto">("manual");
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
    <section className="pb-12">
      <h1 className="text-[30px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/90">横向对比 · 上传入口</h1>
      <p className="mt-3 text-[15px] leading-[1.55] text-black/62">
        用户上传的产品会进入后端 storage 与数据库，后续可直接用于豆包比对与结果页主推展示。
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-3xl border border-black/10 bg-white p-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black/70">品类</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-10 rounded-xl border border-black/12 bg-white px-3 text-[14px] text-black/85 outline-none focus:border-black/35"
            >
              {CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black/70">来源</span>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as "manual" | "doubao" | "auto")}
              className="h-10 rounded-xl border border-black/12 bg-white px-3 text-[14px] text-black/85 outline-none focus:border-black/35"
            >
              <option value="manual">manual（手工JSON）</option>
              <option value="doubao">doubao（图片走豆包）</option>
              <option value="auto">auto（自动）</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black/70">品牌（可选）</span>
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="h-10 rounded-xl border border-black/12 bg-white px-3 text-[14px] text-black/85 outline-none placeholder:text-black/30 focus:border-black/35"
              placeholder="如：多芬"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-black/70">产品名（可选）</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 rounded-xl border border-black/12 bg-white px-3 text-[14px] text-black/85 outline-none placeholder:text-black/30 focus:border-black/35"
              placeholder="如：空气丰盈洗发露"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-black/70">产品图片（可选，建议上传）</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImage(e.target.files?.[0] || null)}
            className="h-10 rounded-xl border border-black/12 bg-white px-3 py-2 text-[13px] text-black/75 file:mr-3 file:rounded-lg file:border-0 file:bg-black/5 file:px-2.5 file:py-1.5 file:text-[12px] file:font-medium"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-black/70">产品 JSON（可选；建议手工上传时填写）</span>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            className="min-h-[180px] rounded-2xl border border-black/12 bg-white px-3 py-2.5 text-[13px] leading-[1.55] text-black/80 outline-none placeholder:text-black/30 focus:border-black/35"
            placeholder={SAMPLE_JSON}
          />
        </label>

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex h-11 items-center justify-center rounded-full bg-black px-5 text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-black/25"
        >
          {submitting ? "上传中..." : "上传到后端并入库"}
        </button>

        {error ? <p className="text-[13px] leading-[1.5] text-[#b42318]">{error}</p> : null}

        {result ? (
          <div className="rounded-2xl border border-black/10 bg-black/[0.03] px-3.5 py-3 text-[13px] leading-[1.6] text-black/75">
            <div>状态：{result.status}</div>
            <div>入库 ID：{result.id}</div>
            <div>模式：{result.mode || "-"}</div>
            <div>品类：{result.category || "-"}</div>
            <div>图片：{result.image_path || "-"}</div>
            <div>JSON：{result.json_path || "-"}</div>
          </div>
        ) : null}
      </form>
    </section>
  );
}

