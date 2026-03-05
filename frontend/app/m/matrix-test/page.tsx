"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  calculateBestMatch,
  CONDITIONER_CONFIG,
  CONDITIONER_QUESTIONS,
  runMatrixCsvTests,
  SHAMPOO_CONFIG,
  SHAMPOO_QUESTIONS,
  type AnswerMap,
} from "@/lib/mobile/haircareMatrix";

function fmt(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

export default function MobileMatrixTestPage() {
  const [batchSummary, setBatchSummary] = useState(() => runMatrixCsvTests());
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

  return (
    <section className="space-y-4 pb-12">
      <header className="rounded-3xl border border-black/10 bg-white/92 p-4 shadow-[0_12px_28px_rgba(17,24,39,0.08)]">
        <p className="text-[11px] tracking-[0.1em] text-black/52 uppercase">Matrix QA</p>
        <h1 className="mt-1 text-[28px] leading-[1.08] font-semibold tracking-[-0.02em] text-black/90">
          洗护矩阵测试台
        </h1>
        <p className="mt-2 text-[13px] leading-[1.6] text-black/64">
          使用与你提供的 Python 同版矩阵规则，在前端直接复现批量测试与单例调试。
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setBatchSummary(runMatrixCsvTests())}
            className="rounded-full border border-black/12 bg-black text-[12px] font-medium text-white px-4 py-2"
          >
            重新运行 6 条用例
          </button>
          <Link
            href="/m"
            className="rounded-full border border-black/12 bg-white px-4 py-2 text-[12px] font-medium text-black/74"
          >
            返回 /m
          </Link>
        </div>
      </header>

      <article className="rounded-2xl border border-black/10 bg-white/90 p-4">
        <h2 className="text-[15px] font-semibold text-black/86">自动化回归结果</h2>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-black/10 bg-white px-3 py-2">
            <p className="text-[11px] text-black/52">通过</p>
            <p className="text-[20px] font-semibold text-emerald-700">{fmt(batchSummary.passed)}</p>
          </div>
          <div className="rounded-xl border border-black/10 bg-white px-3 py-2">
            <p className="text-[11px] text-black/52">总数</p>
            <p className="text-[20px] font-semibold text-black/84">{fmt(batchSummary.total)}</p>
          </div>
          <div className="rounded-xl border border-black/10 bg-white px-3 py-2">
            <p className="text-[11px] text-black/52">准确率</p>
            <p className="text-[20px] font-semibold text-cyan-700">{batchSummary.accuracy.toFixed(1)}%</p>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {batchSummary.results.map((item) => (
            <div key={item.row.testId} className="rounded-xl border border-black/10 bg-white px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] font-medium text-black/82">
                  #{item.row.testId} {item.row.desc}
                </p>
                <span className={`text-[11px] font-semibold ${item.pass ? "text-emerald-700" : "text-rose-700"}`}>
                  {item.pass ? "PASS" : "FAIL"}
                </span>
              </div>
              <p className="mt-1 text-[12px] text-black/64">
                洗发水: 期望 {item.row.expShampoo} / 实际 {item.shampoo.bestMatch} ·
                护发素: 期望 {item.row.expConditioner} / 实际 {item.conditioner.bestMatch}
              </p>
              <p className="text-[11px] text-black/52">
                头部得分: {item.shampoo.top2[0]?.category}={item.shampoo.top2[0]?.score ?? 0}，
                次优={item.shampoo.top2[1]?.score ?? 0}
              </p>
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-2xl border border-black/10 bg-white/90 p-4">
        <h2 className="text-[15px] font-semibold text-black/86">单例调试</h2>
        <p className="mt-1 text-[12px] text-black/56">手动选答案，实时看矩阵输出与分数面板。</p>

        <div className="mt-3 space-y-4">
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
