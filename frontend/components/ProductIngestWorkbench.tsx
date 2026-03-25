"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import WorkbenchTaskSection from "@/components/workbench/WorkbenchTaskSection";
import {
  WorkbenchLiveTextState,
  createWorkbenchStatusHandlers,
  createEmptyLiveTextState,
  useProductWorkbenchJobs,
} from "@/components/workbench/useProductWorkbenchJobs";
import {
  cancelUploadIngestJob,
  createUploadIngestJob,
  fetchUploadIngestJob,
  ingestProduct,
  listUploadIngestJobs,
  resumeUploadIngestJob,
  retryUploadIngestJobs,
  retryUploadIngestJob,
  UploadIngestJob,
  UploadIngestJobBatchRetryResponse,
  UploadIngestJobCancelResponse,
} from "@/lib/api";

const ACTIVE_JOB_STORAGE_KEY = "upload-ingest-active-job-id";

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

type ModelTier = "mini" | "lite" | "pro";

type ResumeDraft = {
  image: File | null;
  category: string;
  brand: string;
  name: string;
};

type PreviewModalState = {
  src: string;
  title: string;
} | null;

type IngestResultLike = {
  id?: string;
  status?: string;
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
};

type UploadCreatePayload = Parameters<typeof createUploadIngestJob>[0];
type UploadResumePayload = Parameters<typeof resumeUploadIngestJob>[0];

const EMPTY_DRAFT: ResumeDraft = {
  image: null,
  category: "",
  brand: "",
  name: "",
};

