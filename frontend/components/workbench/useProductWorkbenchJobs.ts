"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProductWorkbenchJob, ProductWorkbenchJobCancelResponse } from "@/lib/api";

type ProductWorkbenchJobStatus = ProductWorkbenchJob["status"];

export type WorkbenchJobStatusConfig<TStatus extends string = ProductWorkbenchJobStatus> = {
  running: readonly TStatus[];
  terminal: readonly TStatus[];
  keepActive?: readonly TStatus[];
};

export type WorkbenchJobLike = {
  status: string;
  job_id: string;
  stage?: string | null;
  stage_label?: string | null;
  message?: string | null;
  live_text?: string | null;
  percent?: number | null;
  current_index?: number | null;
  current_total?: number | null;
  result?: unknown;
  error?: { detail?: string | null } | null;
  created_at: string;
  updated_at: string;
};

type ProductWorkbenchJobListParams<TStatus extends string = ProductWorkbenchJobStatus> = {
  status?: TStatus;
  offset?: number;
  limit?: number;
};

const ACTIVE_JOB_STATUSES: ProductWorkbenchJobStatus[] = ["queued", "running", "cancelling"];
const TERMINAL_JOB_STATUSES: ProductWorkbenchJobStatus[] = ["done", "failed", "cancelled"];

export type WorkbenchLiveTextState = {
  text: string;
  meta: Record<string, unknown>;
};

export type ProductWorkbenchJobService<
  TCreatePayload,
  TJob extends WorkbenchJobLike = ProductWorkbenchJob,
  TCancelResponse = ProductWorkbenchJobCancelResponse,
  TResumePayload = never,
> = {
  listJobs: (params?: ProductWorkbenchJobListParams<TJob["status"] & string>) => Promise<TJob[]>;
  fetchJob: (jobId: string) => Promise<TJob>;
  createJob: (payload: TCreatePayload) => Promise<TJob>;
  cancelJob: (jobId: string) => Promise<TCancelResponse>;
  retryJob?: (jobId: string) => Promise<TJob>;
  resumeJob?: (payload: TResumePayload) => Promise<TJob>;
};

type UseProductWorkbenchJobsOptions<
  TCreatePayload,
  TResult,
  TJob extends WorkbenchJobLike = ProductWorkbenchJob,
  TCancelResponse = ProductWorkbenchJobCancelResponse,
  TResumePayload = never,
> = {
  storageKey: string;
  service: ProductWorkbenchJobService<TCreatePayload, TJob, TCancelResponse, TResumePayload>;
  parseResult: (job: TJob) => TResult | null;
  listLimit?: number;
  listPollIntervalMs?: number;
  activePollIntervalMs?: number;
  isRunningJob?: (job: TJob) => boolean;
  isTerminalJob?: (job: TJob) => boolean;
  shouldKeepActiveJob?: (job: TJob) => boolean;
  extractCancelledJob?: (response: TCancelResponse) => TJob;
  assembleLiveText?: (job: TJob | null, previous: WorkbenchLiveTextState) => WorkbenchLiveTextState;
  formatCountersText?: (job: TJob | null) => string | null;
  formatPrettyText?: (context: {
    result: TResult | null;
    resultJobId: string | null;
    activeJob: TJob | null;
    jobs: TJob[];
  }) => string;
};

export type UseProductWorkbenchJobsState<
  TCreatePayload,
  TResult,
  TJob extends WorkbenchJobLike = ProductWorkbenchJob,
  TResumePayload = never,
> = {
  jobLoading: boolean;
  jobsLoading: boolean;
  errorMessage: string | null;
  setErrorMessage: (value: string | null) => void;
  jobs: TJob[];
  sortedJobs: TJob[];
  activeJob: TJob | null;
  activeRunning: boolean;
  progressValue: number;
  countersText: string | null;
  liveText: string;
  prettyText: string;
  result: TResult | null;
  resultJobId: string | null;
  refreshJobs: () => Promise<void>;
  startJob: (payload: TCreatePayload) => Promise<TJob | null>;
  startJobs: (payloads: TCreatePayload[]) => Promise<{ jobs: TJob[]; errors: string[] }>;
  cancelJob: (jobId: string) => Promise<TJob | null>;
  cancelActiveJob: () => Promise<TJob | null>;
  retryJob: (jobId: string) => Promise<TJob | null>;
  resumeJob?: (payload: TResumePayload) => Promise<TJob | null>;
  selectJob: (job: TJob) => void;
  clearResult: () => void;
};

export function createEmptyLiveTextState(): WorkbenchLiveTextState {
  return { text: "", meta: {} };
}

export function createWorkbenchStatusHandlers<
  TJob extends WorkbenchJobLike,
  TStatus extends string = TJob["status"] & string,
