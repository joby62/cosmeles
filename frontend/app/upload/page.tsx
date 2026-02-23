"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ingestImage } from "@/lib/api";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("shampoo");
  const [brand, setBrand] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!file) {
      setErr("请选择一张图片");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("category", category);
      if (brand.trim()) fd.append("brand", brand.trim());
      if (name.trim()) fd.append("name", name.trim());

      const res = await ingestImage(fd);
      router.push(`/products/${res.id}`);
    } catch (e: any) {
      setErr(e?.message || "上传失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold">上传新产品</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Demo 阶段：上传成分表图片，后端会生成结构化 JSON 并落盘。
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5 rounded-2xl border p-6">
        <div>
          <label className="text-sm font-medium">图片</label>
          <input
            className="mt-2 block w-full text-sm"
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium">分类</label>
            <select
              className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="shampoo">shampoo</option>
              <option value="bodywash">bodywash</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">品牌（可选）</label>
            <input
              className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="例如：多芬"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">产品名（可选）</label>
          <input
            className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：空气丰盈保湿洗发露（日本版）"
          />
        </div>

        {err ? <p className="text-sm text-red-600">{err}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-black px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "上传中…" : "提交并生成分析"}
        </button>
      </form>
    </main>
  );
}
