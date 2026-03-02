"use client";

import { useMemo, useState } from "react";
import { AIRunView, AIJobView, ProductDoc, createAIJob, fetchLatestAIRunByJobId } from "@/lib/api";

type ActionState = {
  loading: boolean;
  job?: AIJobView;
  run?: AIRunView | null;
  outputText?: string;
  error?: string;
};

export default function ProductAIConsole({ productId, doc }: { productId: string; doc: ProductDoc }) {
  const ingredients = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of doc.ingredients || []) {
      const name = String(item?.name || "").trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);
      out.push(name);
    }
    return out;
  }, [doc.ingredients]);

  const [selectedIngredient, setSelectedIngredient] = useState(() => ingredients[0] || "");
  const [ingredientContext, setIngredientContext] = useState(doc.summary?.one_sentence || "");
  const [ingredientState, setIngredientState] = useState<ActionState>({ loading: false });
  const [consistencyState, setConsistencyState] = useState<ActionState>({ loading: false });

  const imageRelPath = normalizeImageRelPath(doc.evidence?.image_path);
  const jsonText = useMemo(() => JSON.stringify(doc, null, 2), [doc]);

  async function runIngredientEnrich() {
    if (!selectedIngredient) {
      setIngredientState({ loading: false, error: "当前产品无可解释的成分。" });
      return;
    }

    setIngredientState((prev) => ({ ...prev, loading: true, error: undefined }));
    try {
      const job = await createAIJob({
        capability: "doubao.ingredient_enrich",
        trace_id: productId,
        run_immediately: true,
        input: {
          ingredient: selectedIngredient,
          context: ingredientContext,
          product_id: productId,
        },
      });
      const run = await fetchLatestRunSafe(job.id);
      const outputText = toReadableOutput(job.output);
      setIngredientState({
        loading: false,
        job,
        run,
        outputText,
        error: job.status === "failed" ? job.error_message || "AI job failed." : undefined,
      });
    } catch (err) {
      setIngredientState({ loading: false, error: formatError(err) });
    }
  }

  async function runImageJsonConsistency() {
    if (!imageRelPath) {
      setConsistencyState({ loading: false, error: "缺少 evidence.image_path，无法发起一致性校验。" });
      return;
    }

    setConsistencyState((prev) => ({ ...prev, loading: true, error: undefined }));
    try {
      const job = await createAIJob({
        capability: "doubao.image_json_consistency",
        trace_id: productId,
        run_immediately: true,
        input: {
          image_path: imageRelPath,
          json_text: jsonText,
          product_id: productId,
        },
      });
      const run = await fetchLatestRunSafe(job.id);
      const outputText = toReadableOutput(job.output);
      setConsistencyState({
        loading: false,
        job,
        run,
        outputText,
        error: job.status === "failed" ? job.error_message || "AI job failed." : undefined,
      });
    } catch (err) {
      setConsistencyState({ loading: false, error: formatError(err) });
    }
  }

  return (
    <section className="mt-6 rounded-[28px] border border-black/10 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-black/86">AI 工作台</h2>
        <span className="rounded-full border border-black/12 bg-black/[0.02] px-2.5 py-1 text-[11px] text-black/62">trace_id: {productId}</span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-black/10 bg-[#fbfcff] p-4">
          <h3 className="text-[14px] font-semibold text-black/82">成分解释（doubao.ingredient_enrich）</h3>
          <div className="mt-3 grid grid-cols-1 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] text-black/64">成分</span>
              <select
                value={selectedIngredient}
                onChange={(e) => setSelectedIngredient(e.target.value)}
                className="h-10 rounded-lg border border-black/12 bg-white px-2.5 text-[13px] text-black/82 outline-none focus:border-black/35"
                disabled={ingredients.length === 0 || ingredientState.loading}
              >
                {ingredients.length === 0 ? <option value="">无成分可选</option> : null}
                {ingredients.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] text-black/64">上下文（可编辑）</span>
              <textarea
                value={ingredientContext}
                onChange={(e) => setIngredientContext(e.target.value)}
                rows={3}
                className="rounded-lg border border-black/12 bg-white px-2.5 py-2 text-[12px] leading-[1.55] text-black/78 outline-none focus:border-black/35"
                disabled={ingredientState.loading}
              />
            </label>

            <button
              type="button"
              onClick={runIngredientEnrich}
              disabled={ingredientState.loading || ingredients.length === 0}
              className="inline-flex h-10 items-center justify-center rounded-full bg-black px-4 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-black/25"
            >
              {ingredientState.loading ? "分析中..." : "解释该成分"}
            </button>
          </div>

          <ActionResult state={ingredientState} />
        </article>

        <article className="rounded-2xl border border-black/10 bg-[#f8fafc] p-4">
          <h3 className="text-[14px] font-semibold text-black/82">图文一致性（doubao.image_json_consistency）</h3>
          <div className="mt-2 text-[12px] text-black/64">
            <div>image_path: {imageRelPath || "-"}</div>
            <div>json_bytes: {new TextEncoder().encode(jsonText).length}</div>
          </div>

          <button
            type="button"
            onClick={runImageJsonConsistency}
            disabled={consistencyState.loading || !imageRelPath}
            className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-black px-4 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-black/25"
          >
            {consistencyState.loading ? "分析中..." : "执行一致性校验"}
          </button>

          <ActionResult state={consistencyState} />
        </article>
      </div>
    </section>
  );
}

