"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useState } from "react";
import { useSitePreferences } from "@/components/site/SitePreferenceProvider";
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
import { getCategories, normalizeCategoryKey, type CategoryKey } from "@/lib/site";

type MatchExperienceProps = {
  initialCategory: CategoryKey;
  hasExplicitCategory: boolean;
};

function buildMatchHref(category: CategoryKey): string {
  return category === "shampoo" ? "/match" : `/match?category=${encodeURIComponent(category)}`;
}

function formatProductName(entry: MobileSelectionResolveResponse, locale: "en" | "zh"): string {
  return entry.recommended_product.name || entry.recommended_product.brand || (locale === "zh" ? "未命名商品" : "Untitled product");
}

function formatTimestamp(value: string | null | undefined, locale: "en" | "zh"): string {
  const raw = String(value || "").trim();
  if (!raw) return locale === "zh" ? "暂无时间" : "No timestamp";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    month: locale === "zh" ? "numeric" : "short",
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

function readDraft(category: CategoryKey, locale: "en" | "zh"): MatchAnswers {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(getMatchDraftStorageKey(category));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as MatchAnswers;
    return normalizeMatchAnswers(category, parsed, locale);
  } catch {
    return {};
  }
}

function writeDraft(category: CategoryKey, answers: MatchAnswers, locale: "en" | "zh") {
  if (typeof window === "undefined") return;
  const normalized = normalizeMatchAnswers(category, answers, locale);
  const key = getMatchDraftStorageKey(category);
  if (Object.keys(normalized).length === 0) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(normalized));
}

