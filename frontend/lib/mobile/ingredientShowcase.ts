import { type WikiCategoryKey } from "@/lib/mobile/ingredientWiki";

export type IngredientShowcase = {
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

export const INGREDIENT_SHOWCASE_MAP: Record<WikiCategoryKey, IngredientShowcase[]> = {
  shampoo: [
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
  ],
  bodywash: [
    {
      slug: "glycerin",
      name: "甘油",
      tagline: "保湿底座",
      preview: "洗净后立即补水，减少“刚洗完就发紧”。",
      heroLabel: "Humectant",
      heroSub: "Hydration Base",
      heroClassName:
        "bg-[radial-gradient(circle_at_20%_20%,rgba(255,250,238,0.98),rgba(248,232,202,0.93)_46%,rgba(238,211,168,0.9)_74%,rgba(220,189,144,0.95)_100%)]",
      why: "沐浴露最常见翻车点是“洗得干净但皮肤发涩”。甘油是把舒适度拉回来的基础缓冲。",
      mechanism: [
        "吸湿保水，降低清洁后的经皮水分流失感。",
        "在表层形成柔润感，减少粗糙与拉扯。",
        "和温和表活配合时，能提升日常可持续使用感。",
      ],
      fit: "偏干肤质、秋冬洗后紧绷、需要天天洗澡人群。",
      caution: "极油肌肤仍需平衡清洁力，不建议只追求厚重保湿。",
      usage: "沐浴后 3 分钟内叠加润肤霜，保湿体验会更稳定。",
    },
    {
      slug: "ceramide",
      name: "神经酰胺",
      tagline: "屏障修护",
      preview: "把“越洗越薄”的屏障感拉回来，减少反复干痒。",
      heroLabel: "Ceramide",
      heroSub: "Barrier Repair",
      heroClassName:
        "bg-[radial-gradient(circle_at_76%_18%,rgba(239,247,255,0.98),rgba(208,225,244,0.92)_45%,rgba(174,197,231,0.9)_74%,rgba(145,171,214,0.95)_100%)]",
      why: "频繁清洁会让屏障“掉线”，神经酰胺能补回脂质结构，让皮肤稳定下来。",
      mechanism: [
        "补充角质层脂质，提升屏障完整度。",
        "降低外界刺激引发的反复泛痒。",
        "提升洗后舒适续航，不只是短暂润感。",
      ],
      fit: "敏感干痒、屏障脆弱、换季反复人群。",
      caution: "急性皮炎或破损期仍需医疗干预，不靠日化单独解决。",
      usage: "建议连续 2-4 周稳定使用，再评估是否需要增强功效线。",
    },
    {
      slug: "niacinamide",
      name: "烟酰胺",
      tagline: "肤感提亮",
      preview: "改善暗沉粗糙，提升身体肌肤细腻度。",
      heroLabel: "Vitamin B3",
      heroSub: "Tone & Texture",
      heroClassName:
        "bg-[radial-gradient(circle_at_28%_16%,rgba(252,246,255,0.99),rgba(230,214,246,0.93)_46%,rgba(205,183,233,0.9)_74%,rgba(177,154,217,0.95)_100%)]",
      why: "如果你不是单纯缺水，而是“肤色灰、肤感粗”，烟酰胺更容易给到可见变化。",
      mechanism: [
        "调节皮脂与角质代谢，改善粗糙感。",
        "帮助肤色均匀，减轻暗沉印象。",
        "与保湿体系叠加时，既稳又有感。",
      ],
      fit: "追求身体肌肤细腻度和亮泽度的人群。",
      caution: "高敏人群先做局部试用，观察耐受后再扩展使用。",
      usage: "与基础保湿并行更稳，不建议脱离补水单独猛上功效。",
    },
    {
      slug: "body-salicylic-acid",
      name: "水杨酸（身体线）",
      tagline: "背部净化",
      preview: "针对背部闷堵和角质堆积，洗感更“通透”。",
      heroLabel: "BHA Body",
      heroSub: "Pore Clarity",
      heroClassName:
        "bg-[radial-gradient(circle_at_72%_20%,rgba(236,255,248,0.99),rgba(204,237,223,0.93)_44%,rgba(168,214,196,0.91)_74%,rgba(140,191,173,0.95)_100%)]",
      why: "背部痘和粗糙常来自角质+油脂堆积，水杨酸能帮助清理这一层“闷盖”。",
      mechanism: [
        "脂溶性角质管理，聚焦毛孔区域。",
        "减少闷堵导致的粗糙和颗粒感。",
        "让后续保湿吸收感更均匀。",
      ],
      fit: "背部易闷、出汗后粗糙感明显人群。",
      caution: "干敏皮肤请降频，刺痛泛红时立即停用回退温和线。",
      usage: "建议隔天或每周 2-3 次，避免和多种去角质同日叠加。",
    },
  ],
  conditioner: [
    {
      slug: "dimethicone",
      name: "聚二甲基硅氧烷",
      tagline: "瞬时顺滑",
      preview: "快速抚平毛糙，降低梳理阻力。",
      heroLabel: "Silicone",
      heroSub: "Slip Control",
      heroClassName:
        "bg-[radial-gradient(circle_at_24%_18%,rgba(244,248,255,0.99),rgba(213,226,243,0.93)_45%,rgba(180,200,226,0.9)_74%,rgba(152,177,206,0.95)_100%)]",
      why: "毛躁打结最怕“越梳越断”。硅油提供即时润滑，先把摩擦降下来。",
      mechanism: [
        "在发丝表面形成低摩擦膜层。",
        "降低打结与静电，减少拉扯断裂。",
        "提升光泽与整齐度，改善粗糙手感。",
      ],
      fit: "中长发、毛躁打结、烫染后干涩人群。",
      caution: "细软塌发要控制用量并避开发根。",
      usage: "重点涂发中到发尾，停留 1-2 分钟后冲净。",
    },
    {
      slug: "polyquaternium-10",
      name: "聚季铵盐-10",
      tagline: "抗静电服帖",
      preview: "中和负电荷，让毛躁发更听话。",
      heroLabel: "PQ-10",
      heroSub: "Charge Balance",
      heroClassName:
        "bg-[radial-gradient(circle_at_76%_16%,rgba(255,244,240,0.99),rgba(246,214,204,0.92)_44%,rgba(229,185,170,0.9)_73%,rgba(208,157,141,0.95)_100%)]",
      why: "头发炸毛很多时候是电荷失衡。聚季铵盐能先把“炸”压住，再谈其他体验。",
      mechanism: [
        "中和发丝负电荷，降低静电飞散。",
        "提升发丝贴合度，改善凌乱感。",
        "辅助梳理顺畅度，减少机械损伤。",
      ],
      fit: "静电重、冬季毛躁、易飞发人群。",
      caution: "过量可能有残留厚重感，细软发建议减量。",
      usage: "短发按压半泵即可，宁少勿多，逐步加量。",
    },
    {
      slug: "hydrolyzed-keratin",
      name: "水解角蛋白",
      tagline: "结构修护",
      preview: "给受损发丝“补砖”，恢复韧性。",
      heroLabel: "Keratin",
      heroSub: "Structure Repair",
      heroClassName:
        "bg-[radial-gradient(circle_at_30%_20%,rgba(255,252,240,0.99),rgba(245,232,201,0.93)_45%,rgba(230,208,163,0.9)_74%,rgba(206,181,132,0.95)_100%)]",
      why: "染烫受损是结构问题，不是只靠“润”能解决。水解角蛋白更像补结构的关键件。",
      mechanism: [
        "填补受损发丝蛋白空隙。",
        "提升发丝抗拉与回弹表现。",
        "降低断裂与分叉扩散速度。",
      ],
      fit: "频繁染烫、发尾干枯易断人群。",
      caution: "重修护线会增加重量，细软发需搭配轻盈吹整策略。",
      usage: "建议每次洗发都用少量，持续使用比一次猛敷更有效。",
    },
    {
      slug: "cetyl-alcohol",
      name: "鲸蜡醇",
      tagline: "柔润底盘",
      preview: "让护发素“润而不空”，改善干涩触感。",
      heroLabel: "Fatty Alcohol",
      heroSub: "Soft Base",
      heroClassName:
        "bg-[radial-gradient(circle_at_68%_22%,rgba(250,248,255,0.99),rgba(229,221,245,0.92)_45%,rgba(205,191,233,0.9)_75%,rgba(176,160,214,0.95)_100%)]",
      why: "护发素没有柔润底盘就会“空顺滑”。鲸蜡醇负责把顺滑体验变得更稳定和持久。",
      mechanism: [
        "提供柔润触感，改善发丝干涩。",
        "增强调理剂附着稳定性，避免“冲完就没”。",
        "提高整体配方顺滑耐久。",
      ],
      fit: "大多数发质都适用，尤其发尾粗糙人群。",
      caution: "细软发一次用量过大可能压塌。",
      usage: "发尾重点、发根略过，冲净后不应有明显膜感残留。",
    },
  ],
  lotion: [
    {
      slug: "lotion-ceramide",
      name: "神经酰胺",
      tagline: "屏障核心",
      preview: "把脆弱屏障补回来，减少干痒反复。",
      heroLabel: "Ceramide",
      heroSub: "Barrier First",
      heroClassName:
        "bg-[radial-gradient(circle_at_26%_16%,rgba(241,247,255,0.99),rgba(213,225,244,0.92)_44%,rgba(179,197,229,0.9)_74%,rgba(149,172,211,0.95)_100%)]",
      why: "润肤霜最重要不是“立刻滑”，而是“第二天仍舒服”。神经酰胺决定这个底盘。",
      mechanism: [
        "补充角质层脂质，减少水分流失。",
        "降低环境刺激触发的反复干痒。",
        "支持长期稳定，不靠短时油润假象。",
      ],
      fit: "干敏、屏障脆弱、易反复紧绷人群。",
      caution: "急性炎症期需先就医评估，避免自行叠加太多活性。",
      usage: "洗后半干状态薄涂，连续 2 周观察稳定度。",
    },
    {
      slug: "urea",
      name: "尿素（低浓度）",
      tagline: "粗糙软化",
      preview: "改善角质堆积，让手肘膝盖不再“砂纸感”。",
      heroLabel: "Urea",
      heroSub: "Roughness Reset",
      heroClassName:
        "bg-[radial-gradient(circle_at_75%_18%,rgba(255,248,238,0.99),rgba(247,228,205,0.93)_44%,rgba(234,203,168,0.91)_75%,rgba(215,180,138,0.95)_100%)]",
      why: "局部粗糙常是角质堆积。低浓度尿素可以温和软化，不是暴力去角质。",
      mechanism: [
        "软化角质并提升含水量。",
        "降低粗糙颗粒感与干裂触感。",
        "提升后续保湿成分的体感效率。",
      ],
      fit: "手肘膝盖、小腿粗糙、干纹明显人群。",
      caution: "敏感泛红区域先小范围试用，刺痛则降频或停用。",
      usage: "局部点涂更有效，不必全身高频覆盖。",
    },
    {
      slug: "squalane",
      name: "角鲨烷",
      tagline: "轻润补脂",
      preview: "在不黏腻的前提下补回润泽感。",
      heroLabel: "Squalane",
      heroSub: "Light Lipid",
      heroClassName:
        "bg-[radial-gradient(circle_at_30%_22%,rgba(248,255,247,0.98),rgba(218,240,214,0.92)_44%,rgba(186,222,180,0.91)_74%,rgba(156,199,151,0.95)_100%)]",
      why: "怕油腻的人常把保湿做得太轻，反而更干。角鲨烷能补脂但不厚重，是折中解。",
      mechanism: [
        "模拟皮脂结构，改善干燥拉扯感。",
        "提升皮肤柔软度与延展性。",
        "与神经酰胺搭配时，稳定度更高。",
      ],
      fit: "想润但怕黏、需要白天也能接受的人群。",
      caution: "单一角鲨烷不是完整保湿体系，仍需水相保湿搭配。",
      usage: "白天薄涂，夜间可在干燥部位叠加一层。",
    },
    {
      slug: "lotion-panthenol",
      name: "泛醇",
      tagline: "舒缓补水",
      preview: "缓和干燥不适，降低换季“刺挠感”。",
      heroLabel: "B5",
      heroSub: "Comfort Boost",
      heroClassName:
        "bg-[radial-gradient(circle_at_70%_20%,rgba(255,246,241,0.99),rgba(248,220,210,0.93)_45%,rgba(236,192,178,0.9)_74%,rgba(218,165,149,0.95)_100%)]",
      why: "当问题是“总不舒服”而不是“总出油”，泛醇的舒缓补水比强化功效更实用。",
      mechanism: [
        "提升角质层含水量，减轻紧绷。",
        "缓和干燥引发的痒感反馈。",
        "支持屏障恢复期的舒适体验。",
      ],
      fit: "换季敏感、洗后发紧、局部轻微发痒人群。",
      caution: "若出现持续红斑或破损，需停止自护并就医。",
      usage: "先小范围连用 3 天，确认耐受再全身使用。",
    },
  ],
  cleanser: [
    {
      slug: "cleanser-amino-surfactant",
      name: "氨基酸表活",
      tagline: "温和清洁",
      preview: "减少洗后紧绷，让洁面更可持续。",
      heroLabel: "Amino",
      heroSub: "Gentle Clean",
      heroClassName:
        "bg-[radial-gradient(circle_at_26%_18%,rgba(241,252,255,0.99),rgba(210,235,244,0.92)_44%,rgba(175,211,227,0.9)_74%,rgba(145,189,209,0.95)_100%)]",
      why: "很多人洁面翻车在“过度去脂”。氨基酸表活能先把洗后舒适度守住。",
      mechanism: [
        "温和带走污垢与多余油脂。",
        "降低清洁后的屏障负担。",
        "适合高频洁面和敏感状态过渡期。",
      ],
      fit: "干敏、混合偏敏、晨间洁面人群。",
      caution: "重油皮夜间可能需要与卸妆/二次清洁配合。",
      usage: "起泡后在面部停留 20-30 秒，避免久搓。",
    },
    {
      slug: "glucoside-surfactant",
      name: "葡糖苷表活",
      tagline: "稳妥日常",
      preview: "冲净感好，兼顾温和与清爽。",
      heroLabel: "Glucoside",
      heroSub: "Daily Balance",
      heroClassName:
        "bg-[radial-gradient(circle_at_72%_17%,rgba(247,255,241,0.99),rgba(218,239,208,0.92)_44%,rgba(186,223,173,0.9)_73%,rgba(156,200,144,0.95)_100%)]",
      why: "想要“每天都能用”的洁面，重点不是极致强度，而是稳定。葡糖苷是高容错选项。",
      mechanism: [
        "提供中等清洁力与较好冲洗性。",
        "降低敏感触发概率，适合长期使用。",
        "和保湿组分搭配时，洁后肤感更平衡。",
      ],
      fit: "追求稳妥洁面、怕刺激但也怕洗不净的人群。",
      caution: "低泡不代表无清洁力，不要靠“泡沫多少”判断全部效果。",
      usage: "晚间搭配防晒/彩妆清洁步骤，不建议单靠洁面硬卸。",
    },
    {
      slug: "hyaluronic-glycerin",
      name: "甘油/透明质酸",
      tagline: "洁后舒适",
      preview: "减少“洗完立刻拔干”的反差感。",
      heroLabel: "Hydration",
      heroSub: "Afterwash Comfort",
      heroClassName:
        "bg-[radial-gradient(circle_at_28%_22%,rgba(250,246,255,0.99),rgba(229,217,245,0.93)_45%,rgba(205,188,232,0.9)_74%,rgba(177,158,216,0.95)_100%)]",
      why: "很多人以为洁面后“干净=发紧”，其实这是脱脂过度信号。保湿组分能把这种不适降下来。",
      mechanism: [
        "提高角质层含水量，降低紧绷反馈。",
        "平衡清洁后的肤感落差。",
        "支持后续护肤衔接更平顺。",
      ],
      fit: "洗后紧绷、泛干、换季不稳人群。",
      caution: "保湿组分不能代替防晒卸除步骤。",
      usage: "洁面后 1 分钟内进入保湿步骤，体验更稳定。",
    },
    {
      slug: "cleanser-salicylic-acid",
      name: "水杨酸（低浓度）",
      tagline: "油痘管理",
      preview: "辅助清理角质油脂，缓和闷堵感。",
      heroLabel: "BHA",
      heroSub: "Pore Assist",
      heroClassName:
        "bg-[radial-gradient(circle_at_70%_19%,rgba(255,247,240,0.99),rgba(246,223,209,0.92)_44%,rgba(230,194,173,0.9)_73%,rgba(212,168,146,0.95)_100%)]",
      why: "若你主要问题是 T 区闷堵和油光反复，低浓度水杨酸是更可控的切入点。",
      mechanism: [
        "脂溶性角质管理，聚焦油脂聚集区域。",
        "帮助疏通毛孔，改善粗糙和闭口感。",
        "与温和表活配合时，兼顾净化和耐受。",
      ],
      fit: "油痘倾向、T 区易堵、角质感明显人群。",
      caution: "干敏或刺痛泛红状态要降频，必要时回退温和线。",
      usage: "每周 2-4 次更稳，避免和高浓酸类同日叠加。",
    },
  ],
};

export function getIngredientShowcaseBySlug(category: WikiCategoryKey, slug: string): IngredientShowcase | undefined {
  return INGREDIENT_SHOWCASE_MAP[category].find((item) => item.slug === slug);
}
