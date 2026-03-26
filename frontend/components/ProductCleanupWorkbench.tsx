"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import WorkbenchTaskSection from "@/components/workbench/WorkbenchTaskSection";
import { formatErrorDetail, useProductWorkbenchJobs } from "@/components/workbench/useProductWorkbenchJobs";
import {
  MobileInvalidProductRefCleanupRequest,
  MobileInvalidProductRefCleanupResponse,
  OrphanStorageCleanupRequest,
  OrphanStorageCleanupResponse,
  Product,
  ProductBatchDeleteRequest,
  ProductBatchDeleteResponse,
  ProductWorkbenchJob,
  cancelMobileInvalidProductRefCleanupJob,
  cancelOrphanStorageCleanupJob,
  cancelProductBatchDeleteJob,
  createMobileInvalidProductRefCleanupJob,
  createOrphanStorageCleanupJob,
  createProductBatchDeleteJob,
  downloadAllProductImagesZip,
  fetchMobileInvalidProductRefCleanupJob,
  fetchOrphanStorageCleanupJob,
  fetchProductBatchDeleteJob,
  listMobileInvalidProductRefCleanupJobs,
  listOrphanStorageCleanupJobs,
  listProductBatchDeleteJobs,
  retryMobileInvalidProductRefCleanupJob,
  retryOrphanStorageCleanupJob,
  retryProductBatchDeleteJob,
} from "@/lib/api";
import { CATEGORY_CONFIG } from "@/lib/catalog";

const ORPHAN_MIN_AGE_MINUTES = 120;
const ORPHAN_MAX_DELETE = 1000;
const MOBILE_REF_SAMPLE_LIMIT = 8;
const ORPHAN_JOB_STORAGE_KEY = "product-cleanup-orphan-job-id";
const MOBILE_REF_JOB_STORAGE_KEY = "product-cleanup-mobile-ref-job-id";
const PRODUCT_DELETE_JOB_STORAGE_KEY = "product-cleanup-delete-job-id";

