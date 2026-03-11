export type ProductManagementSectionKey = "overview" | "pipeline" | "governance" | "ingredients";

export type ProductManagementSectionDef = {
  key: ProductManagementSectionKey;
  href: string;
  navLabelZh: string;
  navLabelEn: string;
  titleZh: string;
  summaryZh: string;
  bulletsZh: string[];
};

export const PRODUCT_MANAGEMENT_SECTIONS: ProductManagementSectionDef[] = [
  {
    key: "overview",
    href: "/product",
    navLabelZh: "产品总览",
    navLabelEn: "Overview",
    titleZh: "产品管理总览",
    summaryZh: "把产品生产、产品治理和成分治理拆成三条独立工作线，减少超长滚动页。",
    bulletsZh: ["统一入口", "工作线分流", "保持旧链接可达"],
  },
  {
    key: "pipeline",
    href: "/product/pipeline",
    navLabelZh: "产品流水线",
    navLabelEn: "Pipeline",
    titleZh: "产品生产流水线",
    summaryZh: "上传、同品归并、成分分析、类型映射和增强分析都在这里完成。",
    bulletsZh: ["上传解析", "同品归并", "增强分析"],
  },
  {
    key: "governance",
    href: "/product/governance",
    navLabelZh: "产品治理",
    navLabelEn: "Product Ops",
    titleZh: "产品治理",
    summaryZh: "查看展示结果、维护主推配置，并处理产品清理与引用修复。",
    bulletsZh: ["展示筛选", "主推配置", "产品清理"],
  },
  {
    key: "ingredients",
    href: "/product/ingredients",
    navLabelZh: "成分治理",
    navLabelEn: "Ingredient Ops",
    titleZh: "成分治理",
    summaryZh: "查看成分分布并执行批量清理，先看结构，再做治理。",
    bulletsZh: ["成分可视化", "成分清理", "结构校对"],
  },
];

export function getProductManagementSection(
  key: ProductManagementSectionKey,
): ProductManagementSectionDef {
  return PRODUCT_MANAGEMENT_SECTIONS.find((item) => item.key === key) || PRODUCT_MANAGEMENT_SECTIONS[0];
}
