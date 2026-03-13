"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MobileSelectionCategory } from "@/lib/api";
import { formatDecisionDurationSummary, listDecisionCategories } from "@/domain/mobile/decision/catalog";
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

type CategoryKey = MobileSelectionCategory;

type CategoryMeta = {
  key: CategoryKey;
  zh: string;
  image: string;
  startHref: string;
  resultHref: string;
  profileHref: string;
  totalSteps: number;
  summary: string;
  audience: string;
  focusAudience: string;
  draftKey: string;
};

type DraftProgress = {
  key: CategoryKey;
  answered: number;
  total: number;
  continueHref: string;
  audience: string;
};

const DEFAULT_CATEGORY_KEY: CategoryKey = "shampoo";
const CHOOSE_SELECTED_CATEGORY_KEY = "mx_mobile_choose_selected_category_v1";

const CATEGORY_PRESENTATION: Record<
  CategoryKey,
  {
    image: string;
    audience: string;
    focusAudience: string;
    draftKey: string;
  }
> = {
  shampoo: {
    image: "/m/categories/shampoo.png",
    audience: "头皮容易出油，也在意头屑、敏感或发丝状态",
    focusAudience: "头皮容易出油",
    draftKey: SHAMPOO_PROFILE_DRAFT_KEY,
  },
  bodywash: {
    image: "/m/categories/bodywash.png",
    audience: "既想洗得舒服，也想一起判断粗糙、痘痘或耐受问题",
    focusAudience: "想洗得舒服稳定",
    draftKey: BODYWASH_PROFILE_DRAFT_KEY,
  },
  conditioner: {
    image: "/m/categories/conditioner.png",
    audience: "发丝有受损、毛躁、打结，或很怕一用就塌",
    focusAudience: "发丝毛躁打结",
    draftKey: CONDITIONER_PROFILE_DRAFT_KEY,
  },
  lotion: {
    image: "/m/categories/lotion.png",
    audience: "身体容易干痒粗糙，或很在意质地负担和修护续航",
    focusAudience: "身体干痒粗糙",
    draftKey: LOTION_PROFILE_DRAFT_KEY,
  },
  cleanser: {
    image: "/m/categories/cleanser.png",
    audience: "想同时兼顾清洁力、敏感度和洗后肤感",
    focusAudience: "洗后怕紧绷",
    draftKey: CLEANSER_PROFILE_DRAFT_KEY,
  },
};

const CATS: CategoryMeta[] = listDecisionCategories().map((cat) => {
  const presentation = CATEGORY_PRESENTATION[cat.key];
  return {
    key: cat.key,
    zh: cat.labelZh,
    image: presentation.image,
    startHref: `/m/${cat.key}/profile?step=1`,
    resultHref: `/m/${cat.key}/result`,
    profileHref: `/m/${cat.key}/profile`,
    totalSteps: cat.questionCount,
    summary: formatDecisionDurationSummary(cat),
    audience: presentation.audience,
    focusAudience: presentation.focusAudience,
    draftKey: presentation.draftKey,
  };
});

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

const SHAMPOO_AUDIENCE = {
  q1: {
    A: "头皮一天不洗就油",
    B: "头皮两三天洗一次刚好",
    C: "头皮偏干或出油慢",
  },
  q2: {
    A: "有头屑发痒困扰",
    B: "头皮容易发红刺痛",
    C: "掉发明显、发根脆弱",
    D: "想把头皮状态维持稳定",
  },
  q3: {
    A: "经常染烫、发丝干枯",
    B: "细软易塌、想保住蓬松",
    C: "想把头皮和发丝都维持平衡",
  },
} as const;

const BODYWASH_AUDIENCE = {
  q1: {
    A: "处在干燥偏冷环境",
    B: "处在干热环境",
    C: "处在潮湿闷热环境",
    D: "处在潮湿偏冷环境",
  },
  q2: {
    A: "皮肤很怕刺激",
    B: "更想优先看肤感和效果",
  },
  q3: {
    A: "身体容易出油或反复冒痘",
    B: "洗后常常干涩紧绷",
    C: "皮肤粗糙起颗粒",
    D: "只想日常洗得舒服稳定",
  },
  q4: {
    A: "更想要清爽洗感",
    B: "更想要柔滑不拔干",
  },
  q5: {
    A: "非常在意纯净和低刺激",
    B: "在意留香氛围",
  },
} as const;