export default function ProductCleanupWorkbench({ initialProducts }: { initialProducts: Product[] }) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("");
  const [onlyInvalid, setOnlyInvalid] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [autoCleanup, setAutoCleanup] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState(15);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [downloadingImages, setDownloadingImages] = useState(false);
  const [downloadSummary, setDownloadSummary] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [handledOrphanResultJobId, setHandledOrphanResultJobId] = useState<string | null>(null);
  const [handledMobileRefResultJobId, setHandledMobileRefResultJobId] = useState<string | null>(null);
  const [handledDeleteResultJobId, setHandledDeleteResultJobId] = useState<string | null>(null);

  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  const orphanJobService = useMemo(
    () => ({
      listJobs: listOrphanStorageCleanupJobs,
      fetchJob: fetchOrphanStorageCleanupJob,
      createJob: createOrphanStorageCleanupJob,
      cancelJob: cancelOrphanStorageCleanupJob,
      retryJob: retryOrphanStorageCleanupJob,
    }),
    [],
  );
  const mobileRefJobService = useMemo(
    () => ({
      listJobs: listMobileInvalidProductRefCleanupJobs,
      fetchJob: fetchMobileInvalidProductRefCleanupJob,
      createJob: createMobileInvalidProductRefCleanupJob,
      cancelJob: cancelMobileInvalidProductRefCleanupJob,
      retryJob: retryMobileInvalidProductRefCleanupJob,
    }),
    [],
  );
  const productDeleteJobService = useMemo(
    () => ({
      listJobs: listProductBatchDeleteJobs,
      fetchJob: fetchProductBatchDeleteJob,
      createJob: createProductBatchDeleteJob,
      cancelJob: cancelProductBatchDeleteJob,
      retryJob: retryProductBatchDeleteJob,
    }),
    [],
  );

  const orphanJobs = useProductWorkbenchJobs<OrphanStorageCleanupRequest, OrphanStorageCleanupResponse>({
    storageKey: ORPHAN_JOB_STORAGE_KEY,
    listLimit: 20,
    parseResult: (job) => parseOrphanCleanupResult(job.result as Record<string, unknown> | undefined),
    service: orphanJobService,
  });
  const mobileRefJobs = useProductWorkbenchJobs<MobileInvalidProductRefCleanupRequest, MobileInvalidProductRefCleanupResponse>({
    storageKey: MOBILE_REF_JOB_STORAGE_KEY,
    listLimit: 20,
    parseResult: (job) => parseMobileInvalidProductRefCleanupResult(job.result as Record<string, unknown> | undefined),
    service: mobileRefJobService,
  });
  const productDeleteJobs = useProductWorkbenchJobs<ProductBatchDeleteRequest, ProductBatchDeleteResponse>({
    storageKey: PRODUCT_DELETE_JOB_STORAGE_KEY,
    listLimit: 20,
    parseResult: (job) => parseProductBatchDeleteResult(job.result as Record<string, unknown> | undefined),
    service: productDeleteJobService,
  });
  const orphanJobLoading = orphanJobs.jobLoading;
  const orphanActiveRunning = orphanJobs.activeRunning;
  const startOrphanJob = orphanJobs.startJob;

  useEffect(() => {
    if (!autoCleanup) return;
    const timer = window.setInterval(() => {
      if (orphanJobLoading || orphanActiveRunning) return;
      void startOrphanJob({
        dry_run: false,
        min_age_minutes: ORPHAN_MIN_AGE_MINUTES,
        max_delete: ORPHAN_MAX_DELETE,
      });
    }, intervalMinutes * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [autoCleanup, intervalMinutes, orphanActiveRunning, orphanJobLoading, startOrphanJob]);

  useEffect(() => {
    if (!orphanJobs.result || !orphanJobs.resultJobId || handledOrphanResultJobId === orphanJobs.resultJobId) return;
    setHandledOrphanResultJobId(orphanJobs.resultJobId);
    if (!orphanJobs.result.dry_run && (orphanJobs.result.images.deleted_images > 0 || orphanJobs.result.runs.deleted_runs > 0)) {
      router.refresh();
    }
  }, [handledOrphanResultJobId, orphanJobs.result, orphanJobs.resultJobId, router]);

  useEffect(() => {
    if (!mobileRefJobs.result || !mobileRefJobs.resultJobId || handledMobileRefResultJobId === mobileRefJobs.resultJobId) {
      return;
    }
    setHandledMobileRefResultJobId(mobileRefJobs.resultJobId);
    if (!mobileRefJobs.result.dry_run && mobileRefJobs.result.total_repaired > 0) {
      router.refresh();
    }
  }, [handledMobileRefResultJobId, mobileRefJobs.result, mobileRefJobs.resultJobId, router]);

  useEffect(() => {
    if (!productDeleteJobs.result || !productDeleteJobs.resultJobId || handledDeleteResultJobId === productDeleteJobs.resultJobId) {
      return;
    }
    setHandledDeleteResultJobId(productDeleteJobs.resultJobId);
    const deletedSet = new Set(productDeleteJobs.result.deleted_ids);
    setSelectedIds([]);
    if (deletedSet.size > 0) {
      setProducts((prev) => prev.filter((item) => !deletedSet.has(item.id)));
      router.refresh();
    }
  }, [handledDeleteResultJobId, productDeleteJobs.result, productDeleteJobs.resultJobId, router]);

  const categoryStats = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of products) {
      const key = (item.category || "unknown").trim().toLowerCase();
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return products.filter((item) => {
      const productCategory = (item.category || "").trim().toLowerCase();
      if (category && productCategory !== category) return false;

      const blob = `${item.id} ${item.name || ""} ${item.brand || ""} ${item.one_sentence || ""}`.toLowerCase();
      if (q && !blob.includes(q)) return false;

      if (!onlyInvalid) return true;
      return invalidReasons(item).length > 0;
    });
  }, [category, keyword, onlyInvalid, products]);

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) return Array.from(new Set([...prev, id]));
      return prev.filter((item) => item !== id);
    });
  }

  function selectAllFiltered() {
    setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredProducts.map((item) => item.id)])));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  async function startOrphanCleanup(dryRun: boolean) {
    await orphanJobs.startJob({
      dry_run: dryRun,
      min_age_minutes: ORPHAN_MIN_AGE_MINUTES,
      max_delete: ORPHAN_MAX_DELETE,
    });
  }

  async function startMobileRefCleanup(dryRun: boolean) {
    await mobileRefJobs.startJob({
      dry_run: dryRun,
      sample_limit: MOBILE_REF_SAMPLE_LIMIT,
    });
  }

  async function deleteSelectedProducts() {
    if (selectedIds.length === 0) {
      productDeleteJobs.setErrorMessage("当前没有勾选产品。");
      return;
    }
    await productDeleteJobs.startJob({
      ids: [...selectedIds],
      remove_doubao_artifacts: true,
    });
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
          产品治理 · 清理维护
        </span>
      </div>
      <h2 className="mt-3 text-[28px] font-semibold tracking-[-0.02em] text-black/90">产品清理台</h2>
      <p className="mt-2 text-[14px] text-black/65">
        orphan 清理、移动端失效引用修复、批量删产品已统一切到后台 jobs，支持刷新恢复、取消、失败重试，并直接暴露真实错误。
      </p>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-black/10 bg-[#f8fafc] p-4">
          <div className="text-[13px] font-semibold text-black/82">orphan 存储清理</div>
          <div className="mt-1 text-[12px] leading-[1.6] text-black/56">
            安全窗口：仅清理超过 {ORPHAN_MIN_AGE_MINUTES} 分钟的文件或目录。支持预览、真实清理、页面定时任务。
          </div>
          <WorkbenchTaskSection
            errorMessage={orphanJobs.errorMessage}
            onRefresh={() => {
              void orphanJobs.refreshJobs();
            }}
            refreshDisabled={orphanJobs.jobsLoading}
            refreshLabel={orphanJobs.jobsLoading ? "刷新中..." : "刷新 orphan 任务"}
            onCancelActive={() => {
              void orphanJobs.cancelActiveJob();
            }}
            cancelActiveDisabled={orphanJobs.jobLoading || !orphanJobs.activeRunning || !orphanJobs.activeJob}
            cancelActiveLabel="中止当前 orphan 任务"
            toolbarExtra={
              <>
                <button
                  type="button"
                  onClick={() => void startOrphanCleanup(true)}
                  disabled={orphanJobs.jobLoading || orphanJobs.activeRunning}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-black/14 bg-white px-5 text-[13px] font-semibold text-black/78 disabled:opacity-45"
                >
                  {orphanJobs.jobLoading && !orphanJobs.activeRunning ? "提交中..." : "预览 orphan 清理"}
                </button>
                <button
                  type="button"
                  onClick={() => void startOrphanCleanup(false)}
                  disabled={orphanJobs.jobLoading || orphanJobs.activeRunning}
                  className="inline-flex h-10 items-center justify-center rounded-full bg-black px-5 text-[13px] font-semibold text-white disabled:bg-black/25"
                >
                  {orphanJobs.jobLoading && !orphanJobs.activeRunning ? "提交中..." : "立即清理 orphan"}
                </button>
                <label className="inline-flex items-center gap-2 text-[12px] text-black/68">
                  <input
                    type="checkbox"
                    checked={autoCleanup}
                    onChange={(event) => setAutoCleanup(event.target.checked)}
                    className="h-4 w-4"
                  />
                  开启页面定时任务
                </label>
                <select
                  value={intervalMinutes}
                  onChange={(event) => setIntervalMinutes(Number(event.target.value))}
                  className="h-10 rounded-full border border-black/14 bg-white px-4 text-[12px] text-black/72"
                  disabled={!autoCleanup}
                >
                  <option value={5}>每 5 分钟</option>
                  <option value={15}>每 15 分钟</option>
                  <option value={30}>每 30 分钟</option>
                  <option value={60}>每 60 分钟</option>
                </select>
              </>
            }
            consoleProps={{
              activeJob: orphanJobs.activeJob,
              activeRunning: orphanJobs.activeRunning,
              progressValue: orphanJobs.progressValue,
              countersText: buildOrphanCountersText(orphanJobs.activeJob),
              liveText: orphanJobs.liveText,
              prettyText: orphanJobs.result ? buildOrphanCleanupPrettyText(orphanJobs.result) : "",
              jobs: orphanJobs.sortedJobs,
              jobLoading: orphanJobs.jobLoading,
              onSelectJob: orphanJobs.selectJob,
              onRetryJob: (jobId) => {
                void orphanJobs.retryJob(jobId);
              },
              waitingPrettyText: "等待 orphan 清理结果...",
              emptyHistoryText: "暂无 orphan 清理任务。",
            }}
          />
        </div>

        <div className="rounded-2xl border border-black/10 bg-[#f8fafc] p-4">
          <div className="text-[13px] font-semibold text-black/82">移动端失效引用修复</div>
          <div className="mt-1 text-[12px] leading-[1.6] text-black/56">
            清理已删除产品在移动端历史里的残留引用，避免 compare 与历史页继续报 Product not found。
          </div>
          <WorkbenchTaskSection
            errorMessage={mobileRefJobs.errorMessage}
            onRefresh={() => {
              void mobileRefJobs.refreshJobs();
            }}
            refreshDisabled={mobileRefJobs.jobsLoading}
            refreshLabel={mobileRefJobs.jobsLoading ? "刷新中..." : "刷新引用修复任务"}
            onCancelActive={() => {
              void mobileRefJobs.cancelActiveJob();
            }}
            cancelActiveDisabled={mobileRefJobs.jobLoading || !mobileRefJobs.activeRunning || !mobileRefJobs.activeJob}
            cancelActiveLabel="中止当前引用修复任务"
            toolbarExtra={
              <>
                <button
                  type="button"
                  onClick={() => void startMobileRefCleanup(true)}
                  disabled={mobileRefJobs.jobLoading || mobileRefJobs.activeRunning}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-black/14 bg-white px-5 text-[13px] font-semibold text-black/78 disabled:opacity-45"
                >
                  {mobileRefJobs.jobLoading && !mobileRefJobs.activeRunning ? "提交中..." : "扫描失效引用"}
                </button>
                <button
                  type="button"
                  onClick={() => void startMobileRefCleanup(false)}
                  disabled={mobileRefJobs.jobLoading || mobileRefJobs.activeRunning}
                  className="inline-flex h-10 items-center justify-center rounded-full bg-[#0a84ff] px-5 text-[13px] font-semibold text-white disabled:bg-[#0a84ff]/35"
                >
                  {mobileRefJobs.jobLoading && !mobileRefJobs.activeRunning ? "提交中..." : "一键修复失效引用"}
                </button>
              </>
            }
            consoleProps={{
              activeJob: mobileRefJobs.activeJob,
              activeRunning: mobileRefJobs.activeRunning,
              progressValue: mobileRefJobs.progressValue,
              countersText: buildMobileRefCountersText(mobileRefJobs.activeJob),
              liveText: mobileRefJobs.liveText,
              prettyText: mobileRefJobs.result ? buildMobileRefCleanupPrettyText(mobileRefJobs.result) : "",
              jobs: mobileRefJobs.sortedJobs,
              jobLoading: mobileRefJobs.jobLoading,
              onSelectJob: mobileRefJobs.selectJob,
              onRetryJob: (jobId) => {
                void mobileRefJobs.retryJob(jobId);
              },
              waitingPrettyText: "等待引用修复结果...",
              emptyHistoryText: "暂无引用修复任务。",
            }}
          />
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-black/10 bg-[#f8fafc] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[13px] font-semibold text-black/82">维护设置</div>
            <div className="mt-1 text-[12px] text-black/56">图片打包下载仍保留直连下载，不走 jobs。</div>
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen((prev) => !prev)}
            className="inline-flex h-9 items-center justify-center rounded-full border border-black/14 bg-white px-4 text-[12px] font-semibold text-black/78"
          >
            {settingsOpen ? "收起设置" : "展开设置"}
          </button>
        </div>
        {settingsOpen ? (
          <div className="mt-3 rounded-xl border border-black/10 bg-white p-3">
            <div className="text-[12px] font-semibold text-black/78">一键下载全部图片</div>
            <div className="mt-1 text-[12px] text-black/56">按当前产品索引引用打包图片资源，便于线下核查。</div>
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
            {downloadError ? <div className="mt-2 whitespace-pre-wrap text-[12px] text-[#b42318]">{downloadError}</div> : null}
          </div>
        ) : null}
      </div>

      <div className="mt-5 rounded-2xl border border-black/10 bg-[#fbfcff] p-4">
        <div className="text-[13px] font-semibold text-black/82">批量删产品（后台任务）</div>
        <div className="mt-1 text-[12px] leading-[1.6] text-black/56">
          直接把当前勾选提交到后台删除任务，失败可重试，取消会暴露已完成的部分结果，不再假装全成或全败。
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="按 ID/品牌/名称检索"
            className="h-10 rounded-xl border border-black/12 bg-white px-3 text-[13px] outline-none focus:border-black/35"
          />
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
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
            <input
              type="checkbox"
              checked={onlyInvalid}
              onChange={(event) => setOnlyInvalid(event.target.checked)}
              className="h-4 w-4"
            />
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
            onClick={() => void deleteSelectedProducts()}
            disabled={productDeleteJobs.jobLoading || productDeleteJobs.activeRunning || selectedIds.length === 0}
            className="inline-flex h-9 items-center justify-center rounded-full border border-[#ef4444]/40 bg-[#fff5f5] px-4 text-[12px] font-semibold text-[#b42318] disabled:opacity-50"
          >
            {productDeleteJobs.jobLoading && !productDeleteJobs.activeRunning ? "提交中..." : `删除勾选 (${selectedIds.length})`}
          </button>
          <span className="text-[12px] text-black/58">当前筛选 {filteredProducts.length} 条</span>
        </div>

        <WorkbenchTaskSection
          errorMessage={productDeleteJobs.errorMessage}
          onRefresh={() => {
            void productDeleteJobs.refreshJobs();
          }}
          refreshDisabled={productDeleteJobs.jobsLoading}
          refreshLabel={productDeleteJobs.jobsLoading ? "刷新中..." : "刷新删除任务"}
          onCancelActive={() => {
            void productDeleteJobs.cancelActiveJob();
          }}
          cancelActiveDisabled={productDeleteJobs.jobLoading || !productDeleteJobs.activeRunning || !productDeleteJobs.activeJob}
          cancelActiveLabel="中止当前删除任务"
          consoleProps={{
            activeJob: productDeleteJobs.activeJob,
            activeRunning: productDeleteJobs.activeRunning,
            progressValue: productDeleteJobs.progressValue,
            countersText: buildProductDeleteCountersText(productDeleteJobs.activeJob),
            liveText: productDeleteJobs.liveText,
            prettyText: productDeleteJobs.result ? buildProductDeletePrettyText(productDeleteJobs.result) : "",
            jobs: productDeleteJobs.sortedJobs,
            jobLoading: productDeleteJobs.jobLoading,
            onSelectJob: productDeleteJobs.selectJob,
            onRetryJob: (jobId) => {
              void productDeleteJobs.retryJob(jobId);
            },
            waitingPrettyText: "等待删除结果...",
            emptyHistoryText: "暂无批量删产品任务。",
          }}
        />

        <div className="mt-4 max-h-[360px] space-y-2 overflow-auto pr-1">
          {filteredProducts.map((item) => {
            const checked = selectedIds.includes(item.id);
            const reasons = invalidReasons(item);
            return (
              <label key={item.id} className="flex items-start gap-2 rounded-lg border border-black/10 bg-white p-2.5">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => toggleSelect(item.id, event.target.checked)}
                  className="mt-1 h-4 w-4"
                />
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

function buildOrphanCountersText(job: ProductWorkbenchJob | null): string | null {
  if (!job) return null;
  return `images 扫描 ${job.counters.scanned_images} · orphan ${job.counters.orphan_images} · 删除 ${job.counters.deleted_images} · runs 扫描 ${job.counters.scanned_runs} · orphan ${job.counters.orphan_runs} · 删除 ${job.counters.deleted_runs} · tmp_uploads 扫描 ${job.counters.scanned_tmp_uploads} · orphan ${job.counters.orphan_tmp_uploads} · 删除 ${job.counters.deleted_tmp_uploads}`;
}

function buildMobileRefCountersText(job: ProductWorkbenchJob | null): string | null {
  if (!job) return null;
  return `invalid ${job.counters.invalid} · repaired ${job.counters.repaired}`;
}

function buildProductDeleteCountersText(job: ProductWorkbenchJob | null): string | null {
  if (!job) return null;
  return `deleted ${job.counters.deleted} · skipped ${job.counters.skipped} · missing ${job.counters.missing} · removed_files ${job.counters.removed_files} · removed_dirs ${job.counters.removed_dirs}`;
}

function parseOrphanCleanupResult(value: Record<string, unknown> | undefined): OrphanStorageCleanupResponse | null {
  if (!value || typeof value !== "object") return null;
  const images = isRecord(value.images) ? value.images : ({} as Record<string, unknown>);
  const runs = isRecord(value.runs) ? value.runs : ({} as Record<string, unknown>);
  const tmpUploads = isRecord(value.tmp_uploads) ? value.tmp_uploads : ({} as Record<string, unknown>);
  const status = String(value.status || "").trim();
  if (!status) return null;
  return {
    status,
    dry_run: Boolean(value.dry_run),
    min_age_minutes: Number(value.min_age_minutes || 0),
    max_delete: Number(value.max_delete || 0),
    images: {
      scanned_images: Number(images.scanned_images || 0),
      kept_images: Number(images.kept_images || 0),
      orphan_images: Number(images.orphan_images || 0),
      deleted_images: Number(images.deleted_images || 0),
      orphan_paths: Array.isArray(images.orphan_paths) ? images.orphan_paths.map(String) : [],
      deleted_paths: Array.isArray(images.deleted_paths) ? images.deleted_paths.map(String) : [],
    },
    runs: {
      scanned_runs: Number(runs.scanned_runs || 0),
      kept_runs: Number(runs.kept_runs || 0),
      orphan_runs: Number(runs.orphan_runs || 0),
      deleted_runs: Number(runs.deleted_runs || 0),
      deleted_run_files: Number(runs.deleted_run_files || 0),
      orphan_run_dirs: Array.isArray(runs.orphan_run_dirs) ? runs.orphan_run_dirs.map(String) : [],
      deleted_run_dirs: Array.isArray(runs.deleted_run_dirs) ? runs.deleted_run_dirs.map(String) : [],
    },
    tmp_uploads: {
      scanned_tmp_uploads: Number(tmpUploads.scanned_tmp_uploads || 0),
      kept_tmp_uploads: Number(tmpUploads.kept_tmp_uploads || 0),
      orphan_tmp_uploads: Number(tmpUploads.orphan_tmp_uploads || 0),
      deleted_tmp_uploads: Number(tmpUploads.deleted_tmp_uploads || 0),
      orphan_tmp_paths: Array.isArray(tmpUploads.orphan_tmp_paths) ? tmpUploads.orphan_tmp_paths.map(String) : [],
      deleted_tmp_paths: Array.isArray(tmpUploads.deleted_tmp_paths) ? tmpUploads.deleted_tmp_paths.map(String) : [],
    },
  };
}

function parseMobileInvalidProductRefCleanupResult(
  value: Record<string, unknown> | undefined,
): MobileInvalidProductRefCleanupResponse | null {
  if (!value || typeof value !== "object") return null;
  const status = String(value.status || "").trim();
  if (!status) return null;
  return {
    status,
    dry_run: Boolean(value.dry_run),
    product_count: Number(value.product_count || 0),
    total_invalid: Number(value.total_invalid || 0),
    total_repaired: Number(value.total_repaired || 0),
    selection_sessions: parseMobileRefScope(value.selection_sessions),
    bag_items: parseMobileRefScope(value.bag_items),
    compare_usage_stats: parseMobileRefScope(value.compare_usage_stats),
  };
}

function parseProductBatchDeleteResult(value: Record<string, unknown> | undefined): ProductBatchDeleteResponse | null {
  if (!value || typeof value !== "object") return null;
  const status = String(value.status || "").trim();
  if (!status) return null;
  return {
    status,
    deleted_ids: Array.isArray(value.deleted_ids) ? value.deleted_ids.map(String) : [],
    skipped_ids: Array.isArray(value.skipped_ids) ? value.skipped_ids.map(String) : [],
    missing_ids: Array.isArray(value.missing_ids) ? value.missing_ids.map(String) : [],
    removed_files: Number(value.removed_files || 0),
    removed_dirs: Number(value.removed_dirs || 0),
  };
}

function parseMobileRefScope(value: unknown): MobileInvalidProductRefCleanupResponse["selection_sessions"] {
  const scope = isRecord(value) ? value : ({} as Record<string, unknown>);
  return {
    scanned: Number(scope.scanned || 0),
    invalid: Number(scope.invalid || 0),
    repaired: Number(scope.repaired || 0),
    sample_refs: Array.isArray(scope.sample_refs) ? scope.sample_refs.map(String) : [],
  };
}

function buildOrphanCleanupPrettyText(result: OrphanStorageCleanupResponse): string {
  const lines: string[] = [];
  lines.push(`状态: ${result.status}`);
  lines.push(`模式: ${result.dry_run ? "预览" : "真实清理"}`);
  lines.push(`安全窗口: ${result.min_age_minutes} 分钟`);
  lines.push(`images: scanned=${result.images.scanned_images}, orphan=${result.images.orphan_images}, deleted=${result.images.deleted_images}`);
  lines.push(`runs: scanned=${result.runs.scanned_runs}, orphan=${result.runs.orphan_runs}, deleted=${result.runs.deleted_runs}`);
  lines.push(`tmp_uploads: scanned=${result.tmp_uploads.scanned_tmp_uploads}, orphan=${result.tmp_uploads.orphan_tmp_uploads}, deleted=${result.tmp_uploads.deleted_tmp_uploads}`);
  if (result.images.orphan_paths.length > 0) {
    lines.push("");
    lines.push("orphan 图片样本:");
    for (const path of result.images.orphan_paths.slice(0, 8)) {
      lines.push(`- ${path}`);
    }
  }
  if (result.runs.orphan_run_dirs.length > 0) {
    lines.push("");
    lines.push("orphan runs 样本:");
    for (const path of result.runs.orphan_run_dirs.slice(0, 8)) {
      lines.push(`- ${path}`);
    }
  }
  if (result.tmp_uploads.orphan_tmp_paths.length > 0) {
    lines.push("");
    lines.push("orphan tmp_uploads 样本:");
    for (const path of result.tmp_uploads.orphan_tmp_paths.slice(0, 8)) {
      lines.push(`- ${path}`);
    }
  }
  return lines.join("\n");
}

function buildMobileRefCleanupPrettyText(result: MobileInvalidProductRefCleanupResponse): string {
  const lines: string[] = [];
  lines.push(`状态: ${result.status}`);
  lines.push(`模式: ${result.dry_run ? "扫描" : "修复"}`);
  lines.push(`total_invalid=${result.total_invalid}, total_repaired=${result.total_repaired}`);
  lines.push(
    `selection_sessions: scanned=${result.selection_sessions.scanned}, invalid=${result.selection_sessions.invalid}, repaired=${result.selection_sessions.repaired}`,
  );
  lines.push(`bag_items: scanned=${result.bag_items.scanned}, invalid=${result.bag_items.invalid}, repaired=${result.bag_items.repaired}`);
  lines.push(
    `compare_usage_stats: scanned=${result.compare_usage_stats.scanned}, invalid=${result.compare_usage_stats.invalid}, repaired=${result.compare_usage_stats.repaired}`,
  );
  const samples = [
    ...result.selection_sessions.sample_refs,
    ...result.bag_items.sample_refs,
    ...result.compare_usage_stats.sample_refs,
  ];
  if (samples.length > 0) {
    lines.push("");
    lines.push("失效引用样本:");
    for (const item of samples.slice(0, 10)) {
      lines.push(`- ${item}`);
    }
  }
  return lines.join("\n");
}

function buildProductDeletePrettyText(result: ProductBatchDeleteResponse): string {
  const lines: string[] = [];
  lines.push(`状态: ${result.status}`);
  lines.push(`deleted=${result.deleted_ids.length}, skipped=${result.skipped_ids.length}, missing=${result.missing_ids.length}`);
  lines.push(`removed_files=${result.removed_files}, removed_dirs=${result.removed_dirs}`);
  if (result.deleted_ids.length > 0) {
    lines.push("");
    lines.push("已删除产品:");
    for (const id of result.deleted_ids.slice(0, 20)) {
      lines.push(`- ${id}`);
    }
  }
  if (result.missing_ids.length > 0) {
    lines.push("");
    lines.push("缺失产品:");
    for (const id of result.missing_ids.slice(0, 10)) {
      lines.push(`- ${id}`);
    }
  }
  return lines.join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
