"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";
import {
  listMobileSelectionSessions,
  resolveImageUrl,
  resolveMobileSelection,
  type MobileSelectionResolveResponse,
} from "@/lib/api";
import {
  MATCH_LAST_CATEGORY_KEY,
  countAnsweredSteps,
  getMatchChoice,
  getMatchConfig,
  getMatchDraftStorageKey,
  getNextUnansweredIndex,
  getSelectionDisplayTitle,
  isMatchComplete,
  normalizeMatchAnswers,
  type MatchAnswers,
} from "@/lib/match";
import { CATEGORIES, normalizeCategoryKey, type CategoryKey } from "@/lib/site";

type MatchExperienceProps = {
  initialCategory: CategoryKey;
  hasExplicitCategory: boolean;
};

function buildMatchHref(category: CategoryKey): string {
  return category === "shampoo" ? "/match" : `/match?category=${encodeURIComponent(category)}`;
}

function formatProductName(entry: MobileSelectionResolveResponse): string {
  return entry.recommended_product.name || entry.recommended_product.brand || "未命名商品";
}

function formatTimestamp(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "暂无时间";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function sortSessions(items: MobileSelectionResolveResponse[]): MobileSelectionResolveResponse[] {
  return [...items].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    const aPinned = String(a.pinned_at || "");
    const bPinned = String(b.pinned_at || "");
    if (aPinned !== bPinned) return bPinned.localeCompare(aPinned);
    return String(b.created_at || "").localeCompare(String(a.created_at || ""));
  });
}

function readDraft(category: CategoryKey): MatchAnswers {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(getMatchDraftStorageKey(category));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as MatchAnswers;
    return normalizeMatchAnswers(category, parsed);
  } catch {
    return {};
  }
}

function writeDraft(category: CategoryKey, answers: MatchAnswers) {
  if (typeof window === "undefined") return;
  const normalized = normalizeMatchAnswers(category, answers);
  const key = getMatchDraftStorageKey(category);
  if (Object.keys(normalized).length === 0) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(normalized));
}

