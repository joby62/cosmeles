"use client";

import { ProductWorkbenchJob } from "@/lib/api";

type ProductWorkbenchJobConsoleProps = {
  activeJob: ProductWorkbenchJob | null;
  activeRunning: boolean;
  progressValue: number;
  countersText?: string | null;
  liveText: string;
  prettyText: string;
  jobs: ProductWorkbenchJob[];
  jobLoading: boolean;
  onSelectJob: (job: ProductWorkbenchJob) => void;
  onRetryJob: (jobId: string) => void;
  waitingLogText?: string;
  waitingPrettyText?: string;
  emptyHistoryText?: string;
};

export default function ProductWorkbenchJobConsole({
  activeJob,
  activeRunning,
  progressValue,
  countersText,
  liveText,
  prettyText,
  jobs,
  jobLoading,
  onSelectJob,
  onRetryJob,
  waitingLogText = "等待任务日志...",
  waitingPrettyText = "分析中...",
  emptyHistoryText = "暂无历史任务。",
}: ProductWorkbenchJobConsoleProps) {
  return (
    <>
      <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[13px] font-semibold text-black/82">当前任务</div>
          <div className="text-[12px] text-black/58">
            {activeJob ? `${activeJob.job_id} · ${activeJob.status}` : "暂无运行任务"}
          </div>
        </div>
        <div className="mt-2 text-[12px] text-black/64">
          {activeJob?.stage_label || activeJob?.stage || "待命"} · {activeJob?.message || "等待创建任务"}
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10">
          <div className="h-full rounded-full bg-black transition-all" style={{ width: `${progressValue}%` }} />
        </div>
        <div className="mt-2 text-[12px] text-black/58">
          进度 {progressValue}% · {activeJob?.current_index || 0}/{activeJob?.current_total || 0}
        </div>
        {activeJob && countersText ? <div className="mt-2 text-[12px] text-black/58">{countersText}</div> : null}
      </div>

      {(liveText || prettyText || activeRunning) && (
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-black/10 bg-[#fbfcff] p-2.5">
            <div className="text-[11px] font-semibold text-[#3151d8]">实时文本</div>
            <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap text-[12px] leading-[1.55] text-black/74">
              {liveText || (activeRunning ? waitingLogText : "-")}
            </pre>
          </div>
          <div className="rounded-xl border border-black/10 bg-white p-2.5">
            <div className="text-[11px] font-semibold text-[#3151d8]">最终美化文本</div>
            <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap text-[12px] leading-[1.55] text-black/74">
              {prettyText || (activeRunning ? waitingPrettyText : "-")}
            </pre>
          </div>
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-black/10 bg-[#f8fafc] p-4">
        <div className="text-[13px] font-semibold text-black/82">最近任务</div>
        <div className="mt-3 max-h-[220px] space-y-2 overflow-auto pr-1">
          {jobs.map((job) => {
            const canRetry = job.status === "failed" || job.status === "cancelled";
            return (
              <div key={job.job_id} className="rounded-xl border border-black/10 bg-white px-3 py-2">
                <button
                  type="button"
                  onClick={() => onSelectJob(job)}
                  className="w-full text-left"
                >
                  <div className="truncate text-[12px] font-semibold text-black/78">
                    {job.job_id} · {job.status} · {job.percent}%
                  </div>
                  <div className="mt-0.5 truncate text-[12px] text-black/58">{job.stage_label || job.stage || "-"} · {job.message || "-"}</div>
                  <div className="mt-0.5 text-[11px] text-black/48">updated_at: {job.updated_at}</div>
                </button>
                {canRetry ? (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => onRetryJob(job.job_id)}
                      disabled={jobLoading}
                      className="inline-flex h-8 items-center justify-center rounded-full border border-[#3151d8]/30 bg-[#eef2ff] px-3 text-[12px] font-semibold text-[#3151d8] disabled:opacity-45"
                    >
                      失败重试
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
          {jobs.length === 0 ? <div className="text-[12px] text-black/52">{emptyHistoryText}</div> : null}
        </div>
      </div>
    </>
  );
}
