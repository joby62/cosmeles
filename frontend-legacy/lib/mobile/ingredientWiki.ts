export type WikiCategoryKey = "shampoo" | "bodywash" | "conditioner" | "lotion" | "cleanser";

export type IngredientCategory = {
  key: WikiCategoryKey;
  label: string;
  summary: string;
};

export const WIKI_ORDER: WikiCategoryKey[] = [
  "shampoo",
  "bodywash",
  "conditioner",
  "lotion",
  "cleanser",
];

export const WIKI_MAP: Record<WikiCategoryKey, IngredientCategory> = {
  shampoo: {
    key: "shampoo",
    label: "洗发水",
    summary: "洗发水的核心是“清洁力、头皮舒适、发丝手感”的平衡，不是成分越多越好。",
  },
  bodywash: {
    key: "bodywash",
    label: "沐浴露",
    summary: "沐浴露看三件事：洗后是否紧绷、冲洗是否干净、香味和刺激是否可长期接受。",
  },
  conditioner: {
    key: "conditioner",
    label: "护发素",
    summary: "护发素本质是“顺滑管理”，关键在发丝状态与使用手法匹配，而不是越厚越有效。",
  },
  lotion: {
    key: "lotion",
    label: "润肤霜",
    summary: "润肤霜优先级是“屏障稳定 > 功效堆叠”，先把舒适度拉稳，再考虑进阶。",
  },
  cleanser: {
    key: "cleanser",
    label: "洗面奶",
    summary: "洁面要解决的是“洗干净且不破坏耐受”，不是追求强脱脂或强刺激反馈。",
  },
};

export function isWikiCategoryKey(v?: string): v is WikiCategoryKey {
  return v === "shampoo" || v === "bodywash" || v === "conditioner" || v === "lotion" || v === "cleanser";
}