const UPLOAD_JOB_STATUS_HANDLERS = createWorkbenchStatusHandlers<UploadIngestJob>({
  running: ["queued", "running", "cancelling"],
  terminal: ["done", "failed", "cancelled"],
  keepActive: ["queued", "running", "waiting_more", "cancelling"],
});

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
  const [pairAsSingleProduct, setPairAsSingleProduct] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [batchRetrying, setBatchRetrying] = useState(false);
  const [previewModal, setPreviewModal] = useState<PreviewModalState>(null);
  const [resumeDrafts, setResumeDrafts] = useState<Record<string, ResumeDraft>>({});
  const [manualResult, setManualResult] = useState<IngestResultLike | null>(null);

  const jobService = useMemo(
    () => ({
      listJobs: listUploadIngestJobs,
      fetchJob: fetchUploadIngestJob,
      createJob: createUploadIngestJob,
      cancelJob: cancelUploadIngestJob,
      retryJob: retryUploadIngestJob,
      resumeJob: resumeUploadIngestJob,
    }),
    [],
  );

  const {
    jobLoading,
    jobsLoading,
    errorMessage,
    setErrorMessage,
    sortedJobs,
    activeJob,
    activeRunning,
    progressValue,
    liveText,
    prettyText,
    result,
    refreshJobs,
    startJobs,
    cancelJob,
    retryJob,
    resumeJob,
    selectJob,
  } = useProductWorkbenchJobs<
    UploadCreatePayload,
    IngestResultLike,
    UploadIngestJob,
    UploadIngestJobCancelResponse,
    UploadResumePayload
  >({
    storageKey: ACTIVE_JOB_STORAGE_KEY,
    listLimit: 60,
    listPollIntervalMs: 2200,
    activePollIntervalMs: 2200,
    service: jobService,
    parseResult: parseUploadResult,
    ...UPLOAD_JOB_STATUS_HANDLERS,
    assembleLiveText: assembleUploadLiveText,
    formatPrettyText: ({ activeJob: current }) => buildUploadPrettyText(current),
  });

  const canSubmit = useMemo(() => {
    if (submitting || jobLoading) return false;
    if (images.length === 0) return false;
    if (!useJsonOverride && source === "doubao" && pairAsSingleProduct) {
      return images.length >= 2 && images.length % 2 === 0;
    }
    if (useJsonOverride) return !!jsonText.trim();
    return true;
  }, [images.length, jsonText, jobLoading, pairAsSingleProduct, source, submitting, useJsonOverride]);

  const latestModels = useMemo(() => {
    for (const item of sortedJobs) {
      const models = item.models || {};
      const vision = typeof models.vision === "string" ? models.vision : null;
      const struct = typeof models.struct === "string" ? models.struct : null;
      if (vision || struct) {
        return { stage1: vision, stage2: struct };
      }
    }
    return { stage1: null as string | null, stage2: null as string | null };
  }, [sortedJobs]);

  const retryableFailedJobs = useMemo(
    () => sortedJobs.filter((job) => (job.status === "failed" || job.status === "cancelled") && job.can_retry),
    [sortedJobs],
  );

  function updateResumeDraft(jobId: string, patch: Partial<ResumeDraft>) {
    setResumeDrafts((prev) => ({
      ...prev,
      [jobId]: {
        ...(prev[jobId] || EMPTY_DRAFT),
        ...patch,
      },
    }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setErrorMessage(null);

    if (source === "doubao" && !useJsonOverride) {
      setManualResult(null);
      if (pairAsSingleProduct && images.length % 2 !== 0) {
        setErrorMessage("双图同品模式要求图片数量为偶数（每 2 张图组成 1 个任务）。");
        return;
      }

      const payloads = pairAsSingleProduct
        ? buildPairPayloads(images, stage1ModelTier, stage2ModelTier)
        : images.map((image) => ({
            image,
            stage1ModelTier,
            stage2ModelTier,
          }));
      const total = payloads.length;
      const { jobs: createdJobs, errors } = await startJobs(payloads);
      if (errors.length > 0) {
        setErrorMessage(buildCreateBatchError(createdJobs.length, total, errors));
      }
      return;
    }

    setSubmitting(true);
    setManualResult(null);
    try {
      const ingestResult = await ingestProduct({
        image: images[0] || undefined,
        category: useJsonOverride ? category : undefined,
        brand: useJsonOverride ? brand.trim() || undefined : undefined,
        name: useJsonOverride ? name.trim() || undefined : undefined,
        source,
        metaJson: useJsonOverride ? jsonText.trim() || undefined : undefined,
        stage1ModelTier,
        stage2ModelTier,
      });
      setManualResult(ingestResult);
      await refreshJobs();
    } catch (err) {
      setErrorMessage(formatError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResumeJob(job: UploadIngestJob) {
    if (!resumeJob) return;
    const draft = resumeDrafts[job.job_id] || EMPTY_DRAFT;
    const resumed = await resumeJob({
      jobId: job.job_id,
      image: draft.image,
      category: draft.category.trim() || undefined,
      brand: draft.brand.trim() || undefined,
      name: draft.name.trim() || undefined,
    });
    if (resumed) {
      setResumeDrafts((prev) => ({ ...prev, [job.job_id]: EMPTY_DRAFT }));
    }
  }

  async function handleBatchRetryJobs() {
    const jobIds = retryableFailedJobs.map((job) => job.job_id);
    if (jobIds.length === 0) return;

    setBatchRetrying(true);
    setErrorMessage(null);
    try {
      const summary = await retryUploadIngestJobs(jobIds);
      if (summary.retried_jobs[0]) {
        selectJob(summary.retried_jobs[0]);
      }
      await refreshJobs();
      if (summary.failed_items.length > 0) {
        setErrorMessage(buildUploadBatchRetrySummary(summary));
      }
    } catch (err) {
      setErrorMessage(formatError(err));
    } finally {
      setBatchRetrying(false);
    }
  }

  return (
    <section
      id="product-ingest-workbench"
      className="mt-8 rounded-[30px] border border-black/10 bg-gradient-to-br from-[#f8fbff] via-white to-[#f2f8f1] p-6"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">
          Stage A · 上传与成分解析（后台任务）
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
        上传先落盘到暂存区，再统一转换 webp/jpg，随后进入 Stage1/Stage2。支持终止任务、补拍续跑、单条/批量失败重试与刷新恢复。
      </p>

      <form onSubmit={onSubmit} className="mt-5 space-y-5 rounded-[24px] border border-black/10 bg-white p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-black/72">来源模式</span>
            <select
              value={source}
              onChange={(event) => setSource(event.target.value as "manual" | "doubao" | "auto")}
              className="h-11 rounded-xl border border-black/12 bg-white px-3 text-[14px] text-black/86 outline-none focus:border-black/35"
            >
              <option value="doubao">doubao（后台任务）</option>
              <option value="manual">manual（手工 JSON 优先）</option>
              <option value="auto">auto（自动）</option>
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-black/72">Stage1 模型档位</span>
            <select
              value={stage1ModelTier}
              onChange={(event) => setStage1ModelTier(event.target.value as ModelTier)}
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
              onChange={(event) => setStage2ModelTier(event.target.value as ModelTier)}
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
            onChange={(event) => setImages(Array.from(event.target.files || []))}
            className="h-11 rounded-xl border border-black/12 bg-white px-3 py-2 text-[13px] text-black/76 file:mr-3 file:rounded-lg file:border-0 file:bg-black/6 file:px-2.5 file:py-1.5 file:text-[12px] file:font-medium"
          />
          {images.length > 0 ? (
            <div className="rounded-xl border border-black/8 bg-black/[0.02] px-3 py-2 text-[12px] text-black/66">
              已选 {images.length} 张{pairAsSingleProduct ? `（预计创建 ${Math.floor(images.length / 2)} 个双图任务）` : ""}：{images.map((file) => file.name).join("、")}
            </div>
          ) : null}
          {!useJsonOverride && source === "doubao" ? (
            <label className="mt-1 inline-flex items-center gap-2 text-[12px] text-black/66">
              <input
                type="checkbox"
                checked={pairAsSingleProduct}
                onChange={(event) => setPairAsSingleProduct(event.target.checked)}
                className="h-4 w-4 rounded border border-black/25"
              />
              双图同品分析（每 2 张图作为同一产品，直接进入双图 Stage1）
            </label>
          ) : null}
          <div className="text-[12px] text-black/52">状态覆盖：queued / uploading / converting / stage1 / stage2 / waiting_more / cancelling / cancelled / done / failed。</div>
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2.5 text-[13px] text-black/78">
          <input
            type="checkbox"
            checked={useJsonOverride}
            onChange={(event) => setUseJsonOverride(event.target.checked)}
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
                  onChange={(event) => setCategory(event.target.value)}
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
                  onChange={(event) => setBrand(event.target.value)}
                  className="h-11 rounded-xl border border-black/12 bg-white px-3 text-[14px] text-black/86 outline-none placeholder:text-black/30 focus:border-black/35"
                  placeholder="如：CeraVe"
                />
              </label>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-black/72">产品名（可选）</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-11 rounded-xl border border-black/12 bg-white px-3 text-[14px] text-black/86 outline-none placeholder:text-black/30 focus:border-black/35"
                placeholder="如：温和保湿沐浴露"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold text-black/72">产品 JSON（必填）</span>
              <textarea
                value={jsonText}
                onChange={(event) => setJsonText(event.target.value)}
                className="min-h-[220px] rounded-2xl border border-black/12 bg-white px-3 py-2.5 text-[13px] leading-[1.6] text-black/82 outline-none placeholder:text-black/30 focus:border-black/35"
                placeholder={SAMPLE_JSON}
              />
            </label>
          </>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex h-11 items-center justify-center rounded-full bg-black px-6 text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-black/25"
          >
            {submitting || jobLoading ? "提交中..." : "上传到后端"}
          </button>
        </div>

        <WorkbenchTaskSection
          errorMessage={errorMessage}
          onRefresh={() => {
            void refreshJobs();
          }}
          refreshDisabled={jobsLoading}
          refreshLabel={jobsLoading ? "刷新中..." : "刷新任务"}
          onCancelActive={
            activeJob && canCancelUploadJob(activeJob)
              ? () => {
                  void cancelJob(activeJob.job_id);
                }
              : undefined
          }
          cancelActiveDisabled={!activeJob || !canCancelUploadJob(activeJob) || activeJob.status === "cancelling" || jobLoading}
          cancelActiveLabel={activeJob?.status === "cancelling" ? "取消中..." : "中止当前任务"}
          toolbarExtra={
            retryableFailedJobs.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  void handleBatchRetryJobs();
                }}
                disabled={jobLoading || jobsLoading || batchRetrying}
                className="inline-flex h-10 items-center justify-center rounded-full border border-[#3151d8]/30 bg-[#eef2ff] px-5 text-[13px] font-semibold text-[#3151d8] disabled:opacity-45"
              >
                {batchRetrying ? "批量重试中..." : `批量重试失败任务（${retryableFailedJobs.length}）`}
              </button>
            ) : null
          }
          consoleProps={{
            activeJob,
            activeRunning,
            progressValue,
            countersText: buildUploadCountersText(activeJob),
            liveText,
            prettyText,
            jobs: sortedJobs,
            jobLoading,
            onSelectJob: selectJob,
            onCancelJob: (jobId) => {
              void cancelJob(jobId);
            },
            canCancelJob: canCancelUploadJob,
            onRetryJob: (jobId) => {
              void retryJob(jobId);
            },
            canRetryJob: (job) => Boolean(job.can_retry),
            waitingLogText: "等待 Stage 文本...",
            waitingPrettyText: "等待格式化结果...",
            emptyHistoryText: "暂无上传任务。",
            liveTitle: "实时文本",
            prettyTitle: "格式化文本",
            renderActiveMeta: (job) => renderUploadActiveMeta(job),
            renderActiveBody: (job) =>
              renderUploadJobBody({
                job,
                draft: resumeDrafts[job.job_id] || EMPTY_DRAFT,
                onChangeDraft: updateResumeDraft,
                onPreview: setPreviewModal,
                onResume: handleResumeJob,
                canResume: Boolean(resumeJob) && Boolean(job.can_resume),
                jobLoading,
              }),
            renderJobActions: (job) => renderUploadJobLinks(job),
            renderJobBody: (job) =>
              renderUploadJobBody({
                job,
                draft: resumeDrafts[job.job_id] || EMPTY_DRAFT,
                onChangeDraft: updateResumeDraft,
                onPreview: setPreviewModal,
                onResume: handleResumeJob,
                canResume: Boolean(resumeJob) && Boolean(job.can_resume),
                jobLoading,
              }),
          }}
        />

        {manualResult || result ? (
          <div className="rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3.5 text-[13px] leading-[1.65] text-black/76">
            <pre className="whitespace-pre-wrap">{buildIngestResultSummary((manualResult || result) as IngestResultLike)}</pre>
          </div>
        ) : null}
      </form>

      {previewModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
          onClick={() => setPreviewModal(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-black/8 px-4 py-3">
              <div className="truncate text-[13px] font-medium text-black/82">{previewModal.title}</div>
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                className="inline-flex h-8 items-center justify-center rounded-full border border-black/12 bg-white px-3 text-[12px] font-semibold text-black/72"
              >
                关闭
              </button>
            </div>
            <div className="max-h-[calc(90vh-56px)] overflow-auto bg-black/5 p-3">
              <Image
                src={previewModal.src}
                alt={previewModal.title}
                width={1920}
                height={1920}
                unoptimized
                className="mx-auto h-auto max-h-[78vh] w-auto max-w-full rounded-lg bg-white shadow-sm"
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function buildPairPayloads(
  images: File[],
  stage1ModelTier: ModelTier,
  stage2ModelTier: ModelTier,
): UploadCreatePayload[] {
  const payloads: UploadCreatePayload[] = [];
  for (let index = 0; index < images.length; index += 2) {
    payloads.push({
      image: images[index],
      supplementImage: images[index + 1],
      stage1ModelTier,
      stage2ModelTier,
    });
  }
  return payloads;
}

function parseUploadResult(job: UploadIngestJob): IngestResultLike | null {
  if (!job.result || typeof job.result !== "object") return null;
  return job.result as IngestResultLike;
}

function assembleUploadLiveText(job: UploadIngestJob | null): WorkbenchLiveTextState {
  if (!job) return createEmptyLiveTextState();
  const sections: string[] = [];
  const stage1Block = buildUploadLiveStageBlock("Stage1", job.stage1_text, job.stage1_reasoning_text);
  const stage2Block = buildUploadLiveStageBlock("Stage2", job.stage2_text, job.stage2_reasoning_text);
  if (stage1Block) sections.push(stage1Block);
  if (stage2Block) sections.push(stage2Block);
  if (job.error?.detail) sections.push(`【错误】\n${job.error.detail}`);
  if (sections.length === 0) {
    const fallback = [job.stage_label || job.stage || "待命", job.message || ""].filter(Boolean).join(" | ");
    if (fallback) sections.push(fallback);
  }
  return {
    text: sections.join("\n\n"),
    meta: { jobId: job.job_id },
  };
}

function buildUploadLiveStageBlock(
  title: string,
  outputText?: string | null,
  reasoningText?: string | null,
): string | null {
  const sections: string[] = [];
  const output = String(outputText || "").trim();
  const reasoning = String(reasoningText || "").trim();
  if (output) sections.push(`模型输出（response.output_text）\n${output}`);
  if (reasoning) sections.push(`思考摘要（response.reasoning_summary_text）\n${reasoning}`);
  if (sections.length === 0) return null;
  return `【${title}】\n${sections.join("\n\n")}`;
}

function buildUploadPrettyText(job: UploadIngestJob | null): string {
  if (!job) return "";
  const blocks: string[] = [];
  if (job.stage1_text) {
    const stage1 = toVisionSections(job.stage1_text)
      .map((section) => `【${section.title}】\n${section.body || "未识别"}`)
      .join("\n\n");
    blocks.push(`Stage1\n${stage1}`);
  }
  if (job.stage2_text) {
    blocks.push(`Stage2\n${toPrettyStructText(job.stage2_text)}`);
  }
  if (job.status === "waiting_more") {
    blocks.push(`待补拍/补录\n${(job.missing_fields || []).map((field) => missingFieldLabel(field)).join("、") || "关键信息"}`);
  }
  return blocks.join("\n\n");
}

function buildUploadCountersText(job: UploadIngestJob | null): string | null {
  if (!job) return null;
  const imageCount = Array.isArray(job.image_paths) ? job.image_paths.length : 0;
  const fields = (job.missing_fields || []).map((field) => missingFieldLabel(field)).join("、");
  const parts = [
    imageCount > 0 ? `已转存图片 ${imageCount}` : null,
    job.stage1_model_tier ? `Stage1 档位 ${job.stage1_model_tier}` : null,
    job.stage2_model_tier ? `Stage2 档位 ${job.stage2_model_tier}` : null,
    fields ? `待补字段 ${fields}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function renderUploadActiveMeta(job: UploadIngestJob) {
  return (
    <div className="space-y-1 text-[12px] text-black/58">
      {job.required_view ? <div>建议补拍：{job.required_view}</div> : null}
      {job.artifact_context_lost ? (
        <div className="text-[#b42318]">上传暂存上下文已丢失，详见下方阻断原因。</div>
      ) : null}
      {(job.temp_preview_url || job.supplement_temp_preview_url) && !job.artifact_context_lost ? (
        <div>暂存预览已保留，可在当前任务或历史任务中放大查看。</div>
      ) : null}
    </div>
  );
}

function canCancelUploadJob(job: UploadIngestJob): boolean {
  return job.status === "queued" || job.status === "running" || job.status === "waiting_more" || job.status === "cancelling";
}

function renderUploadJobLinks(job: UploadIngestJob) {
  const resultId = getIngestResultId(job.result);
  return (
    <>
      {resultId ? (
        <Link
          href={`/product/${resultId}`}
          className="inline-flex h-8 items-center rounded-full border border-black/14 bg-white px-3 text-[12px] font-semibold text-black/78"
        >
          查看详情
        </Link>
      ) : null}
    </>
  );
}

function renderUploadJobBody({
  job,
  draft,
  onChangeDraft,
  onPreview,
  onResume,
  canResume,
  jobLoading,
}: {
  job: UploadIngestJob;
  draft: ResumeDraft;
  onChangeDraft: (jobId: string, patch: Partial<ResumeDraft>) => void;
  onPreview: (value: PreviewModalState) => void;
  onResume: (job: UploadIngestJob) => void;
  canResume: boolean;
  jobLoading: boolean;
}) {
  const resultId = getIngestResultId(job.result);
  const actionBlockedDetail = job.artifact_context_lost ? job.artifact_context_detail || "上传暂存上下文已丢失，当前任务不可继续。" : null;
  return (
    <div className="space-y-2">
      <div className="text-[12px] text-black/58">
        stage: {job.stage || "-"} · 入库ID: {resultId || "-"}
      </div>

      {job.temp_preview_url || job.supplement_temp_preview_url ? (
        <div className="rounded-xl border border-black/10 bg-black/[0.02] p-2.5">
          <div className="text-[11px] font-medium text-black/62">暂存区图片（任务成功后自动删除）</div>
          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
            {job.temp_preview_url ? (
              <button
                type="button"
                onClick={() => onPreview({ src: job.temp_preview_url as string, title: `${job.file_name || "upload"} · 主图` })}
                className="overflow-hidden rounded-lg border border-black/10 bg-white text-left"
              >
                <Image
                  src={job.temp_preview_url}
                  alt={`${job.file_name || "upload"} 主图`}
                  width={320}
                  height={160}
                  unoptimized
                  className="h-20 w-full object-cover"
                />
                <div className="px-2 py-1 text-[11px] text-black/64">主图（点击放大）</div>
              </button>
            ) : null}
            {job.supplement_temp_preview_url ? (
              <button
                type="button"
                onClick={() => onPreview({ src: job.supplement_temp_preview_url as string, title: `${job.file_name || "upload"} · 补图` })}
                className="overflow-hidden rounded-lg border border-black/10 bg-white text-left"
              >
                <Image
                  src={job.supplement_temp_preview_url}
                  alt={`${job.file_name || "upload"} 补图`}
                  width={320}
                  height={160}
                  unoptimized
                  className="h-20 w-full object-cover"
                />
                <div className="px-2 py-1 text-[11px] text-black/64">补图（点击放大）</div>
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {actionBlockedDetail ? (
        <div className="rounded-xl border border-[#ef4444]/30 bg-[#fff5f5] p-2.5">
          <div className="text-[12px] font-semibold text-[#b42318]">当前任务上下文已失效</div>
          <div className="mt-1 whitespace-pre-wrap text-[12px] leading-[1.55] text-[#b42318]">{actionBlockedDetail}</div>
        </div>
      ) : null}

      {job.status === "waiting_more" && !actionBlockedDetail ? (
        <div className="rounded-xl border border-[#f3c178]/40 bg-[#fff8ef] p-2.5">
          <div className="text-[12px] font-semibold text-[#9b5a00]">待补拍/补录：{(job.missing_fields || []).map((field) => missingFieldLabel(field)).join("、") || "关键信息"}</div>
          <div className="mt-1 text-[12px] text-black/66">建议：{job.required_view || "补拍另一面"}</div>

          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
            <select
              value={draft.category}
              onChange={(event) => onChangeDraft(job.job_id, { category: event.target.value })}
              className="h-9 rounded-lg border border-black/12 bg-white px-2.5 text-[12px]"
            >
              <option value="">补录类别（可选）</option>
              {CATEGORIES.map((item) => (
                <option key={`${job.job_id}-${item.value}`} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <input
              value={draft.brand}
              onChange={(event) => onChangeDraft(job.job_id, { brand: event.target.value })}
              placeholder="补录品牌（可选）"
              className="h-9 rounded-lg border border-black/12 bg-white px-2.5 text-[12px]"
            />
            <input
              value={draft.name}
              onChange={(event) => onChangeDraft(job.job_id, { name: event.target.value })}
              placeholder="补录产品名（可选）"
              className="h-9 rounded-lg border border-black/12 bg-white px-2.5 text-[12px]"
            />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="file"
              accept="image/*"
              onChange={(event) => onChangeDraft(job.job_id, { image: event.target.files?.[0] || null })}
              className="h-8 rounded-lg border border-black/12 bg-white px-2 text-[12px] text-black/76 file:mr-2 file:rounded file:border-0 file:bg-black/6 file:px-2 file:py-1 file:text-[11px]"
            />
            <button
              type="button"
              disabled={!canResume || jobLoading}
              onClick={() => onResume(job)}
              className="inline-flex h-8 items-center justify-center rounded-full bg-black px-3 text-[12px] font-semibold text-white disabled:bg-black/25"
            >
              {jobLoading ? "继续处理中..." : "继续分析"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function buildCreateBatchError(successCount: number, total: number, errors: string[]): string {
  const lines = [`任务创建完成：${successCount}/${total} 成功，${errors.length} 失败。`];
  for (const item of errors.slice(0, 3)) {
    lines.push(item);
  }
  return lines.join("\n");
}

function buildUploadBatchRetrySummary(summary: UploadIngestJobBatchRetryResponse): string {
  const lines = [`批量重试结果：${summary.retried}/${summary.requested} 已重新入队，${summary.failed} 仍失败。`];
  for (const item of summary.failed_items.slice(0, 3)) {
    lines.push(`${item.job_id}: ${item.detail}`);
  }
  return lines.join("\n");
}

function buildIngestResultSummary(result: IngestResultLike): string {
  const lines = [
    `状态：${result.status || "-"}`,
    `入库 ID：${result.id || "-"}`,
    `模式：${result.mode || "-"}`,
    `品类：${result.category || "-"}`,
    `图片：${result.image_path || "-"}`,
    `JSON：${result.json_path || "-"}`,
  ];
  if (result.doubao) {
    lines.push("");
    lines.push(`Doubao 流程：${result.doubao.pipeline_mode || "-"}`);
    lines.push(`模型：vision=${result.doubao.models?.vision || "-"} / struct=${result.doubao.models?.struct || "-"}`);
    lines.push(`落盘(阶段1)：${result.doubao.artifacts?.vision || "-"}`);
    lines.push(`落盘(阶段2)：${result.doubao.artifacts?.struct || "-"}`);
    lines.push(`落盘(context)：${result.doubao.artifacts?.context || "-"}`);
  }
  return lines.join("\n");
}

function getIngestResultId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const id = (value as IngestResultLike).id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
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

function missingFieldLabel(field: string): string {
  if (field === "brand") return "品牌";
  if (field === "name") return "产品名";
  if (field === "category") return "产品类别";
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
  return sections.filter((item) => item.title || item.body);
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
