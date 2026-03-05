"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  calculateBestMatch,
  compareMatrixTestId,
  CONDITIONER_CONFIG,
  CONDITIONER_QUESTIONS,
  runMatrixCsvTests,
  SHAMPOO_CONFIG,
  SHAMPOO_QUESTIONS,
  type AnswerMap,
} from "@/lib/mobile/haircareMatrix";

const DEFAULT_INPUT = `test_id,desc,q1,q2,q3,c_q1,c_q2,c_q3,exp_shampoo,exp_conditioner
1,经典通勤油头,A,D,C,C,C,C,deep-oil-control,c-basic-hydrate
2,定期打理精致党,B,D,A,A,C,C,moisture-balance,c-structure-rebuild
3,天生细软扁塌,A,D,B,B,A,C,deep-oil-control,c-airy-light
4,天生沙发/自然卷,C,D,C,B,B,B,moisture-balance,c-smooth-frizz
5,换季轻微头屑,B,A,C,C,C,C,anti-dandruff-itch,c-basic-hydrate
6,刚染完的新发色,B,D,A,B,C,A,moisture-balance,c-color-lock
7,中年脱发焦虑,B,C,B,B,A,C,anti-hair-loss,c-airy-light
8,干性敏感头皮,C,B,C,C,C,C,gentle-soothing,c-basic-hydrate
9,长期极度烫染受损,C,D,A,A,C,B,moisture-balance,c-structure-rebuild
10,[极端]又大油头又敏感发炎,A,B,C,C,C,C,gentle-soothing,c-basic-hydrate
11,[极端]大油头+细软且极度受损,A,D,A,A,A,B,deep-oil-control,c-structure-rebuild
12,[极端]干性头皮却长头屑,C,A,C,B,B,B,anti-dandruff-itch,c-smooth-frizz
13,[极端]细软塌刚染完急需锁色,B,D,B,B,A,A,moisture-balance,c-color-lock
14,[极端]重度脂溢性脱发,A,C,B,C,A,C,anti-hair-loss,c-airy-light
15,完美原生发只求柔顺,B,D,C,C,B,B,moisture-balance,c-smooth-frizz`;

