import type { MobileSelectionCategory } from "@/lib/api";

const CATEGORY_LABELS_ZH: Record<MobileSelectionCategory, string> = {
  shampoo: "洗发水",
  bodywash: "沐浴露",
  conditioner: "护发素",
  lotion: "润肤霜",
  cleanser: "洗面奶",
};

const ROUTE_FOCUS_COPY: Record<MobileSelectionCategory, Record<string, string>> = {
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
};

function normalizeCategory(raw: MobileSelectionCategory | string | null | undefined): MobileSelectionCategory | null {
  const normalized = String(raw || "").trim().toLowerCase();
  if (normalized === "shampoo" || normalized === "bodywash" || normalized === "conditioner" || normalized === "lotion" || normalized === "cleanser") {
    return normalized;
  }
  return null;
}

export function getMobileCategoryLabel(category: MobileSelectionCategory | string | null | undefined): string {
  const normalized = normalizeCategory(category);
  if (normalized) return CATEGORY_LABELS_ZH[normalized];
  return String(category || "").trim() || "当前品类";
}

export function describeMobileRouteFocus(
  category: MobileSelectionCategory | string | null | undefined,
  routeKey: string | null | undefined,
): string {
  const normalized = normalizeCategory(category);
  if (!normalized) return "优先沿着这条路线判断整体适配度。";
  const key = String(routeKey || "").trim();
  return ROUTE_FOCUS_COPY[normalized][key] || "优先沿着这条路线判断整体适配度。";
}
