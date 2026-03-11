// frontend/lib/taxonomy.ts

export type NavItem = {
  label: string
  slug: string
}

export type NavGroup = {
  title: string
  items: NavItem[]
}

export type CategoryNav = {
  slug: string
  label: string
  groups: NavGroup[]
}

export const TAXONOMY: CategoryNav[] = [
  {
    slug: "shampoo",
    label: "洗发水",
    groups: [
      {
        title: "探索",
        items: [
          { label: "控油清爽", slug: "oil-control" },
          { label: "去屑止痒", slug: "anti-dandruff" },
          { label: "修护受损", slug: "repair" },
          { label: "蓬松丰盈", slug: "volume" },
          { label: "护色维稳", slug: "color-care" },
          { label: "头皮舒缓", slug: "scalp-soothe" },
        ],
      },
      {
        title: "适合谁",
        items: [
          { label: "油性头皮", slug: "oily-scalp" },
          { label: "敏感头皮", slug: "sensitive-scalp" },
          { label: "染烫受损", slug: "damaged-hair" },
        ],
      },
      {
        title: "更多",
        items: [
          { label: "成分与配方逻辑", slug: "ingredients" },
          { label: "如何选择洗发水", slug: "how-to-choose" },
        ],
      },
    ],
  },

  {
    slug: "body-wash",
    label: "沐浴露",
    groups: [
      {
        title: "探索",
        items: [
          { label: "温和清洁", slug: "gentle-clean" },
          { label: "深度保湿", slug: "hydrating" },
          { label: "去角质焕肤", slug: "exfoliating" },
          { label: "净肤祛痘", slug: "acne-care" },
          { label: "舒缓修护", slug: "soothing" },
        ],
      },
      {
        title: "适合谁",
        items: [
          { label: "干性肤质", slug: "dry-skin" },
          { label: "敏感肤质", slug: "sensitive-skin" },
          { label: "易出汗人群", slug: "active" },
        ],
      },
      {
        title: "更多",
        items: [
          { label: "沐浴露 vs 香皂", slug: "bodywash-vs-soap" },
          { label: "成分与刺激性说明", slug: "ingredients" },
        ],
      },
    ],
  },
]