import Link from "next/link";
import {
  normalizeLotionSignals,
  toLotionSearchParams,
  type LotionSignals,
} from "@/lib/mobile/lotionDecision";

type Search = Record<string, string | string[] | undefined>;
type StepKey = keyof LotionSignals;
type Option = { value: string; label: string; sub: string };

const STEPS: Array<{ key: StepKey; title: string; note: string; options: Option[] }> = [
  {
    key: "group",
    title: "你更接近哪类人群",
    note: "先做人群定位，再进入细化收敛",
    options: [
      { value: "dry-tight", label: "洗后常紧绷、偏干", sub: "先稳住舒适度" },
      { value: "rough-dull", label: "摸起来粗糙、缺光泽", sub: "先改善触感" },
      { value: "sensitive-red", label: "容易泛红或刺痒", sub: "先降低刺激" },
      { value: "stable-maintain", label: "整体稳定，想长期维护", sub: "先要低负担稳定" },
    ],
  },
  {
    key: "issue",
    title: "你现在最明显的困扰",
    note: "只选当前最影响你的",
    options: [
      { value: "itch-flake", label: "干痒/轻微起屑", sub: "希望先恢复舒适" },
      { value: "rough-patch", label: "局部粗糙（手肘膝盖）", sub: "希望更柔软" },
      { value: "dull-no-soft", label: "不够细腻柔软", sub: "希望肤感更顺" },
      { value: "none", label: "没有明显困扰", sub: "以稳定维护为主" },
    ],
  },
  {
    key: "scene",
    title: "你的主要使用场景",
    note: "场景会决定保湿强度和质地",
    options: [
      { value: "after-shower", label: "洗澡后马上用", sub: "重视锁水效率" },
      { value: "dry-cold", label: "换季/干冷时用", sub: "重视保湿续航" },
      { value: "ac-room", label: "空调环境白天用", sub: "重视不黏腻" },
      { value: "night-repair", label: "夜间修护用", sub: "重视隔夜舒适" },
    ],
  },
  {
    key: "avoid",
    title: "最后一个排除条件",
    note: "告诉我们你不想要什么",
    options: [
      { value: "sticky-greasy", label: "黏腻厚重", sub: "希望清爽些" },
      { value: "strong-fragrance", label: "香味太重", sub: "希望气味克制" },
      { value: "active-too-much", label: "活性叠加太多", sub: "希望极简稳定" },
      { value: "none", label: "没有特别排除", sub: "可以直接拍板" },
    ],
  },
];

const CHOICE_LABELS: Record<StepKey, Record<string, string>> = {
  group: {
    "dry-tight": "洗后常紧绷、偏干",
    "rough-dull": "摸起来粗糙、缺光泽",
    "sensitive-red": "容易泛红或刺痒",
    "stable-maintain": "整体稳定，想长期维护",
  },
  issue: {
    "itch-flake": "干痒/轻微起屑",
    "rough-patch": "局部粗糙（手肘膝盖）",
    "dull-no-soft": "不够细腻柔软",
    none: "没有明显困扰",
  },
  scene: {
    "after-shower": "洗澡后马上用",
    "dry-cold": "换季/干冷时用",
    "ac-room": "空调环境白天用",
    "night-repair": "夜间修护用",
  },
  avoid: {
    "sticky-greasy": "黏腻厚重",
    "strong-fragrance": "香味太重",
    "active-too-much": "活性叠加太多",
    none: "没有特别排除",
  },
};

function makeHref(signals: LotionSignals, key: StepKey, value: string, nextStep: number): string {
  const merged: LotionSignals = { ...signals, [key]: value };
  const qp = toLotionSearchParams(merged);
  qp.set("step", String(nextStep));
  if (nextStep > STEPS.length) return `/m/lotion/resolve?${qp.toString()}`;
  return `/m/lotion/profile?${qp.toString()}`;
}

export default async function LotionProfilePage({
  searchParams,
}: {
  searchParams?: Search | Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const signals = normalizeLotionSignals(raw);
  const stepNumRaw = Array.isArray(raw.step) ? raw.step[0] : raw.step;
  const parsed = Number(stepNumRaw || "1");
  const stepNum = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), STEPS.length) : 1;
  const current = STEPS[stepNum - 1];

  return (
    <section className="pb-8">
      <div className="text-[13px] font-medium text-black/45">润肤霜决策 · 第 {stepNum}/{STEPS.length} 步</div>
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
          {(["group", "issue", "scene", "avoid"] as StepKey[]).map((k) => {
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