const CONDITIONER_AUDIENCE = {
  c_q1: {
    A: "频繁染烫、发丝很受损",
    B: "经常热工具、发丝轻中度受损",
    C: "原生发但也想保持手感",
  },
  c_q2: {
    A: "细软易贴头皮",
    B: "粗硬毛躁、难打理",
    C: "发丝状态比较适中",
  },
  c_q3: {
    A: "想先把锁色留住",
    B: "想先解决打结和不顺",
    C: "想保住自然蓬松",
  },
} as const;

const LOTION_AUDIENCE = {
  q1: {
    A: "长时间待在干冷环境",
    B: "天气热又容易出汗",
    C: "换季温差大、皮肤容易不稳",
    D: "日常环境相对温和",
  },
  q2: {
    A: "皮肤容易敏感泛红",
    B: "更想直接看实际修护和肤感",
  },
  q3: {
    A: "身体经常干到起屑发痒",
    B: "前胸后背容易冒痘",
    C: "手臂大腿粗糙起颗粒",
    D: "在意暗沉和肤色不均",
    E: "只想稳定做日常保养",
  },
  q4: {
    A: "只接受轻薄快吸收",
    B: "想要平衡型滋润",
    C: "需要更厚的包裹感",
  },
  q5: {
    A: "非常在意纯净低刺激",
    B: "在意留香体验",
    C: "更看重实际功效",
  },
} as const;

const CLEANSER_AUDIENCE = {
  q1: {
    A: "本身就是大油皮",
    B: "混油、T 区更爱出油",
    C: "中性或混干",
    D: "天生偏干、洗后很怕紧绷",
  },
  q2: {
    A: "皮肤很容易泛红刺痛",
    B: "换季时偶尔敏感",
    C: "皮肤耐受相对稳定",
  },
  q3: {
    A: "每天都带妆或高倍防晒",
    B: "日常通勤防晒和淡妆",
    C: "基本素颜，只想把日常皮脂洗舒服",
  },
  q4: {
    A: "黑头闭口反复出现",
    B: "正在反复冒红肿痘",
    C: "暗沉粗糙、想更平滑",
    D: "洗后很容易紧绷缺水",
    E: "只想日常稳定维持",
  },
  q5: {
    A: "喜欢丰富泡沫",
    B: "偏爱极致清爽",
    C: "更喜欢洗后保留水润感",
    D: "更接受低泡和温和感",
  },
} as const;

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

function uniqAudienceParts(parts: Array<string | undefined>, fallback: string): string {
  const seen = new Set<string>();
  const compact = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .filter((part) => {
      if (seen.has(part)) return false;
      seen.add(part);
      return true;
    })
    .slice(0, 3);
  return compact.length ? compact.join("、") : fallback;
}

function pickPrimaryAudience(audience: string, fallback: string): string {
  const normalized = audience.trim();
  if (!normalized) return fallback;
  const first = normalized
    .split(/[，,。；;、]/)
    .map((part) => part.trim())
    .find(Boolean);
  return first || fallback;
}

function describeShampooAudience(signals: { q1?: "A" | "B" | "C"; q2?: "A" | "B" | "C" | "D"; q3?: "A" | "B" | "C" }): string {
  return uniqAudienceParts(
    [
      signals.q2 ? SHAMPOO_AUDIENCE.q2[signals.q2] : undefined,
      signals.q1 ? SHAMPOO_AUDIENCE.q1[signals.q1] : undefined,
      signals.q3 ? SHAMPOO_AUDIENCE.q3[signals.q3] : undefined,
    ],
    CAT_MAP.shampoo.audience,
  );
}

function describeBodyWashAudience(signals: {
  q1?: "A" | "B" | "C" | "D";
  q2?: "A" | "B";
  q3?: "A" | "B" | "C" | "D";
  q4?: "A" | "B";
  q5?: "A" | "B";
}): string {
  return uniqAudienceParts(
    [
      signals.q3 ? BODYWASH_AUDIENCE.q3[signals.q3] : undefined,
      signals.q2 ? BODYWASH_AUDIENCE.q2[signals.q2] : undefined,
      signals.q4 ? BODYWASH_AUDIENCE.q4[signals.q4] : undefined,
      signals.q5 ? BODYWASH_AUDIENCE.q5[signals.q5] : undefined,
      signals.q1 ? BODYWASH_AUDIENCE.q1[signals.q1] : undefined,
    ],
    CAT_MAP.bodywash.audience,
  );
}

