import Link from "next/link";
import { redirect } from "next/navigation";
import {
  isCompleteLotionSignals,
  lotionChoiceLabel,
  normalizeLotionSignals,
  toLotionSearchParams,
  type LotionSignals,
} from "@/lib/mobile/lotionDecision";

type Search = Record<string, string | string[] | undefined>;
type StepKey = keyof LotionSignals;
type OptionValue = "A" | "B" | "C" | "D" | "E";
type Option = { value: OptionValue; label: string; sub: string };

const STEPS: Array<{ key: StepKey; title: string; note: string; options: Option[] }> = [
  {
    key: "q1",
    title: "Q1 气候环境与当前季节",
    note: "先确定环境权重，决定保湿和清爽的底盘。",
    options: [
      { value: "A", label: "A. 干燥寒冷 / 长时间待在暖气房", sub: "优先提高封闭保湿能力" },
      { value: "B", label: "B. 炎热潮湿 / 夏季易出汗环境", sub: "优先轻薄吸收，避免闷黏" },
      { value: "C", label: "C. 换季温差大 / 经常刮风", sub: "优先平衡修护与舒适感" },
      { value: "D", label: "D. 气候温和 / 室内温湿度适宜", sub: "按功效诉求做收敛" },
    ],
  },
  {
    key: "q2",
    title: "Q2 身体肌肤耐受度",
    note: "安全优先，这一步会触发敏感掩码。",
    options: [
      { value: "A", label: "A. 极度敏感", sub: "易泛红干痒，需严格避刺激" },
      { value: "B", label: "B. 屏障健康", sub: "耐受较强，可考虑功效型路线" },
    ],
  },
  {
    key: "q3",
    title: "Q3 最核心的皮肤痛点",
    note: "这一题主导路线归属和风险隔离。",
    options: [
      { value: "A", label: "A. 极度干屑", sub: "重点缓解干裂瘙痒和脱屑" },
      { value: "B", label: "B. 躯干痘痘", sub: "重点清痘并避免闷痘" },
      { value: "C", label: "C. 粗糙颗粒", sub: "重点改善鸡皮和粗糙角质" },
      { value: "D", label: "D. 暗沉色差", sub: "重点提亮和均匀肤色" },
      { value: "E", label: "E. 状态正常", sub: "以维稳和体验感为主" },
    ],
  },
  {
    key: "q4",
    title: "Q4 身体乳质地与肤感偏好",
    note: "按肤感偏好微调，不越过风险掩码边界。",
    options: [
      { value: "A", label: "A. 秒吸收的轻薄水感", sub: "最怕粘腻沾衣，偏好清爽" },
      { value: "B", label: "B. 适中滋润的丝滑乳液感", sub: "希望保湿与肤感平衡" },
      { value: "C", label: "C. 强包裹的丰润油膏感", sub: "需要厚重膜感与修护感" },
    ],
  },
  {
    key: "q5",
    title: "Q5 特殊限制与诉求",
    note: "最后一步做安全过滤与体验偏好收敛。",
    options: [
      { value: "A", label: "A. 极致纯净", sub: "孕哺期或严格排斥香精/色素/防腐剂" },
      { value: "B", label: "B. 情绪留香", sub: "希望有明显调香和伪体香体验" },
      { value: "C", label: "C. 无特殊限制", sub: "更看重实际功效表现" },
    ],
  },
];

function queryValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function buildNextHref(
  signals: LotionSignals,
  key: StepKey,
  value: OptionValue,
  nextStep: number,
): string {
  const merged: LotionSignals = { ...signals, [key]: value };
  const qp = toLotionSearchParams(merged);
  if (isCompleteLotionSignals(merged)) {
    return `/m/lotion/resolve?${qp.toString()}`;
  }
  qp.set("step", String(nextStep));
  return `/m/lotion/profile?${qp.toString()}`;
}

export default async function LotionProfilePage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const signals = normalizeLotionSignals(raw);
  const stepRaw = queryValue(raw.step);
  const parsedStep = Number(stepRaw || "1");

  if (!signals.q1 && parsedStep > 1) {
    redirect("/m/lotion/profile?step=1");
  }
  if (signals.q1 && !signals.q2 && parsedStep > 2) {
    redirect(`/m/lotion/profile?${toLotionSearchParams({ q1: signals.q1 }).toString()}&step=2`);
  }
  if (signals.q1 && signals.q2 && !signals.q3 && parsedStep > 3) {
    redirect(`/m/lotion/profile?${toLotionSearchParams({ q1: signals.q1, q2: signals.q2 }).toString()}&step=3`);
  }
  if (signals.q1 && signals.q2 && signals.q3 && !signals.q4 && parsedStep > 4) {
    redirect(
      `/m/lotion/profile?${toLotionSearchParams({ q1: signals.q1, q2: signals.q2, q3: signals.q3 }).toString()}&step=4`,
    );
  }
  if (signals.q1 && signals.q2 && signals.q3 && signals.q4 && !signals.q5 && parsedStep > 5) {
    redirect(
      `/m/lotion/profile?${toLotionSearchParams({ q1: signals.q1, q2: signals.q2, q3: signals.q3, q4: signals.q4 }).toString()}&step=5`,
    );
  }
  if (isCompleteLotionSignals(signals)) {
    redirect(`/m/lotion/resolve?${toLotionSearchParams(signals).toString()}`);
  }

  const stepNum = Number.isFinite(parsedStep) ? Math.min(Math.max(parsedStep, 1), STEPS.length) : 1;
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
                {key.toUpperCase()} · {value} · {lotionChoiceLabel(key, value)}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
