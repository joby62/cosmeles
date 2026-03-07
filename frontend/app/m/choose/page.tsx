"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BODYWASH_LAST_RESULT_QUERY_KEY,
  BODYWASH_PROFILE_DRAFT_KEY,
  normalizeBodyWashResultQueryString,
} from "@/lib/mobile/bodywashFlowStorage";
import {
  CLEANSER_LAST_RESULT_QUERY_KEY,
  CLEANSER_PROFILE_DRAFT_KEY,
  normalizeCleanserResultQueryString,
} from "@/lib/mobile/cleanserFlowStorage";
import {
  CONDITIONER_LAST_RESULT_QUERY_KEY,
  CONDITIONER_PROFILE_DRAFT_KEY,
  normalizeConditionerResultQueryString,
} from "@/lib/mobile/conditionerFlowStorage";
import {
  LOTION_LAST_RESULT_QUERY_KEY,
  LOTION_PROFILE_DRAFT_KEY,
  normalizeLotionResultQueryString,
} from "@/lib/mobile/lotionFlowStorage";
import {
  SHAMPOO_LAST_RESULT_QUERY_KEY,
  SHAMPOO_PROFILE_DRAFT_KEY,
  normalizeShampooResultQueryString,
} from "@/lib/mobile/shampooFlowStorage";

type CategoryKey = "shampoo" | "bodywash" | "conditioner" | "lotion" | "cleanser";

type CategoryMeta = {
  key: CategoryKey;
  zh: string;
  image: string;
  startHref: string;
  resultHref: string;
  profileHref: string;
  totalSteps: number;
  summary: string;
  detail: string;
  draftKey: string;
};

type DraftProgress = {
  key: CategoryKey;
  answered: number;
  total: number;
  continueHref: string;
};

const CHOOSE_SELECTED_CATEGORY_KEY = "mx_mobile_choose_selected_category_v1";

const CATS: CategoryMeta[] = [
  {
    key: "shampoo",
    zh: "洗发水",
    image: "/m/categories/shampoo.png",
    startHref: "/m/shampoo/start",
    resultHref: "/m/shampoo/result",
    profileHref: "/m/shampoo/profile",
    totalSteps: 3,
    summary: "3 步 · 约 30 秒",
    detail: "先看出油节奏，再看头皮状态，最后锁定发丝需求。",
    draftKey: SHAMPOO_PROFILE_DRAFT_KEY,
  },
  {
    key: "bodywash",
    zh: "沐浴露",
    image: "/m/categories/bodywash.png",
    startHref: "/m/bodywash/start",
    resultHref: "/m/bodywash/result",
    profileHref: "/m/bodywash/profile",
    totalSteps: 5,
    summary: "5 步 · 约 45 秒",
    detail: "环境、耐受、油脂角质、冲洗偏好、特殊限制逐层收敛。",
    draftKey: BODYWASH_PROFILE_DRAFT_KEY,
  },
  {
    key: "conditioner",
    zh: "护发素",
    image: "/m/categories/conditioner.png",
    startHref: "/m/conditioner/start",
    resultHref: "/m/conditioner/result",
    profileHref: "/m/conditioner/profile",
    totalSteps: 3,
    summary: "3 步 · 约 30 秒",
    detail: "受损程度、发丝形态、视觉效果三步得出唯一答案。",
    draftKey: CONDITIONER_PROFILE_DRAFT_KEY,
  },
  {
    key: "lotion",
    zh: "润肤霜",
    image: "/m/categories/lotion.png",
    startHref: "/m/lotion/start",
    resultHref: "/m/lotion/result",
    profileHref: "/m/lotion/profile",
    totalSteps: 5,
    summary: "5 步 · 约 45 秒",
    detail: "按环境、敏感度、痛点与质地偏好筛到单一路线。",
    draftKey: LOTION_PROFILE_DRAFT_KEY,
  },
  {
    key: "cleanser",
    zh: "洗面奶",
    image: "/m/categories/cleanser.png",
    startHref: "/m/cleanser/start",
    resultHref: "/m/cleanser/result",
    profileHref: "/m/cleanser/profile",
    totalSteps: 5,
    summary: "5 步 · 约 45 秒",
    detail: "出油、敏感、清洁负担、痛点与肤感偏好共同决策。",
    draftKey: CLEANSER_PROFILE_DRAFT_KEY,
  },
];

const CAT_MAP: Record<CategoryKey, CategoryMeta> = CATS.reduce((acc, cat) => {
  acc[cat.key] = cat;
  return acc;
}, {} as Record<CategoryKey, CategoryMeta>);

const LAST_RESULT_QUERY_META: Record<
  CategoryKey,
  { key: string; normalize: (raw: string | null | undefined) => string | null }