export default function MatchExperience({ initialCategory, hasExplicitCategory }: MatchExperienceProps) {
  const router = useRouter();
  const [category, setCategory] = useState<CategoryKey>(initialCategory);
  const [answers, setAnswers] = useState<MatchAnswers>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [sessions, setSessions] = useState<MobileSelectionResolveResponse[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [restoredDraft, setRestoredDraft] = useState(false);

  const config = getMatchConfig(category);
  const answeredCount = countAnsweredSteps(category, answers);
  const completed = isMatchComplete(category, answers);
  const visibleStepIndex = completed ? config.steps.length - 1 : Math.min(currentStep, config.steps.length - 1);
  const activeQuestion = config.steps[visibleStepIndex];
  const latestSession = sessions[0] || null;

  useEffect(() => {
    if (typeof window === "undefined" || hasExplicitCategory) return;
    const savedCategory = normalizeCategoryKey(window.localStorage.getItem(MATCH_LAST_CATEGORY_KEY));
    if (!savedCategory || savedCategory === initialCategory) return;
    setCategory(savedCategory);
    startTransition(() => {
      router.replace(buildMatchHref(savedCategory), { scroll: false });
    });
  }, [hasExplicitCategory, initialCategory, router]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MATCH_LAST_CATEGORY_KEY, category);
    }

    const draft = readDraft(category);
    const nextStep = getNextUnansweredIndex(category, draft);
    setAnswers(draft);
    setCurrentStep(Math.min(nextStep, Math.max(0, config.steps.length - 1)));
    setRestoredDraft(Object.keys(draft).length > 0);
    setSubmitError(null);
    setSessions([]);

    let cancelled = false;

    async function loadHistory() {
      try {
        setLoadingHistory(true);
        setHistoryError(null);
        const data = await listMobileSelectionSessions({ category, limit: 8, offset: 0 });
        if (cancelled) return;
        setSessions(sortSessions(data));
      } catch (error) {
        if (cancelled) return;
        setSessions([]);
        setHistoryError(error instanceof Error ? error.message : String(error));
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    }

    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [category, config.steps.length]);

  const answerRows = useMemo(
    () =>
      config.steps.map((step) => ({
        step,
        choice: answers[step.key] ? getMatchChoice(category, step.key, answers[step.key]) : null,
      })),
    [answers, category, config.steps],
  );

  function updateCategory(nextCategory: CategoryKey) {
    if (nextCategory === category) return;
    writeDraft(category, answers);
    setCategory(nextCategory);
    startTransition(() => {
      router.replace(buildMatchHref(nextCategory), { scroll: false });
    });
  }

  function updateAnswer(questionKey: string, value: string) {
    const nextAnswers = normalizeMatchAnswers(category, {
      ...answers,
      [questionKey]: value,
    });
    const nextStep = getNextUnansweredIndex(category, nextAnswers);
    setAnswers(nextAnswers);
    setCurrentStep(Math.min(nextStep, config.steps.length - 1));
    setRestoredDraft(false);
    setSubmitError(null);
    writeDraft(category, nextAnswers);
  }

  function goBack() {
    setSubmitError(null);
    setCurrentStep((current) => Math.max(0, current - 1));
  }

  function clearDraft() {
    setAnswers({});
    setCurrentStep(0);
    setRestoredDraft(false);
    setSubmitError(null);
    writeDraft(category, {});
  }

  async function submitMatch() {
    if (submitting || !completed) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const result = await resolveMobileSelection({
        category,
        answers: normalizeMatchAnswers(category, answers),
        reuse_existing: true,
      });
      writeDraft(category, {});
      startTransition(() => {
        router.push(`/match/${encodeURIComponent(result.session_id)}`);
      });
    } catch (error) {
      setSubmitting(false);
      setSubmitError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((entry) => {
          const active = entry.key === category;
          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => updateCategory(entry.key)}
              className={`inline-flex h-11 items-center justify-center rounded-full px-5 text-[14px] font-medium transition ${
                active
                  ? "bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] text-white shadow-[0_12px_28px_rgba(0,113,227,0.24)]"
                  : "border border-black/8 bg-white text-slate-700"
              }`}
            >
              {entry.label}
            </button>
          );
        })}
      </div>

      <section className="grid gap-5 xl:grid-cols-[1.02fr_0.98fr]">
        <article className="rounded-[32px] border border-black/8 bg-white/94 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)] md:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-sky-700">婕选测配</p>
              <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">{config.title}</h2>
              <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-600">{config.summary}</p>
            </div>
            <div className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-3 text-right">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">预计耗时</div>
              <div className="mt-2 text-[14px] font-medium text-slate-700">{config.estimatedTime}</div>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between gap-3 text-[13px] font-medium text-slate-600">
              <span>{completed ? "答案已准备好" : `第 ${visibleStepIndex + 1} 步，共 ${config.steps.length} 步`}</span>
              <span>已回答 {answeredCount}/{config.steps.length}</span>
            </div>
            <div className="mt-3 h-2 rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] transition-[width] duration-300"
                style={{ width: `${Math.max(8, (answeredCount / config.steps.length) * 100)}%` }}
              />
            </div>
          </div>

          {restoredDraft ? (
            <div className="mt-6 rounded-[24px] border border-sky-100 bg-sky-50 px-4 py-4 text-[14px] leading-6 text-sky-800">
              已为 {CATEGORIES.find((entry) => entry.key === category)?.label || category} 恢复上次未完成的测配进度。
            </div>
          ) : null}

          {!completed ? (
            <div className="mt-6 rounded-[28px] border border-black/8 bg-[linear-gradient(180deg,#fbfdff_0%,#f6f9fd_100%)] p-5 md:p-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {config.steps[visibleStepIndex].key}
              </div>
              <h3 className="mt-3 text-[28px] font-semibold leading-[1.08] tracking-[-0.04em] text-slate-950">
                {activeQuestion.title}
              </h3>
              <p className="mt-3 text-[15px] leading-7 text-slate-600">{activeQuestion.note}</p>

              <div className="mt-6 grid gap-3">
                {activeQuestion.options.map((option) => {
                  const selected = answers[activeQuestion.key] === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => updateAnswer(activeQuestion.key, option.value)}
                      className={`rounded-[24px] border px-4 py-4 text-left transition ${
                        selected
                          ? "border-sky-300 bg-sky-50 shadow-[0_14px_30px_rgba(0,113,227,0.12)]"
                          : "border-black/8 bg-white hover:-translate-y-[1px] hover:shadow-[0_14px_30px_rgba(15,23,42,0.06)]"
                      }`}
                    >
                      <div className="text-[16px] font-semibold tracking-[-0.02em] text-slate-950">{option.label}</div>
                      <div className="mt-2 text-[14px] leading-6 text-slate-600">{option.description}</div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={visibleStepIndex === 0}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[14px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  上一步
                </button>
                <button
                  type="button"
                  onClick={clearDraft}
                  disabled={answeredCount === 0}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[14px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  重新开始
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-[28px] border border-black/8 bg-[linear-gradient(180deg,#fbfdff_0%,#f6f9fd_100%)] p-5 md:p-6">
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-sky-700">准备生成结果</p>
              <h3 className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">
                当前答案已经可以生成并保存测配结果。
              </h3>
              <p className="mt-3 text-[15px] leading-7 text-slate-600">
                婕选会把这次结果保存在当前设备上，方便之后进入对比时继续复用。
              </p>

              <div className="mt-6 grid gap-3">
                {answerRows.map(({ step, choice }, index) => (
                  <button
                    key={step.key}
                    type="button"
                    onClick={() => setCurrentStep(index)}
                    className="rounded-[22px] border border-black/8 bg-white px-4 py-4 text-left transition hover:-translate-y-[1px] hover:shadow-[0_12px_28px_rgba(15,23,42,0.05)]"
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">问题 {index + 1}</div>
                    <div className="mt-2 text-[16px] font-semibold tracking-[-0.02em] text-slate-950">{step.title}</div>
                    <div className="mt-2 text-[14px] leading-6 text-slate-600">
                      {choice ? `${choice.label} - ${choice.description}` : "请选择一个答案"}
                    </div>
                  </button>
                ))}
              </div>

              {submitError ? (
                <div className="mt-5 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4 text-[14px] leading-6 text-rose-700">
                  测配提交失败：{submitError}
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={submitMatch}
                  disabled={submitting}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-6 text-[14px] font-semibold text-white shadow-[0_14px_36px_rgba(0,113,227,0.28)] disabled:cursor-wait disabled:opacity-70"
                >
                  {submitting ? "正在保存测配结果..." : "查看我的测配结果"}
                </button>
                <button
                  type="button"
                  onClick={clearDraft}
                  disabled={submitting}
                  className="inline-flex h-12 items-center justify-center rounded-full border border-black/10 bg-white px-6 text-[14px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  清空答案
                </button>
              </div>
            </div>
          )}
        </article>

        <div className="space-y-5">
          <article className="rounded-[32px] border border-black/8 bg-white/94 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">已存适配基础</p>
            {latestSession ? (
              <>
                <h3 className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">
                  {latestSession.is_pinned ? "已固定的测配结果可用" : "最新测配结果可直接复用"}
                </h3>
                <p className="mt-3 text-[15px] leading-7 text-slate-600">
                  对比页会复用这个品类最近一次的测配结果。如果你想保留更稳定的基础，可以固定其中一条。
                </p>
                  <div className="mt-5 rounded-[26px] border border-black/8 bg-slate-50 p-4">
                  <div className="flex items-center gap-4">
                    <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[20px] bg-white">
                      <Image
                        src={resolveImageUrl(latestSession.recommended_product)}
                        alt={formatProductName(latestSession)}
                        fill
                        sizes="72px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700">
                          {getSelectionDisplayTitle(category, latestSession.route.key)}
                        </span>
                        {latestSession.is_pinned ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700">
                            已固定
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-[17px] font-semibold tracking-[-0.02em] text-slate-950">{formatProductName(latestSession)}</p>
                      <p className="mt-2 text-[13px] leading-6 text-slate-600">{formatTimestamp(latestSession.created_at)}</p>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href={`/match/${encodeURIComponent(latestSession.session_id)}`}
                      className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[13px] font-semibold text-white"
                    >
                      查看已存测配
                    </Link>
                    <Link
                      href={`/compare?category=${encodeURIComponent(category)}`}
                      className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[13px] font-semibold text-slate-700"
                    >
                      在对比中使用
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h3 className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">还没有已存测配结果</h3>
                <p className="mt-3 text-[15px] leading-7 text-slate-600">
                  完成一次测配后，这个品类就会留下可复用的决策基础，方便之后继续对比和回看。
                </p>
              </>
            )}
          </article>

          <article className="rounded-[32px] border border-black/8 bg-white/94 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">最近历史</p>
                <h3 className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">当前设备上的测配记录</h3>
              </div>
              <span className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[12px] font-medium text-slate-600">
                {sessions.length}
              </span>
            </div>

            {loadingHistory ? (
              <p className="mt-5 text-[15px] leading-7 text-slate-600">正在加载已存测配记录...</p>
            ) : historyError ? (
              <div className="mt-5 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4 text-[14px] leading-6 text-rose-700">
                历史记录加载失败：{historyError}
              </div>
            ) : sessions.length === 0 ? (
              <p className="mt-5 text-[15px] leading-7 text-slate-600">
                当前设备还没有这个品类的已存测配结果。
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {sessions.map((entry) => (
                  <Link
                    key={entry.session_id}
                    href={`/match/${encodeURIComponent(entry.session_id)}`}
                    className="flex items-center gap-4 rounded-[24px] border border-black/8 bg-slate-50 px-4 py-4 transition hover:-translate-y-[1px] hover:bg-white hover:shadow-[0_12px_28px_rgba(15,23,42,0.05)]"
                  >
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[18px] bg-white">
                      <Image
                        src={resolveImageUrl(entry.recommended_product)}
                        alt={formatProductName(entry)}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                          {getSelectionDisplayTitle(category, entry.route.key)}
                        </span>
                        {entry.is_pinned ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700">
                            已固定
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 text-[16px] font-semibold tracking-[-0.02em] text-slate-950">{formatProductName(entry)}</div>
                      <div className="mt-1 text-[13px] text-slate-500">{formatTimestamp(entry.created_at)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </article>
        </div>
      </section>
    </div>
  );
}
