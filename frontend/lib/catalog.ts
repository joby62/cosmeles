export type CategoryKey = "shampoo" | "bodywash" | "conditioner" | "lotion" | "cleanser";

export type CategoryConfig = {
  key: CategoryKey;
  zh: string;
  en: string;
  tagline: string; // 类别副标题
  // 后端 products 列表里 p.category 的值（你后端现在是 "shampoo" 这种）
  apiCategory: string;

  // 这个品类主推的 product_id（你给我的 5 个）
  featuredProductId: string;

  // Apple 风格：短促有冲击力的类目卖点
  bullets: string[];
};

export const CATEGORY_CONFIG: Record<CategoryKey, CategoryConfig> = {
  shampoo: {
    key: "shampoo",
    zh: "洗发水",
    en: "Shampoo",
    tagline: "为头皮与发丝而生",
    apiCategory: "shampoo",
    featuredProductId: "db1422ec-6263-45cc-966e-0ee9292fd8f1",
    bullets: ["清洁与蓬松", "柔顺不过度", "日常好用"],
  },
  bodywash: {
    key: "bodywash",
    zh: "沐浴露",
    en: "Body Wash",
    tagline: "更舒服的沐浴体验",
    apiCategory: "bodywash",
    featuredProductId: "5839e60e-ce27-4b83-ab84-cd349126046c",
    bullets: ["温和清洁", "香气更克制", "肤感更润"],
  },
  conditioner: {
    key: "conditioner",
    zh: "护发素",
    en: "Conditioner",
    tagline: "更顺滑，更易梳",
    apiCategory: "conditioner",
    featuredProductId: "b43ab8f2-f4b2-4d7d-b691-b9c4d2c6c5bc",
    bullets: ["快速顺滑", "减少打结", "光泽更自然"],
  },
  lotion: {
    key: "lotion",
    zh: "润肤露",
    en: "Lotion",
    tagline: "保湿与肤感优先",
    apiCategory: "lotion",
    featuredProductId: "f6774685-cd03-4b99-a606-ef8af9ce1bad",
    bullets: ["长效保湿", "不粘腻", "四季可用"],
  },
  cleanser: {
    key: "cleanser",
    zh: "洗面奶",
    en: "Cleanser",
    tagline: "干净，但不紧绷",
    apiCategory: "cleanser",
    featuredProductId: "39fe09a5-65ab-40ed-b52b-1033159bab23",
    bullets: ["净澈但温和", "减少干涩", "适合通勤"],
  },
};

export const TOP_CATEGORIES: CategoryKey[] = [
  "shampoo",
  "bodywash",
  "conditioner",
  "lotion",
  "cleanser",
];

export function isCategoryKey(v: unknown): v is CategoryKey {
  return typeof v === "string" && (TOP_CATEGORIES as string[]).includes(v);
}
