import Link from "next/link";
import {
  normalizeBodyWashSignals,
  toBodyWashSearchParams,
  type BodyWashSignals,
} from "@/lib/mobile/bodywashDecision";

type Search = Record<string, string | string[] | undefined>;
type StepKey = keyof BodyWashSignals;
type Option = { value: string; label: string; sub: string };

const STEPS: Array<{ key: StepKey; title: string; note: string; options: Option[] }> = [
  {
    key: "feel",
    title: "洗完后你最怕哪种感觉",
    note: "只选最接近你的那一项",
    options: [
      { value: "dry-tight", label: "紧绷发干", sub: "洗完不舒服，皮肤容易发紧" },
      { value: "slimy", label: "黏腻冲不净", sub: "总觉得有膜感，冲很久" },
      { value: "itch-red", label: "容易痒/泛红", sub: "想洗干净但怕刺激" },
      { value: "odor-fast", label: "体味残留快", sub: "希望净味更稳定" },
    ],
  },
  {
    key: "scene",
    title: "你大多数在什么场景洗澡",
    note: "场景会直接影响我们怎么拍板",
    options: [
      { value: "quick-morning", label: "早晨快冲", sub: "希望效率高、好冲净" },
      { value: "night-care", label: "晚上认真洗", sub: "更重视洗后肤感" },
      { value: "post-workout", label: "运动后立刻洗", sub: "要清爽但别过度清洁" },
      { value: "dry-season", label: "换季/干冷期", sub: "避免越洗越干" },
    ],
  },
  {
    key: "skin",
    title: "你的身体皮肤更接近哪种状态",
    note: "别纠结，选最常见状态",
    options: [
      { value: "dry", label: "偏干，容易起屑", sub: "优先洗后舒适" },
      { value: "oily", label: "偏油，背部易出油", sub: "优先清爽和冲净" },
      { value: "sensitive", label: "敏感，容易刺激", sub: "优先低刺激" },
      { value: "stable", label: "基本稳定", sub: "日常好用就行" },
    ],
  },
  {
    key: "avoid",
    title: "最后一个排除条件",
    note: "告诉我们你不想要什么",
    options: [
      { value: "strong-fragrance", label: "香味太重", sub: "气味越克制越好" },
      { value: "hard-rinse", label: "冲洗慢有膜感", sub: "希望一冲就净" },
      { value: "too-strong-clean", label: "清洁力太猛", sub: "不想越洗越干" },
      { value: "complex-formula", label: "成分太复杂", sub: "希望简单稳定" },
    ],
  },
];

const CHOICE_LABELS: Record<StepKey, Record<string, string>> = {
  feel: {
    "dry-tight": "紧绷发干",
    slimy: "黏腻冲不净",
    "itch-red": "容易痒/泛红",
    "odor-fast": "体味残留快",
  },
  scene: {
    "quick-morning": "早晨快冲",
    "night-care": "晚上认真洗",
    "post-workout": "运动后立刻洗",
    "dry-season": "换季/干冷期",
  },
  skin: {
    dry: "偏干，容易起屑",
    oily: "偏油，背部易出油",
    sensitive: "敏感，容易刺激",
    stable: "基本稳定",
  },
  avoid: {
    "strong-fragrance": "香味太重",
    "hard-rinse": "冲洗慢有膜感",
    "too-strong-clean": "清洁力太猛",
    "complex-formula": "成分太复杂",
  },
};

function makeHref(signals: BodyWashSignals, key: StepKey, value: string, nextStep: number): string {
  const merged: BodyWashSignals = { ...signals, [key]: value };
  const qp = toBodyWashSearchParams(merged);
  qp.set("step", String(nextStep));
  if (nextStep > STEPS.length) return `/m/bodywash/resolve?${qp.toString()}`;
  return `/m/bodywash/profile?${qp.toString()}`;
}

export default async function BodyWashProfilePage({
  searchParams,
}: {
  searchParams?: Search | Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const signals = normalizeBodyWashSignals(raw);
  const stepNumRaw = Array.isArray(raw.step) ? raw.step[0] : raw.step;
  const parsed = Number(stepNumRaw || "1");
  const stepNum = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), STEPS.length) : 1;
  const current = STEPS[stepNum - 1];

  return (
    <section className="pb-8">
      <div className="text-[13px] font-medium text-black/45">沐浴露决策 · 第 {stepNum}/{STEPS.length} 步</div>
      <h1 className="mt-2 text-[30px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/90">{current.title}</h1>
      <p className="mt-2 text-[15px] leading-[1.5] text-black/60">{current.note}</p>

      <div className="mt-6 space-y-3">
        {current.options.map((opt) => (
          <Link
            key={opt.value}
            href={makeHref(signals, current.key, opt.value, stepNum + 1)}
            className="block rounded-2xl border border-black/10 bg-white px-4 py-4 active:bg-black/[0.03]"
          >
            <div className="text-[16px] font-semibold text-black/90">{opt.label}</div>
            <div className="mt-1 text-[13px] text-black/55">{opt.sub}</div>
          </Link>
        ))}
      </div>

      <div className="mt-7 rounded-2xl border border-black/8 bg-black/[0.02] px-4 py-4">
        <div className="text-[13px] font-medium text-black/55">已收集信号</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["feel", "scene", "skin", "avoid"] as StepKey[]).map((k) => {
            const value = signals[k];
            if (!value) return null;
            return (
              <span
                key={`${k}-${value}`}
                className="inline-flex h-7 items-center rounded-full bg-black/[0.06] px-3 text-[12px] text-black/70"
              >
                {CHOICE_LABELS[k][value]}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
