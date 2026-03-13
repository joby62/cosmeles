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
    label: "干燥",
    heroTitle: "先把干燥感降下来，再决定需要多重的修护路线。",
    heroSummary:
      "这个专题页会把注意力放在舒适感、补充感和一周内更稳定的使用体验上，而不是把护理架子越堆越复杂。",
    shopperSummary:
      "当你更在意紧绷、缺水、干涩和长期舒适度时，可以先从这里缩小候选范围。",
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
    label: "毛躁",
    heroTitle: "当你想要的是更顺、更服帖，而不是盲目增加厚重感。",
    heroSummary:
      "这里会优先展示与顺滑、柔顺、表面平整度有关的路线，帮助你判断发丝到底能承受多少重量。",
    shopperSummary:
      "如果你主要在意炸毛、蓬散、发尾难打理或洗后不够服帖，可以先从这个专题进入。",
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
    label: "敏感",
    heroTitle: "先把刺激负担降下来，再谈更激进的功能诉求。",
    heroSummary:
      "这个专题会优先收敛到更低摩擦的清洁与舒缓路线，覆盖头皮、面部和身体护理中的敏感场景。",
    shopperSummary:
      "当刺痛、泛红、反应性或屏障脆弱比强功效更重要时，这里会是更好的起点。",
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
    label: "控油",
    heroTitle: "控油应该更有针对性，而不是默认更刺激、更拔干。",
    heroSummary:
      "这个专题会收敛到更干净的重置型路线，同时保留对头皮、皮肤和身体耐受度的判断。",
    shopperSummary:
      "如果你更在意出油速度、闷感、堵塞感或洗后发沉，这里会比泛泛的清洁页更高效。",
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
    label: "屏障支持",
    heroTitle: "在活性和营销词之前，先把舒适感和恢复感放到前面。",
    heroSummary:
      "这个专题围绕补充、舒缓清洁和更稳定的日常使用感展开，帮助你建立一条更低摩擦的修护路线。",
    shopperSummary:
      "如果你现在更关注恢复、保护感和减少反复折腾，而不是更强的清洁或去角质，这里更适合作为起点。",
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
