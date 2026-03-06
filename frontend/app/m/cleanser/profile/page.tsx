import Link from "next/link";
import { redirect } from "next/navigation";
import {
  cleanserChoiceLabel,
  isCompleteCleanserSignals,
  normalizeCleanserSignals,
  toCleanserSearchParams,
  type CleanserSignals,
} from "@/lib/mobile/cleanserDecision";

type Search = Record<string, string | string[] | undefined>;
type StepKey = keyof CleanserSignals;
type OptionValue = "A" | "B" | "C" | "D" | "E";
type Option = { value: OptionValue; label: string; sub: string };

const STEPS: Array<{ key: StepKey; title: string; note: string; options: Option[] }> = [
  {
    key: "q1",
    title: "Q1 基础肤质与出油量",
    note: "先确定皮脂基线，决定清洁强度的主权重。",
    options: [
      { value: "A", label: "A. 大油田", sub: "全脸泛油，洗后很快回油" },
      { value: "B", label: "B. 混油皮", sub: "T区明显出油，U区正常或偏干" },
      { value: "C", label: "C. 中性/混干", sub: "出油正常，偶发干燥" },
      { value: "D", label: "D. 大干皮", sub: "极少出油，洗后易紧绷起皮" },
    ],
  },
  {
    key: "q2",
    title: "Q2 屏障健康与敏感度",
    note: "安全优先级最高，这一步会触发强制掩码。",
    options: [
      { value: "A", label: "A. 重度敏感", sub: "常泛红发痒，容易刺痛" },
      { value: "B", label: "B. 轻度敏感", sub: "偶尔泛红，需谨慎选品" },
      { value: "C", label: "C. 屏障健康", sub: "耐受稳定，对活性成分容忍更高" },
    ],
  },
  {
    key: "q3",
    title: "Q3 日常清洁负担",
    note: "根据彩妆/防晒负担修正洗净力需求。",
    options: [
      { value: "A", label: "A. 每天浓妆", sub: "常见防水妆或高倍防晒" },
      { value: "B", label: "B. 淡妆/通勤防晒", sub: "日常隔离或轻薄底妆" },
      { value: "C", label: "C. 仅素颜", sub: "只需清理皮脂与灰尘" },
    ],
  },
  {
    key: "q4",
    title: "Q4 面部特殊痛点",
    note: "这一题决定功能路径和排除策略。",
    options: [
      { value: "A", label: "A. 黑头与闭口粉刺", sub: "毛孔堵塞与脂栓明显" },
      { value: "B", label: "B. 红肿破口痘", sub: "处于炎症或破口阶段" },
      { value: "C", label: "C. 暗沉粗糙", sub: "角质堆积、肤色不匀" },
      { value: "D", label: "D. 极度缺水紧绷", sub: "洗后立刻干涩刺痛" },
      { value: "E", label: "E. 无明显痛点", sub: "以健康维稳为主" },
    ],
  },
  {
    key: "q5",
    title: "Q5 质地与洗后肤感",
    note: "最后一步按偏好做轻量收敛，不越过安全边界。",
    options: [
      { value: "A", label: "A. 喜欢丰富绵密泡沫", sub: "更有清洁仪式感" },
      { value: "B", label: "B. 喜欢绝对清爽感", sub: "追求更强去油触感" },
      { value: "C", label: "C. 喜欢保留水润滑感", sub: "抗拒洗后紧绷" },
      { value: "D", label: "D. 喜欢无泡/低泡温和感", sub: "只要温和不刺激" },
    ],
  },
];

function queryValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function buildNextHref(
  signals: CleanserSignals,
  key: StepKey,
  value: OptionValue,
  nextStep: number,
): string {
  const merged: CleanserSignals = { ...signals, [key]: value };
  const qp = toCleanserSearchParams(merged);
  if (isCompleteCleanserSignals(merged)) {
    return `/m/cleanser/resolve?${qp.toString()}`;
  }
  qp.set("step", String(nextStep));
  return `/m/cleanser/profile?${qp.toString()}`;
}

export default async function CleanserProfilePage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const signals = normalizeCleanserSignals(raw);
  const stepRaw = queryValue(raw.step);
  const parsedStep = Number(stepRaw || "1");

  if (!signals.q1 && parsedStep > 1) {
    redirect("/m/cleanser/profile?step=1");
  }
  if (signals.q1 && !signals.q2 && parsedStep > 2) {
    redirect(`/m/cleanser/profile?${toCleanserSearchParams({ q1: signals.q1 }).toString()}&step=2`);
  }
  if (signals.q1 && signals.q2 && !signals.q3 && parsedStep > 3) {
    redirect(`/m/cleanser/profile?${toCleanserSearchParams({ q1: signals.q1, q2: signals.q2 }).toString()}&step=3`);
  }
  if (signals.q1 && signals.q2 && signals.q3 && !signals.q4 && parsedStep > 4) {
    redirect(
      `/m/cleanser/profile?${toCleanserSearchParams({ q1: signals.q1, q2: signals.q2, q3: signals.q3 }).toString()}&step=4`,
    );
  }
  if (signals.q1 && signals.q2 && signals.q3 && signals.q4 && !signals.q5 && parsedStep > 5) {
    redirect(
      `/m/cleanser/profile?${toCleanserSearchParams({ q1: signals.q1, q2: signals.q2, q3: signals.q3, q4: signals.q4 }).toString()}&step=5`,
    );
  }
  if (isCompleteCleanserSignals(signals)) {
    redirect(`/m/cleanser/resolve?${toCleanserSearchParams(signals).toString()}`);
  }

  const stepNum = Number.isFinite(parsedStep) ? Math.min(Math.max(parsedStep, 1), STEPS.length) : 1;
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
            href={buildNextHref(signals, current.key, opt.value, stepNum + 1)}
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
          {(["q1", "q2", "q3", "q4", "q5"] as StepKey[]).map((key) => {
            const value = signals[key];
            if (!value) return null;
            return (
              <span
                key={`${key}-${value}`}
                className="inline-flex h-7 items-center rounded-full bg-black/[0.06] px-3 text-[12px] text-black/70"
              >
                {key.toUpperCase()} · {value} · {cleanserChoiceLabel(key, value)}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
