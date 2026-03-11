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
  desktopRoutes: Array<{
    key: string;
    title: string;
  }>;
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
    desktopRoutes: [
      { key: "deep-oil-control", title: "深层控油型" },
      { key: "anti-dandruff-itch", title: "去屑止痒型" },
      { key: "gentle-soothing", title: "温和舒缓型" },
      { key: "anti-hair-loss", title: "防脱强韧型" },
      { key: "moisture-balance", title: "水油平衡型" },
    ],
  },
  bodywash: {
    key: "bodywash",
    zh: "沐浴露",
    en: "Body Wash",
    tagline: "更舒服的沐浴体验",
    apiCategory: "bodywash",
    featuredProductId: "5839e60e-ce27-4b83-ab84-cd349126046c",
    bullets: ["温和清洁", "香气更克制", "肤感更润"],
    desktopRoutes: [
      { key: "rescue", title: "恒温舒缓修护型" },
      { key: "purge", title: "水杨酸净彻控油型" },
      { key: "polish", title: "乳酸尿素更新型" },
      { key: "glow", title: "氨基酸亮肤型" },
      { key: "shield", title: "脂类补充油膏型" },
      { key: "vibe", title: "轻盈香氛平衡型" },
    ],
  },
  conditioner: {
    key: "conditioner",
    zh: "护发素",
    en: "Conditioner",
    tagline: "更顺滑，更易梳",
    apiCategory: "conditioner",
    featuredProductId: "b43ab8f2-f4b2-4d7d-b691-b9c4d2c6c5bc",
    bullets: ["快速顺滑", "减少打结", "光泽更自然"],
    desktopRoutes: [
      { key: "c-color-lock", title: "锁色固色型" },
      { key: "c-airy-light", title: "轻盈蓬松型" },
      { key: "c-structure-rebuild", title: "结构修护型" },
      { key: "c-smooth-frizz", title: "柔顺抗躁型" },
      { key: "c-basic-hydrate", title: "基础保湿型" },
    ],
  },
  lotion: {
    key: "lotion",
    zh: "润肤露",
    en: "Lotion",
    tagline: "保湿与肤感优先",
    apiCategory: "lotion",
    featuredProductId: "f6774685-cd03-4b99-a606-ef8af9ce1bad",
    bullets: ["长效保湿", "不粘腻", "四季可用"],
    desktopRoutes: [
      { key: "light_hydrate", title: "轻盈保湿型" },
      { key: "heavy_repair", title: "重度修护型" },
      { key: "bha_clear", title: "BHA净痘型" },
      { key: "aha_renew", title: "AHA焕肤型" },
      { key: "glow_bright", title: "亮肤提光型" },
      { key: "vibe_fragrance", title: "留香氛围型" },
    ],
  },
  cleanser: {
    key: "cleanser",
    zh: "洗面奶",
    en: "Cleanser",
    tagline: "干净，但不紧绷",
    apiCategory: "cleanser",
    featuredProductId: "39fe09a5-65ab-40ed-b52b-1033159bab23",
    bullets: ["净澈但温和", "减少干涩", "适合通勤"],
    desktopRoutes: [
      { key: "apg_soothing", title: "APG舒缓型" },
      { key: "pure_amino", title: "纯氨基酸温和型" },
      { key: "soap_amino_blend", title: "皂氨复配清洁型" },
      { key: "bha_clearing", title: "BHA净肤型" },
      { key: "clay_purifying", title: "泥膜净化型" },
      { key: "enzyme_polishing", title: "酵素抛光型" },
    ],
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
