export type CategoryKey = "shampoo" | "conditioner" | "bodywash" | "lotion" | "cleanser";

export type CategoryMeta = {
  key: CategoryKey;
  label: string;
  shortLabel: string;
  eyebrow: string;
  description: string;
  routineHint: string;
};

export type ConcernMeta = {
  key: "dryness" | "frizz" | "sensitivity" | "oil-control" | "barrier-support";
  label: string;
  description: string;
  href: string;
};

export const CATEGORY_ORDER: CategoryKey[] = ["shampoo", "conditioner", "bodywash", "lotion", "cleanser"];

export const CATEGORY_META: Record<CategoryKey, CategoryMeta> = {
  shampoo: {
    key: "shampoo",
    label: "洗发",
    shortLabel: "头皮清洁",
    eyebrow: "头发",
    description: "围绕清洁力、洗后蓬松感和头皮负担感，找到更适合日常节奏的洗发方案。",
    routineHint: "适合想把清洁做得更稳、更清楚，而不是靠猜的人。",
  },
  conditioner: {
    key: "conditioner",
    label: "护发",
    shortLabel: "发丝修护",
    eyebrow: "头发",
    description: "比较顺滑度、柔软度、修护感，以及你的发丝到底能承受多少重量。",
    routineHint: "适合毛躁、干涩、断裂感开始影响日常状态的时候。",
  },
  bodywash: {
    key: "bodywash",
    label: "沐浴",
    shortLabel: "身体清洁",
    eyebrow: "身体",
    description: "从舒适度、冲洗感和日常耐受出发，选更适合长期使用的身体清洁路线。",
    routineHint: "适合想把身体护理先收回到干净、舒服、可持续的人。",
  },
  lotion: {
    key: "lotion",
    label: "身体乳",
    shortLabel: "身体保湿",
    eyebrow: "身体",
    description: "先看保湿强度、肤感偏好和修护需求，再决定身体乳该走哪条路。",
    routineHint: "适合干燥、屏障支持和日常舒适感是当前重点的时候。",
  },
  cleanser: {
    key: "cleanser",
    label: "洁面",
    shortLabel: "面部清洁",
    eyebrow: "皮肤",
    description: "围绕清洁负担、皮肤舒适度和一周内的状态波动，选更稳的洁面方案。",
    routineHint: "适合敏感、紧绷和日常舒适感需要优先被照顾的时候。",
  },
};

export const CATEGORIES = CATEGORY_ORDER.map((key) => CATEGORY_META[key]);

export const SHOP_CONCERNS: ConcernMeta[] = [
  {
    key: "dryness",
    label: "干燥",
    description: "从舒缓、修护和更柔和的使用感出发，先把干燥感降下来。",
    href: "/collections/dryness",
  },
  {
    key: "frizz",
    label: "毛躁",
    description: "更关注顺滑和服帖，而不是一味堆厚重感。",
    href: "/collections/frizz",
  },
  {
    key: "sensitivity",
    label: "敏感",
    description: "先把刺激负担降下来，让候选列表收得更窄一些。",
    href: "/collections/sensitivity",
  },
  {
    key: "oil-control",
    label: "控油",
    description: "围绕更干净的头皮和肌肤状态，找到不过度拔干的路线。",
    href: "/collections/oil-control",
  },
  {
    key: "barrier-support",
    label: "屏障支持",
    description: "把舒适感、修护感和更低摩擦的日常节奏放到前面。",
    href: "/collections/barrier-support",
  },
];

export const TRUST_ITEMS = [
  "配送信息前置",
  "退货规则清楚",
  "成分透明可查",
];

export const PRIMARY_NAV = [
  { href: "/shop", label: "选购" },
  { href: "/match", label: "测配" },
  { href: "/compare", label: "对比" },
  { href: "/learn", label: "探索" },
  { href: "/about", label: "关于" },
] as const;

export const SUPPORT_NAV = [
  { href: "/support", label: "支持" },
  { href: "/support/shipping", label: "配送" },
  { href: "/support/returns", label: "退货" },
  { href: "/support/faq", label: "常见问题" },
  { href: "/support/contact", label: "联系" },
  { href: "/privacy", label: "隐私" },
  { href: "/terms", label: "条款" },
  { href: "/cookies", label: "Cookie 说明" },
] as const;

export const LEARN_TOPICS = [
  {
    title: "怎么把护理流程收得更低负担",
    summary: "从更少步骤、更清楚分工和更稳定的使用节奏开始。",
    href: "/learn",
  },
  {
    title: "买之前最该比较什么",
    summary: "质地、耐受、洗后肤发感和适配度，往往比营销词更重要。",
    href: "/compare",
  },
  {
    title: "婕选怎么理解成分",
    summary: "成分透明不是附录，而是信任层本身。",
    href: "/learn",
  },
] as const;

export function isCategoryKey(value: string): value is CategoryKey {
  return CATEGORY_ORDER.includes(value as CategoryKey);
}

export function normalizeCategoryKey(value: string | null | undefined): CategoryKey | null {
  const normalized = String(value || "").trim().toLowerCase();
  return isCategoryKey(normalized) ? normalized : null;
}

export function getCategoryMeta(value: string | null | undefined): CategoryMeta | null {
  const key = normalizeCategoryKey(value);
  return key ? CATEGORY_META[key] : null;
}

export function categoryHref(key: CategoryKey): string {
  return `/shop/${key}`;
}
