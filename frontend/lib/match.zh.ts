import { CATEGORY_META, type CategoryKey } from "@/lib/site";

export type MatchQuestionOption = {
  value: string;
  label: string;
  description: string;
};

export type MatchQuestion = {
  key: string;
  title: string;
  note: string;
  options: MatchQuestionOption[];
};

export type MatchRouteMeta = {
  key: string;
  title: string;
  summary: string;
};

export type MatchCategoryConfig = {
  key: CategoryKey;
  title: string;
  summary: string;
  estimatedTime: string;
  steps: MatchQuestion[];
  routes: Record<string, MatchRouteMeta>;
};

export type MatchAnswers = Record<string, string>;

export const MATCH_LAST_CATEGORY_KEY = "jeslect_match_last_category_v1";

const MATCH_DRAFT_STORAGE_KEY_PREFIX = "jeslect_match_draft_v1";

export const MATCH_CONFIG: Record<CategoryKey, MatchCategoryConfig> = {
  shampoo: {
    key: "shampoo",
    title: "按头皮真实状态，找到更适合你的洗发路线。",
    summary: "从出油节奏、当前头皮问题，以及发丝能承受多少修护负担三个维度先把范围收窄。",
    estimatedTime: "3 个问题，约 30 秒",
    steps: [
      {
        key: "q1",
        title: "你的头皮通常多久会明显出油？",
        note: "按最接近日常的状态来选，不用按最好或最差的一天作答。",
        options: [
          { value: "A", label: "第二天就会油", description: "只要少洗一天，头发通常就会变塌或出油明显。" },
          { value: "B", label: "2 到 3 天", description: "通常维持一个中等频率的洗发节奏会比较舒服。" },
          { value: "C", label: "3 天以上", description: "头皮整体偏干，或者出油速度比较慢。" },
        ],
      },
      {
        key: "q2",
        title: "你现在最在意的头皮问题是什么？",
        note: "这是洗发路径里最重要的一层筛选。",
        options: [
          { value: "A", label: "头屑和发痒", description: "希望这条路线先把头屑和痒感控制住。" },
          { value: "B", label: "泛红、刺痛或头皮痘", description: "需要一条更低刺激的路线。" },
          { value: "C", label: "掉发明显或发根无力", description: "更希望头皮支持感更稳，日常节奏更持续。" },
          { value: "D", label: "没有明显头皮问题", description: "主要想找到最适合日常使用的清洁路线。" },
        ],
      },
      {
        key: "q3",
        title: "你现在的发丝状态更接近哪一种？",
        note: "最后一步会决定洗发可以承载多少修护感和重量。",
        options: [
          { value: "A", label: "染烫多、受热多，容易脆断", description: "需要更多修护支持，减少断裂压力。" },
          { value: "B", label: "细软扁塌，容易有重量感", description: "更需要轻一点的结果，保留蓬松感。" },
          { value: "C", label: "相对健康，维护难度不高", description: "主要追求日常平衡和稳定。" },
        ],
      },
    ],
    routes: {
      "deep-oil-control": {
        key: "deep-oil-control",
        title: "深层控油",
        summary: "优先解决头皮重置感、发根清爽度和中段出油过快的问题。",
      },
      "anti-dandruff-itch": {
        key: "anti-dandruff-itch",
        title: "去屑止痒",
        summary: "优先关注头屑稳定、痒感缓解和头皮长期更平稳的状态。",
      },
      "gentle-soothing": {
        key: "gentle-soothing",
        title: "温和舒缓",
        summary: "优先降低刺激负担，让清洁更温和、头皮日常更舒服。",
      },
      "anti-hair-loss": {
        key: "anti-hair-loss",
        title: "头皮强韧支持",
        summary: "优先考虑头皮友好度、发根支持感和可长期坚持的护理节奏。",
      },
      "moisture-balance": {
        key: "moisture-balance",
        title: "水油平衡",
        summary: "优先在洗后舒适度和不过度厚重之间取得更稳的平衡。",
      },
    },
  },
  bodywash: {
    key: "bodywash",
    title: "按舒适度、冲洗感和日常耐受，匹配更适合的沐浴路线。",
    summary: "婕选会从气候、敏感度、出油与粗糙问题，以及你真正喜欢的洗后感开始收窄范围。",
    estimatedTime: "5 个问题，约 45 秒",
    steps: [
      {
        key: "q1",
        title: "你现在所处的气候和日常环境更接近哪一种？",
        note: "这会先决定清洁力和舒适感的大方向。",
        options: [
          { value: "A", label: "干冷", description: "天气和取暖环境常让身体皮肤更容易干、紧、粗糙。" },
          { value: "B", label: "干热", description: "高温加低湿，皮肤会同时发热又发紧。" },
          { value: "C", label: "湿热", description: "汗、油和黏腻感更容易堆起来。" },
          { value: "D", label: "湿冷", description: "气温低加室内供暖，洗后依然可能觉得被抽干。" },
        ],
      },
      {
        key: "q2",
        title: "你现在的身体皮肤耐受度如何？",
        note: "这里的安全筛选优先级会高于其他偏好。",
        options: [
          { value: "A", label: "非常敏感", description: "热、摩擦或换产品都容易引起发红或发痒。" },
          { value: "B", label: "整体还算耐受", description: "平时对常规身体清洁产品大多能适应。" },
        ],
      },
      {
        key: "q3",
        title: "你现在最想解决的身体皮肤问题是什么？",
        note: "这一步会决定路线更偏净化、平滑还是保护。",
        options: [
          { value: "A", label: "出油多、身体痘明显", description: "胸背更容易油或冒痘，想先把它收住。" },
          { value: "B", label: "很干、很痒、洗后紧", description: "舒适和保留感比强清洁更重要。" },
          { value: "C", label: "粗糙、鸡皮或堆积感", description: "更在意肤感平整和表面更细一点。" },
          { value: "D", label: "没有明显问题", description: "主要想要舒服、能长期坚持的日常沐浴体验。" },
        ],
      },
      {
        key: "q4",
        title: "你更喜欢哪种冲洗后的肤感？",
        note: "这一步会在不打破安全边界的情况下调整感受。",
        options: [
          { value: "A", label: "清爽利落", description: "不喜欢残留，偏好更轻、更干净的洗后感。" },
          { value: "B", label: "柔和包裹一点", description: "能接受更柔润、更有保留感的结尾。" },
        ],
      },
      {
        key: "q5",
        title: "你有没有特别的限制或偏好？",
        note: "最后一步会进一步收紧成分边界和香味边界。",
        options: [
          { value: "A", label: "更低风险、更干净", description: "希望成分边界更克制，香味负担更低。" },
          { value: "B", label: "香味体验也很重要", description: "会希望沐浴过程有更明显的感官氛围。" },
        ],
      },
    ],
    routes: {
      rescue: {
        key: "rescue",
        title: "舒缓修护",
        summary: "优先考虑舒缓、低摩擦和在更激进动作之前先恢复舒适感。",
      },
      purge: {
        key: "purge",
        title: "净化控油",
        summary: "优先解决身体出油、痘感和洗后更清爽的净化需求。",
      },
      polish: {
        key: "polish",
        title: "平滑焕新",
        summary: "优先改善粗糙、堆积和身体肤感不够细致的问题。",
      },
      glow: {
        key: "glow",
        title: "透亮清洁",
        summary: "优先让身体护理更清透、明亮，同时保留日常可持续性。",
      },
      shield: {
        key: "shield",
        title: "屏障舒适",
        summary: "优先补充感、减轻洗后干燥，并让皮肤更有被保护的感觉。",
      },
      vibe: {
        key: "vibe",
        title: "香氛导向平衡",
        summary: "优先保留香味体验，同时让日常使用感不过于难以坚持。",
      },
    },
  },
  conditioner: {
    key: "conditioner",
    title: "按受损程度、发丝形态和目标结果，匹配更适合的护发路线。",
    summary: "护发流程不该太重、太轻，或者过于泛化。婕选会先帮你把结果方向收清楚。",
    estimatedTime: "3 个问题，约 30 秒",
    steps: [
      {
        key: "c_q1",
        title: "你的头发承载了多少受损历史？",
        note: "这一步会先决定修护重量的大方向。",
        options: [
          { value: "A", label: "频繁漂染、热损伤明显", description: "更需要厚一点的支持和更少的断裂压力。" },
          { value: "B", label: "有染发或规律性热造型", description: "需要在修护和轻盈之间找平衡。" },
          { value: "C", label: "大多未经处理，状态相对健康", description: "更要避免过度堆料或过重负担。" },
        ],
      },
      {
        key: "c_q2",
        title: "你的发丝形态更接近哪一种？",
        note: "这一步是为了防止结果太塌或太毛。",
        options: [
          { value: "A", label: "细软，容易被压塌", description: "蓬松度很重要，太重的顺滑会很快变成负担。" },
          { value: "B", label: "偏粗硬、毛躁或自然蓬乱", description: "更需要顺滑度和控制力。" },
          { value: "C", label: "介于两者之间", description: "可以更多围绕目标结果来收路线。" },
        ],
      },
      {
        key: "c_q3",
        title: "你现在最想看到的效果是什么？",
        note: "最后一步会把路线锁定到更明确的终点。",
        options: [
          { value: "A", label: "让染后发色更耐看", description: "更在意颜色维持、光泽感和洗后状态。" },
          { value: "B", label: "顺滑更强、毛躁更少", description: "更想改善梳理手感和表面服帖度。" },
          { value: "C", label: "发尾柔软，但不要太塌", description: "想要保湿和轻盈同时成立。" },
        ],
      },
    ],
    routes: {
      "c-color-lock": {
        key: "c-color-lock",
        title: "锁色护理",
        summary: "优先帮助染后发色维持光泽，并让退色速度更慢一些。",
      },
      "c-airy-light": {
        key: "c-airy-light",
        title: "轻盈丰盈",
        summary: "优先在柔软和轻盈之间找平衡，不让头发容易塌下去。",
      },
      "c-structure-rebuild": {
        key: "c-structure-rebuild",
        title: "结构修护",
        summary: "优先考虑更深一点的修护支持、韧性和断裂压力管理。",
      },
      "c-smooth-frizz": {
        key: "c-smooth-frizz",
        title: "顺滑抚躁",
        summary: "优先改善毛躁、梳理困难和日间粗糙感。",
      },
      "c-basic-hydrate": {
        key: "c-basic-hydrate",
        title: "平衡保湿",
        summary: "优先提供日常柔软和水分支持，而不过度复杂化护发流程。",
      },
    },
  },
  lotion: {
    key: "lotion",
    title: "按气候、皮肤舒适度和你真正愿意使用的肤感，匹配身体乳路线。",
    summary: "婕选会从屏障需求、爆痘风险、质地偏好和香味取向出发，把身体乳候选收窄。",
    estimatedTime: "5 个问题，约 45 秒",
    steps: [
      {
        key: "q1",
        title: "你现在所处的气候与季节更接近哪种状态？",
        note: "这一步会先决定轻保湿还是重修护更适合作为底盘。",
        options: [
          { value: "A", label: "干冷", description: "暖气和冬天会让皮肤更容易觉得被抽空。" },
          { value: "B", label: "湿热", description: "希望保湿存在，但不想留下明显黏感。" },
          { value: "C", label: "季节切换大、风也大", description: "皮肤更需要持续稳定的舒适感。" },
          { value: "D", label: "整体平稳温和", description: "可以更多围绕你最想要的效果来收路线。" },
        ],
      },
      {
        key: "q2",
        title: "你现在的身体皮肤有多敏感？",
        note: "这里会先排除过于激进的路线。",
        options: [
          { value: "A", label: "非常敏感", description: "泛红、发痒或屏障压力很容易出现。" },
          { value: "B", label: "整体还算耐受", description: "通常能接受更主动一点的身体护理路线。" },
        ],
      },
      {
        key: "q3",
        title: "你最想改善的身体皮肤问题是什么？",
        note: "这是身体乳路线里最强的一步分流。",
        options: [
          { value: "A", label: "非常干、起皮明显", description: "舒适和缓解要排在最前面。" },
          { value: "B", label: "身体痘", description: "想更清爽，不希望过于封闭厚重。" },
          { value: "C", label: "粗糙颗粒或纹理不平", description: "希望肤感更细一点、更平一点。" },
          { value: "D", label: "暗沉、色调不均", description: "更在意透亮感和均匀度。" },
          { value: "E", label: "没有特别明显的问题", description: "更想找一款好坚持、够舒服的日常身体乳。" },
        ],
      },
      {
        key: "q4",
        title: "你真正喜欢的质地是哪一种？",
        note: "这一步会在不打破安全边界的前提下微调肤感终点。",
        options: [
          { value: "A", label: "很轻、吸收快", description: "越不黏越好，存在感越低越容易坚持。" },
          { value: "B", label: "标准乳液感", description: "希望保湿和延展都在线，但不要太重。" },
          { value: "C", label: "更丰润、更有包裹感", description: "更安心于被修护和包起来的感觉。" },
        ],
      },
      {
        key: "q5",
        title: "你有没有特别的限制或偏好？",
        note: "最后一步让路线更贴近你真实的购买标准。",
        options: [
          { value: "A", label: "更低香、边界更克制", description: "希望成分和香味都更收敛。" },
          { value: "B", label: "香味体验对我很重要", description: "希望身体护理也有明显的感官氛围。" },
          { value: "C", label: "没有特别限制", description: "主要还是看整体效果和适配度。" },
        ],
      },
    ],
    routes: {
      light_hydrate: {
        key: "light_hydrate",
        title: "轻盈保湿",
        summary: "优先提供日常水分和舒适度，不留下明显厚重或黏感。",
      },
      heavy_repair: {
        key: "heavy_repair",
        title: "丰润修护",
        summary: "优先补充感、屏障舒适度和更持久一点的缓解体验。",
      },
      bha_clear: {
        key: "bha_clear",
        title: "BHA 净痘清理",
        summary: "优先帮助身体痘和闷堵管理，同时保留日常可用性。",
      },
      aha_renew: {
        key: "aha_renew",
        title: "AHA 焕新平滑",
        summary: "优先改善纹理粗糙、表面不平和逐步焕新的感觉。",
      },
      glow_bright: {
        key: "glow_bright",
        title: "透亮提亮",
        summary: "优先让肤色看起来更均匀、更有光泽，同时保留可穿戴的日常体验。",
      },
      vibe_fragrance: {
        key: "vibe_fragrance",
        title: "香氛优先质感",
        summary: "优先保留更强的感官氛围，同时不让日常舒适度掉得太多。",
      },
    },
  },
  cleanser: {
    key: "cleanser",
    title: "按出油、敏感度、清洁负担和洗后状态，匹配更适合的洁面路线。",
    summary: "婕选会尽量避免洁面路线太刺激、太无力，或者对你的屏障来说过头。",
    estimatedTime: "5 个问题，约 45 秒",
    steps: [
      {
        key: "q1",
        title: "你的肤质和出油程度更接近哪一种？",
        note: "这一步先决定清洁重量的大致范围。",
        options: [
          { value: "A", label: "很油", description: "出油回来得很快，光泽感经常压不住。" },
          { value: "B", label: "混油", description: "T 区偏油，但其他区域相对平衡或更干。" },
          { value: "C", label: "中性到偏干", description: "出油中等，干燥更多是季节性出现。" },
          { value: "D", label: "很干", description: "皮肤很容易紧绷，很少觉得油。" },
        ],
      },
      {
        key: "q2",
        title: "你现在的敏感度有多强？",
        note: "这是洁面路线里最重要的安全筛选。",
        options: [
          { value: "A", label: "高度敏感", description: "泛红、发痒或刺痛都很容易出现。" },
          { value: "B", label: "有一点敏感", description: "换季或路线过强时更容易反应。" },
          { value: "C", label: "整体较耐受", description: "屏障通常能承受更主动一点的清洁路线。" },
        ],
      },
      {
        key: "q3",
        title: "你日常的清洁负担有多重？",
        note: "这会决定洁面到底需要多强的带走能力。",
        options: [
          { value: "A", label: "全妆或更厚的防晒", description: "经常需要处理更顽固的残留。" },
          { value: "B", label: "淡妆或通勤防晒", description: "需要正常日常清洁，但不一定要最强重置。" },
          { value: "C", label: "基本素颜", description: "主要是去油、汗和日常表面污垢。" },
        ],
      },
      {
        key: "q4",
        title: "你现在最在意的面部问题是什么？",
        note: "这一步会决定功能路线更靠近哪一侧。",
        options: [
          { value: "A", label: "黑头和堵塞感", description: "更想把闷堵和颗粒感先处理清楚。" },
          { value: "B", label: "发炎痘或正在反复的痘", description: "需要更稳一点的边界来配合当前状态。" },
          { value: "C", label: "暗沉、粗糙", description: "更在意纹理和清晰度。" },
          { value: "D", label: "很缺水、很紧绷", description: "舒适和屏障缓解是第一优先级。" },
          { value: "E", label: "没有特别明显的问题", description: "主要想找到更健康的日常基础清洁。" },
        ],
      },
      {
        key: "q5",
        title: "你更喜欢哪种洗后感？",
        note: "最后一步只在安全范围内调整感官偏好。",
        options: [
          { value: "A", label: "泡沫更足一点", description: "喜欢更熟悉、更完整的泡沫清洁感。" },
          { value: "B", label: "非常清爽干净", description: "更偏好明显切油的洗后感。" },
          { value: "C", label: "冲完后柔和保湿", description: "不喜欢被洗得很空、很干的感觉。" },
          { value: "D", label: "低泡、非常温和", description: "希望整体感受尽量轻柔、刺激更低。" },
        ],
      },
    ],
    routes: {
      apg_soothing: {
        key: "apg_soothing",
        title: "舒缓清洁",
        summary: "优先让皮肤更平稳，降低刺激负担，并保留更舒服的洗脸体验。",
      },
      pure_amino: {
        key: "pure_amino",
        title: "氨基酸温和清洁",
        summary: "优先让日常清洁更温和，冲洗后更容易保留舒适感。",
      },
      soap_amino_blend: {
        key: "soap_amino_blend",
        title: "平衡深清",
        summary: "优先保留更强一点的清洁感，但不走到完全拔干的那一端。",
      },
      bha_clearing: {
        key: "bha_clearing",
        title: "BHA 清堵路线",
        summary: "优先处理堵塞、出油管理和因堆积引起的不清爽感。",
      },
      clay_purifying: {
        key: "clay_purifying",
        title: "泥膜感净化",
        summary: "优先吸附油脂，让毛孔看起来更清爽，结尾更干净利落。",
      },
      enzyme_polishing: {
        key: "enzyme_polishing",
        title: "酶感平滑焕亮",
        summary: "优先改善粗糙感和暗沉，让皮肤表面看起来更细一点。",
      },
    },
  },
};

