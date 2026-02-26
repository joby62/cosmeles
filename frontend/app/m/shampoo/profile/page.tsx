import Link from "next/link";
import {
  normalizeShampooSignals,
  toSignalSearchParams,
  type ShampooSignals,
} from "@/lib/mobile/shampooDecision";

type Search = Record<string, string | string[] | undefined>;

type StepKey = keyof ShampooSignals;

type Option = { value: string; label: string; sub: string };

const STEPS: Array<{
  key: StepKey;
  title: string;
  note: string;
  options: Option[];
}> = [
  {
    key: "scalp",
    title: "先说你的头皮状态",
    note: "只选最接近你的那一项",
    options: [
      { value: "very-oily", label: "一天不到就油", sub: "偏快出油，下午容易塌" },
      { value: "oily", label: "一天会油", sub: "偏油，但还能接受" },
      { value: "normal", label: "基本正常", sub: "不太油也不太干" },
      { value: "dry-sensitive", label: "偏干或偏敏", sub: "容易紧绷、发痒或不舒服" },
    ],
  },
  {
    key: "issue",
    title: "你最想解决什么",
    note: "不做评分，直接说核心困扰",
    options: [
      { value: "flat-oily", label: "油+塌，蓬不起来", sub: "下午头发贴头皮" },
      { value: "itch-dandruff", label: "头皮痒/有头屑", sub: "想更干净但别太刺激" },
      { value: "dry-frizz", label: "干涩毛躁", sub: "希望顺一点、不要炸毛" },
      { value: "none", label: "没明显问题", sub: "只要稳定、好用" },
    ],
  },
  {
    key: "scene",
    title: "你的主要使用场景",
    note: "场景会直接影响我们怎么拍板",
    options: [
      { value: "rush-morning", label: "早上赶时间", sub: "要快、要稳、别翻车" },
      { value: "daily-commute", label: "日常通勤", sub: "每天都能放心用" },
      { value: "post-workout", label: "运动后清洁", sub: "要清爽，不想过度清洁" },
    ],
  },
  {
    key: "avoid",
    title: "最后一个排除条件",
    note: "告诉我们你不想要什么",
    options: [
      { value: "strong-fragrance", label: "不要浓香", sub: "气味越克制越好" },
      { value: "high-cleansing", label: "不要过强清洁", sub: "不想洗完太干" },
      { value: "none", label: "没有特别排除", sub: "你们直接拍板就行" },
    ],
  },
];

const CHOICE_LABELS: Record<StepKey, Record<string, string>> = {
  scalp: {
    "very-oily": "一天不到就油",
    oily: "一天会油",
    normal: "基本正常",
    "dry-sensitive": "偏干或偏敏",
  },
  issue: {
    "flat-oily": "油+塌，蓬不起来",
    "itch-dandruff": "头皮痒/有头屑",
    "dry-frizz": "干涩毛躁",
    none: "没明显问题",
  },
  scene: {
    "rush-morning": "早上赶时间",
    "daily-commute": "日常通勤",
    "post-workout": "运动后清洁",
  },
  avoid: {
    "strong-fragrance": "不要浓香",
    "high-cleansing": "不要过强清洁",
    none: "没有特别排除",
  },
};

function makeHref(
  signals: ShampooSignals,
  key: StepKey,
  value: string,
  nextStep: number,
): string {
  const merged: ShampooSignals = { ...signals, [key]: value };
  const qp = toSignalSearchParams(merged);
  qp.set("step", String(nextStep));
  if (nextStep > STEPS.length) return `/m/shampoo/resolve?${qp.toString()}`;
  return `/m/shampoo/profile?${qp.toString()}`;
}

export default async function ShampooProfilePage({
  searchParams,
}: {
  searchParams?: Search | Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const signals = normalizeShampooSignals(raw);
  const stepNumRaw = Array.isArray(raw.step) ? raw.step[0] : raw.step;
  const parsed = Number(stepNumRaw || "1");
  const stepNum = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), STEPS.length) : 1;
  const current = STEPS[stepNum - 1];

  return (
    <section className="pb-8">
      <div className="text-[13px] font-medium text-black/45">洗发水决策 · 第 {stepNum}/{STEPS.length} 步</div>
      <h1 className="mt-2 text-[30px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/90">
        {current.title}
      </h1>
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
          {(["scalp", "issue", "scene", "avoid"] as StepKey[]).map((k) => {
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
          {!signals.scalp && !signals.issue && !signals.scene && !signals.avoid && (
            <span className="text-[13px] text-black/45">还没有，先从第一步开始。</span>
          )}
        </div>
      </div>
    </section>
  );
}
