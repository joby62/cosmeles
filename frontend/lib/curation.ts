// frontend/lib/curation.ts
import type { CategoryKey } from "./catalog";

export const FEATURED_BY_CATEGORY: Record<CategoryKey, string> = {
  shampoo: "db1422ec-6263-45cc-966e-0ee9292fd8f1",
  bodywash: "39fe09a5-65ab-40ed-b52b-1033159bab23",
  conditioner: "5839e60e-ce27-4b83-ab84-cd349126046c",
  lotion: "b43ab8f2-f4b2-4d7d-b691-b9c4d2c6c5bc",
  cleanser: "f6774685-cd03-4b99-a606-ef8af9ce1bad",
};

// 方便以后做“功能/人群集合”的入口（先留空结构）
export const FEATURED_COLLECTIONS = [
  {
    key: "daily-gentle",
    title: "日常温和",
    subtitle: "敏感/通勤/长期用更安心",
    productIds: [
      "f6774685-cd03-4b99-a606-ef8af9ce1bad",
      "39fe09a5-65ab-40ed-b52b-1033159bab23",
    ],
  },
] as const;