function fmt(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function normalizeCsvInput(raw: string): string {
  const text = raw.trim();
  if (!text) return "";
  if (!text.includes("```")) return text;
  return text
    .replace(/^```(?:csv|CSV)?\s*/g, "")
    .replace(/\s*```$/g, "")
    .trim();
}

export default function DesktopMatrixTestPage() {
  const [csvInput, setCsvInput] = useState(DEFAULT_INPUT);
  const [batchSummary, setBatchSummary] = useState(() => runMatrixCsvTests(DEFAULT_INPUT));
  const [shampooAnswers, setShampooAnswers] = useState<AnswerMap>({ q1: "A", q2: "D", q3: "C" });
  const [conditionerAnswers, setConditionerAnswers] = useState<AnswerMap>({ c_q1: "C", c_q2: "C", c_q3: "C" });

  const shampooResult = useMemo(
    () => calculateBestMatch(shampooAnswers, SHAMPOO_CONFIG),
    [shampooAnswers],
  );
  const conditionerResult = useMemo(
    () => calculateBestMatch(conditionerAnswers, CONDITIONER_CONFIG),
    [conditionerAnswers],
  );
  const prioritizedResults = useMemo(
    () =>
      [...batchSummary.results].sort((a, b) => {
        if (a.pass !== b.pass) return a.pass ? 1 : -1;
        return compareMatrixTestId(a.row.testId, b.row.testId);
      }),
    [batchSummary.results],
  );

  return (
    <section className="mx-auto max-w-[1180px] space-y-5 px-6 pb-20 pt-12 md:px-10">
      <header className="rounded-[28px] border border-black/10 bg-white/92 p-6 shadow-[0_18px_40px_rgba(17,24,39,0.08)]">
        <p className="text-[12px] tracking-[0.12em] text-black/52 uppercase">Desktop Matrix QA</p>
        <h1 className="mt-2 text-[40px] leading-[1.04] font-semibold tracking-[-0.025em] text-black/90">
          洗护矩阵测试控制台
        </h1>
        <p className="mt-3 text-[15px] leading-[1.65] text-black/64">
          支持直接粘贴 CSV 代码段并运行批量测试，同时保留单例调试面板做细颗粒分析。
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            href="/"
            className="rounded-full border border-black/12 bg-white px-4 py-2 text-[12px] font-medium text-black/74"
          >
            返回首页
          </Link>
          <Link
            href="/git"
            className="rounded-full border border-black/12 bg-white px-4 py-2 text-[12px] font-medium text-black/74"
          >
            打开 Git 面板
          </Link>
        </div>
      </header>

      <article className="rounded-2xl border border-black/10 bg-white/90 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[16px] font-semibold text-black/86">批量 CSV 测试</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCsvInput(DEFAULT_INPUT)}
              className="rounded-full border border-black/12 bg-white px-3 py-1.5 text-[12px] font-medium text-black/70"
            >
              恢复示例
            </button>
            <button
              type="button"
              onClick={() => setBatchSummary(runMatrixCsvTests(normalizeCsvInput(csvInput)))}
              className="rounded-full border border-black/12 bg-black px-4 py-1.5 text-[12px] font-medium text-white"
            >
              运行测试
            </button>
          </div>
        </div>

        <textarea
          value={csvInput}
          onChange={(event) => setCsvInput(event.target.value)}
          spellCheck={false}
          className="mt-3 h-[280px] w-full rounded-xl border border-black/12 bg-white px-3 py-2 font-mono text-[12px] leading-[1.5] text-black/82 outline-none focus:border-black/28 focus:ring-2 focus:ring-black/10"
        />

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-black/10 bg-white px-3 py-2">
            <p className="text-[11px] text-black/52">通过</p>
            <p className="text-[22px] font-semibold text-emerald-700">{fmt(batchSummary.passed)}</p>
          </div>
          <div className="rounded-xl border border-black/10 bg-white px-3 py-2">
            <p className="text-[11px] text-black/52">总数</p>
            <p className="text-[22px] font-semibold text-black/84">{fmt(batchSummary.total)}</p>
          </div>
          <div className="rounded-xl border border-black/10 bg-white px-3 py-2">
            <p className="text-[11px] text-black/52">准确率</p>
            <p className="text-[22px] font-semibold text-cyan-700">{batchSummary.accuracy.toFixed(1)}%</p>
          </div>
        </div>

        <div className="mt-3 max-h-[340px] overflow-auto rounded-xl border border-black/10">
          <table className="min-w-full table-fixed border-separate border-spacing-0">
            <thead className="sticky top-0 bg-white/96">
              <tr>
                <th className="w-[68px] border-b border-black/10 px-2 py-2 text-left text-[11px] text-black/52 uppercase">ID</th>
                <th className="border-b border-black/10 px-2 py-2 text-left text-[11px] text-black/52 uppercase">描述</th>
                <th className="w-[240px] border-b border-black/10 px-2 py-2 text-left text-[11px] text-black/52 uppercase">洗发水</th>
                <th className="w-[240px] border-b border-black/10 px-2 py-2 text-left text-[11px] text-black/52 uppercase">护发素</th>
                <th className="w-[72px] border-b border-black/10 px-2 py-2 text-left text-[11px] text-black/52 uppercase">结果</th>
              </tr>
            </thead>
            <tbody>
              {prioritizedResults.map((item, index) => (
                <tr key={`${item.row.testId}-${index}`} className="bg-white">
                  <td className="border-b border-black/[0.06] px-2 py-2 text-[12px] text-black/74">{item.row.testId}</td>
                  <td className="border-b border-black/[0.06] px-2 py-2 text-[12px] text-black/80">{item.row.desc}</td>
                  <td className="border-b border-black/[0.06] px-2 py-2 text-[12px] text-black/74">
                    <span className="text-black/52">exp</span> {item.row.expShampoo} <span className="text-black/42">→</span> {item.shampoo.bestMatch}
                  </td>
                  <td className="border-b border-black/[0.06] px-2 py-2 text-[12px] text-black/74">
                    <span className="text-black/52">exp</span> {item.row.expConditioner} <span className="text-black/42">→</span> {item.conditioner.bestMatch}
                  </td>
                  <td className={`border-b border-black/[0.06] px-2 py-2 text-[12px] font-semibold ${item.pass ? "text-emerald-700" : "text-rose-700"}`}>
                    {item.pass ? "PASS" : "FAIL"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="rounded-2xl border border-black/10 bg-white/90 p-5">
        <h2 className="text-[16px] font-semibold text-black/86">单例调试</h2>
        <p className="mt-1 text-[12px] text-black/56">手动选择答案，实时查看 best match 与 top2 得分。</p>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-black/10 bg-white p-3">
            <h3 className="text-[13px] font-semibold text-black/82">洗发水</h3>
            <div className="mt-2 space-y-2">
              {SHAMPOO_QUESTIONS.map((question) => (
                <label key={question.key} className="block">
                  <span className="text-[11px] text-black/58">{question.label}</span>
                  <select
                    value={shampooAnswers[question.key] ?? question.options[0]?.value ?? ""}
                    onChange={(event) =>
                      setShampooAnswers((prev) => ({
                        ...prev,
                        [question.key]: event.target.value,
                      }))
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-black/12 bg-white px-2 text-[12px]"
                  >
                    {question.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-black/72">
              输出: <span className="font-semibold">{shampooResult.bestMatch}</span>
            </p>
            <p className="text-[11px] text-black/56">Top2: {shampooResult.top2.map((v) => `${v.category}=${v.score}`).join(" / ")}</p>
          </div>

          <div className="rounded-xl border border-black/10 bg-white p-3">
            <h3 className="text-[13px] font-semibold text-black/82">护发素</h3>
            <div className="mt-2 space-y-2">
              {CONDITIONER_QUESTIONS.map((question) => (
                <label key={question.key} className="block">
                  <span className="text-[11px] text-black/58">{question.label}</span>
                  <select
                    value={conditionerAnswers[question.key] ?? question.options[0]?.value ?? ""}
                    onChange={(event) =>
                      setConditionerAnswers((prev) => ({
                        ...prev,
                        [question.key]: event.target.value,
                      }))
                    }
                    className="mt-1 h-9 w-full rounded-lg border border-black/12 bg-white px-2 text-[12px]"
                  >
                    {question.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-black/72">
              输出: <span className="font-semibold">{conditionerResult.bestMatch}</span>
            </p>
            <p className="text-[11px] text-black/56">Top2: {conditionerResult.top2.map((v) => `${v.category}=${v.score}`).join(" / ")}</p>
          </div>
        </div>
      </article>
    </section>
  );
}
