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
    title: "Find a shampoo that matches how your scalp actually behaves.",
    summary: "Start with oil rhythm, current scalp concern, and how much repair support your hair can carry.",
    estimatedTime: "3 questions, about 30 seconds",
    steps: [
      {
        key: "q1",
        title: "How quickly does your scalp usually feel oily?",
        note: "Pick the closest everyday pattern, not your best or worst day.",
        options: [
          { value: "A", label: "By the next day", description: "Usually flat or oily if you skip a wash." },
          { value: "B", label: "Every 2 to 3 days", description: "A balanced wash rhythm usually feels right." },
          { value: "C", label: "After 3 days or longer", description: "Your scalp usually leans drier or slower to oil up." },
        ],
      },
      {
        key: "q2",
        title: "What is the main scalp concern right now?",
        note: "This is the strongest filter in the shampoo flow.",
        options: [
          { value: "A", label: "Flakes and itchiness", description: "You want the routine to focus on flake control first." },
          { value: "B", label: "Redness, stinging, or scalp breakouts", description: "You need a lower-irritation path." },
          { value: "C", label: "Noticeable shedding or weaker roots", description: "You want more scalp support and a steadier routine." },
          { value: "D", label: "No major scalp issue", description: "You mostly want the cleanest everyday fit." },
        ],
      },
      {
        key: "q3",
        title: "Which hair state feels closest today?",
        note: "This last step adjusts how much weight or repair the wash can carry.",
        options: [
          { value: "A", label: "Color-treated, heat-styled, or easy to break", description: "You need more repair support through the routine." },
          { value: "B", label: "Fine, flat, or easy to weigh down", description: "You need a lighter result that keeps more lift." },
          { value: "C", label: "Relatively healthy and low-maintenance", description: "You mostly want balance and consistency." },
        ],
      },
    ],
    routes: {
      "deep-oil-control": {
        key: "deep-oil-control",
        title: "Deep oil control",
        summary: "Prioritizes cleaner reset, fresher roots, and less mid-cycle oil buildup.",
      },
      "anti-dandruff-itch": {
        key: "anti-dandruff-itch",
        title: "Anti-flake and itch relief",
        summary: "Prioritizes flake stability, itch relief, and keeping the scalp calmer over time.",
      },
      "gentle-soothing": {
        key: "gentle-soothing",
        title: "Gentle soothing",
        summary: "Prioritizes lower irritation load, gentler cleansing, and day-to-day scalp comfort.",
      },
      "anti-hair-loss": {
        key: "anti-hair-loss",
        title: "Scalp strengthening",
        summary: "Prioritizes scalp friendliness, root support, and routines you can keep using consistently.",
      },
      "moisture-balance": {
        key: "moisture-balance",
        title: "Moisture balance",
        summary: "Prioritizes comfort after washing without leaving the routine too stripped or too heavy.",
      },
    },
  },
  bodywash: {
    key: "bodywash",
    title: "Match your body wash to comfort, rinse feel, and daily tolerance.",
    summary: "Jeslect narrows body wash around climate, sensitivity, oil and texture buildup, and the finish you actually enjoy.",
    estimatedTime: "5 questions, about 45 seconds",
    steps: [
      {
        key: "q1",
        title: "Which climate and daily environment feel closest right now?",
        note: "This sets the base weight for cleansing versus comfort.",
        options: [
          { value: "A", label: "Dry and cold", description: "Skin often feels dry, tight, or rough in cooler weather." },
          { value: "B", label: "Dry and hot", description: "Heat plus low humidity leaves skin hot and tight." },
          { value: "C", label: "Humid and hot", description: "Sweat, oil, and stickiness build up easily." },
          { value: "D", label: "Humid and cold", description: "Cold weather plus indoor heat can still leave skin stripped." },
        ],
      },
      {
        key: "q2",
        title: "How tolerant is your skin right now?",
        note: "Safety filters take priority over everything else here.",
        options: [
          { value: "A", label: "Very sensitive", description: "Heat, friction, or product changes can trigger redness or itching." },
          { value: "B", label: "Generally resilient", description: "Your skin usually tolerates normal body products well." },
        ],
      },
      {
        key: "q3",
        title: "What is the main oil or texture issue?",
        note: "This decides whether the wash needs to lean purifying, smoothing, or protective.",
        options: [
          { value: "A", label: "More oil and body breakouts", description: "Chest or back can feel greasy or acne-prone." },
          { value: "B", label: "Dry and low-oil", description: "Skin feels rough, itchy, or tight after washing." },
          { value: "C", label: "Rough texture or buildup", description: "Chicken skin, thicker texture, or dullness is the main issue." },
          { value: "D", label: "No major issue", description: "You mostly want a comfortable daily wash." },
        ],
      },
      {
        key: "q4",
        title: "What rinse feel do you prefer?",
        note: "This adjusts sensory finish without breaking the safety path.",
        options: [
          { value: "A", label: "Crisp and very clean", description: "You dislike residue and want a lighter after-feel." },
          { value: "B", label: "Soft and more cushioned", description: "You do not mind a gentler, more moisturized finish." },
        ],
      },
      {
        key: "q5",
        title: "Do you have a special restriction or preference?",
        note: "This last step tightens ingredient and fragrance boundaries.",
        options: [
          { value: "A", label: "Very clean and low-risk", description: "You want a stricter ingredient boundary and lower scent load." },
          { value: "B", label: "I want fragrance to be part of the experience", description: "A more elevated scent profile matters to you." },
        ],
      },
    ],
    routes: {
      rescue: {
        key: "rescue",
        title: "Calming repair",
        summary: "Prioritizes soothing, lower friction, and restoring comfort before anything more aggressive.",
      },
      purge: {
        key: "purge",
        title: "Clarifying oil control",
        summary: "Prioritizes clearer body skin, stronger oil control, and cleaner-feeling rinse-off.",
      },
      polish: {
        key: "polish",
        title: "Smoothing renewal",
        summary: "Prioritizes rough texture, buildup, and a more refined skin feel over time.",
      },
      glow: {
        key: "glow",
        title: "Brightening cleanse",
        summary: "Prioritizes a clearer, brighter body routine without abandoning daily comfort.",
      },
      shield: {
        key: "shield",
        title: "Barrier comfort",
        summary: "Prioritizes replenishment, less dryness after washing, and a more protected feel.",
      },
      vibe: {
        key: "vibe",
        title: "Fragrance-forward balance",
        summary: "Prioritizes a lighter scent-led experience while keeping the routine wearable every day.",
      },
    },
  },
  conditioner: {
    key: "conditioner",
    title: "Match your conditioner to damage level, hair shape, and the finish you want to see.",
    summary: "The conditioner flow keeps the routine from getting too heavy, too weak, or too generic for your hair.",
    estimatedTime: "3 questions, about 30 seconds",
    steps: [
      {
        key: "c_q1",
        title: "How much damage history does your hair carry?",
        note: "This sets the repair weight from the start.",
        options: [
          { value: "A", label: "Frequent bleach, color, or heat damage", description: "Your hair needs heavier support and less breakage stress." },
          { value: "B", label: "Some color or regular heat styling", description: "You need balance between repair and lightness." },
          { value: "C", label: "Mostly untreated and healthy", description: "The routine should avoid overloading the hair fiber." },
        ],
      },
      {
        key: "c_q2",
        title: "Which physical hair shape feels closest?",
        note: "This prevents the finish from turning too flat or too rough.",
        options: [
          { value: "A", label: "Fine and easy to weigh down", description: "Volume matters and heavy slip can become a problem fast." },
          { value: "B", label: "Coarser, rougher, or naturally frizz-prone", description: "You need more smoothing and control." },
          { value: "C", label: "Balanced or in-between", description: "You can tune more around the desired finish." },
        ],
      },
      {
        key: "c_q3",
        title: "What visual result matters most right now?",
        note: "The last step locks the routine to one finish goal.",
        options: [
          { value: "A", label: "Keep color looking fresher", description: "Color maintenance and shine are the main job." },
          { value: "B", label: "Maximum slip and less frizz", description: "You want easier comb-through and a smoother surface." },
          { value: "C", label: "Soft ends without losing natural lift", description: "You want balanced hydration with less weight." },
        ],
      },
    ],
    routes: {
      "c-color-lock": {
        key: "c-color-lock",
        title: "Color lock",
        summary: "Prioritizes helping color-treated hair hold shine and fade more slowly.",
      },
      "c-airy-light": {
        key: "c-airy-light",
        title: "Airy volume",
        summary: "Prioritizes lightweight conditioning so hair stays softer without collapsing flat.",
      },
      "c-structure-rebuild": {
        key: "c-structure-rebuild",
        title: "Structure repair",
        summary: "Prioritizes deeper repair support, stronger feel, and less breakage stress.",
      },
      "c-smooth-frizz": {
        key: "c-smooth-frizz",
        title: "Frizz smoothing",
        summary: "Prioritizes smoother texture, easier detangling, and less roughness through the day.",
      },
      "c-basic-hydrate": {
        key: "c-basic-hydrate",
        title: "Balanced hydration",
        summary: "Prioritizes everyday softness and hydration without overcomplicating the routine.",
      },
    },
  },
  lotion: {
    key: "lotion",
    title: "Match body moisture around climate, skin comfort, and the finish you actually enjoy wearing.",
    summary: "Jeslect narrows lotion around barrier needs, breakout risk, texture preference, and whether fragrance matters.",
    estimatedTime: "5 questions, about 45 seconds",
    steps: [
      {
        key: "q1",
        title: "Which climate and season feel closest right now?",
        note: "This sets the base balance between light hydration and heavier repair.",
        options: [
          { value: "A", label: "Dry and cold", description: "Heating or winter air leaves skin more depleted." },
          { value: "B", label: "Hot and humid", description: "You want moisture without a sticky finish." },
          { value: "C", label: "Big seasonal swings or windy weather", description: "Your skin needs steadier comfort through shifts." },
          { value: "D", label: "Mostly mild and stable", description: "You can tune more around the main benefit you want." },
        ],
      },
      {
        key: "q2",
        title: "How reactive is your body skin right now?",
        note: "This can remove stronger actives from the shortlist.",
        options: [
          { value: "A", label: "Very sensitive", description: "Redness, itching, or barrier stress shows up easily." },
          { value: "B", label: "Generally resilient", description: "Your skin can usually tolerate more active routes." },
        ],
      },
      {
        key: "q3",
        title: "What is the main body-skin issue you want to improve?",
        note: "This is the strongest route-setting step in the lotion flow.",
        options: [
          { value: "A", label: "Severe dryness and visible flaking", description: "Relief and comfort matter more than anything else." },
          { value: "B", label: "Body breakouts", description: "You want a clearer routine that does not feel too occlusive." },
          { value: "C", label: "Rough bumps or uneven texture", description: "Texture smoothing matters most." },
          { value: "D", label: "Dullness or uneven tone", description: "You want a brighter, more even-looking finish." },
          { value: "E", label: "No major issue", description: "You want a comfortable, easy daily moisturizer." },
        ],
      },
      {
        key: "q4",
        title: "What texture do you actually enjoy using?",
        note: "This tunes finish while staying inside the safety guardrails.",
        options: [
          { value: "A", label: "Very light and quick-absorbing", description: "You want the least sticky feel possible." },
          { value: "B", label: "Balanced lotion feel", description: "You want moisture and slip without heaviness." },
          { value: "C", label: "Rich and cocooning", description: "A stronger wrapped-in repair feel is reassuring." },
        ],
      },
      {
        key: "q5",
        title: "Do you have a special restriction or preference?",
        note: "The last step keeps the route aligned with how you actually shop.",
        options: [
          { value: "A", label: "Very clean and low-fragrance", description: "You want a stricter ingredient and scent boundary." },
          { value: "B", label: "Fragrance matters to me", description: "You want body care to feel more mood-led and sensorial." },
          { value: "C", label: "No special restriction", description: "You mostly care about results and overall fit." },
        ],
      },
    ],
    routes: {
      light_hydrate: {
        key: "light_hydrate",
        title: "Lightweight hydration",
        summary: "Prioritizes daily moisture and comfort without leaving the finish heavy or sticky.",
      },
      heavy_repair: {
        key: "heavy_repair",
        title: "Rich repair",
        summary: "Prioritizes stronger replenishment, better barrier comfort, and longer-lasting relief.",
      },
      bha_clear: {
        key: "bha_clear",
        title: "BHA body clear",
        summary: "Prioritizes clearer body skin and breakout management without losing daily usability.",
      },
      aha_renew: {
        key: "aha_renew",
        title: "AHA renewal",
        summary: "Prioritizes smoother texture, more even feel, and gradual surface renewal.",
      },
      glow_bright: {
        key: "glow_bright",
        title: "Glow brightening",
        summary: "Prioritizes brighter-looking skin and more even tone while keeping a wearable routine.",
      },
      vibe_fragrance: {
        key: "vibe_fragrance",
        title: "Fragrance-first finish",
        summary: "Prioritizes a more sensorial, scent-led body routine without losing day-to-day comfort.",
      },
    },
  },
  cleanser: {
    key: "cleanser",
    title: "Match your cleanser around oil level, sensitivity, cleansing load, and how your skin feels after washing.",
    summary: "Jeslect keeps the cleanser route from becoming too stripping, too weak, or too aggressive for your barrier.",
    estimatedTime: "5 questions, about 45 seconds",
    steps: [
      {
        key: "q1",
        title: "Which skin and oil level feel closest?",
        note: "This sets the main cleansing-weight baseline.",
        options: [
          { value: "A", label: "Very oily", description: "Oil comes back fast and shine is hard to ignore." },
          { value: "B", label: "Combination-oily", description: "T-zone gets oily while other areas stay balanced or drier." },
          { value: "C", label: "Normal to combination-dry", description: "Oil is moderate and dryness shows up more seasonally." },
          { value: "D", label: "Very dry", description: "Your skin tightens easily and rarely feels oily." },
        ],
      },
      {
        key: "q2",
        title: "How strong is your sensitivity right now?",
        note: "This is the strongest safety filter in the cleanser flow.",
        options: [
          { value: "A", label: "Highly sensitive", description: "Redness, itching, or stinging show up easily." },
          { value: "B", label: "Somewhat sensitive", description: "You can react during seasonal shifts or stronger routines." },
          { value: "C", label: "Mostly resilient", description: "Your barrier usually tolerates more active routines well." },
        ],
      },
      {
        key: "q3",
        title: "How heavy is your daily cleansing load?",
        note: "This adjusts how much removal power the cleanser really needs.",
        options: [
          { value: "A", label: "Full makeup or heavier sunscreen", description: "You regularly remove more stubborn residue." },
          { value: "B", label: "Light makeup or commute sunscreen", description: "You need a normal daily clean, not the strongest reset." },
          { value: "C", label: "Bare skin only", description: "You mainly need to remove oil, sweat, and daily debris." },
        ],
      },
      {
        key: "q4",
        title: "What is the main face concern right now?",
        note: "This decides which functional route stays closest to the surface.",
        options: [
          { value: "A", label: "Blackheads and clogged texture", description: "Congestion is the clearest signal." },
          { value: "B", label: "Inflamed or broken-out acne", description: "Your skin needs a gentler boundary around active breakouts." },
          { value: "C", label: "Dull and rough skin", description: "Texture and lack of clarity stand out most." },
          { value: "D", label: "Severe dehydration and tightness", description: "Comfort and barrier relief matter most." },
          { value: "E", label: "No major concern", description: "You want the healthiest everyday baseline." },
        ],
      },
      {
        key: "q5",
        title: "What wash feel do you prefer?",
        note: "The last step tunes sensory preference without crossing the safety filters.",
        options: [
          { value: "A", label: "Rich foamy cleanse", description: "You enjoy a fuller, more familiar foam feel." },
          { value: "B", label: "Very fresh and squeaky-clean", description: "You want a more oil-cutting finish." },
          { value: "C", label: "Soft and hydrated after rinsing", description: "You dislike that stripped post-wash feeling." },
          { value: "D", label: "Low-foam and very gentle", description: "You want the mildest sensory profile possible." },
        ],
      },
    ],
    routes: {
      apg_soothing: {
        key: "apg_soothing",
        title: "Soothing cleanse",
        summary: "Prioritizes calmer skin, lower irritation load, and a more comfortable wash experience.",
      },
      pure_amino: {
        key: "pure_amino",
        title: "Gentle amino cleanse",
        summary: "Prioritizes a mild everyday wash that keeps comfort higher after rinsing.",
      },
      soap_amino_blend: {
        key: "soap_amino_blend",
        title: "Balanced deep cleanse",
        summary: "Prioritizes stronger cleansing feel while staying more balanced than an all-out stripping wash.",
      },
      bha_clearing: {
        key: "bha_clearing",
        title: "BHA clearing",
        summary: "Prioritizes congestion, oil management, and clearer-feeling skin when buildup is the issue.",
      },
      clay_purifying: {
        key: "clay_purifying",
        title: "Clay purifying",
        summary: "Prioritizes oil absorption, cleaner-feeling pores, and a fresher finish.",
      },
      enzyme_polishing: {
        key: "enzyme_polishing",
        title: "Enzyme polishing",
        summary: "Prioritizes smoother texture and a more refined skin feel when dullness leads the problem.",
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
