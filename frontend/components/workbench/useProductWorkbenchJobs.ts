"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProductWorkbenchJob, ProductWorkbenchJobCancelResponse } from "@/lib/api";

type ProductWorkbenchJobStatus = ProductWorkbenchJob["status"];

type ProductWorkbenchJobListParams = {
  status?: ProductWorkbenchJobStatus;
  offset?: number;
  limit?: number;
};

const ACTIVE_JOB_STATUSES: ProductWorkbenchJobStatus[] = ["queued", "running", "cancelling"];
const TERMINAL_JOB_STATUSES: ProductWorkbenchJobStatus[] = ["done", "failed", "cancelled"];

export type ProductWorkbenchJobService<TCreatePayload> = {
  listJobs: (params?: ProductWorkbenchJobListParams) => Promise<ProductWorkbenchJob[]>;
  fetchJob: (jobId: string) => Promise<ProductWorkbenchJob>;
  createJob: (payload: TCreatePayload) => Promise<ProductWorkbenchJob>;
  cancelJob: (jobId: string) => Promise<ProductWorkbenchJobCancelResponse>;
  retryJob: (jobId: string) => Promise<ProductWorkbenchJob>;
};

type UseProductWorkbenchJobsOptions<TCreatePayload, TResult> = {
  storageKey: string;
  service: ProductWorkbenchJobService<TCreatePayload>;
  parseResult: (value: Record<string, unknown> | undefined) => TResult | null;
  listLimit?: number;
  listPollIntervalMs?: number;
  activePollIntervalMs?: number;
};

export type UseProductWorkbenchJobsState<TCreatePayload, TResult> = {
  jobLoading: boolean;
  jobsLoading: boolean;
  errorMessage: string | null;
  setErrorMessage: (value: string | null) => void;
  jobs: ProductWorkbenchJob[];
  sortedJobs: ProductWorkbenchJob[];
  activeJob: ProductWorkbenchJob | null;
  activeRunning: boolean;
  progressValue: number;
  liveText: string;
  result: TResult | null;
  resultJobId: string | null;
  refreshJobs: () => Promise<void>;
  startJob: (payload: TCreatePayload) => Promise<ProductWorkbenchJob | null>;
  cancelActiveJob: () => Promise<ProductWorkbenchJob | null>;
  retryJob: (jobId: string) => Promise<ProductWorkbenchJob | null>;
  selectJob: (job: ProductWorkbenchJob) => void;
  clearResult: () => void;
};

export function useProductWorkbenchJobs<TCreatePayload, TResult>({
  storageKey,
  service,
  parseResult,
  listLimit = 30,
  listPollIntervalMs = 2800,
  activePollIntervalMs = 2200,
}: UseProductWorkbenchJobsOptions<TCreatePayload, TResult>): UseProductWorkbenchJobsState<TCreatePayload, TResult> {
  const [jobLoading, setJobLoading] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [jobs, setJobs] = useState<ProductWorkbenchJob[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<ProductWorkbenchJob | null>(null);
  const [result, setResult] = useState<TResult | null>(null);
  const [resultJobId, setResultJobId] = useState<string | null>(null);
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

  const applyParsedResult = useCallback((job: ProductWorkbenchJob, parsed: TResult | null) => {
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
        const running = rows.find((item) => ACTIVE_JOB_STATUSES.includes(item.status));
        if (running) rememberActiveJob(running.job_id);
      }
      const latestDone = rows.find((item) => item.status === "done" && item.result && typeof item.result === "object");
      if (latestDone) {
        const parsed = parseResult(latestDone.result as Record<string, unknown>);
        applyParsedResult(latestDone, parsed);
      }
    } catch (err) {
      setErrorMessage(formatErrorDetail(err));
      setJobs([]);
    } finally {
      setJobsLoading(false);
    }
  }, [activeJobId, applyParsedResult, listLimit, parseResult, rememberActiveJob, service]);

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
        if (job.result && typeof job.result === "object") {
          const parsed = parseResult(job.result as Record<string, unknown>);
          applyParsedResult(job, parsed);
        }
        if (TERMINAL_JOB_STATUSES.includes(job.status)) {
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
  }, [activeJobId, activePollIntervalMs, applyParsedResult, clearActiveJob, loadJobs, parseResult, service]);

  const startJob = useCallback(
    async (payload: TCreatePayload): Promise<ProductWorkbenchJob | null> => {
      setJobLoading(true);
      setErrorMessage(null);
      try {
        const job = await service.createJob(payload);
        setActiveJob(job);
        rememberActiveJob(job.job_id);
        await loadJobs();
        return job;
      } catch (err) {
        setErrorMessage(formatErrorDetail(err));
        return null;
      } finally {
        setJobLoading(false);
      }
    },
    [loadJobs, rememberActiveJob, service],
  );

  const cancelActiveJob = useCallback(async (): Promise<ProductWorkbenchJob | null> => {
    if (!activeJob) return null;
    setJobLoading(true);
    setErrorMessage(null);
    try {
      const resp = await service.cancelJob(activeJob.job_id);
      setActiveJob(resp.job);
      await loadJobs();
      return resp.job;
    } catch (err) {
      setErrorMessage(formatErrorDetail(err));
      return null;
    } finally {
      setJobLoading(false);
    }
  }, [activeJob, loadJobs, service]);

  const retryJob = useCallback(
    async (jobId: string): Promise<ProductWorkbenchJob | null> => {
      setJobLoading(true);
      setErrorMessage(null);
      try {
        const job = await service.retryJob(jobId);
        setActiveJob(job);
        rememberActiveJob(job.job_id);
        await loadJobs();
        return job;
      } catch (err) {
        setErrorMessage(formatErrorDetail(err));
        return null;
      } finally {
        setJobLoading(false);
      }
    },
    [loadJobs, rememberActiveJob, service],
  );

  const selectJob = useCallback(
    (job: ProductWorkbenchJob) => {
      setActiveJob(job);
      if (ACTIVE_JOB_STATUSES.includes(job.status)) {
        rememberActiveJob(job.job_id);
      }
    },
    [rememberActiveJob],
  );

  const refreshJobs = useCallback(async () => {
    await loadJobs();
  }, [loadJobs]);

  const sortedJobs = useMemo(
    () => [...jobs].sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || ""))),
    [jobs],
  );
  const activeRunning = Boolean(activeJob && ACTIVE_JOB_STATUSES.includes(activeJob.status));
  const progressValue = Math.max(0, Math.min(100, Number(activeJob?.percent || 0)));
  const liveText = activeJob?.logs?.join("\n") || "";

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
    liveText,
    result,
    resultJobId,
    refreshJobs,
    startJob,
    cancelActiveJob,
    retryJob,
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
