import Link from "next/link";
import { redirect } from "next/navigation";
import {
  bodyWashChoiceLabel,
  isReadyBodyWashResult,
  normalizeBodyWashSignals,
  toBodyWashSearchParams,
  type BodyWashSignals,
} from "@/lib/mobile/bodywashDecision";

type Search = Record<string, string | string[] | undefined>;
type StepKey = keyof BodyWashSignals;
type OptionValue = "A" | "B" | "C" | "D";
type Option = { value: OptionValue; label: string; sub: string };

const STEPS: Array<{ key: StepKey; title: string; note: string; options: Option[] }> = [
  {
    key: "q1",
    title: "Q1 当前气候与微环境更接近哪一类？",
    note: "这一步决定基础背景权重。",
    options: [
      { value: "A", label: "A. 干燥寒冷", sub: "北方冬季常见，易干裂脱屑" },
      { value: "B", label: "B. 干燥炎热", sub: "日照强、汗液蒸发快，易发烫紧绷" },
      { value: "C", label: "C. 潮湿闷热", sub: "汗油混合，体感厚重，细菌易滋生" },
      { value: "D", label: "D. 潮湿寒冷", sub: "阴冷+热水澡常导致过度去脂" },
    ],
  },
  {
    key: "q2",
    title: "Q2 你的皮肤基础耐受度？",
    note: "安全优先级最高，选完我们会先做硬过滤。",
    options: [
      { value: "A", label: "A. 极度敏感", sub: "遇热/摩擦易发红，换季刺痛瘙痒" },
      { value: "B", label: "B. 屏障健康", sub: "对多数产品耐受稳定" },
    ],
  },
  {
    key: "q3",
    title: "Q3 当前油脂与角质状态？",
    note: "这一步决定洗剂基底与功能主线。",
    options: [
      { value: "A", label: "A. 出油旺盛", sub: "前胸后背易长痘、午后粘腻" },
      { value: "B", label: "B. 缺油干涩", sub: "像砂纸，洗后不涂会发痒" },
      { value: "C", label: "C. 角质堆积", sub: "鸡皮肤/关节厚茧/暗沉" },
      { value: "D", label: "D. 状态正常", sub: "无明显油痘或粗糙痛点" },
    ],
  },
  {
    key: "q4",
    title: "Q4 你更喜欢哪种冲洗肤感？",
    note: "这一步是肤感修正系数。",
    options: [
      { value: "A", label: "A. 清爽干脆", sub: "讨厌残留，偏好“嘎吱响”" },
      { value: "B", label: "B. 柔滑滋润", sub: "接受轻膜感，喜欢乳液般包裹" },
    ],
  },
  {
    key: "q5",
    title: "Q5 有没有特殊限制？",
    note: "这一步用于成分过滤。",
    options: [
      { value: "A", label: "A. 极致纯净", sub: "备孕/母婴/强排香精场景" },
      { value: "B", label: "B. 情绪留香", sub: "希望有高级香氛体验" },
    ],
  },
];

function queryValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function buildNextHref(signals: BodyWashSignals, key: StepKey, value: OptionValue, nextStep: number): string {
  const merged: BodyWashSignals = { ...signals, [key]: value };
  const qp = toBodyWashSearchParams(merged);

  if (key === "q2" && merged.q1 && merged.q2 === "A") {
    return `/m/bodywash/resolve?${qp.toString()}`;
  }

  if (isReadyBodyWashResult(merged)) {
    return `/m/bodywash/resolve?${qp.toString()}`;
  }

  qp.set("step", String(nextStep));
  return `/m/bodywash/profile?${qp.toString()}`;
}

export default async function BodyWashProfilePage({
  searchParams,
}: {
  searchParams?: Search | Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const signals = normalizeBodyWashSignals(raw);
  const stepRaw = queryValue(raw.step);
  const parsedStep = Number(stepRaw || "1");

  if (!signals.q1 && parsedStep > 1) {
    redirect("/m/bodywash/profile?step=1");
  }

  if (signals.q1 && !signals.q2 && parsedStep > 2) {
    redirect(`/m/bodywash/profile?${toBodyWashSearchParams({ q1: signals.q1 }).toString()}&step=2`);
  }

  if (signals.q1 && signals.q2 === "A") {
    redirect(`/m/bodywash/resolve?${toBodyWashSearchParams(signals).toString()}`);
  }

  if (signals.q1 && signals.q2 === "B" && !signals.q3 && parsedStep > 3) {
    redirect(`/m/bodywash/profile?${toBodyWashSearchParams({ q1: signals.q1, q2: signals.q2 }).toString()}&step=3`);
  }

  if (signals.q1 && signals.q2 && signals.q3 && !signals.q4 && parsedStep > 4) {
    redirect(
      `/m/bodywash/profile?${toBodyWashSearchParams({ q1: signals.q1, q2: signals.q2, q3: signals.q3 }).toString()}&step=4`,
    );
  }

  if (signals.q1 && signals.q2 && signals.q3 && signals.q4 && !signals.q5 && parsedStep > 5) {
    redirect(
      `/m/bodywash/profile?${toBodyWashSearchParams({ q1: signals.q1, q2: signals.q2, q3: signals.q3, q4: signals.q4 }).toString()}&step=5`,
    );
  }

  if (isReadyBodyWashResult(signals)) {
    redirect(`/m/bodywash/resolve?${toBodyWashSearchParams(signals).toString()}`);
  }

  const stepNum = Number.isFinite(parsedStep) ? Math.min(Math.max(parsedStep, 1), STEPS.length) : 1;
  const current = STEPS[stepNum - 1];

  return (
    <section className="pb-8">
      <div className="text-[13px] font-medium text-black/45">沐浴挑选 · 第 {stepNum}/5 步</div>
      <h1 className="mt-2 text-[30px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/90">{current.title}</h1>
      <p className="mt-2 text-[15px] leading-[1.55] text-black/60">{current.note}</p>

      <div className="mt-6 space-y-3">
        {current.options.map((opt) => (
          <Link
            key={opt.value}
            href={buildNextHref(signals, current.key, opt.value, stepNum + 1)}
            className="block rounded-2xl border border-black/10 bg-white px-4 py-4 active:bg-black/[0.03]"
          >
            <div className="text-[16px] font-semibold text-black/90">{opt.label}</div>
            <div className="mt-1 text-[13px] text-black/55">{opt.sub}</div>
          </Link>
        ))}
      </div>

      <div className="mt-7 rounded-2xl border border-black/8 bg-black/[0.02] px-4 py-4">
        <div className="text-[13px] font-medium text-black/55">你已完成</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["q1", "q2", "q3", "q4", "q5"] as StepKey[]).map((key) => {
            const value = signals[key];
            if (!value) return null;
            return (
              <span
                key={`${key}-${value}`}
                className="inline-flex h-7 items-center rounded-full bg-black/[0.06] px-3 text-[12px] text-black/70"
              >
                {key.toUpperCase()} · {value} · {bodyWashChoiceLabel(key, value)}
              </span>
            );
          })}
          {!signals.q1 && !signals.q2 && !signals.q3 && !signals.q4 && !signals.q5 && (
            <span className="text-[13px] text-black/45">从第一题开始，系统会自动收敛到唯一类别。</span>
          )}
        </div>
      </div>
    </section>
  );
}
