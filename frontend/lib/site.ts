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
    label: "Shampoo",
    shortLabel: "Hair cleanse",
    eyebrow: "Hair",
    description: "Build a lighter cleanse, a more balanced wash rhythm, and a clearer scalp routine.",
    routineHint: "Best when you want a cleaner start without guesswork.",
  },
  conditioner: {
    key: "conditioner",
    label: "Conditioner",
    shortLabel: "Hair finish",
    eyebrow: "Hair",
    description: "Compare slip, softness, repair feel, and how much weight your hair can comfortably carry.",
    routineHint: "Best when frizz, roughness, or breakage is getting in the way.",
  },
  bodywash: {
    key: "bodywash",
    label: "Body Wash",
    shortLabel: "Body cleanse",
    eyebrow: "Body",
    description: "Choose a cleaner body routine around comfort, rinse feel, and day-to-day tolerance.",
    routineHint: "Best when your body routine needs a daily reset.",
  },
  lotion: {
    key: "lotion",
    label: "Lotion",
    shortLabel: "Body moisture",
    eyebrow: "Body",
    description: "Start with moisture level, finish preference, and how much repair support you actually want.",
    routineHint: "Best when dryness or barrier support is top priority.",
  },
  cleanser: {
    key: "cleanser",
    label: "Cleanser",
    shortLabel: "Face cleanse",
    eyebrow: "Skin",
    description: "Filter for skin comfort, cleansing load, and how your skin behaves across the week.",
    routineHint: "Best when sensitivity and daily comfort need to stay in balance.",
  },
};

export const CATEGORIES = CATEGORY_ORDER.map((key) => CATEGORY_META[key]);

export const SHOP_CONCERNS: ConcernMeta[] = [
  {
    key: "dryness",
    label: "Dryness",
    description: "Start with softer routines and recovery-minded texture choices.",
    href: "/collections/dryness",
  },
  {
    key: "frizz",
    label: "Frizz",
    description: "Compare conditioners that reduce roughness without flattening the routine.",
    href: "/collections/frizz",
  },
  {
    key: "sensitivity",
    label: "Sensitivity",
    description: "Keep the product list tighter and the irritation load lower.",
    href: "/collections/sensitivity",
  },
  {
    key: "oil-control",
    label: "Oil control",
    description: "Prioritize cleaner reset options for scalp and skin routines.",
    href: "/collections/oil-control",
  },
  {
    key: "barrier-support",
    label: "Barrier support",
    description: "Center the routine around comfort, replenishment, and lower friction.",
    href: "/collections/barrier-support",
  },
];

export const TRUST_ITEMS = [
  "US shipping",
  "Easy returns",
  "Full ingredient transparency",
];

export const PRIMARY_NAV = [
  { href: "/shop", label: "Shop" },
  { href: "/match", label: "Match" },
  { href: "/compare", label: "Compare" },
  { href: "/learn", label: "Learn" },
  { href: "/about", label: "About" },
] as const;

export const SUPPORT_NAV = [
  { href: "/support/shipping", label: "Shipping" },
  { href: "/support/returns", label: "Returns" },
  { href: "/support/faq", label: "FAQ" },
  { href: "/support/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/cookies", label: "Cookies" },
] as const;

export const LEARN_TOPICS = [
  {
    title: "How to build a lower-friction routine",
    summary: "Start with fewer products, clearer roles, and more consistent use.",
    href: "/learn",
  },
  {
    title: "What to compare before you buy",
    summary: "Texture, daily tolerance, wash feel, and routine fit matter more than hype.",
    href: "/compare",
  },
  {
    title: "How Jeslect thinks about ingredients",
    summary: "Ingredient transparency is part of product trust, not a hidden appendix.",
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