function ActionResult({ state }: { state: ActionState }) {
  return (
    <div className="mt-3 space-y-3">
      {state.error ? <div className="rounded-xl border border-[#f5d0d5] bg-[#fff6f7] px-3 py-2 text-[12px] text-[#b42318]">{state.error}</div> : null}

      {state.outputText ? (
        <pre className="max-h-72 overflow-auto rounded-xl border border-black/10 bg-white p-2.5 text-[12px] leading-[1.55] text-black/74 whitespace-pre-wrap">
          {state.outputText}
        </pre>
      ) : null}

      {state.job ? <JobObservability job={state.job} run={state.run} /> : null}
    </div>
  );
}

function JobObservability({ job, run }: { job: AIJobView; run?: AIRunView | null }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <StatusBadge status={job.status} />
        <span className="rounded-full border border-black/12 bg-black/[0.02] px-2 py-0.5 text-black/66">job_id: {job.id}</span>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-1.5 text-[12px] text-black/68 sm:grid-cols-2">
        <div>capability: {job.capability}</div>
        <div>model: {job.model || "-"}</div>
        <div>prompt_key: {job.prompt_key || "-"}</div>
        <div>prompt_version: {job.prompt_version || "-"}</div>
        <div>run_id: {run?.id || "-"}</div>
        <div>run_latency_ms: {typeof run?.latency_ms === "number" ? run.latency_ms : "-"}</div>
      </div>
      {job.error_message ? (
        <div className="mt-2 rounded-lg border border-[#f5d0d5] bg-[#fff6f7] px-2.5 py-1.5 text-[12px] text-[#b42318]">{job.error_message}</div>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "succeeded"
      ? "bg-[#eaf8ef] text-[#116a3f]"
      : status === "failed"
        ? "bg-[#fdeaea] text-[#9f1d1d]"
        : status === "running"
          ? "bg-[#eef2ff] text-[#3151d8]"
          : "bg-black/6 text-black/62";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>status: {status}</span>;
}

function normalizeImageRelPath(path?: string | null): string | null {
  if (!path) return null;
  const value = path.trim();
  if (!value) return null;
  return value.replace(/^\/+/, "");
}

async function fetchLatestRunSafe(jobId: string): Promise<AIRunView | null> {
  try {
    return await fetchLatestAIRunByJobId(jobId);
  } catch {
    return null;
  }
}

function toReadableOutput(output?: Record<string, unknown> | null): string {
  if (!output) return "";
  const analysisText = output.analysis_text;
  if (typeof analysisText === "string" && analysisText.trim()) {
    return analysisText.trim();
  }
  try {
    return JSON.stringify(output, null, 2);
  } catch {
    return String(output);
  }
}

function formatError(err: unknown): string {
  if (!(err instanceof Error)) return "请求失败，请稍后重试。";
  return err.message || "请求失败，请稍后重试。";
}
