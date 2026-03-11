"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
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

const DEFAULT_CATEGORY_KEY: CategoryKey = "shampoo";
const CHOOSE_SELECTED_CATEGORY_KEY = "mx_mobile_choose_selected_category_v1";

const CATS: CategoryMeta[] = [
  {
    key: "shampoo",
    zh: "洗发水",
    image: "/m/categories/shampoo.png",
    startHref: "/m/shampoo/profile?step=1",
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
    startHref: "/m/bodywash/profile?step=1",
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
    startHref: "/m/conditioner/profile?step=1",
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
    startHref: "/m/lotion/profile?step=1",
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
    startHref: "/m/cleanser/profile?step=1",
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

const CAT_INDEX_MAP: Record<CategoryKey, number> = CATS.reduce((acc, cat, index) => {
  acc[cat.key] = index;
  return acc;
}, {} as Record<CategoryKey, number>);

const CARD_REPEAT = 7;
const CARD_LOOP_SIZE = CATS.length;
const CARD_MIDDLE_LOOP = Math.floor(CARD_REPEAT / 2);
const MIDDLE_CARD_BASE_INDEX = CARD_LOOP_SIZE * CARD_MIDDLE_LOOP;
const CARD_RECENTER_DELTA = MIDDLE_CARD_BASE_INDEX;
const CARD_RECENTER_MIN_INDEX = CARD_LOOP_SIZE;
const CARD_RECENTER_MAX_INDEX = CARD_LOOP_SIZE * (CARD_REPEAT - 1) - 1;
const DEFAULT_CARD_INDEX = MIDDLE_CARD_BASE_INDEX + CAT_INDEX_MAP[DEFAULT_CATEGORY_KEY];

const CARD_ITEMS: Array<{ id: string; cat: CategoryMeta; realIndex: number }> = Array.from(
  { length: CARD_REPEAT },
  (_, loop) =>
    CATS.map((cat, index) => ({
      id: `loop-${loop}-${cat.key}`,
      cat,
      realIndex: index,
    })),
).flat();

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
  const [selectedKey, setSelectedKey] = useState<CategoryKey>(DEFAULT_CATEGORY_KEY);
  const [drafts, setDrafts] = useState<Partial<Record<CategoryKey, DraftProgress>>>({});
  const [recentResultHref, setRecentResultHref] = useState<Partial<Record<CategoryKey, string>>>({});
  const [railsReady, setRailsReady] = useState(false);
  const cardRailRef = useRef<HTMLDivElement | null>(null);
  const cardItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const cardScrollRafRef = useRef<number | null>(null);
  const cardSettleTimerRef = useRef<number | null>(null);
  const activeCardIndexRef = useRef<number>(DEFAULT_CARD_INDEX);
  const autoCycleTimerRef = useRef<number | null>(null);
  const autoCycleStoppedRef = useRef(false);
  const lastHapticAtRef = useRef(0);

  const persistSelectedKey = useCallback((key: CategoryKey) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CHOOSE_SELECTED_CATEGORY_KEY, key);
    }
  }, []);

  const stopAutoCycle = useCallback(() => {
    autoCycleStoppedRef.current = true;
    if (typeof window === "undefined") return;
    if (autoCycleTimerRef.current !== null) {
      window.clearInterval(autoCycleTimerRef.current);
      autoCycleTimerRef.current = null;
    }
  }, []);

  const clearCardSettleTimer = useCallback(() => {
    if (typeof window === "undefined") return;
    if (cardSettleTimerRef.current !== null) {
      window.clearTimeout(cardSettleTimerRef.current);
      cardSettleTimerRef.current = null;
    }
  }, []);

  const pulseSelectionHaptic = useCallback(() => {
    if (typeof window === "undefined") return;
    const now = Date.now();
    if (now - lastHapticAtRef.current < 120) return;
    lastHapticAtRef.current = now;
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([8, 14, 8]);
    }
  }, []);

  const alignCardIndex = useCallback((slot: number, behavior: ScrollBehavior) => {
    const rail = cardRailRef.current;
    const node = cardItemRefs.current[slot];
    if (!rail || !node) return;
    rail.scrollTo({ left: node.offsetLeft, behavior });
  }, []);

  const keyToMiddleCardIndex = useCallback((key: CategoryKey): number => {
    const index = CAT_INDEX_MAP[key];
    if (!Number.isFinite(index)) return DEFAULT_CARD_INDEX;
    return MIDDLE_CARD_BASE_INDEX + index;
  }, []);

  const recenterCardRail = useCallback((index: number): number => {
    let targetIndex = index;
    if (index < CARD_RECENTER_MIN_INDEX) {
      targetIndex = index + CARD_RECENTER_DELTA;
    } else if (index > CARD_RECENTER_MAX_INDEX) {
      targetIndex = index - CARD_RECENTER_DELTA;
    }
    if (targetIndex === index) return index;

    const rail = cardRailRef.current;
    const fromNode = cardItemRefs.current[index];
    const toNode = cardItemRefs.current[targetIndex];
    if (!rail || !fromNode || !toNode) return index;

    const offsetInsideCard = rail.scrollLeft - fromNode.offsetLeft;
    rail.scrollTo({ left: toNode.offsetLeft + offsetInsideCard, behavior: "auto" });
    return targetIndex;
  }, []);

  const pickNearestCardIndex = useCallback((): number | null => {
    const rail = cardRailRef.current;
    if (!rail) return null;
    const targetLeft = rail.scrollLeft;
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < cardItemRefs.current.length; index += 1) {
      const node = cardItemRefs.current[index];
      if (!node) continue;
      const distance = Math.abs(node.offsetLeft - targetLeft);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    return bestIndex >= 0 ? bestIndex : null;
  }, []);

  const pickClosestCardIndexForKey = useCallback(
    (key: CategoryKey, fromIndex: number): number => {
      let bestIndex = -1;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let index = 0; index < CARD_ITEMS.length; index += 1) {
        if (CARD_ITEMS[index]?.cat.key !== key) continue;
        const distance = Math.abs(index - fromIndex);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      }
      return bestIndex >= 0 ? bestIndex : keyToMiddleCardIndex(key);
    },
    [keyToMiddleCardIndex],
  );

  const applySelectedKey = useCallback(
    (key: CategoryKey, withHaptic: boolean) => {
      setSelectedKey((prev) => {
        if (prev === key) return prev;
        persistSelectedKey(key);
        if (withHaptic) {
          pulseSelectionHaptic();
        }
        return key;
      });
    },
    [persistSelectedKey, pulseSelectionHaptic],
  );

  const settleCardRail = useCallback(() => {
    const nearestIndex = pickNearestCardIndex();
    if (nearestIndex === null) return;
    const recenteredIndex = recenterCardRail(nearestIndex);
    activeCardIndexRef.current = recenteredIndex;
    alignCardIndex(recenteredIndex, "auto");
    const key = CARD_ITEMS[recenteredIndex]?.cat.key || DEFAULT_CATEGORY_KEY;
    applySelectedKey(key, autoCycleStoppedRef.current);
  }, [alignCardIndex, applySelectedKey, pickNearestCardIndex, recenterCardRail]);

  const scheduleCardSettle = useCallback(() => {
    if (typeof window === "undefined") return;
    clearCardSettleTimer();
    cardSettleTimerRef.current = window.setTimeout(() => {
      settleCardRail();
    }, 88);
  }, [clearCardSettleTimer, settleCardRail]);

  const scrollToCategory = useCallback(
    (key: CategoryKey, behavior: ScrollBehavior) => {
      const stabilizedCurrent = recenterCardRail(activeCardIndexRef.current);
      activeCardIndexRef.current = stabilizedCurrent;
      const targetIndex = pickClosestCardIndexForKey(key, stabilizedCurrent);
      activeCardIndexRef.current = targetIndex;
      alignCardIndex(targetIndex, behavior);
    },
    [alignCardIndex, pickClosestCardIndexForKey, recenterCardRail],
  );

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
      const nextSelected = isCategoryKey(storedSelected) ? storedSelected : firstDraftKey || DEFAULT_CATEGORY_KEY;

      setSelectedKey((prev) => (prev === nextSelected ? prev : nextSelected));
      setRailsReady(false);
      autoCycleStoppedRef.current = false;
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
    if (typeof window === "undefined") return;
    if (!cardRailRef.current) return;
    if (!cardItemRefs.current.length) return;
    const targetIndex = keyToMiddleCardIndex(selectedKey);

    if (!railsReady) {
      const rafId = window.requestAnimationFrame(() => {
        alignCardIndex(targetIndex, "auto");
        activeCardIndexRef.current = targetIndex;
        setRailsReady(true);
      });
      return () => {
        window.cancelAnimationFrame(rafId);
      };
    }
  }, [alignCardIndex, keyToMiddleCardIndex, railsReady, selectedKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!railsReady || autoCycleStoppedRef.current) return;
    if (autoCycleTimerRef.current !== null) {
      window.clearInterval(autoCycleTimerRef.current);
    }

    autoCycleTimerRef.current = window.setInterval(() => {
      if (autoCycleStoppedRef.current) return;
      const stabilizedCurrent = recenterCardRail(activeCardIndexRef.current);
      let nextIndex = stabilizedCurrent + 1;
      if (nextIndex >= CARD_ITEMS.length) {
        nextIndex = keyToMiddleCardIndex(CARD_ITEMS[stabilizedCurrent]?.cat.key || DEFAULT_CATEGORY_KEY);
      }
      const nextKey = CARD_ITEMS[nextIndex]?.cat.key || DEFAULT_CATEGORY_KEY;
      activeCardIndexRef.current = nextIndex;
      applySelectedKey(nextKey, false);
      alignCardIndex(nextIndex, "smooth");
    }, 2600);

    return () => {
      if (autoCycleTimerRef.current !== null) {
        window.clearInterval(autoCycleTimerRef.current);
        autoCycleTimerRef.current = null;
      }
    };
  }, [alignCardIndex, applySelectedKey, keyToMiddleCardIndex, railsReady, recenterCardRail]);

  useEffect(() => {
    return () => {
      if (typeof window === "undefined") return;
      if (cardScrollRafRef.current !== null) {
        window.cancelAnimationFrame(cardScrollRafRef.current);
      }
      if (autoCycleTimerRef.current !== null) {
        window.clearInterval(autoCycleTimerRef.current);
      }
      clearCardSettleTimer();
    };
  }, [clearCardSettleTimer]);

  const onCardScroll = useCallback(() => {
    if (typeof window === "undefined") return;
    if (cardScrollRafRef.current !== null) {
      window.cancelAnimationFrame(cardScrollRafRef.current);
    }
    cardScrollRafRef.current = window.requestAnimationFrame(() => {
      const nearestIndex = pickNearestCardIndex();
      if (nearestIndex === null) return;
      const recenteredIndex = recenterCardRail(nearestIndex);
      activeCardIndexRef.current = recenteredIndex;
      const key = CARD_ITEMS[recenteredIndex]?.cat.key || DEFAULT_CATEGORY_KEY;
      applySelectedKey(key, autoCycleStoppedRef.current);
      scheduleCardSettle();
    });
  }, [applySelectedKey, pickNearestCardIndex, recenterCardRail, scheduleCardSettle]);

  const onSelectTag = useCallback(
    (key: CategoryKey) => {
      stopAutoCycle();
      applySelectedKey(key, true);
      scrollToCategory(key, "smooth");
    },
    [applySelectedKey, scrollToCategory, stopAutoCycle],
  );

  const onSelectCardItem = useCallback(
    (key: CategoryKey) => {
      stopAutoCycle();
      applySelectedKey(key, true);
      scrollToCategory(key, "smooth");
    },
    [applySelectedKey, scrollToCategory, stopAutoCycle],
  );

  const selected = CAT_MAP[selectedKey];
  const selectedDraft = drafts[selected.key] || null;
  const selectedRecentResultHref = recentResultHref[selected.key] || null;
  const recentEntryHref = selectedRecentResultHref || "/m/me/history?tab=selection";

  return (
    <div className="m-choose-shell" onPointerDownCapture={stopAutoCycle} onTouchStartCapture={stopAutoCycle} onWheelCapture={stopAutoCycle}>
      <div className="m-choose-head">
        <div className="m-choose-head-chip">个性测配</div>
        <Link href={recentEntryHref} className="m-choose-recent m-pressable">
          最近结果
        </Link>
      </div>

      <div className="m-choose-dial-wrap">
        <div className="m-choose-dial-shell">
          <div className="m-choose-dial" role="tablist" aria-label="选择测配品类">
            {CATS.map((cat) => {
              const active = selected.key === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onSelectTag(cat.key)}
                  className={`m-choose-dial-item m-pressable ${active ? "m-choose-dial-item-active" : ""}`}
                >
                  {cat.zh}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        className="m-choose-focus-rail"
        ref={cardRailRef}
        onScroll={onCardScroll}
        aria-label="滑动选择品类卡片"
      >
        {CARD_ITEMS.map((item, index) => {
          const cat = item.cat;
          const active = selected.key === cat.key;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelectCardItem(cat.key)}
              className={`m-choose-focus-card m-pressable ${active ? "m-choose-focus-card-active" : ""}`}
              ref={(node) => {
                cardItemRefs.current[index] = node;
              }}
            >
              <div className="m-choose-focus-main">
                <div className="m-choose-focus-title">{cat.zh}</div>
                <div className="m-choose-focus-meta">{cat.summary}</div>
                <p className="m-choose-focus-note">{cat.detail}</p>
              </div>
              <div className="m-choose-focus-image-shell">
                <div className="m-choose-focus-image">
                  <Image src={cat.image} alt={cat.zh} width={220} height={150} className="h-[148px] w-[220px] object-contain" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="m-choose-cta-dock">
        <div className="m-choose-cta-inner">
          <div className="m-choose-action-wrap">
            <Link
              href={selectedDraft ? selectedDraft.continueHref : selected.startHref}
              className="m-profile-primary-btn m-choose-primary-btn inline-flex items-center justify-center"
            >
              {selectedDraft ? "继续测配" : "开始测配"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
