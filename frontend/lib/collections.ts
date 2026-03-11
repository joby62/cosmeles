import type { CategoryKey } from "@/lib/site";

export type ConcernCollectionKey =
  | "dryness"
  | "frizz"
  | "sensitivity"
  | "oil-control"
  | "barrier-support";

export type ConcernCollectionMeta = {
  key: ConcernCollectionKey;
  label: string;
  heroTitle: string;
  heroSummary: string;
  shopperSummary: string;
  routeKeys: Array<{ category: CategoryKey; routeKey: string }>;
  categoryKeys: CategoryKey[];
  matchCategory: CategoryKey;
  learnCategory: CategoryKey;
  suggestedSearches: string[];
};

export const CONCERN_COLLECTIONS: Record<ConcernCollectionKey, ConcernCollectionMeta> = {
  dryness: {
    key: "dryness",
    label: "Dryness",
    heroTitle: "Build a lower-friction routine for dryness before you overcomplicate the shelf.",
    heroSummary:
      "This collection keeps the focus on comfort, replenishment, and products that help skin or hair feel less stripped through the week.",
    shopperSummary:
      "Start here when the main job is restoring comfort, easing tightness, and keeping the routine from feeling harsher than it needs to.",
    routeKeys: [
      { category: "lotion", routeKey: "heavy_repair" },
      { category: "lotion", routeKey: "light_hydrate" },
      { category: "shampoo", routeKey: "moisture-balance" },
      { category: "cleanser", routeKey: "pure_amino" },
    ],
    categoryKeys: ["lotion", "shampoo", "cleanser"],
    matchCategory: "lotion",
    learnCategory: "lotion",
    suggestedSearches: ["dryness", "repair", "moisture", "comfort"],
  },
  frizz: {
    key: "frizz",
    label: "Frizz",
    heroTitle: "Use the frizz collection when smoother hair matters more than adding weight for weight’s sake.",
    heroSummary:
      "These routes center on slip, surface smoothness, and how much finish your hair can actually carry without collapsing.",
    shopperSummary:
      "Start here when roughness, puffiness, or hard-to-manage ends matter more than a general hydration pitch.",
    routeKeys: [
      { category: "conditioner", routeKey: "c-smooth-frizz" },
      { category: "conditioner", routeKey: "c-structure-rebuild" },
      { category: "conditioner", routeKey: "c-basic-hydrate" },
    ],
    categoryKeys: ["conditioner"],
    matchCategory: "conditioner",
    learnCategory: "conditioner",
    suggestedSearches: ["frizz", "smooth", "slip", "repair"],
  },
  sensitivity: {
    key: "sensitivity",
    label: "Sensitivity",
    heroTitle: "Sensitivity collections should tighten the field fast and keep irritation load lower.",
    heroSummary:
      "This collection filters toward lower-friction cleansing and comfort-first routes across skin, scalp, and body.",
    shopperSummary:
      "Start here when stinging, redness, reactivity, or barrier fragility matter more than chasing a stronger active path.",
    routeKeys: [
      { category: "cleanser", routeKey: "apg_soothing" },
      { category: "cleanser", routeKey: "pure_amino" },
      { category: "shampoo", routeKey: "gentle-soothing" },
      { category: "bodywash", routeKey: "rescue" },
    ],
    categoryKeys: ["cleanser", "shampoo", "bodywash"],
    matchCategory: "cleanser",
    learnCategory: "cleanser",
    suggestedSearches: ["sensitive", "soothing", "gentle", "barrier"],
  },
  "oil-control": {
    key: "oil-control",
    label: "Oil control",
    heroTitle: "Oil-control should feel targeted, not automatically harsh.",
    heroSummary:
      "This collection narrows toward cleaner reset routes for scalp, face, and body while keeping over-stripping in check.",
    shopperSummary:
      "Start here when faster oil buildup, congestion, or a heavier rinse feel is getting in the way of your routine.",
    routeKeys: [
      { category: "shampoo", routeKey: "deep-oil-control" },
      { category: "cleanser", routeKey: "bha_clearing" },
      { category: "cleanser", routeKey: "clay_purifying" },
      { category: "bodywash", routeKey: "purge" },
    ],
    categoryKeys: ["shampoo", "cleanser", "bodywash"],
    matchCategory: "shampoo",
    learnCategory: "cleanser",
    suggestedSearches: ["oil", "clarifying", "purifying", "clean"],
  },
  "barrier-support": {
    key: "barrier-support",
    label: "Barrier support",
    heroTitle: "Barrier-support collections should keep comfort visible before actives or hype take over.",
    heroSummary:
      "These routes center on replenishment, calmer cleansing, and products that help routines feel steadier and less reactive.",
    shopperSummary:
      "Start here when comfort, recovery, and a more protected feel matter more than a stronger exfoliating or clarifying route.",
    routeKeys: [
      { category: "lotion", routeKey: "heavy_repair" },
      { category: "lotion", routeKey: "light_hydrate" },
      { category: "cleanser", routeKey: "apg_soothing" },
      { category: "bodywash", routeKey: "shield" },
    ],
    categoryKeys: ["lotion", "cleanser", "bodywash"],
    matchCategory: "lotion",
    learnCategory: "lotion",
    suggestedSearches: ["barrier", "repair", "soothing", "comfort"],
  },
};

export const CONCERN_COLLECTION_LIST = Object.values(CONCERN_COLLECTIONS);

export function isConcernCollectionKey(value: string): value is ConcernCollectionKey {
  return Object.prototype.hasOwnProperty.call(CONCERN_COLLECTIONS, value);
}

export function normalizeConcernCollectionKey(value: string | null | undefined): ConcernCollectionKey | null {
  const normalized = String(value || "").trim().toLowerCase();
  return isConcernCollectionKey(normalized) ? normalized : null;
}

export function getConcernCollection(value: string | null | undefined): ConcernCollectionMeta | null {
  const key = normalizeConcernCollectionKey(value);
  return key ? CONCERN_COLLECTIONS[key] : null;
}

export function collectionHref(key: ConcernCollectionKey): string {
  return `/collections/${key}`;
}
