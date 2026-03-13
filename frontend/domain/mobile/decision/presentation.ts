import type { MobileSelectionCategory } from "@/lib/api";

export type DecisionCategoryPresentation = {
  imageSrc: string;
  scene: string;
};

const CATEGORY_PRESENTATION: Record<MobileSelectionCategory, DecisionCategoryPresentation> = {
  shampoo: {
    imageSrc: "/m/categories/shampoo.png",
    scene: "头皮出油、头屑、敏感或发丝状态问题",
  },
  bodywash: {
    imageSrc: "/m/categories/bodywash.png",
    scene: "洗后干涩、长痘、粗糙或想洗得更舒服",
  },
  conditioner: {
    imageSrc: "/m/categories/conditioner.png",
    scene: "毛躁、打结、受损或一用就塌",
  },
  lotion: {
    imageSrc: "/m/categories/lotion.png",
    scene: "干痒粗糙、修护续航或质地负担问题",
  },
  cleanser: {
    imageSrc: "/m/categories/cleanser.png",
    scene: "清洁力、敏感度和洗后肤感拿不准",
  },
};

export function getDecisionCategoryPresentation(category: MobileSelectionCategory): DecisionCategoryPresentation {
  return CATEGORY_PRESENTATION[category];
}