>(config: WorkbenchJobStatusConfig<TStatus>) {
  const running = new Set(config.running.map((status) => String(status || "").trim().toLowerCase()));
  const terminal = new Set(config.terminal.map((status) => String(status || "").trim().toLowerCase()));
  const keepActive = config.keepActive
    ? new Set(config.keepActive.map((status) => String(status || "").trim().toLowerCase()))
    : null;

  return {
    isRunningJob: (job: TJob) => running.has(String(job.status || "").trim().toLowerCase()),
    isTerminalJob: (job: TJob) => terminal.has(String(job.status || "").trim().toLowerCase()),
    shouldKeepActiveJob: (job: TJob) => {
      const value = String(job.status || "").trim().toLowerCase();
      if (keepActive) return keepActive.has(value);
      return !terminal.has(value);
    },
  };
}

function defaultIsRunningJob(job: WorkbenchJobLike): boolean {
  return ACTIVE_JOB_STATUSES.includes(job.status as ProductWorkbenchJobStatus);
}

function defaultIsTerminalJob(job: WorkbenchJobLike): boolean {
  return TERMINAL_JOB_STATUSES.includes(job.status as ProductWorkbenchJobStatus);
}

function defaultShouldKeepActiveJob(job: WorkbenchJobLike): boolean {
  return !defaultIsTerminalJob(job);
}

function defaultExtractCancelledJob<TJob extends WorkbenchJobLike, TCancelResponse>(response: TCancelResponse): TJob {
  if (response && typeof response === "object" && "job" in response) {
    return (response as { job: TJob }).job;
  }
  return response as unknown as TJob;
}

function defaultAssembleLiveText<TJob extends WorkbenchJobLike>(
  job: TJob | null,
  previous: WorkbenchLiveTextState,
): WorkbenchLiveTextState {
  if (!job) return createEmptyLiveTextState();
  const liveText = String(job.live_text || "").trim();
  if (liveText) {
    return {
      text: liveText,
      meta: { jobId: job.job_id, source: "backend_live_text" },
    };
  }
  if ("logs" in job && Array.isArray((job as { logs?: unknown }).logs)) {
    return {
      text: ((job as { logs: string[] }).logs || []).join("\n"),
      meta: { jobId: job.job_id },
    };
  }
  const message = String(job.message || "").trim();
  if (!message) {
    if (String(previous.meta.jobId || "") === job.job_id) return previous;
    return { text: "", meta: { jobId: job.job_id } };
  }
  return { text: message, meta: { jobId: job.job_id } };
}

export function useProductWorkbenchJobs<
  TCreatePayload,
  TResult,
  TJob extends WorkbenchJobLike = ProductWorkbenchJob,
  TCancelResponse = ProductWorkbenchJobCancelResponse,
  TResumePayload = never,
>({
  storageKey,
  service,
  parseResult,
  listLimit = 30,
  listPollIntervalMs = 2800,
  activePollIntervalMs = 2200,
  isRunningJob = defaultIsRunningJob as (job: TJob) => boolean,
  isTerminalJob = defaultIsTerminalJob as (job: TJob) => boolean,
  shouldKeepActiveJob = defaultShouldKeepActiveJob as (job: TJob) => boolean,
  extractCancelledJob = defaultExtractCancelledJob as (response: TCancelResponse) => TJob,
  assembleLiveText = defaultAssembleLiveText as (job: TJob | null, previous: WorkbenchLiveTextState) => WorkbenchLiveTextState,
  formatCountersText,
  formatPrettyText,
}: UseProductWorkbenchJobsOptions<TCreatePayload, TResult, TJob, TCancelResponse, TResumePayload>): UseProductWorkbenchJobsState<
  TCreatePayload,
  TResult,
  TJob,
  TResumePayload
