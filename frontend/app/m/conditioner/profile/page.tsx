import Link from "next/link";
import { redirect } from "next/navigation";
import {
  conditionerChoiceLabel,
  isCompleteConditionerSignals,
  normalizeConditionerSignals,
  toConditionerSearchParams,
  type ConditionerSignals,
} from "@/lib/mobile/conditionerDecision";

type Search = Record<string, string | string[] | undefined>;
type StepKey = keyof ConditionerSignals;
type Option = { value: "A" | "B" | "C"; label: string; sub: string };

const STEPS: Array<{ key: StepKey; title: string; note: string; options: Option[] }> = [
  {
    key: "c_q1",
    title: "Q1 发丝受损史",
    note: "先确认基础受损程度，作为修护权重底盘。",
    options: [
      { value: "A", label: "A. 频繁漂/染/烫 (干枯空洞)", sub: "高受损，优先修护与抗断裂能力" },
      { value: "B", label: "B. 偶尔染烫/经常使用热工具 (轻度受损)", sub: "中度受损，平衡修护与轻盈感" },
      { value: "C", label: "C. 原生发/几乎不折腾 (健康)", sub: "低受损，避免配方过重导致发丝过载" },
    ],
  },
  {
    key: "c_q2",
    title: "Q2 发丝物理形态",
    note: "这一步会触发质地防线，决定能否用重柔顺路线。",
    options: [
      { value: "A", label: "A. 细软少/极易贴头皮", sub: "优先轻盈蓬松，禁重度柔顺" },
      { value: "B", label: "B. 粗硬/沙发/天生毛躁", sub: "优先抗躁顺滑与服帖度" },
      { value: "C", label: "C. 正常适中", sub: "不偏科，按目标效果做收敛" },
    ],
  },
  {
    key: "c_q3",
    title: "Q3 当前最渴望的视觉效果",
    note: "最后一步，锁定主诉求并给出唯一推荐路径。",
    options: [
      { value: "A", label: "A. 刚染完，需要锁色/固色", sub: "优先锁色膜与色泽维持能力" },
      { value: "B", label: "B. 打结梳不开，需要极致顺滑", sub: "优先抗毛躁与梳理滑度" },
      { value: "C", label: "C. 发尾不干枯，保持自然蓬松就行", sub: "优先基础保湿和轻盈平衡" },
    ],
  },
];

function queryValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function makeHref(signals: ConditionerSignals, key: StepKey, value: "A" | "B" | "C", nextStep: number): string {
  const merged: ConditionerSignals = { ...signals, [key]: value };
  const qp = toConditionerSearchParams(merged);
  if (isCompleteConditionerSignals(merged)) return `/m/conditioner/resolve?${qp.toString()}`;
  qp.set("step", String(nextStep));
  return `/m/conditioner/profile?${qp.toString()}`;
}

export default async function ConditionerProfilePage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const signals = normalizeConditionerSignals(raw);
  const stepNumRaw = queryValue(raw.step);
  const parsed = Number(stepNumRaw || "1");

  if (!signals.c_q1 && parsed > 1) {
    redirect("/m/conditioner/profile?step=1");
  }
  if (signals.c_q1 && !signals.c_q2 && parsed > 2) {
    redirect(`/m/conditioner/profile?${toConditionerSearchParams({ c_q1: signals.c_q1 }).toString()}&step=2`);
  }
  if (signals.c_q1 && signals.c_q2 && !signals.c_q3 && parsed > 3) {
    redirect(
      `/m/conditioner/profile?${toConditionerSearchParams({ c_q1: signals.c_q1, c_q2: signals.c_q2 }).toString()}&step=3`,
    );
  }
  if (isCompleteConditionerSignals(signals)) {
    redirect(`/m/conditioner/resolve?${toConditionerSearchParams(signals).toString()}`);
  }

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
          {(["c_q1", "c_q2", "c_q3"] as StepKey[]).map((k) => {
            const value = signals[k];
            if (!value) return null;
            return (
              <span
                key={`${k}-${value}`}
                className="inline-flex h-7 items-center rounded-full bg-black/[0.06] px-3 text-[12px] text-black/70"
              >
                {k.toUpperCase()} · {value} · {conditionerChoiceLabel(k, value)}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