export function getMatchConfig(category: CategoryKey): MatchCategoryConfig {
  return MATCH_CONFIG[category];
}

export function getMatchDraftStorageKey(category: CategoryKey): string {
  return `${MATCH_DRAFT_STORAGE_KEY_PREFIX}:${category}`;
}

export function normalizeMatchAnswers(category: CategoryKey, input: MatchAnswers): MatchAnswers {
  const config = getMatchConfig(category);
  const output: MatchAnswers = {};

  for (const step of config.steps) {
    const raw = String(input[step.key] || "").trim();
    const isValid = step.options.some((option) => option.value === raw);
    if (!isValid) break;
    output[step.key] = raw;
  }

  return output;
}

export function isMatchComplete(category: CategoryKey, answers: MatchAnswers): boolean {
  const normalized = normalizeMatchAnswers(category, answers);
  return getNextUnansweredIndex(category, normalized) >= getMatchConfig(category).steps.length;
}

export function getNextUnansweredIndex(category: CategoryKey, answers: MatchAnswers): number {
  const normalized = normalizeMatchAnswers(category, answers);
  const steps = getMatchConfig(category).steps;
  const index = steps.findIndex((step) => !normalized[step.key]);
  return index === -1 ? steps.length : index;
}

export function countAnsweredSteps(category: CategoryKey, answers: MatchAnswers): number {
  return Object.keys(normalizeMatchAnswers(category, answers)).length;
}

export function getMatchQuestion(category: CategoryKey, questionKey: string): MatchQuestion | null {
  return getMatchConfig(category).steps.find((step) => step.key === questionKey) || null;
}

export function getMatchChoice(category: CategoryKey, questionKey: string, value: string): MatchQuestionOption | null {
  const question = getMatchQuestion(category, questionKey);
  if (!question) return null;
  return question.options.find((option) => option.value === value) || null;
}

export function getMatchRouteMeta(category: CategoryKey, routeKey: string | null | undefined): MatchRouteMeta | null {
  const key = String(routeKey || "").trim();
  if (!key) return null;
  return getMatchConfig(category).routes[key] || null;
}

export function getSelectionDisplayTitle(category: CategoryKey, routeKey: string | null | undefined): string {
  return getMatchRouteMeta(category, routeKey)?.title || CATEGORY_META[category].label;
}