export default function MatchExperience({ initialCategory, hasExplicitCategory }: MatchExperienceProps) {
  const router = useRouter();
  const { locale } = useSitePreferences();
  const categories = getCategories(locale);
  const copy =
    locale === "zh"
      ? {
          eyebrow: "婕选测配",
          timeLabel: "预计耗时",
          ready: "答案已准备好",
          stepProgress: (current: number, total: number) => `第 ${current} 步，共 ${total} 步`,
          answered: (count: number, total: number) => `已回答 ${count}/${total}`,
          restoredDraft: (label: string) => `已为 ${label} 恢复上次未完成的测配进度。`,
          previous: "上一步",
          restart: "重新开始",
          generateEyebrow: "准备生成结果",
          generateTitle: "当前答案已经可以生成并保存测配结果。",
          generateSummary: "婕选会把这次结果保存在当前设备上，方便之后进入对比时继续复用。",
          questionNumber: (index: number) => `问题 ${index}`,
          chooseAnswer: "请选择一个答案",
          submitFailed: "测配提交失败",
          submitting: "正在保存测配结果...",
          submit: "查看我的测配结果",
          clearAnswers: "清空答案",
          basisEyebrow: "已存适配基础",
          pinnedBasisTitle: "已固定的测配结果可用",
          latestBasisTitle: "最新测配结果可直接复用",
          basisSummary: "对比页会复用这个品类最近一次的测配结果。如果你想保留更稳定的基础，可以固定其中一条。",
          openSavedMatch: "查看已存测配",
          useInCompare: "在对比中使用",
          noSavedMatchTitle: "还没有已存测配结果",
          noSavedMatchSummary: "完成一次测配后，这个品类就会留下可复用的决策基础，方便之后继续对比和回看。",
          pinned: "已固定",
          historyEyebrow: "最近历史",
          historyTitle: "当前设备上的测配记录",
          loadingHistory: "正在加载已存测配记录...",
          historyFailed: "历史记录加载失败",
          emptyHistory: "当前设备还没有这个品类的已存测配结果。",
          savedMatchLoading: "正在加载已存适配基础...",
          viewSavedMatch: "查看已存测配",
        }
      : {
          eyebrow: "Jeslect Match",
          timeLabel: "Estimated time",
          ready: "Answers ready",
          stepProgress: (current: number, total: number) => `Step ${current} of ${total}`,
          answered: (count: number, total: number) => `${count}/${total} answered`,
          restoredDraft: (label: string) => `Restored your unfinished ${label} match progress.`,
          previous: "Previous step",
          restart: "Restart",
          generateEyebrow: "Ready to generate",
          generateTitle: "These answers are ready to generate a saved match.",
          generateSummary: "Jeslect will save this result on the current device so Compare can reuse it later.",
          questionNumber: (index: number) => `Question ${index}`,
          chooseAnswer: "Choose one answer",
          submitFailed: "Match submit failed",
          submitting: "Saving your match...",
          submit: "View my match result",
          clearAnswers: "Clear answers",
          basisEyebrow: "Saved route basis",
          pinnedBasisTitle: "A pinned match is ready",
          latestBasisTitle: "Your latest match is ready to reuse",
          basisSummary: "Compare reuses the latest saved match in this category. Pin one if you want a steadier basis to keep.",
          openSavedMatch: "Open saved match",
          useInCompare: "Use in compare",
          noSavedMatchTitle: "No saved matches yet",
          noSavedMatchSummary: "Once you complete Match, this category keeps a reusable decision basis for compare and revisit.",
          pinned: "Pinned",
          historyEyebrow: "Recent history",
          historyTitle: "Match history on this device",
          loadingHistory: "Loading saved match history...",
          historyFailed: "History failed",
          emptyHistory: "There is no saved match history for this category on this device yet.",
          savedMatchLoading: "Loading saved route basis...",
          viewSavedMatch: "View saved match",
        };

  const [category, setCategory] = useState<CategoryKey>(initialCategory);
  const [answers, setAnswers] = useState<MatchAnswers>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [sessions, setSessions] = useState<MobileSelectionResolveResponse[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [restoredDraft, setRestoredDraft] = useState(false);

  const config = getMatchConfig(category, locale);
  const answeredCount = countAnsweredSteps(category, answers, locale);
  const completed = isMatchComplete(category, answers, locale);
  const visibleStepIndex = completed ? config.steps.length - 1 : Math.min(currentStep, config.steps.length - 1);
  const activeQuestion = config.steps[visibleStepIndex];
  const latestSession = sessions[0] || null;
  const categoryLabel = categories.find((entry) => entry.key === category)?.label || category;

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

    const draft = readDraft(category, locale);
    const nextStep = getNextUnansweredIndex(category, draft, locale);
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
  }, [category, config.steps.length, locale]);

  const answerRows = useMemo(
    () =>
      config.steps.map((step) => ({
        step,
        choice: answers[step.key] ? getMatchChoice(category, step.key, answers[step.key], locale) : null,
      })),
    [answers, category, config.steps, locale],
  );

  function updateCategory(nextCategory: CategoryKey) {
    if (nextCategory === category) return;
    writeDraft(category, answers, locale);
    setCategory(nextCategory);
    startTransition(() => {
      router.replace(buildMatchHref(nextCategory), { scroll: false });
    });
  }

  function updateAnswer(questionKey: string, value: string) {
    const nextAnswers = normalizeMatchAnswers(
      category,
      {
        ...answers,
        [questionKey]: value,
      },
      locale,
    );
    const nextStep = getNextUnansweredIndex(category, nextAnswers, locale);
    setAnswers(nextAnswers);
    setCurrentStep(Math.min(nextStep, config.steps.length - 1));
    setRestoredDraft(false);
    setSubmitError(null);
    writeDraft(category, nextAnswers, locale);
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
    writeDraft(category, {}, locale);
  }

  async function submitMatch() {
    if (submitting || !completed) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const result = await resolveMobileSelection({
        category,
        answers: normalizeMatchAnswers(category, answers, locale),
        reuse_existing: true,
      });
      writeDraft(category, {}, locale);
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
        {categories.map((entry) => {
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
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-sky-700">{copy.eyebrow}</p>
              <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">{config.title}</h2>
              <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-600">{config.summary}</p>
            </div>
            <div className="rounded-[24px] border border-black/8 bg-slate-50 px-4 py-3 text-right">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{copy.timeLabel}</div>
              <div className="mt-2 text-[14px] font-medium text-slate-700">{config.estimatedTime}</div>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between gap-3 text-[13px] font-medium text-slate-600">
              <span>{completed ? copy.ready : copy.stepProgress(visibleStepIndex + 1, config.steps.length)}</span>
              <span>{copy.answered(answeredCount, config.steps.length)}</span>
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
              {copy.restoredDraft(categoryLabel)}
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
                  {copy.previous}
                </button>
                <button
                  type="button"
                  onClick={clearDraft}
                  disabled={answeredCount === 0}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[14px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {copy.restart}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-[28px] border border-black/8 bg-[linear-gradient(180deg,#fbfdff_0%,#f6f9fd_100%)] p-5 md:p-6">
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-sky-700">{copy.generateEyebrow}</p>
              <h3 className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">{copy.generateTitle}</h3>
              <p className="mt-3 text-[15px] leading-7 text-slate-600">{copy.generateSummary}</p>

              <div className="mt-6 grid gap-3">
                {answerRows.map(({ step, choice }, index) => (
                  <button
                    key={step.key}
                    type="button"
                    onClick={() => setCurrentStep(index)}
                    className="rounded-[22px] border border-black/8 bg-white px-4 py-4 text-left transition hover:-translate-y-[1px] hover:shadow-[0_12px_28px_rgba(15,23,42,0.05)]"
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {copy.questionNumber(index + 1)}
                    </div>
                    <div className="mt-2 text-[16px] font-semibold tracking-[-0.02em] text-slate-950">{step.title}</div>
                    <div className="mt-2 text-[14px] leading-6 text-slate-600">
                      {choice ? `${choice.label} - ${choice.description}` : copy.chooseAnswer}
                    </div>
                  </button>
                ))}
              </div>

              {submitError ? (
                <div className="mt-5 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4 text-[14px] leading-6 text-rose-700">
                  {copy.submitFailed}: {submitError}
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={submitMatch}
                  disabled={submitting}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-6 text-[14px] font-semibold text-white shadow-[0_14px_36px_rgba(0,113,227,0.28)] disabled:cursor-wait disabled:opacity-70"
                >
                  {submitting ? copy.submitting : copy.submit}
                </button>
                <button
                  type="button"
                  onClick={clearDraft}
                  disabled={submitting}
                  className="inline-flex h-12 items-center justify-center rounded-full border border-black/10 bg-white px-6 text-[14px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {copy.clearAnswers}
                </button>
              </div>
            </div>
          )}
        </article>

        <div className="space-y-5">
          <article className="rounded-[32px] border border-black/8 bg-white/94 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.basisEyebrow}</p>
            {latestSession ? (
              <>
                <h3 className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">
                  {latestSession.is_pinned ? copy.pinnedBasisTitle : copy.latestBasisTitle}
                </h3>
                <p className="mt-3 text-[15px] leading-7 text-slate-600">{copy.basisSummary}</p>
                <div className="mt-5 rounded-[26px] border border-black/8 bg-slate-50 p-4">
                  <div className="flex items-center gap-4">
                    <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[20px] bg-white">
                      <Image
                        src={resolveImageUrl(latestSession.recommended_product)}
                        alt={formatProductName(latestSession, locale)}
                        fill
                        sizes="72px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700">
                          {getSelectionDisplayTitle(category, latestSession.route.key, locale)}
                        </span>
                        {latestSession.is_pinned ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700">
                            {copy.pinned}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-3 text-[17px] font-semibold tracking-[-0.02em] text-slate-950">
                        {formatProductName(latestSession, locale)}
                      </p>
                      <p className="mt-2 text-[13px] leading-6 text-slate-600">
                        {formatTimestamp(latestSession.created_at, locale)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href={`/match/${encodeURIComponent(latestSession.session_id)}`}
                      className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[13px] font-semibold text-white"
                    >
                      {copy.openSavedMatch}
                    </Link>
                    <Link
                      href={`/compare?category=${encodeURIComponent(category)}`}
                      className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[13px] font-semibold text-slate-700"
                    >
                      {copy.useInCompare}
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h3 className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">{copy.noSavedMatchTitle}</h3>
                <p className="mt-3 text-[15px] leading-7 text-slate-600">{copy.noSavedMatchSummary}</p>
              </>
            )}
          </article>

          <article className="rounded-[32px] border border-black/8 bg-white/94 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">{copy.historyEyebrow}</p>
                <h3 className="mt-3 text-[28px] font-semibold tracking-[-0.04em] text-slate-950">{copy.historyTitle}</h3>
              </div>
              <span className="rounded-full border border-black/8 bg-slate-50 px-3 py-1 text-[12px] font-medium text-slate-600">
                {sessions.length}
              </span>
            </div>

            {loadingHistory ? (
              <p className="mt-5 text-[15px] leading-7 text-slate-600">{copy.loadingHistory}</p>
            ) : historyError ? (
              <div className="mt-5 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4 text-[14px] leading-6 text-rose-700">
                {copy.historyFailed}: {historyError}
              </div>
            ) : sessions.length === 0 ? (
              <p className="mt-5 text-[15px] leading-7 text-slate-600">{copy.emptyHistory}</p>
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
                        alt={formatProductName(entry, locale)}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                          {getSelectionDisplayTitle(category, entry.route.key, locale)}
                        </span>
                        {entry.is_pinned ? (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700">
                            {copy.pinned}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 text-[16px] font-semibold tracking-[-0.02em] text-slate-950">
                        {formatProductName(entry, locale)}
                      </div>
                      <div className="mt-1 text-[13px] text-slate-500">{formatTimestamp(entry.created_at, locale)}</div>
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
