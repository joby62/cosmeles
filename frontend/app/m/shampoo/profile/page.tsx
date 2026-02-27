import Link from "next/link";
import { redirect } from "next/navigation";
import {
  isReadyShampooResult,
  isShampooFastPath,
  normalizeShampooSignals,
  shampooChoiceLabel,
  toSignalSearchParams,
  type ShampooSignals,
} from "@/lib/mobile/shampooDecision";

type Search = Record<string, string | string[] | undefined>;
type StepKey = keyof ShampooSignals;
type Option = { value: "A" | "B" | "C"; label: string; sub: string };

const STEPS: Array<{ key: StepKey; title: string; note: string; options: Option[] }> = [
  {
    key: "q1",
    title: "你平时多久会感觉头发变油？",
    note: "选最接近你日常状态的一项。",
    options: [
      { value: "A", label: "A. 一天不洗就塌/油", sub: "先偏向控油清洁底色" },
      { value: "B", label: "B. 2-3天洗一次正好", sub: "先偏向温和平衡底色" },
      { value: "C", label: "C. 3天以上不洗也不油", sub: "先偏向滋润舒适底色" },
    ],
  },
  {
    key: "q2",
    title: "你现在有没有明显头皮困扰？",
    note: "如果有头屑痒或发红刺痛，我们会直接给你结果。",
    options: [
      { value: "A", label: "A. 有头屑且发痒", sub: "会走去屑快路径，直接出结果" },
      { value: "B", label: "B. 头皮发红/刺痛/长痘", sub: "会走舒缓快路径，直接出结果" },
      { value: "C", label: "C. 无特殊感觉", sub: "继续做发质细化判断" },
    ],
  },
  {
    key: "q3",
    title: "你的发质更接近哪种状态？",
    note: "最后一步，选完就出最终答案。",
    options: [
      { value: "A", label: "A. 频繁染烫/干枯易断", sub: "加修护插件，减少脆断感" },
      { value: "B", label: "B. 细软塌/贴头皮", sub: "加轻盈插件，保留蓬松度" },
      { value: "C", label: "C. 原生发/健康", sub: "走简配插件，保持长期稳定" },
    ],
  },
];

function valueFromQuery(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function buildNextHref(signals: ShampooSignals, key: StepKey, value: "A" | "B" | "C", nextStep: number): string {
  const merged: ShampooSignals = { ...signals, [key]: value };
  const qp = toSignalSearchParams(merged);

  if (key === "q2" && merged.q1 && isShampooFastPath(merged)) {
    return `/m/shampoo/result?${qp.toString()}`;
  }

  if (isReadyShampooResult(merged)) {
    return `/m/shampoo/resolve?${qp.toString()}`;
  }

  qp.set("step", String(nextStep));
  return `/m/shampoo/profile?${qp.toString()}`;
}

export default async function ShampooProfilePage({
  searchParams,
}: {
  searchParams?: Search | Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const signals = normalizeShampooSignals(raw);
  const stepRaw = valueFromQuery(raw.step);
  const parsedStep = Number(stepRaw || "1");

  if (!signals.q1 && parsedStep > 1) {
    redirect("/m/shampoo/profile?step=1");
  }

  if (signals.q1 && !signals.q2 && parsedStep > 2) {
    redirect(`/m/shampoo/profile?${toSignalSearchParams({ q1: signals.q1 }).toString()}&step=2`);
  }

  if (signals.q1 && signals.q2 && isShampooFastPath(signals)) {
    redirect(`/m/shampoo/result?${toSignalSearchParams(signals).toString()}`);
  }

  if (isReadyShampooResult(signals)) {
    redirect(`/m/shampoo/resolve?${toSignalSearchParams(signals).toString()}`);
  }

  const stepNum = Number.isFinite(parsedStep) ? Math.min(Math.max(parsedStep, 1), STEPS.length) : 1;
  const current = STEPS[stepNum - 1];

  return (
    <section className="pb-8">
      <div className="text-[13px] font-medium text-black/45">洗发挑选 · 第 {stepNum}/3 步</div>
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
          {(["q1", "q2", "q3"] as StepKey[]).map((key) => {
            const value = signals[key];
            if (!value) return null;
            return (
              <span
                key={`${key}-${value}`}
                className="inline-flex h-7 items-center rounded-full bg-black/[0.06] px-3 text-[12px] text-black/70"
              >
                {key.toUpperCase()} · {value} · {shampooChoiceLabel(key, value)}
              </span>
            );
          })}
          {!signals.q1 && !signals.q2 && !signals.q3 && (
            <span className="text-[13px] text-black/45">从第一题开始，30 秒左右就能拿到结果。</span>
          )}
        </div>
      </div>
    </section>
  );
}