function describeConditionerAudience(signals: { c_q1?: "A" | "B" | "C"; c_q2?: "A" | "B" | "C"; c_q3?: "A" | "B" | "C" }): string {
  return uniqAudienceParts(
    [
      signals.c_q1 ? CONDITIONER_AUDIENCE.c_q1[signals.c_q1] : undefined,
      signals.c_q2 ? CONDITIONER_AUDIENCE.c_q2[signals.c_q2] : undefined,
      signals.c_q3 ? CONDITIONER_AUDIENCE.c_q3[signals.c_q3] : undefined,
    ],
    CAT_MAP.conditioner.audience,
  );
}

function describeLotionAudience(signals: {
  q1?: "A" | "B" | "C" | "D";
  q2?: "A" | "B";
  q3?: "A" | "B" | "C" | "D" | "E";
  q4?: "A" | "B" | "C";
  q5?: "A" | "B" | "C";
}): string {
  return uniqAudienceParts(
    [
      signals.q3 ? LOTION_AUDIENCE.q3[signals.q3] : undefined,
      signals.q2 ? LOTION_AUDIENCE.q2[signals.q2] : undefined,
      signals.q4 ? LOTION_AUDIENCE.q4[signals.q4] : undefined,
      signals.q5 ? LOTION_AUDIENCE.q5[signals.q5] : undefined,
      signals.q1 ? LOTION_AUDIENCE.q1[signals.q1] : undefined,
    ],
    CAT_MAP.lotion.audience,
  );
}

