import Link from "next/link";
import {
  normalizeCleanserSignals,
  toCleanserSearchParams,
  type CleanserSignals,
} from "@/lib/mobile/cleanserDecision";

type Search = Record<string, string | string[] | undefined>;
type StepKey = keyof CleanserSignals;
type Option = { value: string; label: string; sub: string };

const STEPS: Array<{ key: StepKey; title: string; note: string; options: Option[] }> = [
  {
    key: "skin",
    title: "你更接近哪类肤质人群",
    note: "先定位人群，再做复合收敛",
    options: [
      { value: "oily-acne", label: "偏油、易闷痘", sub: "要清爽但不能过激" },
      { value: "combo", label: "混合肌（T 区油、两颊一般）", sub: "要平衡清洁" },
      { value: "dry-sensitive", label: "偏干、易敏感", sub: "先稳耐受" },
      { value: "stable", label: "整体稳定", sub: "要长期稳定好用" },
    ],
  },
  {
    key: "issue",
    title: "你最想先解决什么",
    note: "只选当前核心困扰",
    options: [
      { value: "oil-shine", label: "油光和闷感", sub: "希望回油慢一点" },
      { value: "tight-after", label: "洗后紧绷", sub: "希望不拔干" },
      { value: "sting-red", label: "刺痛/泛红", sub: "希望更温和" },
      { value: "residue", label: "防晒残留洗不净", sub: "希望清洁更到位" },
    ],
  },
  {
    key: "scene",
    title: "你的主要使用场景",
    note: "场景会影响清洁力度取舍",
    options: [
      { value: "morning-quick", label: "早晨快洗", sub: "要快、要稳" },
      { value: "night-clean", label: "晚间日常清洁", sub: "要洗净但不过度" },
      { value: "post-workout", label: "运动后清洁", sub: "要快速净汗" },
      { value: "after-sunscreen", label: "防晒后清洁", sub: "要兼顾残留与温和" },
    ],
  },
  {
    key: "avoid",
    title: "最后一个排除条件",
    note: "告诉我们你不接受什么",
    options: [
      { value: "over-clean", label: "清洁过猛", sub: "不想越洗越敏" },
      { value: "strong-fragrance", label: "香味太重", sub: "希望气味克制" },
      { value: "low-foam", label: "低泡无反馈", sub: "希望有适度清洁反馈" },
      { value: "complex-formula", label: "配方过于复杂", sub: "希望简单稳定" },
    ],
  },
];

const CHOICE_LABELS: Record<StepKey, Record<string, string>> = {
  skin: {
    "oily-acne": "偏油、易闷痘",
    combo: "混合肌",
    "dry-sensitive": "偏干、易敏感",
    stable: "整体稳定",
  },
  issue: {
    "oil-shine": "油光和闷感",
    "tight-after": "洗后紧绷",
    "sting-red": "刺痛/泛红",
    residue: "防晒残留洗不净",
  },
  scene: {
    "morning-quick": "早晨快洗",
    "night-clean": "晚间日常清洁",
    "post-workout": "运动后清洁",
    "after-sunscreen": "防晒后清洁",
  },
  avoid: {
    "over-clean": "清洁过猛",
    "strong-fragrance": "香味太重",
    "low-foam": "低泡无反馈",
    "complex-formula": "配方过于复杂",
  },
};

function makeHref(signals: CleanserSignals, key: StepKey, value: string, nextStep: number): string {
  const merged: CleanserSignals = { ...signals, [key]: value };
  const qp = toCleanserSearchParams(merged);
  qp.set("step", String(nextStep));
  if (nextStep > STEPS.length) return `/m/cleanser/resolve?${qp.toString()}`;
  return `/m/cleanser/profile?${qp.toString()}`;
}

export default async function CleanserProfilePage({
  searchParams,
}: {
  searchParams?: Search | Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const signals = normalizeCleanserSignals(raw);
  const stepNumRaw = Array.isArray(raw.step) ? raw.step[0] : raw.step;
  const parsed = Number(stepNumRaw || "1");
  const stepNum = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), STEPS.length) : 1;
  const current = STEPS[stepNum - 1];

  return (
    <section className="pb-8">
      <div className="text-[13px] font-medium text-black/45">洗面奶决策 · 第 {stepNum}/{STEPS.length} 步</div>
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
          {(["skin", "issue", "scene", "avoid"] as StepKey[]).map((k) => {
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
