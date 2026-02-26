import Link from "next/link";
import {
  normalizeConditionerSignals,
  toConditionerSearchParams,
  type ConditionerSignals,
} from "@/lib/mobile/conditionerDecision";

type Search = Record<string, string | string[] | undefined>;
type StepKey = keyof ConditionerSignals;
type Option = { value: string; label: string; sub: string };

const STEPS: Array<{ key: StepKey; title: string; note: string; options: Option[] }> = [
  {
    key: "target",
    title: "你最想先解决哪一个问题",
    note: "只选当前最困扰你的",
    options: [
      { value: "tangle", label: "打结难梳", sub: "洗后梳理费劲" },
      { value: "frizz", label: "毛躁炸开", sub: "发丝不服帖" },
      { value: "dry-ends", label: "发尾干硬分叉", sub: "尾段发涩没弹性" },
      { value: "flat-roots", label: "贴头皮没蓬松", sub: "一顺就容易塌" },
    ],
  },
  {
    key: "hair",
    title: "你的头发长度/状态更像",
    note: "按最常见状态选",
    options: [
      { value: "short", label: "短发或中短", sub: "希望轻量快冲" },
      { value: "mid-long", label: "中长发", sub: "希望顺滑稳定" },
      { value: "long-damaged", label: "长发/经常烫染", sub: "需要控躁与修护" },
      { value: "fine-flat", label: "细软扁塌", sub: "怕厚重压塌" },
    ],
  },
  {
    key: "use",
    title: "你通常怎么用护发素",
    note: "按你真实习惯选",
    options: [
      { value: "tips-quick", label: "只抹发尾，快冲", sub: "停留时间很短" },
      { value: "hold-1-3", label: "停留 1-3 分钟", sub: "可以等一会再冲" },
      { value: "more-for-smooth", label: "用量偏多，追求更顺", sub: "希望手感更明显" },
      { value: "touch-scalp", label: "常不小心碰到头皮", sub: "担心残留或塌" },
    ],
  },
  {
    key: "avoid",
    title: "最后一个排除条件",
    note: "告诉我们你不能接受什么",
    options: [
      { value: "still-rough", label: "冲完还是涩", sub: "希望真实顺滑" },
      { value: "next-day-flat", label: "第二天就塌", sub: "希望轻盈不压塌" },
      { value: "strong-fragrance", label: "香味太重", sub: "希望低气味负担" },
      { value: "residue-film", label: "有残留膜感", sub: "希望冲净感更强" },
    ],
  },
];

const CHOICE_LABELS: Record<StepKey, Record<string, string>> = {
  target: {
    tangle: "打结难梳",
    frizz: "毛躁炸开",
    "dry-ends": "发尾干硬分叉",
    "flat-roots": "贴头皮没蓬松",
  },
  hair: {
    short: "短发或中短",
    "mid-long": "中长发",
    "long-damaged": "长发/经常烫染",
    "fine-flat": "细软扁塌",
  },
  use: {
    "tips-quick": "只抹发尾，快冲",
    "hold-1-3": "停留 1-3 分钟",
    "more-for-smooth": "用量偏多，追求更顺",
    "touch-scalp": "常不小心碰到头皮",
  },
  avoid: {
    "still-rough": "冲完还是涩",
    "next-day-flat": "第二天就塌",
    "strong-fragrance": "香味太重",
    "residue-film": "有残留膜感",
  },
};

function makeHref(signals: ConditionerSignals, key: StepKey, value: string, nextStep: number): string {
  const merged: ConditionerSignals = { ...signals, [key]: value };
  const qp = toConditionerSearchParams(merged);
  qp.set("step", String(nextStep));
  if (nextStep > STEPS.length) return `/m/conditioner/resolve?${qp.toString()}`;
  return `/m/conditioner/profile?${qp.toString()}`;
}

export default async function ConditionerProfilePage({
  searchParams,
}: {
  searchParams?: Search | Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const signals = normalizeConditionerSignals(raw);
  const stepNumRaw = Array.isArray(raw.step) ? raw.step[0] : raw.step;
  const parsed = Number(stepNumRaw || "1");
  const stepNum = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), STEPS.length) : 1;
  const current = STEPS[stepNum - 1];

  return (
    <section className="pb-8">
      <div className="text-[13px] font-medium text-black/45">护发素决策 · 第 {stepNum}/{STEPS.length} 步</div>
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
          {(["target", "hair", "use", "avoid"] as StepKey[]).map((k) => {
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