function describeCleanserAudience(signals: {
  q1?: "A" | "B" | "C" | "D";
  q2?: "A" | "B" | "C";
  q3?: "A" | "B" | "C";
  q4?: "A" | "B" | "C" | "D" | "E";
  q5?: "A" | "B" | "C" | "D";
}): string {
  return uniqAudienceParts(
    [
      signals.q4 ? CLEANSER_AUDIENCE.q4[signals.q4] : undefined,
      signals.q2 ? CLEANSER_AUDIENCE.q2[signals.q2] : undefined,
      signals.q1 ? CLEANSER_AUDIENCE.q1[signals.q1] : undefined,
      signals.q5 ? CLEANSER_AUDIENCE.q5[signals.q5] : undefined,
      signals.q3 ? CLEANSER_AUDIENCE.q3[signals.q3] : undefined,
    ],
    CAT_MAP.cleanser.audience,
  );
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
    return {
      key: cat.key,
      answered,
      total: cat.totalSteps,
      continueHref: `${cat.profileHref}?${qp.toString()}`,
      audience: describeShampooAudience({
        q1: q1 as "A" | "B" | "C" | undefined,
        q2: q2 as "A" | "B" | "C" | "D" | undefined,
        q3: q3 as "A" | "B" | "C" | undefined,
      }),
    };
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
    return {
      key: cat.key,
      answered,
      total: cat.totalSteps,
      continueHref: `${cat.profileHref}?${qp.toString()}`,
      audience: describeBodyWashAudience({
        q1: q1 as "A" | "B" | "C" | "D" | undefined,
        q2: q2 as "A" | "B" | undefined,
        q3: q3 as "A" | "B" | "C" | "D" | undefined,
        q4: q4 as "A" | "B" | undefined,
        q5: q5 as "A" | "B" | undefined,
      }),
    };
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
    return {
      key: cat.key,
      answered,
      total: cat.totalSteps,
      continueHref: `${cat.profileHref}?${qp.toString()}`,
      audience: describeConditionerAudience({
        c_q1: cQ1 as "A" | "B" | "C" | undefined,
        c_q2: cQ2 as "A" | "B" | "C" | undefined,
        c_q3: cQ3 as "A" | "B" | "C" | undefined,
      }),
    };
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
    return {
      key: cat.key,
      answered,
      total: cat.totalSteps,
      continueHref: `${cat.profileHref}?${qp.toString()}`,
      audience: describeLotionAudience({
        q1: q1 as "A" | "B" | "C" | "D" | undefined,
        q2: q2 as "A" | "B" | undefined,
        q3: q3 as "A" | "B" | "C" | "D" | "E" | undefined,
        q4: q4 as "A" | "B" | "C" | undefined,
        q5: q5 as "A" | "B" | "C" | undefined,
      }),
    };
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
  return {
    key: cat.key,
    answered,
    total: cat.totalSteps,
    continueHref: `${cat.profileHref}?${qp.toString()}`,
    audience: describeCleanserAudience({
      q1: q1 as "A" | "B" | "C" | "D" | undefined,
      q2: q2 as "A" | "B" | "C" | undefined,
      q3: q3 as "A" | "B" | "C" | undefined,
      q4: q4 as "A" | "B" | "C" | "D" | "E" | undefined,
      q5: q5 as "A" | "B" | "C" | "D" | undefined,
    }),
  };
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
  const selectedFocusAudience = selectedDraft
    ? pickPrimaryAudience(selectedDraft.audience, selected.focusAudience)
    : selected.focusAudience;
  const remainingSteps = selectedDraft ? selectedDraft.total - selectedDraft.answered : 0;
  const chooseTitle = "先选最像你的一类";
  const chooseNote = `先从${selected.zh}开始，更适合${selectedFocusAudience}的人。`;
  const historyKicker = "上次记录";
  const historyTitle = selectedDraft
    ? "这次判断可以直接续上"
    : selectedRecentResultHref
      ? "上次结果还能直接回看"
      : "上次结果会留在这里";
  const historyNote = selectedDraft
    ? "你已经答过前面的题，回来会从刚才停下的位置继续。"
    : selectedRecentResultHref
      ? "状态没怎么变，就先回看上次结果；变了，再重新测一遍。"
      : "做完一次后，结果会自动留在这里，回来不用重新找。";
  const historyMeta = selectedDraft
    ? `${selected.zh} · 已完成 ${selectedDraft.answered}/${selectedDraft.total} · 还差 ${remainingSteps} 题`
    : selectedRecentResultHref
      ? `${selected.zh} · ${selected.summary}`
      : `${selected.zh} · 完成后会自动保留`;
  const historyActionHref = selectedDraft
    ? selectedDraft.continueHref
    : selectedRecentResultHref || "/m/me/history?tab=selection";
  const historyActionLabel = selectedDraft ? "继续" : selectedRecentResultHref ? "回看结果" : "查看历史";

  return (
    <div className="m-choose-shell" onPointerDownCapture={stopAutoCycle} onTouchStartCapture={stopAutoCycle} onWheelCapture={stopAutoCycle}>
      <section className="m-choose-hero" aria-label="个性测配">
        <div className="m-choose-head">
          <div className="m-choose-head-chip">选择测配</div>
          <h1 className="m-choose-head-title">{chooseTitle}</h1>
          <p className="m-choose-head-note">{chooseNote}</p>
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
            const cardDraft = drafts[cat.key] || null;
            const cardMeta = cardDraft ? `已完成 ${cardDraft.answered}/${cardDraft.total}` : cat.summary;
            const cardAudience = cardDraft ? pickPrimaryAudience(cardDraft.audience, cat.focusAudience) : cat.focusAudience;
            const cardNote = `更适合${cardAudience}的人`;
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
                  <div className="m-choose-focus-meta">{cardMeta}</div>
                  <p className="m-choose-focus-note">{cardNote}</p>
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

        <div className="m-choose-action-section">
          <div className="m-choose-action-wrap">
            <Link
              href={selectedDraft ? selectedDraft.continueHref : selected.startHref}
              className="m-profile-primary-btn m-choose-primary-btn inline-flex items-center justify-center"
            >
              {selectedDraft ? "继续测配" : "开始测配"}
            </Link>
          </div>
        </div>
      </section>

      <section className="m-choose-history-section" aria-label="上次记录">
        <div className="m-choose-history-card">
          <div className="m-choose-head-topline">
            <div className="m-choose-head-chip">{historyKicker}</div>
            <Link href={historyActionHref} className="m-choose-recent m-pressable">
              {historyActionLabel}
            </Link>
          </div>
          <h2 className="m-choose-head-title m-choose-history-title">{historyTitle}</h2>
          <p className="m-choose-head-note m-choose-history-note">{historyNote}</p>
          <p className="m-choose-history-meta">{historyMeta}</p>
        </div>
      </section>
    </div>
  );
}