> = {
  shampoo: {
    key: SHAMPOO_LAST_RESULT_QUERY_KEY,
    normalize: normalizeShampooResultQueryString,
  },
  bodywash: {
    key: BODYWASH_LAST_RESULT_QUERY_KEY,
    normalize: normalizeBodyWashResultQueryString,
  },
  conditioner: {
    key: CONDITIONER_LAST_RESULT_QUERY_KEY,
    normalize: normalizeConditionerResultQueryString,
  },
  lotion: {
    key: LOTION_LAST_RESULT_QUERY_KEY,
    normalize: normalizeLotionResultQueryString,
  },
  cleanser: {
    key: CLEANSER_LAST_RESULT_QUERY_KEY,
    normalize: normalizeCleanserResultQueryString,
  },
};

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function isAB(v?: string): v is "A" | "B" {
  return v === "A" || v === "B";
}

function isABC(v?: string): v is "A" | "B" | "C" {
  return v === "A" || v === "B" || v === "C";
}

function isABCD(v?: string): v is "A" | "B" | "C" | "D" {
  return v === "A" || v === "B" || v === "C" || v === "D";
}

function isABCDE(v?: string): v is "A" | "B" | "C" | "D" | "E" {
  return v === "A" || v === "B" || v === "C" || v === "D" || v === "E";
}

