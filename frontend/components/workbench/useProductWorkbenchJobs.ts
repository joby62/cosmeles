"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProductWorkbenchJob, ProductWorkbenchJobCancelResponse } from "@/lib/api";

type ProductWorkbenchJobStatus = ProductWorkbenchJob["status"];

export type WorkbenchJobLike = {
  status: string;
  job_id: string;
  stage?: string | null;
  stage_label?: string | null;
  message?: string | null;
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
    setJobsLoading(true);
    try {
      const rows = await service.listJobs({ limit: listLimit, offset: 0 });
      setJobs(rows);
      if (!activeJobId) {
        const running = rows.find((item) => shouldKeepActiveJob(item));
        if (running) rememberActiveJob(running.job_id);
      }
      const latestDone = [...rows]
        .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")))
        .find((item) => parseResult(item) !== null);
      if (latestDone) {
        const parsed = parseResult(latestDone);
        applyParsedResult(latestDone, parsed);
      }
    } catch (err) {
      setErrorMessage(formatErrorDetail(err));
      setJobs([]);
    } finally {
      setJobsLoading(false);
    }
  }, [activeJobId, applyParsedResult, listLimit, parseResult, rememberActiveJob, service, shouldKeepActiveJob]);

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
        const job = await service.fetchJob(activeJobId);
        if (cancelled) return;
        setActiveJob(job);
        const parsed = parseResult(job);
        applyParsedResult(job, parsed);
        if (isTerminalJob(job)) {
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
  }, [activeJobId, activePollIntervalMs, applyParsedResult, clearActiveJob, isTerminalJob, loadJobs, parseResult, service]);

  useEffect(() => {
    setLiveTextState(createEmptyLiveTextState());
  }, [activeJob?.job_id]);

  useEffect(() => {
    setLiveTextState((previous) => assembleLiveText(activeJob, previous));
  }, [activeJob, assembleLiveText]);

  const startJobs = useCallback(
    async (payloads: TCreatePayload[]): Promise<{ jobs: TJob[]; errors: string[] }> => {
      setJobLoading(true);
      setErrorMessage(null);
      const createdJobs: TJob[] = [];
      const errors: string[] = [];
      try {
        for (const payload of payloads) {
          try {
            const job = await service.createJob(payload);
            createdJobs.push(job);
            setActiveJob(job);
            if (shouldKeepActiveJob(job)) {
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
    [loadJobs, rememberActiveJob, service, shouldKeepActiveJob],
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
      const resp = await service.cancelJob(value);
      const job = extractCancelledJob(resp);
      if (activeJob?.job_id === value || activeJobId === value) {
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
  }, [activeJob?.job_id, activeJobId, extractCancelledJob, loadJobs, service]);

  const cancelActiveJob = useCallback(async (): Promise<TJob | null> => {
    if (!activeJob) return null;
    return cancelJob(activeJob.job_id);
  }, [activeJob, cancelJob]);

  const retryJob = useCallback(
    async (jobId: string): Promise<TJob | null> => {
      if (!service.retryJob) {
        setErrorMessage("当前任务类型不支持重试。");
        return null;
      }
      setJobLoading(true);
      setErrorMessage(null);
      try {
        const job = await service.retryJob(jobId);
        setActiveJob(job);
        if (shouldKeepActiveJob(job)) rememberActiveJob(job.job_id);
        await loadJobs();
        return job;
      } catch (err) {
        setErrorMessage(formatErrorDetail(err));
        return null;
      } finally {
        setJobLoading(false);
      }
    },
    [loadJobs, rememberActiveJob, service, shouldKeepActiveJob],
  );

  const resumeJob = useCallback(
    async (payload: TResumePayload): Promise<TJob | null> => {
      if (!service.resumeJob) {
        setErrorMessage("当前任务类型不支持继续。");
        return null;
      }
      setJobLoading(true);
      setErrorMessage(null);
      try {
        const job = await service.resumeJob(payload);
        setActiveJob(job);
        if (shouldKeepActiveJob(job)) rememberActiveJob(job.job_id);
        await loadJobs();
        return job;
      } catch (err) {
        setErrorMessage(formatErrorDetail(err));
        return null;
      } finally {
        setJobLoading(false);
      }
    },
    [loadJobs, rememberActiveJob, service, shouldKeepActiveJob],
  );

  const selectJob = useCallback(
    (job: TJob) => {
      setActiveJob(job);
      const parsed = parseResult(job);
      applyParsedResult(job, parsed);
      if (shouldKeepActiveJob(job)) {
        rememberActiveJob(job.job_id);
      }
    },
    [applyParsedResult, parseResult, rememberActiveJob, shouldKeepActiveJob],
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
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
