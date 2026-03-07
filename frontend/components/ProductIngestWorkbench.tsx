"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  cancelUploadIngestJob,
  createUploadIngestJob,
  ingestProduct,
  listUploadIngestJobs,
  retryUploadIngestJob,
  resumeUploadIngestJob,
  UploadIngestJob,
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

const EMPTY_DRAFT: ResumeDraft = {
  image: null,
  category: "",
  brand: "",
  name: "",
};

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
  const [jobsLoading, setJobsLoading] = useState(false);
  const [resumingJobId, setResumingJobId] = useState<string | null>(null);
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);
  const [previewModal, setPreviewModal] = useState<PreviewModalState>(null);

  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IngestResultLike | null>(null);
  const [uploadJobs, setUploadJobs] = useState<UploadIngestJob[]>([]);
  const [resumeDrafts, setResumeDrafts] = useState<Record<string, ResumeDraft>>({});

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (images.length === 0) return false;
    if (!useJsonOverride && source === "doubao" && pairAsSingleProduct) {
      return images.length >= 2 && images.length % 2 === 0;
    }
    if (useJsonOverride) return !!jsonText.trim();
    return true;
  }, [images.length, jsonText, pairAsSingleProduct, source, submitting, useJsonOverride]);

  const sortedJobs = useMemo(
    () => [...uploadJobs].sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || ""))),
    [uploadJobs],
  );

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

  const refreshJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const rows = await listUploadIngestJobs({ limit: 60, offset: 0 });
      setUploadJobs(rows);
      const latestDone = rows
        .filter((item) => item.status === "done" && item.result && typeof item.result === "object")
        .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")))[0];
      if (latestDone && latestDone.result && typeof latestDone.result === "object") {
        setResult(latestDone.result as IngestResultLike);
      }
    } catch (err) {
      setError(formatError(err));
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshJobs();
    const timer = window.setInterval(() => {
      void refreshJobs();
    }, 2200);
    return () => window.clearInterval(timer);
  }, [refreshJobs]);

  function updateResumeDraft(jobId: string, patch: Partial<ResumeDraft>) {
    setResumeDrafts((prev) => ({
      ...prev,
      [jobId]: {
        ...(prev[jobId] || EMPTY_DRAFT),
        ...patch,
      },
    }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    try {
      if (source === "doubao" && !useJsonOverride) {
        let ok = 0;
        let fail = 0;
        if (pairAsSingleProduct) {
          if (images.length % 2 !== 0) {
            setError("双图同品模式要求图片数量为偶数（每 2 张图组成 1 个任务）。");
            return;
          }
          const pairCount = Math.floor(images.length / 2);
          for (let i = 0; i < images.length; i += 2) {
            try {
              await createUploadIngestJob({
                image: images[i],
                supplementImage: images[i + 1],
                stage1ModelTier,
                stage2ModelTier,
              });
              ok += 1;
            } catch (err) {
              fail += 1;
              setError(formatError(err));
            }
          }
          await refreshJobs();
          if (fail > 0) {
            setError(`任务创建完成：${ok}/${pairCount} 成功，${fail} 失败。`);
          }
          return;
        }
        for (const image of images) {
          try {
            await createUploadIngestJob({
              image,
              stage1ModelTier,
              stage2ModelTier,
            });
            ok += 1;
          } catch (err) {
            fail += 1;
            setError(formatError(err));
          }
        }
        await refreshJobs();
        if (fail > 0) {
          setError(`任务创建完成：${ok}/${images.length} 成功，${fail} 失败。`);
        }
        return;
      }

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
      setResult(ingestResult);
      await refreshJobs();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelJob(jobId: string) {
    setCancellingJobId(jobId);
    setError(null);
    try {
      await cancelUploadIngestJob(jobId);
      await refreshJobs();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setCancellingJobId(null);
    }
  }

  async function resumeJob(job: UploadIngestJob) {
    const draft = resumeDrafts[job.job_id] || EMPTY_DRAFT;
    setResumingJobId(job.job_id);
    setError(null);
    try {
      await resumeUploadIngestJob({
        jobId: job.job_id,
        image: draft.image,
        category: draft.category.trim() || undefined,
        brand: draft.brand.trim() || undefined,
        name: draft.name.trim() || undefined,
      });
      setResumeDrafts((prev) => ({ ...prev, [job.job_id]: EMPTY_DRAFT }));
      await refreshJobs();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setResumingJobId(null);
    }
  }

  async function retryJob(jobId: string) {
    setRetryingJobId(jobId);
    setError(null);
    try {
      await retryUploadIngestJob(jobId);
      await refreshJobs();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setRetryingJobId(null);
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
        上传先落盘到暂存区，再统一转换 webp/jpg，随后进入 Stage1/Stage2。支持终止任务、孤儿任务自动收敛、刷新后恢复进度。
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
              <option value="doubao">doubao（后台任务）</option>
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
              已选 {images.length} 张{pairAsSingleProduct ? `（预计创建 ${Math.floor(images.length / 2)} 个双图任务）` : ""}：{images.map((f) => f.name).join("、")}
            </div>
          ) : null}
          {!useJsonOverride && source === "doubao" ? (
            <label className="mt-1 inline-flex items-center gap-2 text-[12px] text-black/66">
              <input
                type="checkbox"
                checked={pairAsSingleProduct}
                onChange={(e) => setPairAsSingleProduct(e.target.checked)}
                className="h-4 w-4 rounded border border-black/25"
              />
              双图同品分析（每 2 张图作为同一产品，直接进入双图 Stage1）
            </label>
          ) : null}
          <div className="text-[12px] text-black/52">状态覆盖：上传中、转换中、Stage1、Stage2、待补拍/补录。</div>
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

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex h-11 items-center justify-center rounded-full bg-black px-6 text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-black/25"
          >
            {submitting ? "提交中..." : "上传到后端"}
          </button>
          <button
            type="button"
            onClick={() => void refreshJobs()}
            disabled={jobsLoading}
            className="inline-flex h-11 items-center justify-center rounded-full border border-black/12 bg-white px-5 text-[13px] font-semibold text-black/78 disabled:opacity-45"
          >
            {jobsLoading ? "刷新中..." : "刷新任务"}
          </button>
        </div>

        {error ? <p className="text-[13px] leading-[1.5] text-[#b42318]">{error}</p> : null}

        <div className="rounded-2xl border border-[#8ea3ff]/30 bg-[#eef2ff] p-4">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-semibold text-black/82">后台任务进度</span>
            <span className="text-black/58">共 {sortedJobs.length} 条</span>
          </div>
          <div className="mt-3 space-y-3">
            {sortedJobs.map((job) => {
              const resultObj = job.result && typeof job.result === "object" ? (job.result as IngestResultLike) : null;
              const draft = resumeDrafts[job.job_id] || EMPTY_DRAFT;
              const running = job.status === "queued" || job.status === "running" || job.status === "cancelling";
              return (
                <article key={job.job_id} className="rounded-xl border border-black/10 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="truncate text-[13px] font-medium text-black/82">{job.file_name || "upload"}</div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClassName(job)}`}>
                      {statusLabel(job)}
                    </span>
                  </div>

                  <div className="mt-1 text-[12px] text-black/58">
                    job_id: {job.job_id} | stage: {job.stage || "-"} | 入库ID: {resultObj?.id || "-"}
                  </div>

                  <div className="mt-2 text-[12px] text-black/64">{job.stage_label || job.stage || "处理中"} · {job.message || "-"}</div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10">
                    <div className="h-full rounded-full bg-black transition-all" style={{ width: `${Math.max(0, Math.min(100, Number(job.percent || 0)))}%` }} />
                  </div>

                  {job.error ? <div className="mt-2 text-[12px] text-[#b42318]">{job.error.detail}</div> : null}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {running ? (
                      <button
                        type="button"
                        onClick={() => void cancelJob(job.job_id)}
                        disabled={job.status === "cancelling" || cancellingJobId === job.job_id}
                        className="inline-flex h-8 items-center justify-center rounded-full border border-[#ef4444]/40 bg-[#fff5f5] px-3 text-[12px] font-semibold text-[#b42318] disabled:opacity-45"
                      >
                        {job.status === "cancelling" || cancellingJobId === job.job_id ? "取消中..." : "终止任务"}
                      </button>
                    ) : null}

                    {!running && job.can_retry ? (
                      <button
                        type="button"
                        onClick={() => void retryJob(job.job_id)}
                        disabled={retryingJobId === job.job_id}
                        className="inline-flex h-8 items-center justify-center rounded-full border border-[#3151d8]/30 bg-[#eef2ff] px-3 text-[12px] font-semibold text-[#3151d8] disabled:opacity-45"
                      >
                        {retryingJobId === job.job_id ? "重试中..." : "失败重试"}
                      </button>
                    ) : null}

                    {resultObj?.id ? (
                      <Link
                        href={`/product/${resultObj.id}`}
                        className="inline-flex h-8 items-center rounded-full border border-black/14 bg-white px-3 text-[12px] font-semibold text-black/78"
                      >
                        查看详情
                      </Link>
                    ) : null}
                  </div>

                  {job.temp_preview_url || job.supplement_temp_preview_url ? (
                    <div className="mt-2 rounded-xl border border-black/10 bg-black/[0.02] p-2.5">
                      <div className="text-[11px] font-medium text-black/62">暂存区图片（任务成功后自动删除）</div>
                      <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                        {job.temp_preview_url ? (
                          <button
                            type="button"
                            onClick={() => setPreviewModal({ src: job.temp_preview_url as string, title: `${job.file_name || "upload"} · 主图` })}
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
                            onClick={() =>
                              setPreviewModal({ src: job.supplement_temp_preview_url as string, title: `${job.file_name || "upload"} · 补图` })
                            }
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

                  {job.status === "waiting_more" ? (
                    <div className="mt-2 rounded-xl border border-[#f3c178]/40 bg-[#fff8ef] p-2.5">
                      <div className="text-[12px] font-semibold text-[#9b5a00]">待补拍/补录：{(job.missing_fields || []).map((field) => missingFieldLabel(field)).join("、") || "关键信息"}</div>
                      <div className="mt-1 text-[12px] text-black/66">建议：{job.required_view || "补拍另一面"}</div>

                      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                        <select
                          value={draft.category}
                          onChange={(e) => updateResumeDraft(job.job_id, { category: e.target.value })}
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
                          onChange={(e) => updateResumeDraft(job.job_id, { brand: e.target.value })}
                          placeholder="补录品牌（可选）"
                          className="h-9 rounded-lg border border-black/12 bg-white px-2.5 text-[12px]"
                        />
                        <input
                          value={draft.name}
                          onChange={(e) => updateResumeDraft(job.job_id, { name: e.target.value })}
                          placeholder="补录产品名（可选）"
                          className="h-9 rounded-lg border border-black/12 bg-white px-2.5 text-[12px]"
                        />
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) => updateResumeDraft(job.job_id, { image: event.target.files?.[0] || null })}
                          className="h-8 rounded-lg border border-black/12 bg-white px-2 text-[12px] text-black/76 file:mr-2 file:rounded file:border-0 file:bg-black/6 file:px-2 file:py-1 file:text-[11px]"
                        />
                        <button
                          type="button"
                          disabled={resumingJobId === job.job_id}
                          onClick={() => void resumeJob(job)}
                          className="inline-flex h-8 items-center justify-center rounded-full bg-black px-3 text-[12px] font-semibold text-white disabled:bg-black/25"
                        >
                          {resumingJobId === job.job_id ? "继续处理中..." : "继续分析"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {job.stage1_text ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[12px] font-medium text-black/76">Stage1 实时文本（美化）</summary>
                      <div className="mt-2 rounded-xl border border-black/10 bg-[#fbfcff] p-2.5">
                        {toVisionSections(job.stage1_text).map((section, idx) => (
                          <div key={`${section.title}-${idx}`} className="mb-2 last:mb-0">
                            <div className="text-[11px] font-semibold text-[#3151d8]">{section.title}</div>
                            <pre className="mt-0.5 whitespace-pre-wrap text-[12px] leading-[1.55] text-black/74">{section.body || "未识别"}</pre>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}

                  {job.stage2_text ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[12px] font-medium text-black/76">Stage2 实时文本（格式化）</summary>
                      <pre className="mt-2 max-h-72 overflow-auto rounded-xl border border-black/10 bg-[#f8fafc] p-2.5 text-[12px] leading-[1.55] text-black/74 whitespace-pre-wrap">
                        {toPrettyStructText(job.stage2_text)}
                      </pre>
                    </details>
                  ) : null}
                </article>
              );
            })}
            {sortedJobs.length === 0 ? <div className="text-[12px] text-black/52">暂无上传任务。</div> : null}
          </div>
        </div>

        {result ? (
          <div className="rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3.5 text-[13px] leading-[1.65] text-black/76">
            <div>状态：{result.status || "-"}</div>
            <div>入库 ID：{result.id || "-"}</div>
            <div>模式：{result.mode || "-"}</div>
            <div>品类：{result.category || "-"}</div>
            <div>图片：{result.image_path || "-"}</div>
            <div>JSON：{result.json_path || "-"}</div>
            {result.doubao ? (
              <>
                <div className="mt-2 border-t border-black/8 pt-2">Doubao 流程：{result.doubao.pipeline_mode || "-"}</div>
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

function formatError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function statusLabel(job: UploadIngestJob): string {
  if (job.status === "done") return "成功";
  if (job.status === "failed") return "失败";
  if (job.status === "cancelled") return "已取消";
  if (job.status === "cancelling") return "取消中";
  if (job.status === "waiting_more") return "待补拍";
  if (job.status === "queued") return "排队中";
  const stage = String(job.stage || "").toLowerCase();
  if (stage === "queued") return "排队中";
  if (stage === "uploading") return "上传中";
  if (stage === "converting") return "转换中";
  if (stage === "stage1") return "Stage1";
  if (stage === "stage2") return "Stage2";
  return "进行中";
}

function statusClassName(job: UploadIngestJob): string {
  if (job.status === "done") return "bg-[#e7f6ec] text-[#027a48]";
  if (job.status === "failed") return "bg-[#fdebec] text-[#b42318]";
  if (job.status === "cancelled" || job.status === "cancelling") return "bg-[#ffeceb] text-[#b42318]";
  if (job.status === "waiting_more") return "bg-[#fff4e6] text-[#9b5a00]";
  if (job.status === "queued") return "bg-[#eef2ff] text-[#3151d8]";
  const stage = String(job.stage || "").toLowerCase();
  if (stage === "queued" || stage === "uploading" || stage === "converting" || stage === "stage1" || stage === "stage2") {
    return "bg-[#eef2ff] text-[#3151d8]";
  }
  return "bg-black/6 text-black/60";
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
