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

const DIAL_REPEAT = 5;
const DIAL_MIDDLE_LOOP = Math.floor(DIAL_REPEAT / 2);

const DIAL_ITEMS: Array<{ slot: number; loop: number; cat: CategoryMeta }> = Array.from(
  { length: DIAL_REPEAT },
  (_, loop) =>
    CATS.map((cat, index) => ({
      slot: loop * CATS.length + index,
      loop,
      cat,
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
  const [selectedKey, setSelectedKey] = useState<CategoryKey>("shampoo");
  const [drafts, setDrafts] = useState<Partial<Record<CategoryKey, DraftProgress>>>({});
  const [recentResultHref, setRecentResultHref] = useState<Partial<Record<CategoryKey, string>>>({});
  const dialRef = useRef<HTMLDivElement | null>(null);
  const dialItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const dialReadyRef = useRef(false);
  const scrollRafRef = useRef<number | null>(null);

  const persistSelectedKey = useCallback((key: CategoryKey) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CHOOSE_SELECTED_CATEGORY_KEY, key);
    }
  }, []);

  const centerDialSlot = useCallback((slot: number, behavior: ScrollBehavior) => {
    const rail = dialRef.current;
    const node = dialItemRefs.current[slot];
    if (!rail || !node) return;
    const left = node.offsetLeft - (rail.clientWidth - node.offsetWidth) / 2;
    rail.scrollTo({ left, behavior });
  }, []);

  const slotToKey = useCallback((slot: number): CategoryKey => {
    const normalized = ((slot % CATS.length) + CATS.length) % CATS.length;
    return CATS[normalized]?.key || "shampoo";
  }, []);

  const pickCenteredSlot = useCallback((): number | null => {
    const rail = dialRef.current;
    if (!rail) return null;
    const railRect = rail.getBoundingClientRect();
    const centerX = railRect.left + railRect.width / 2;
    let bestSlot = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < dialItemRefs.current.length; index += 1) {
      const node = dialItemRefs.current[index];
      if (!node) continue;
      const rect = node.getBoundingClientRect();
      const nodeCenter = rect.left + rect.width / 2;
      const distance = Math.abs(nodeCenter - centerX);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestSlot = index;
      }
    }

    return bestSlot >= 0 ? bestSlot : null;
  }, []);

  const moveSlotToMiddleLoop = useCallback(
    (slot: number): number => {
      const lowerBoundary = CATS.length;
      const upperBoundary = CATS.length * (DIAL_REPEAT - 2) - 1;
      if (slot >= lowerBoundary && slot <= upperBoundary) {
        return slot;
      }

      const normalized = ((slot % CATS.length) + CATS.length) % CATS.length;
      const middleSlot = DIAL_MIDDLE_LOOP * CATS.length + normalized;
      centerDialSlot(middleSlot, "auto");
      return middleSlot;
    },
    [centerDialSlot],
  );

  const selectBySlot = useCallback(
    (slot: number) => {
      const stableSlot = moveSlotToMiddleLoop(slot);
      const key = slotToKey(stableSlot);
      setSelectedKey((prev) => {
        if (prev === key) return prev;
        persistSelectedKey(key);
        return key;
      });
    },
    [moveSlotToMiddleLoop, persistSelectedKey, slotToKey],
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
    if (typeof window === "undefined") return;
    if (!dialRef.current || !dialItemRefs.current.length) return;

    const selectedIndex = CATS.findIndex((cat) => cat.key === selectedKey);
    if (selectedIndex < 0) return;

    const targetSlot = DIAL_MIDDLE_LOOP * CATS.length + selectedIndex;

    if (!dialReadyRef.current) {
      const rafId = window.requestAnimationFrame(() => {
        centerDialSlot(targetSlot, "auto");
        dialReadyRef.current = true;
      });
      return () => {
        window.cancelAnimationFrame(rafId);
      };
    }

    const centeredSlot = pickCenteredSlot();
    if (centeredSlot === null) return;
    if (slotToKey(centeredSlot) !== selectedKey) {
      centerDialSlot(targetSlot, "auto");
    }
  }, [centerDialSlot, pickCenteredSlot, selectedKey, slotToKey]);

  useEffect(() => {
    return () => {
      if (typeof window === "undefined") return;
      if (scrollRafRef.current !== null) {
        window.cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, []);

  const onDialScroll = useCallback(() => {
    if (typeof window === "undefined") return;
    if (scrollRafRef.current !== null) {
      window.cancelAnimationFrame(scrollRafRef.current);
    }
    scrollRafRef.current = window.requestAnimationFrame(() => {
      const slot = pickCenteredSlot();
      if (slot === null) return;
      selectBySlot(slot);
    });
  }, [pickCenteredSlot, selectBySlot]);

  const onSelectDialItem = useCallback(
    (slot: number, key: CategoryKey) => {
      setSelectedKey((prev) => {
        if (prev === key) return prev;
        persistSelectedKey(key);
        return key;
      });
      centerDialSlot(slot, "smooth");
    },
    [centerDialSlot, persistSelectedKey],
  );

  const selected = CAT_MAP[selectedKey];
  const selectedDraft = drafts[selected.key] || null;
  const selectedRecentResultHref = recentResultHref[selected.key] || null;
  const recentEntryHref = selectedRecentResultHref || "/m/me?tab=selection";

  return (
    <div className="m-choose-shell">
      <div className="m-choose-head">
        <div className="m-profile-step-index">个性测评</div>
        <Link href={recentEntryHref} className="m-choose-recent m-pressable">
          最近结果
        </Link>
      </div>

      <div className="m-choose-dial-wrap">
        <div className="m-choose-dial-label">全部品类</div>
        <div className="m-choose-dial" ref={dialRef} onScroll={onDialScroll} role="tablist" aria-label="选择测评品类">
          {DIAL_ITEMS.map((item) => {
            const active = selected.key === item.cat.key;
            return (
              <button
                key={`${item.loop}-${item.cat.key}`}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelectDialItem(item.slot, item.cat.key)}
                className={`m-choose-dial-item m-pressable ${active ? "m-choose-dial-item-active" : ""}`}
                ref={(node) => {
                  dialItemRefs.current[item.slot] = node;
                }}
              >
                {item.cat.zh}
              </button>
            );
          })}
        </div>
      </div>

      <article className="m-choose-focus-card">
        <div className="m-choose-focus-image">
          <Image src={selected.image} alt={selected.zh} width={224} height={160} className="h-[152px] w-[224px] object-contain" />
        </div>
        <div className="m-choose-focus-body">
          <div className="m-choose-focus-title">{selected.zh}</div>
          <div className="m-choose-focus-meta">{selected.summary}</div>
          <p className="m-choose-focus-note">{selected.detail}</p>
        </div>
      </article>

      <div className="m-choose-action-wrap">
        <Link
          href={selectedDraft ? selectedDraft.continueHref : selected.startHref}
          className="m-profile-primary-btn m-choose-primary-btn inline-flex items-center justify-center"
        >
          {selectedDraft ? `继续${selected.zh}测配` : `开始${selected.zh}测配`}
        </Link>
      </div>
    </div>
  );
}
