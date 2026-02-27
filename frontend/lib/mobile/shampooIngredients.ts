export type ShampooIngredientShowcase = {
  slug: string;
  name: string;
  tagline: string;
  preview: string;
  heroLabel: string;
  heroSub: string;
  heroClassName: string;
  why: string;
  mechanism: string[];
  fit: string;
  caution: string;
  usage: string;
};

export const SHAMPOO_INGREDIENT_SHOWCASE: ShampooIngredientShowcase[] = [
  {
    slug: "pca-zinc",
    name: "PCA 锌",
    tagline: "控油核心",
    preview: "抑制油脂分泌过快的“指令端”，让蓬松时间更长。",
    heroLabel: "ZnPCA",
    heroSub: "Oil Balance Core",
    heroClassName:
      "bg-[radial-gradient(circle_at_28%_22%,rgba(236,250,255,0.96),rgba(199,231,245,0.9)_42%,rgba(168,206,223,0.9)_72%,rgba(145,187,208,0.95)_100%)]",
    why: "重油头最怕上午刚洗、下午就塌。PCA 锌优先作用在控油节奏上，帮你把“复油速度”降下来。",
    mechanism: [
      "调节皮脂分泌通路，降低过快出油节奏。",
      "与清洁体系配合时，可减少“洗完很快再油”的反复。",
      "适合和温和剥脱成分（如低浓度水杨酸）搭配，稳定油脂环境。",
    ],
    fit: "大油头、发根易贴头皮、头皮易闷味人群。",
    caution: "若头皮处于明显红痛炎症期，先走舒缓修护线，不要盲目加大控油强度。",
    usage: "建议二次清洁法：第二次泡沫停留 30-60 秒后冲净。",
  },
  {
    slug: "salicylic-acid",
    name: "水杨酸",
    tagline: "毛囊疏通",
    preview: "脂溶性深入毛囊口，清理油脂栓和老废角质。",
    heroLabel: "BHA",
    heroSub: "Follicle Clarity",
    heroClassName:
      "bg-[radial-gradient(circle_at_72%_18%,rgba(238,255,244,0.98),rgba(205,239,219,0.92)_44%,rgba(169,217,191,0.92)_74%,rgba(142,195,171,0.96)_100%)]",
    why: "如果你有“头皮油但总觉得洗不透”的感受，问题往往在毛囊口堆积。水杨酸能把这层堵塞慢慢剥开。",
    mechanism: [
      "脂溶性角质管理，优先作用于油脂堆积区域。",
      "减少毛囊口堵塞，降低闭口样头皮痘风险。",
      "配合锌盐类成分时，更容易形成长期控油节奏。",
    ],
    fit: "头皮偏油、易闷堵、运动后复油快的人群。",
    caution: "干敏头皮需要降低频次；刺痛、脱屑明显时先停用回退温和线。",
    usage: "每周 2-4 次更稳妥，不建议一上来每天高频重刷。",
  },
  {
    slug: "oct",
    name: "吡罗克酮乙醇胺盐（OCT）",
    tagline: "去屑主力",
    preview: "针对马拉色菌失衡，从源头压低头屑与瘙痒反复。",
    heroLabel: "OCT",
    heroSub: "Anti-Dandruff Lead",
    heroClassName:
      "bg-[radial-gradient(circle_at_30%_14%,rgba(247,244,255,0.98),rgba(222,213,246,0.92)_44%,rgba(193,179,236,0.9)_74%,rgba(162,147,221,0.95)_100%)]",
    why: "有屑且痒不是“洗不干净”那么简单，核心是真菌负荷失衡。OCT 是更稳妥的日用去屑主力。",
    mechanism: [
      "抑制头屑相关真菌增殖，降低反复概率。",
      "在同等清洁条件下，较少牺牲头皮舒适度。",
      "与止痒成分同配时，可兼顾“快止痒 + 慢稳态”。",
    ],
    fit: "头屑可见、阵发性发痒、洗后次日反复人群。",
    caution: "头皮有破损/渗出应先就医；无屑人群不建议长期高频用强去屑线。",
    usage: "关键是停留 3-5 分钟再冲洗，立刻冲掉等于功效折损。",
  },
  {
    slug: "panthenol-b5",
    name: "泛醇（维生素 B5）",
    tagline: "舒缓保湿",
    preview: "渗透角质层补水，缓和干痒与紧绷反馈。",
    heroLabel: "B5",
    heroSub: "Barrier Comfort",
    heroClassName:
      "bg-[radial-gradient(circle_at_68%_20%,rgba(255,247,236,0.99),rgba(248,228,204,0.94)_44%,rgba(234,204,171,0.92)_76%,rgba(220,184,147,0.95)_100%)]",
    why: "敏感头皮常常不是“没洗净”，而是屏障先掉线。B5 通过补水和舒缓让头皮先恢复可持续耐受。",
    mechanism: [
      "补充角质层水分，减少紧绷和干痒。",
      "辅助减轻刺激后不适，提升日常耐受。",
      "适合与 APG/氨基酸表活组合，构建低刺激清洁链路。",
    ],
    fit: "换季敏感、发红刺痛、洗后容易紧绷人群。",
    caution: "若伴随明显油腻闷堵，应与适度清洁成分平衡，不要只保湿不清洁。",
    usage: "建议搭配温水与轻按摩手法，避免高温热水抵消舒缓效果。",
  },
  {
    slug: "hydrolyzed-wheat-protein",
    name: "水解小麦蛋白",
    tagline: "发根支撑",
    preview: "在发丝表面形成轻膜，提升单根硬度和视觉蓬松度。",
    heroLabel: "HWP",
    heroSub: "Volume Support",
    heroClassName:
      "bg-[radial-gradient(circle_at_28%_22%,rgba(242,248,255,0.98),rgba(211,225,245,0.9)_42%,rgba(176,197,234,0.9)_73%,rgba(146,171,217,0.95)_100%)]",
    why: "细软塌不一定是油太多，也可能是发丝支撑力不足。水解小麦蛋白属于“减负不减支撑”的关键插件。",
    mechanism: [
      "在发丝形成轻质支撑膜，提高根部立体度。",
      "降低贴头皮视觉，改善“洗完很快塌”的观感。",
      "和无硅油体系协同，保持轻盈不压根。",
    ],
    fit: "细软塌、视觉发量少、希望轻盈蓬松的人群。",
    caution: "粗硬自然卷可能出现蓬松过度，需结合保湿修护成分平衡。",
    usage: "洗后逆着发根吹风，能把这类支撑成分的体感放大。",
  },
];

export function getShampooIngredientBySlug(slug: string): ShampooIngredientShowcase | undefined {
  return SHAMPOO_INGREDIENT_SHOWCASE.find((item) => item.slug === slug);
}
