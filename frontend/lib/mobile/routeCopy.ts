import type { MobileSelectionCategory } from "@/lib/api";
import type { Lang } from "@/lib/i18n";

const CATEGORY_LABELS: Record<Lang, Record<MobileSelectionCategory, string>> = {
  zh: {
    shampoo: "洗发水",
    bodywash: "沐浴露",
    conditioner: "护发素",
    lotion: "润肤霜",
    cleanser: "洗面奶",
  },
  en: {
    shampoo: "Shampoo",
    bodywash: "Body Wash",
    conditioner: "Conditioner",
    lotion: "Body Lotion",
    cleanser: "Cleanser",
  },
};

const ROUTE_FOCUS_COPY: Record<Lang, Record<MobileSelectionCategory, Record<string, string>>> = {
  zh: {
    shampoo: {
      "deep-oil-control": "优先看控油效率、清爽度和发根蓬松感。",
      "anti-dandruff-itch": "优先看去屑稳定性、止痒边界和头皮舒适度。",
      "gentle-soothing": "优先避开刺激，再看温和清洁和头皮安定感。",
      "anti-hair-loss": "优先看头皮友好度、强韧支撑和长期可持续用。",
      "moisture-balance": "优先看清洁后不拔干，兼顾头皮与发丝平衡。",
    },
    bodywash: {
      rescue: "优先看舒缓修护，让紧绷、泛红和粗糙感先降下来。",
      purge: "优先看净痘控油，同时避免把皮肤越洗越躁。",
      polish: "优先看平滑更新感，关注鸡皮和粗糙是否更容易被照顾。",
      glow: "优先看亮肤通透度，同时兼顾温和清洁和日常耐受。",
      shield: "优先看洗后不干、不痒，给屏障留出恢复空间。",
      vibe: "优先保留轻盈香感，同时兼顾日常清洁和肤感平衡。",
    },
    conditioner: {
      "c-color-lock": "优先看锁色稳定度，让染后发色和光泽掉得更慢。",
      "c-airy-light": "优先保持轻盈蓬松，避免顺滑感换来塌软。",
      "c-structure-rebuild": "优先看受损修护和发丝支撑感，不只是一时顺滑。",
      "c-smooth-frizz": "优先压住毛躁和炸发，让发丝更整齐好打理。",
      "c-basic-hydrate": "优先补足基础保湿，让发尾柔软但不过分厚重。",
    },
    lotion: {
      light_hydrate: "优先看清爽补水和日常续航，不让肤感变黏。",
      heavy_repair: "优先看干裂修护和长效包裹感，先把不适降下来。",
      bha_clear: "优先处理闭口和小痘，同时注意别把皮肤逼得更干。",
      aha_renew: "优先看角质更新和平滑度，观察粗糙暗沉是否改善。",
      glow_bright: "优先把提亮通透感放前面，同时守住基础保湿。",
      vibe_fragrance: "优先保留留香体验，同时兼顾肤感和日常耐受。",
    },
    cleanser: {
      apg_soothing: "优先稳住敏感和泛红，再看洗后舒适度。",
      pure_amino: "优先保证温和清洁，尽量洗净但不带走舒适感。",
      soap_amino_blend: "优先看清洁力和轻盈感，适合更需要洗净反馈的时候。",
      bha_clearing: "优先看净肤和疏通感，同时避免清洁后过度紧绷。",
      clay_purifying: "优先看吸附净化和出油管理，帮助皮肤维持清爽。",
      enzyme_polishing: "优先看抛光和平滑度，让肤感更细致通透。",
    },
  },
  en: {
    shampoo: {
      "deep-oil-control": "Look at oil control, clean feel, and root lift first.",
      "anti-dandruff-itch": "Prioritize flake control, itch relief, and scalp comfort.",
      "gentle-soothing": "Start by avoiding irritation, then check gentle cleansing and calmness.",
      "anti-hair-loss": "Focus on scalp tolerance, strengthening support, and long-term usability.",
      "moisture-balance": "Look for a clean rinse that does not strip, while balancing scalp and lengths.",
    },
    bodywash: {
      rescue: "Lead with soothing repair so tightness, redness, and roughness settle first.",
      purge: "Prioritize breakout-clearing and oil control without making skin feel harsher.",
      polish: "Focus on smoothing renewal and whether bumps or rough patches feel easier to manage.",
      glow: "Put brightness and clarity first while keeping daily cleansing gentle enough.",
      shield: "Prioritize a non-drying, non-itchy rinse that leaves room for barrier recovery.",
      vibe: "Keep the airy fragrance experience while staying balanced for daily use.",
    },
    conditioner: {
      "c-color-lock": "Prioritize color retention so dyed hair keeps tone and gloss longer.",
      "c-airy-light": "Keep hair airy and lifted without trading that for limp softness.",
      "c-structure-rebuild": "Look for real repair and structure support, not just a temporary slip.",
      "c-smooth-frizz": "Focus on calming frizz and flyaways so hair feels easier to manage.",
      "c-basic-hydrate": "Restore baseline moisture so ends feel soft without turning heavy.",
    },
    lotion: {
      light_hydrate: "Prioritize weightless hydration and daily endurance without sticky feel.",
      heavy_repair: "Lead with deep repair and lasting cushion so discomfort comes down first.",
      bha_clear: "Address bumps and body breakouts first while avoiding over-drying skin.",
      aha_renew: "Focus on surface renewal and smoothness to see whether rough, dull skin improves.",
      glow_bright: "Put radiance first while keeping basic hydration intact.",
      vibe_fragrance: "Preserve the fragrance experience while staying wearable every day.",
    },
    cleanser: {
      apg_soothing: "Calm sensitivity and redness first, then judge post-wash comfort.",
      pure_amino: "Prioritize gentle cleansing that still feels properly clean.",
      soap_amino_blend: "Lead with cleansing strength and airy feel when you want a cleaner finish.",
      bha_clearing: "Focus on unclogging and clarity without over-tightening skin.",
      clay_purifying: "Look for oil management and purifying support that helps skin stay fresh.",
      enzyme_polishing: "Prioritize polishing and smoothness for a finer, clearer skin feel.",
    },
  },
};

function normalizeCategory(raw: MobileSelectionCategory | string | null | undefined): MobileSelectionCategory | null {
  const normalized = String(raw || "").trim().toLowerCase();
  if (normalized === "shampoo" || normalized === "bodywash" || normalized === "conditioner" || normalized === "lotion" || normalized === "cleanser") {
    return normalized;
  }
  return null;
}

export function getMobileCategoryLabel(
  category: MobileSelectionCategory | string | null | undefined,
  lang: Lang = "zh",
): string {
  const normalized = normalizeCategory(category);
  if (normalized) return CATEGORY_LABELS[lang][normalized];
  return String(category || "").trim() || (lang === "zh" ? "当前品类" : "Current category");
}

export function describeMobileRouteFocus(
  category: MobileSelectionCategory | string | null | undefined,
  routeKey: string | null | undefined,
  lang: Lang = "zh",
): string {
  const normalized = normalizeCategory(category);
  if (!normalized) return lang === "zh" ? "优先沿着这条路线判断整体适配度。" : "Use this route as the first lens for overall fit.";
  const key = String(routeKey || "").trim();
  return ROUTE_FOCUS_COPY[lang][normalized][key] || (lang === "zh" ? "优先沿着这条路线判断整体适配度。" : "Use this route as the first lens for overall fit.");
}