function parseJsonObject(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseDraft(cat: CategoryMeta, raw: string | null): DraftProgress | null {
  const parsed = parseJsonObject(raw);
  if (!parsed) return null;

  if (cat.key === "shampoo") {
    const q1 = isABC(asString(parsed.q1)) ? asString(parsed.q1) : undefined;
    const q2 = q1 && isABCD(asString(parsed.q2)) ? asString(parsed.q2) : undefined;
    const q3 = q1 && q2 && isABC(asString(parsed.q3)) ? asString(parsed.q3) : undefined;
    const answered = Number(Boolean(q1)) + Number(Boolean(q2)) + Number(Boolean(q3));
    if (!answered || answered >= cat.totalSteps) return null;
    const qp = new URLSearchParams();
    if (q1) qp.set("q1", q1);
    if (q2) qp.set("q2", q2);
    if (q3) qp.set("q3", q3);
    const step = !q1 ? 1 : !q2 ? 2 : 3;
    qp.set("step", String(step));
    return { key: cat.key, answered, total: cat.totalSteps, continueHref: `${cat.profileHref}?${qp.toString()}` };
  }

  if (cat.key === "bodywash") {
    const q1 = isABCD(asString(parsed.q1)) ? asString(parsed.q1) : undefined;
    const q2 = q1 && isAB(asString(parsed.q2)) ? asString(parsed.q2) : undefined;
    const q3 = q1 && q2 && isABCD(asString(parsed.q3)) ? asString(parsed.q3) : undefined;
    const q4 = q1 && q2 && q3 && isAB(asString(parsed.q4)) ? asString(parsed.q4) : undefined;
    const q5 = q1 && q2 && q3 && q4 && isAB(asString(parsed.q5)) ? asString(parsed.q5) : undefined;
    const answered = Number(Boolean(q1)) + Number(Boolean(q2)) + Number(Boolean(q3)) + Number(Boolean(q4)) + Number(Boolean(q5));
    if (!answered || answered >= cat.totalSteps) return null;
    const qp = new URLSearchParams();
    if (q1) qp.set("q1", q1);
    if (q2) qp.set("q2", q2);
    if (q3) qp.set("q3", q3);
    if (q4) qp.set("q4", q4);
    if (q5) qp.set("q5", q5);
    const step = !q1 ? 1 : !q2 ? 2 : !q3 ? 3 : !q4 ? 4 : 5;
    qp.set("step", String(step));
    return { key: cat.key, answered, total: cat.totalSteps, continueHref: `${cat.profileHref}?${qp.toString()}` };
  }

  if (cat.key === "conditioner") {
    const cQ1 = isABC(asString(parsed.c_q1)) ? asString(parsed.c_q1) : undefined;
    const cQ2 = cQ1 && isABC(asString(parsed.c_q2)) ? asString(parsed.c_q2) : undefined;
    const cQ3 = cQ1 && cQ2 && isABC(asString(parsed.c_q3)) ? asString(parsed.c_q3) : undefined;
    const answered = Number(Boolean(cQ1)) + Number(Boolean(cQ2)) + Number(Boolean(cQ3));
    if (!answered || answered >= cat.totalSteps) return null;
    const qp = new URLSearchParams();
    if (cQ1) qp.set("c_q1", cQ1);
    if (cQ2) qp.set("c_q2", cQ2);
    if (cQ3) qp.set("c_q3", cQ3);
    const step = !cQ1 ? 1 : !cQ2 ? 2 : 3;
    qp.set("step", String(step));
    return { key: cat.key, answered, total: cat.totalSteps, continueHref: `${cat.profileHref}?${qp.toString()}` };
  }

  if (cat.key === "lotion") {
    const q1 = isABCD(asString(parsed.q1)) ? asString(parsed.q1) : undefined;
    const q2 = q1 && isAB(asString(parsed.q2)) ? asString(parsed.q2) : undefined;
    const q3 = q1 && q2 && isABCDE(asString(parsed.q3)) ? asString(parsed.q3) : undefined;
    const q4 = q1 && q2 && q3 && isABC(asString(parsed.q4)) ? asString(parsed.q4) : undefined;
    const q5 = q1 && q2 && q3 && q4 && isABC(asString(parsed.q5)) ? asString(parsed.q5) : undefined;
    const answered = Number(Boolean(q1)) + Number(Boolean(q2)) + Number(Boolean(q3)) + Number(Boolean(q4)) + Number(Boolean(q5));
    if (!answered || answered >= cat.totalSteps) return null;
    const qp = new URLSearchParams();
    if (q1) qp.set("q1", q1);
    if (q2) qp.set("q2", q2);
    if (q3) qp.set("q3", q3);
    if (q4) qp.set("q4", q4);
    if (q5) qp.set("q5", q5);
    const step = !q1 ? 1 : !q2 ? 2 : !q3 ? 3 : !q4 ? 4 : 5;
    qp.set("step", String(step));
    return { key: cat.key, answered, total: cat.totalSteps, continueHref: `${cat.profileHref}?${qp.toString()}` };
  }

  const q1 = isABCD(asString(parsed.q1)) ? asString(parsed.q1) : undefined;
  const q2 = q1 && isABC(asString(parsed.q2)) ? asString(parsed.q2) : undefined;
  const q3 = q1 && q2 && isABC(asString(parsed.q3)) ? asString(parsed.q3) : undefined;
  const q4 = q1 && q2 && q3 && isABCDE(asString(parsed.q4)) ? asString(parsed.q4) : undefined;
  const q5 = q1 && q2 && q3 && q4 && isABCD(asString(parsed.q5)) ? asString(parsed.q5) : undefined;
  const answered = Number(Boolean(q1)) + Number(Boolean(q2)) + Number(Boolean(q3)) + Number(Boolean(q4)) + Number(Boolean(q5));
  if (!answered || answered >= cat.totalSteps) return null;
  const qp = new URLSearchParams();
  if (q1) qp.set("q1", q1);
  if (q2) qp.set("q2", q2);
  if (q3) qp.set("q3", q3);
  if (q4) qp.set("q4", q4);
  if (q5) qp.set("q5", q5);
  const step = !q1 ? 1 : !q2 ? 2 : !q3 ? 3 : !q4 ? 4 : 5;
  qp.set("step", String(step));
  return { key: cat.key, answered, total: cat.totalSteps, continueHref: `${cat.profileHref}?${qp.toString()}` };
}

function isCategoryKey(v: string | null): v is CategoryKey {
  return v === "shampoo" || v === "bodywash" || v === "conditioner" || v === "lotion" || v === "cleanser";
}

export default function MobileChoose() {
  const [selectedKey, setSelectedKey] = useState<CategoryKey>("shampoo");
  const [drafts, setDrafts] = useState<Partial<Record<CategoryKey, DraftProgress>>>({});
  const [recentResultHref, setRecentResultHref] = useState<Partial<Record<CategoryKey, string>>>({});
  const railRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Partial<Record<CategoryKey, HTMLButtonElement | null>>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncFromStorage = () => {
      const nextDrafts: Partial<Record<CategoryKey, DraftProgress>> = {};
      const nextRecentResult: Partial<Record<CategoryKey, string>> = {};

      for (const cat of CATS) {
        const draftRaw = window.localStorage.getItem(cat.draftKey);
        const parsedDraft = parseDraft(cat, draftRaw);
        if (parsedDraft) {
          nextDrafts[cat.key] = parsedDraft;
        } else if (draftRaw) {
          window.localStorage.removeItem(cat.draftKey);
        }

        const recentMeta = LAST_RESULT_QUERY_META[cat.key];
        const rawRecentQuery = window.localStorage.getItem(recentMeta.key);
        const normalizedRecentQuery = recentMeta.normalize(rawRecentQuery);
        if (normalizedRecentQuery) {
          nextRecentResult[cat.key] = `${cat.resultHref}?${normalizedRecentQuery}`;
        } else if (rawRecentQuery) {
          window.localStorage.removeItem(recentMeta.key);
        }
      }

      const storedSelected = window.localStorage.getItem(CHOOSE_SELECTED_CATEGORY_KEY);
      const firstDraftKey = CATS.find((cat) => Boolean(nextDrafts[cat.key]))?.key;
      const nextSelected = isCategoryKey(storedSelected) ? storedSelected : firstDraftKey || "shampoo";

      setSelectedKey((prev) => (prev === nextSelected ? prev : nextSelected));
      setDrafts(nextDrafts);
      setRecentResultHref(nextRecentResult);
    };

    const rafId = window.requestAnimationFrame(syncFromStorage);
    window.addEventListener("focus", syncFromStorage);
    window.addEventListener("storage", syncFromStorage);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("focus", syncFromStorage);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) return;
    const rail = railRef.current;
    if (!rail) return;

    const ratioByKey = new Map<CategoryKey, number>();
    const pickMostVisible = () => {
      let next: CategoryKey | null = null;
      let bestRatio = 0;
      for (const cat of CATS) {
        const ratio = ratioByKey.get(cat.key) || 0;
        if (ratio > bestRatio) {
          bestRatio = ratio;
          next = cat.key;
        }
      }
      if (!next || bestRatio < 0.52) return;
      setSelectedKey((prev) => {
        if (prev === next) return prev;
        window.localStorage.setItem(CHOOSE_SELECTED_CATEGORY_KEY, next);
        return next;
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const key = (entry.target as HTMLElement).dataset.categoryKey as CategoryKey | undefined;
          if (!key || !isCategoryKey(key)) continue;
          ratioByKey.set(key, entry.intersectionRatio);
        }
        pickMostVisible();
      },
      {
        root: rail,
        threshold: [0.15, 0.35, 0.52, 0.68, 0.85],
      },
    );

    for (const cat of CATS) {
      const node = cardRefs.current[cat.key];
      if (node) observer.observe(node);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  const onSelect = useCallback((key: CategoryKey) => {
    setSelectedKey(key);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CHOOSE_SELECTED_CATEGORY_KEY, key);
    }
  }, []);

  const selected = CAT_MAP[selectedKey];
  const selectedDraft = drafts[selected.key] || null;
  const selectedRecentResultHref = recentResultHref[selected.key] || null;
  const fallbackDraft = useMemo(() => CATS.map((cat) => drafts[cat.key] || null).find(Boolean) || null, [drafts]);
  const continueDraft = selectedDraft || fallbackDraft;
  const continueCat = continueDraft ? CAT_MAP[continueDraft.key] : null;

  return (
    <div className="m-choose-shell">
      <div className="m-profile-step-index">个性测配</div>
      <h1 className="m-choose-title">选一个品类，30 秒拿到唯一答案。</h1>
      <p className="m-choose-note">点选后直接进入对应品类，按问题一路完成即可。</p>

      {continueDraft && continueCat ? (
        <Link href={continueDraft.continueHref} className="m-choose-continue m-pressable">
          <div className="m-choose-continue-kicker">继续上次测配</div>
          <div className="m-choose-continue-title">{continueCat.zh}</div>
          <p className="m-choose-continue-note">
            已完成 {continueDraft.answered}/{continueDraft.total} 步，继续即可直接回到未完成题目。
          </p>
        </Link>
      ) : null}

      <div className="m-choose-rail" ref={railRef}>
        {CATS.map((cat) => {
          const active = selected.key === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(cat.key)}
              data-category-key={cat.key}
              ref={(node) => {
                cardRefs.current[cat.key] = node;
              }}
              className={`m-choose-stage m-pressable ${active ? "m-choose-stage-active" : ""}`}
            >
              <div className="m-choose-stage-image">
                <Image src={cat.image} alt={cat.zh} width={212} height={150} className="h-[136px] w-[212px] object-contain" />
              </div>
              <div className="mt-3 text-left">
                <div className="m-choose-stage-title">{cat.zh}</div>
                <div className="m-choose-stage-meta">{cat.summary}</div>
                <div className="m-choose-stage-note">{cat.detail}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="m-choose-action m-choose-action-dock">
        <div className="m-choose-action-title">当前选择 · {selected.zh}</div>
        <div className="m-choose-action-note">{selected.detail}</div>

        <div className="mt-4 flex flex-wrap gap-2.5">
          <Link
            href={selectedDraft ? selectedDraft.continueHref : selected.startHref}
            className="m-profile-primary-btn inline-flex h-11 items-center justify-center px-5 text-[15px] font-semibold tracking-[-0.01em]"
          >
            {selectedDraft ? `继续${selected.zh}测配` : `开始${selected.zh}测配`}
          </Link>
          {selectedRecentResultHref ? (
            <Link href={selectedRecentResultHref} className="m-profile-secondary-btn inline-flex">
              查看最近结果
            </Link>
          ) : (
            <button type="button" disabled className="m-profile-secondary-btn inline-flex opacity-45">
              查看最近结果
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
