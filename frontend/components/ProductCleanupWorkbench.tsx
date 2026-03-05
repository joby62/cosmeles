"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Product,
  OrphanStorageCleanupResponse,
  cleanupOrphanStorage,
  deleteProductsBatch,
  downloadAllProductImagesZip,
} from "@/lib/api";
import { CATEGORY_CONFIG } from "@/lib/catalog";

const ORPHAN_MIN_AGE_MINUTES = 120;

export default function ProductCleanupWorkbench({ initialProducts }: { initialProducts: Product[] }) {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("");
  const [onlyInvalid, setOnlyInvalid] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteSummary, setDeleteSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [autoCleanup, setAutoCleanup] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState(15);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupSummary, setCleanupSummary] = useState<string | null>(null);
  const [cleanupError, setCleanupError] = useState<string | null>(null);
  const [lastCleanup, setLastCleanup] = useState<OrphanStorageCleanupResponse | null>(null);
  const cleanupRunningRef = useRef(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [downloadingImages, setDownloadingImages] = useState(false);
  const [downloadSummary, setDownloadSummary] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const categoryStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of initialProducts) {
      const key = (item.category || "unknown").trim().toLowerCase();
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [initialProducts]);

  const filteredProducts = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return initialProducts.filter((item) => {
      const pCategory = (item.category || "").trim().toLowerCase();
      if (category && pCategory !== category) return false;

      const blob = `${item.id} ${item.name || ""} ${item.brand || ""} ${item.one_sentence || ""}`.toLowerCase();
      if (q && !blob.includes(q)) return false;

      if (!onlyInvalid) return true;
      return invalidReasons(item).length > 0;
    });
  }, [initialProducts, category, keyword, onlyInvalid]);

  const runOrphanCleanup = useCallback(
    async (dryRun: boolean, fromTimer = false) => {
      if (cleanupRunningRef.current) return;
      cleanupRunningRef.current = true;
      setCleanupRunning(true);
      setCleanupError(null);
      if (!fromTimer) setCleanupSummary(null);
      try {
        const result = await cleanupOrphanStorage({
          dry_run: dryRun,
          min_age_minutes: ORPHAN_MIN_AGE_MINUTES,
          max_delete: 1000,
        });
        setLastCleanup(result);
        const summary = dryRun
          ? `扫描完成：orphan 图片 ${result.images.orphan_images}，orphan runs ${result.runs.orphan_runs}。`
          : `清理完成：删除图片 ${result.images.deleted_images}，删除 runs ${result.runs.deleted_runs}。`;
        setCleanupSummary(summary);
        if (!dryRun) router.refresh();
      } catch (err) {
        setCleanupError(formatErrorDetail(err));
      } finally {
        cleanupRunningRef.current = false;
        setCleanupRunning(false);
      }
    },
    [router],
  );

  useEffect(() => {
    if (!autoCleanup) return;
    const timer = window.setInterval(() => {
      void runOrphanCleanup(false, true);
    }, intervalMinutes * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [autoCleanup, intervalMinutes, runOrphanCleanup]);

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) return Array.from(new Set([...prev, id]));
      return prev.filter((item) => item !== id);
    });
  }

  function selectAllFiltered() {
    setSelectedIds(Array.from(new Set([...selectedIds, ...filteredProducts.map((item) => item.id)])));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  async function deleteSelectedProducts() {
    if (selectedIds.length === 0) {
      setDeleteSummary("当前没有勾选产品。");
      return;
    }
    setDeleting(true);
    setError(null);
    setDeleteSummary(null);
    try {
      const result = await deleteProductsBatch({
        ids: selectedIds,
        remove_doubao_artifacts: true,
      });
      setDeleteSummary(
        `删除完成：${result.deleted_ids.length} 条，跳过 ${result.skipped_ids.length} 条，缺失 ${result.missing_ids.length} 条。`,
      );
      setSelectedIds([]);
      router.refresh();
    } catch (err) {
      setError(formatErrorDetail(err));
    } finally {
      setDeleting(false);
    }
  }

  async function handleDownloadAllImages() {
    setDownloadingImages(true);
    setDownloadSummary(null);
    setDownloadError(null);
    try {
      const { blob, filename, image_count } = await downloadAllProductImagesZip();
      const href = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(href);
      setDownloadSummary(`下载完成：${image_count} 张图片，文件 ${filename}`);
    } catch (err) {
      setDownloadError(formatErrorDetail(err));
    } finally {
      setDownloadingImages(false);
    }
  }

  return (
    <section className="mt-8 rounded-[30px] border border-black/10 bg-white p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
          Stage E · 清理维护
        </span>
      </div>
      <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.02em] text-black/90">手动清理台</h2>
      <p className="mt-2 text-[14px] text-black/65">
        支持定时清理无 product 引用的 images 与 doubao_runs，也支持手动勾选无效产品直接删除。
      </p>

      <div className="mt-5 rounded-2xl border border-black/10 bg-[#f8fafc] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSettingsOpen((prev) => !prev)}
            className="inline-flex h-9 items-center justify-center rounded-full border border-black/14 bg-white px-4 text-[13px] font-semibold text-black/78"
          >
            设置
          </button>
          <button
            type="button"
            onClick={() => runOrphanCleanup(true)}
            disabled={cleanupRunning}
            className="inline-flex h-9 items-center justify-center rounded-full border border-black/14 bg-white px-4 text-[13px] font-semibold text-black/78 disabled:opacity-50"
          >
            {cleanupRunning ? "执行中..." : "预览 orphan 清理"}
          </button>
          <button
            type="button"
            onClick={() => runOrphanCleanup(false)}
            disabled={cleanupRunning}
            className="inline-flex h-9 items-center justify-center rounded-full bg-black px-4 text-[13px] font-semibold text-white disabled:bg-black/25"
          >
            {cleanupRunning ? "清理中..." : "立即清理 orphan"}
          </button>
          <label className="ml-2 inline-flex items-center gap-2 text-[12px] text-black/68">
            <input type="checkbox" checked={autoCleanup} onChange={(e) => setAutoCleanup(e.target.checked)} className="h-4 w-4" />
            开启页面定时任务
          </label>
          <select
            value={intervalMinutes}
            onChange={(e) => setIntervalMinutes(Number(e.target.value))}
            className="h-8 rounded-lg border border-black/12 bg-white px-2 text-[12px] text-black/72"
            disabled={!autoCleanup}
          >
            <option value={5}>每 5 分钟</option>
            <option value={15}>每 15 分钟</option>
            <option value={30}>每 30 分钟</option>
            <option value={60}>每 60 分钟</option>
          </select>
        </div>
        <div className="mt-2 text-[12px] text-black/55">安全窗口：仅清理超过 {ORPHAN_MIN_AGE_MINUTES} 分钟的文件/目录。</div>
        {cleanupSummary ? <div className="mt-2 text-[13px] text-[#116a3f]">{cleanupSummary}</div> : null}
        {cleanupError ? <div className="mt-2 text-[13px] text-[#b42318]">{cleanupError}</div> : null}
        {lastCleanup ? (
          <div className="mt-2 text-[12px] text-black/62">
            最近结果：images 扫描 {lastCleanup.images.scanned_images} / orphan {lastCleanup.images.orphan_images}；runs 扫描 {lastCleanup.runs.scanned_runs} / orphan {lastCleanup.runs.orphan_runs}
          </div>
        ) : null}
        {settingsOpen ? (
          <div className="mt-3 rounded-xl border border-black/10 bg-white p-3">
            <div className="text-[12px] font-semibold text-black/78">维护设置</div>
            <div className="mt-1 text-[12px] text-black/56">一键打包下载当前产品索引引用的全部图片。</div>
            <div className="mt-2">
              <button
                type="button"
                onClick={handleDownloadAllImages}
                disabled={downloadingImages}
                className="inline-flex h-9 items-center justify-center rounded-full border border-black/14 bg-white px-4 text-[12px] font-semibold text-black/78 disabled:opacity-50"
              >
                {downloadingImages ? "打包中..." : "一键下载全部图片"}
              </button>
            </div>
            {downloadSummary ? <div className="mt-2 text-[12px] text-[#116a3f]">{downloadSummary}</div> : null}
            {downloadError ? <div className="mt-2 text-[12px] text-[#b42318]">{downloadError}</div> : null}
          </div>
        ) : null}
      </div>

      <div className="mt-5 rounded-2xl border border-black/10 bg-[#fbfcff] p-4">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="按 ID/品牌/名称检索"
            className="h-10 rounded-xl border border-black/12 bg-white px-3 text-[13px] outline-none focus:border-black/35"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-10 rounded-xl border border-black/12 bg-white px-3 text-[13px] outline-none focus:border-black/35"
          >
            <option value="">全部品类</option>
            {categoryStats.map(([key, count]) => (
              <option key={key} value={key}>
                {categoryLabel(key)} · {count}
              </option>
            ))}
          </select>
          <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-black/12 bg-white px-3 text-[13px] text-black/72">
            <input type="checkbox" checked={onlyInvalid} onChange={(e) => setOnlyInvalid(e.target.checked)} className="h-4 w-4" />
            仅显示疑似无效产品
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={selectAllFiltered}
            className="inline-flex h-9 items-center justify-center rounded-full border border-black/12 bg-white px-4 text-[12px] font-semibold text-black/75"
          >
            勾选当前筛选
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="inline-flex h-9 items-center justify-center rounded-full border border-black/12 bg-white px-4 text-[12px] font-semibold text-black/75"
          >
            清空勾选
          </button>
          <button
            type="button"
            onClick={deleteSelectedProducts}
            disabled={deleting || selectedIds.length === 0}
            className="inline-flex h-9 items-center justify-center rounded-full border border-[#ef4444]/40 bg-[#fff5f5] px-4 text-[12px] font-semibold text-[#b42318] disabled:opacity-50"
          >
            {deleting ? "删除中..." : `删除勾选 (${selectedIds.length})`}
          </button>
          <span className="text-[12px] text-black/58">当前筛选 {filteredProducts.length} 条</span>
        </div>

        {deleteSummary ? <div className="mt-2 text-[13px] text-[#116a3f]">{deleteSummary}</div> : null}
        {error ? <div className="mt-2 text-[13px] text-[#b42318]">{error}</div> : null}

        <div className="mt-3 max-h-[360px] overflow-auto space-y-2 pr-1">
          {filteredProducts.map((item) => {
            const checked = selectedIds.includes(item.id);
            const reasons = invalidReasons(item);
            return (
              <label key={item.id} className="flex items-start gap-2 rounded-lg border border-black/10 bg-white p-2.5">
                <input type="checkbox" checked={checked} onChange={(e) => toggleSelect(item.id, e.target.checked)} className="mt-1 h-4 w-4" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-black/84">{item.name || "未命名产品"}</div>
                  <div className="truncate text-[12px] text-black/62">
                    {item.brand || "品牌缺失"} · {categoryLabel(item.category)} · trace_id: {item.id}
                  </div>
                  {reasons.length > 0 ? <div className="mt-1 text-[12px] text-[#b42318]">疑似无效：{reasons.join(" / ")}</div> : null}
                </div>
              </label>
            );
          })}
          {filteredProducts.length === 0 ? <div className="text-[12px] text-black/52">当前筛选无结果。</div> : null}
        </div>
      </div>
    </section>
  );
}

function invalidReasons(item: Product): string[] {
  const reasons: string[] = [];
  if (!String(item.name || "").trim()) reasons.push("缺少名称");
  if (!String(item.brand || "").trim()) reasons.push("缺少品牌");
  if (!String(item.one_sentence || "").trim()) reasons.push("缺少摘要");
  if (!String(item.image_url || "").trim()) reasons.push("缺少图片路径");
  return reasons;
}

function categoryLabel(category?: string | null): string {
  if (!category) return "-";
  const key = category.toLowerCase() as keyof typeof CATEGORY_CONFIG;
  return CATEGORY_CONFIG[key]?.zh || category;
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
