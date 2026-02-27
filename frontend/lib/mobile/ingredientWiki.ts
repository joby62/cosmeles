export type WikiCategoryKey = "shampoo" | "bodywash" | "conditioner" | "lotion" | "cleanser";

export type IngredientItem = {
  name: string;
  effect: string;
  fit: string;
  caution: string;
};

export type IngredientCategory = {
  key: WikiCategoryKey;
  label: string;
  summary: string;
  items: IngredientItem[];
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
    items: [
      {
        name: "氨基酸表活",
        effect: "清洁更温和，头皮紧绷感更低。",
        fit: "偏干、偏敏、日常高频清洗人群。",
        caution: "大油头若运动量大，可能会觉得去油不够快。",
      },
      {
        name: "甜菜碱（两性表活）",
        effect: "辅助起泡并降低刺激，提升整体温和度。",
        fit: "需要每天洗、追求稳定肤感的人群。",
        caution: "通常是辅助位，单靠它不决定清洁强弱。",
      },
      {
        name: "泛醇（维B5）",
        effect: "改善发丝干涩，提升顺滑与柔软感。",
        fit: "毛躁、发尾偏干、常吹风人群。",
        caution: "对头皮去油影响有限，不替代清洁成分。",
      },
      {
        name: "吡罗克酮乙醇胺（去屑）",
        effect: "帮助控制头屑相关困扰。",
        fit: "有头屑烦恼、需要温和去屑路线的人群。",
        caution: "持续明显头皮炎症应优先就医，不靠日化产品硬扛。",
      },
    ],
  },
  bodywash: {
    key: "bodywash",
    label: "沐浴露",
    summary: "沐浴露看三件事：洗后是否紧绷、冲洗是否干净、香味和刺激是否可长期接受。",
    items: [
      {
        name: "甘油",
        effect: "基础保湿，减少洗后发干与紧绷。",
        fit: "偏干、换季干冷、洗后容易发紧人群。",
        caution: "保湿感会受配方整体影响，不是越高越好。",
      },
      {
        name: "神经酰胺",
        effect: "帮助维持皮肤屏障，提升舒适稳定感。",
        fit: "偏干、偏敏、频繁洗澡人群。",
        caution: "若有明显皮肤问题，仍需皮肤科方案配合。",
      },
      {
        name: "烟酰胺",
        effect: "改善肤感粗糙与黯淡，辅助肤感细腻。",
        fit: "追求身体肌肤细腻度的人群。",
        caution: "敏感人群应先小范围测试耐受。",
      },
      {
        name: "水杨酸",
        effect: "帮助改善背部角质堆积与闷堵感。",
        fit: "背部易出油、易闷的人群。",
        caution: "偏干敏人群不宜高频使用高强度去角质线。",
      },
    ],
  },
  conditioner: {
    key: "conditioner",
    label: "护发素",
    summary: "护发素本质是“顺滑管理”，关键在发丝状态与使用手法匹配，而不是越厚越有效。",
    items: [
      {
        name: "硅油（如聚二甲基硅氧烷）",
        effect: "快速提升顺滑和抗打结表现。",
        fit: "打结、毛躁、发尾粗糙人群。",
        caution: "细软易塌人群要控制用量并避免碰到头皮。",
      },
      {
        name: "阳离子调理剂（季铵盐）",
        effect: "降低静电与毛躁，让发丝更服帖。",
        fit: "中长发、静电重、干燥季人群。",
        caution: "用量过大可能造成残留厚重感。",
      },
      {
        name: "角蛋白/氨基酸衍生物",
        effect: "改善受损发丝触感与弹性表现。",
        fit: "烫染后、发尾受损明显人群。",
        caution: "重度损伤需要持续护理，单次不会“修回原生发质”。",
      },
      {
        name: "脂肪醇（鲸蜡醇等）",
        effect: "提供柔润与顺滑底盘，降低干涩。",
        fit: "多数发质都受益，尤其发尾偏干。",
        caution: "细软发质建议少量多次，不要一次过量。",
      },
    ],
  },
  lotion: {
    key: "lotion",
    label: "润肤霜",
    summary: "润肤霜优先级是“屏障稳定 > 功效堆叠”，先把舒适度拉稳，再考虑进阶。",
    items: [
      {
        name: "神经酰胺",
        effect: "强化屏障稳定，减少干痒反复。",
        fit: "偏干、脆弱、易反复紧绷人群。",
        caution: "需连续使用一段时间，别频繁换品。",
      },
      {
        name: "尿素（低浓度）",
        effect: "软化粗糙角质，提升平滑触感。",
        fit: "手肘膝盖、小腿粗糙人群。",
        caution: "敏感泛红区域先谨慎尝试低浓度。",
      },
      {
        name: "角鲨烷",
        effect: "提供轻盈润泽，减轻干燥拉扯感。",
        fit: "怕油腻但又需要保湿的人群。",
        caution: "单一角鲨烷并不代表完整保湿体系。",
      },
      {
        name: "泛醇",
        effect: "舒缓干燥不适，辅助皮肤恢复稳定。",
        fit: "洗后紧绷、换季不适人群。",
        caution: "若持续明显刺痛泛红，应先回退到极简修护线。",
      },
    ],
  },
  cleanser: {
    key: "cleanser",
    label: "洗面奶",
    summary: "洁面要解决的是“洗干净且不破坏耐受”，不是追求强脱脂或强刺激反馈。",
    items: [
      {
        name: "氨基酸表活",
        effect: "温和清洁，减少洗后紧绷。",
        fit: "干敏、混合偏敏、晨间洁面人群。",
        caution: "大油皮夜间可能需要更完整清洁流程配合。",
      },
      {
        name: "葡糖苷表活",
        effect: "温和且冲净感较好，适合高频使用。",
        fit: "追求稳妥日常清洁的人群。",
        caution: "低泡不代表洗不净，关键看配方整体。",
      },
      {
        name: "甘油/透明质酸",
        effect: "提升洗后舒适，减少拔干。",
        fit: "洗后紧绷人群。",
        caution: "保湿成分不能替代防晒卸除步骤。",
      },
      {
        name: "水杨酸（低浓度）",
        effect: "辅助油脂角质管理，改善闷堵感。",
        fit: "油痘倾向、T 区易堵人群。",
        caution: "干敏或刺痛泛红人群应降低频次或回退温和线。",
      },
    ],
  },
};

export function isWikiCategoryKey(v?: string): v is WikiCategoryKey {
  return v === "shampoo" || v === "bodywash" || v === "conditioner" || v === "lotion" || v === "cleanser";
}