> {
  const [jobLoading, setJobLoading] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [jobs, setJobs] = useState<TJob[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<TJob | null>(null);
  const [result, setResult] = useState<TResult | null>(null);
  const [resultJobId, setResultJobId] = useState<string | null>(null);
  const [liveTextState, setLiveTextState] = useState<WorkbenchLiveTextState>(createEmptyLiveTextState);
  const resultSignatureRef = useRef<string | null>(null);
  const loadJobsPromiseRef = useRef<Promise<void> | null>(null);
  const serviceRef = useRef(service);
  const parseResultRef = useRef(parseResult);
  const isTerminalJobRef = useRef(isTerminalJob);
  const shouldKeepActiveJobRef = useRef(shouldKeepActiveJob);
  const extractCancelledJobRef = useRef(extractCancelledJob);
  const assembleLiveTextRef = useRef(assembleLiveText);
  const activeJobIdRef = useRef<string | null>(activeJobId);
  const activeJobRef = useRef<TJob | null>(activeJob);

  serviceRef.current = service;
  parseResultRef.current = parseResult;
  isTerminalJobRef.current = isTerminalJob;
  shouldKeepActiveJobRef.current = shouldKeepActiveJob;
  extractCancelledJobRef.current = extractCancelledJob;
  assembleLiveTextRef.current = assembleLiveText;
  activeJobIdRef.current = activeJobId;
  activeJobRef.current = activeJob;

  const rememberActiveJob = useCallback(
    (jobId: string) => {
      const value = String(jobId || "").trim();
      if (!value) return;
      window.localStorage.setItem(storageKey, value);
      setActiveJobId(value);
    },
    [storageKey],
  );

  const clearActiveJob = useCallback(() => {
    window.localStorage.removeItem(storageKey);
    setActiveJobId(null);
  }, [storageKey]);

  const applyParsedResult = useCallback((job: TJob, parsed: TResult | null) => {
    if (!parsed) return;
    const signature = `${job.job_id}:${job.updated_at}:${job.status}`;
    if (resultSignatureRef.current === signature) return;
    resultSignatureRef.current = signature;
    setResult(parsed);
    setResultJobId(job.job_id);
  }, []);

  const clearResult = useCallback(() => {
    resultSignatureRef.current = null;
    setResult(null);
    setResultJobId(null);
  }, []);

  const loadJobs = useCallback(async () => {
    if (loadJobsPromiseRef.current) return loadJobsPromiseRef.current;

    const task = (async () => {
      setJobsLoading(true);
      try {
        const rows = await serviceRef.current.listJobs({ limit: listLimit, offset: 0 });
        setJobs(rows);
        if (!activeJobIdRef.current) {
          const running = rows.find((item) => shouldKeepActiveJobRef.current(item));
          if (running) rememberActiveJob(running.job_id);
        }
        const latestDone = [...rows]
          .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")))
          .find((item) => parseResultRef.current(item) !== null);
        if (latestDone) {
          const parsed = parseResultRef.current(latestDone);
          applyParsedResult(latestDone, parsed);
        }
      } catch (err) {
        setErrorMessage(formatErrorDetail(err));
        setJobs([]);
      } finally {
        setJobsLoading(false);
      }
    })();

    loadJobsPromiseRef.current = task;
    try {
      await task;
    } finally {
      if (loadJobsPromiseRef.current === task) {
        loadJobsPromiseRef.current = null;
      }
    }
  }, [applyParsedResult, listLimit, rememberActiveJob]);

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);
    if (raw && raw.trim()) setActiveJobId(raw.trim());
    void loadJobs();
  }, [loadJobs, storageKey]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadJobs();
    }, listPollIntervalMs);
    return () => window.clearInterval(timer);
  }, [listPollIntervalMs, loadJobs]);

  useEffect(() => {
    if (!activeJobId) {
      setActiveJob(null);
      return;
    }
    let cancelled = false;
    let timer: number | null = null;

    const pull = async () => {
      try {
        const job = await serviceRef.current.fetchJob(activeJobId);
        if (cancelled) return;
        setActiveJob(job);
        const parsed = parseResultRef.current(job);
        applyParsedResult(job, parsed);
        if (isTerminalJobRef.current(job)) {
          clearActiveJob();
          void loadJobs();
          return;
        }
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(formatErrorDetail(err));
      }
      if (cancelled) return;
      timer = window.setTimeout(() => {
        void pull();
      }, activePollIntervalMs);
    };

    void pull();
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [activeJobId, activePollIntervalMs, applyParsedResult, clearActiveJob, loadJobs]);

  useEffect(() => {
    setLiveTextState(createEmptyLiveTextState());
  }, [activeJob?.job_id]);

  useEffect(() => {
    setLiveTextState((previous) => assembleLiveTextRef.current(activeJob, previous));
  }, [activeJob]);

  const startJobs = useCallback(
    async (payloads: TCreatePayload[]): Promise<{ jobs: TJob[]; errors: string[] }> => {
      setJobLoading(true);
      setErrorMessage(null);
      const createdJobs: TJob[] = [];
      const errors: string[] = [];
      try {
        for (const payload of payloads) {
          try {
            const job = await serviceRef.current.createJob(payload);
            createdJobs.push(job);
            setActiveJob(job);
            if (shouldKeepActiveJobRef.current(job)) {
              rememberActiveJob(job.job_id);
            }
          } catch (err) {
            errors.push(formatErrorDetail(err));
          }
        }
        await loadJobs();
        if (errors.length > 0) {
          setErrorMessage(errors[errors.length - 1]);
        }
        return { jobs: createdJobs, errors };
      } finally {
        setJobLoading(false);
      }
    },
    [loadJobs, rememberActiveJob],
  );

  const startJob = useCallback(
    async (payload: TCreatePayload): Promise<TJob | null> => {
      const { jobs: createdJobs } = await startJobs([payload]);
      return createdJobs[0] || null;
    },
    [startJobs],
  );

  const cancelJob = useCallback(async (jobId: string): Promise<TJob | null> => {
    const value = String(jobId || "").trim();
    if (!value) return null;
    setJobLoading(true);
    setErrorMessage(null);
    try {
      const resp = await serviceRef.current.cancelJob(value);
      const job = extractCancelledJobRef.current(resp);
      if (activeJobRef.current?.job_id === value || activeJobIdRef.current === value) {
        setActiveJob(job);
      }
      await loadJobs();
      return job;
    } catch (err) {
      setErrorMessage(formatErrorDetail(err));
      return null;
    } finally {
      setJobLoading(false);
    }
  }, [loadJobs]);

  const cancelActiveJob = useCallback(async (): Promise<TJob | null> => {
    if (!activeJob) return null;
    return cancelJob(activeJob.job_id);
  }, [activeJob, cancelJob]);

  const retryJob = useCallback(
    async (jobId: string): Promise<TJob | null> => {
      const retryImpl = serviceRef.current.retryJob;
      if (!retryImpl) {
        setErrorMessage("当前任务类型不支持重试。");
        return null;
      }
      setJobLoading(true);
      setErrorMessage(null);
      try {
        const job = await retryImpl(jobId);
        setActiveJob(job);
        if (shouldKeepActiveJobRef.current(job)) rememberActiveJob(job.job_id);
        await loadJobs();
        return job;
      } catch (err) {
        setErrorMessage(formatErrorDetail(err));
        return null;
      } finally {
        setJobLoading(false);
      }
    },
    [loadJobs, rememberActiveJob],
  );

  const resumeJob = useCallback(
    async (payload: TResumePayload): Promise<TJob | null> => {
      const resumeImpl = serviceRef.current.resumeJob;
      if (!resumeImpl) {
        setErrorMessage("当前任务类型不支持继续。");
        return null;
      }
      setJobLoading(true);
      setErrorMessage(null);
      try {
        const job = await resumeImpl(payload);
        setActiveJob(job);
        if (shouldKeepActiveJobRef.current(job)) rememberActiveJob(job.job_id);
        await loadJobs();
        return job;
      } catch (err) {
        setErrorMessage(formatErrorDetail(err));
        return null;
      } finally {
        setJobLoading(false);
      }
    },
    [loadJobs, rememberActiveJob],
  );

  const selectJob = useCallback(
    (job: TJob) => {
      setActiveJob(job);
      const parsed = parseResultRef.current(job);
      applyParsedResult(job, parsed);
      if (shouldKeepActiveJobRef.current(job)) {
        rememberActiveJob(job.job_id);
      }
    },
    [applyParsedResult, rememberActiveJob],
  );

  const refreshJobs = useCallback(async () => {
    await loadJobs();
  }, [loadJobs]);

  const sortedJobs = useMemo(
    () => [...jobs].sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || ""))),
    [jobs],
  );
  const activeRunning = Boolean(activeJob && isRunningJob(activeJob));
  const progressValue = Math.max(0, Math.min(100, Number(activeJob?.percent || 0)));
  const liveText = liveTextState.text;
  const countersText = useMemo(() => formatCountersText?.(activeJob) || null, [activeJob, formatCountersText]);
  const prettyText = useMemo(
    () =>
      formatPrettyText?.({
        result,
        resultJobId,
        activeJob,
        jobs: sortedJobs,
      }) || "",
    [activeJob, formatPrettyText, result, resultJobId, sortedJobs],
  );

  return {
    jobLoading,
    jobsLoading,
    errorMessage,
    setErrorMessage,
    jobs,
    sortedJobs,
    activeJob,
    activeRunning,
    progressValue,
    countersText,
    liveText,
    prettyText,
    result,
    resultJobId,
    refreshJobs,
    startJob,
    startJobs,
    cancelJob,
    cancelActiveJob,
    retryJob,
    resumeJob: service.resumeJob ? resumeJob : undefined,
    selectJob,
    clearResult,
  };
}

export function formatErrorDetail(err: unknown): string {
  if (err instanceof TypeError && /fetch/i.test(err.message || "")) {
    return "网络请求失败：浏览器未连到 API。请检查当前域名下的 /api 代理、NEXT_PUBLIC_API_BASE 配置，以及 frontend 是否已按最新配置重建。";
  }
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
