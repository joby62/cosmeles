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
  type MatrixConfig,
  type MatrixQuestion,
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

const BOUNDARY_GAP = 5;

type ExhaustiveSimulationRow = {
  key: string;
  bestMatch: string;
  gap: number;
  answerSummary: string;
  top2Summary: string;
};

function formatScore(value: number): string {
  if (Number.isFinite(value)) return String(value);
  return value > 0 ? "∞" : "-∞";
}

function buildQuestionOptionLabel(question: MatrixQuestion, value: string): string {
  const option = question.options.find((item) => item.value === value);
  return `${question.key}=${option?.label || value}`;
}

function enumerateAnswerMaps(questions: MatrixQuestion[]): AnswerMap[] {
  let rows: AnswerMap[] = [{}];
  for (const question of questions) {
    rows = rows.flatMap((prev) =>
      question.options.map((option) => ({
        ...prev,
        [question.key]: option.value,
      })),
    );
  }
  return rows;
}

function buildExhaustiveSimulationRows(questions: MatrixQuestion[], config: MatrixConfig): ExhaustiveSimulationRow[] {
  return enumerateAnswerMaps(questions)
    .map((answers) => {
      const result = calculateBestMatch(answers, config);
      const first = result.top2[0]?.score ?? Number.NEGATIVE_INFINITY;
      const second = result.top2[1]?.score ?? Number.NEGATIVE_INFINITY;
      const answerSummary = questions.map((question) => buildQuestionOptionLabel(question, answers[question.key] || "")).join(" · ");
      return {
        key: questions.map((question) => answers[question.key] || "").join("|"),
        bestMatch: result.bestMatch,
        gap: first - second,
        answerSummary,
        top2Summary: result.top2.map((item) => `${item.category}=${formatScore(item.score)}`).join(" / "),
      };
    })
    .sort((left, right) => {
      if (left.bestMatch !== right.bestMatch) return left.bestMatch.localeCompare(right.bestMatch);
      if (left.gap !== right.gap) return left.gap - right.gap;
      return left.key.localeCompare(right.key);
    });
}

function buildDistribution(rows: ExhaustiveSimulationRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.bestMatch, (counts.get(row.bestMatch) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category));
}

function ExhaustiveSimulatorPanel({
  title,
  description,
  questions,
  config,
}: {
  title: string;
  description: string;
  questions: MatrixQuestion[];
  config: MatrixConfig;
}) {
  const [routeFilter, setRouteFilter] = useState("all");
  const [boundaryOnly, setBoundaryOnly] = useState(false);

  const allRows = useMemo(() => buildExhaustiveSimulationRows(questions, config), [questions, config]);
  const distribution = useMemo(() => buildDistribution(allRows), [allRows]);
  const boundaryCount = useMemo(() => allRows.filter((row) => row.gap <= BOUNDARY_GAP).length, [allRows]);
  const filteredRows = useMemo(
    () =>
      allRows.filter((row) => {
        if (routeFilter !== "all" && row.bestMatch !== routeFilter) return false;
        if (boundaryOnly && row.gap > BOUNDARY_GAP) return false;
        return true;
      }),
    [allRows, boundaryOnly, routeFilter],
  );

  return (
    <div className="rounded-[24px] border border-black/10 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-black/86">{title}</h3>
          <p className="mt-1 text-[12px] leading-[1.55] text-black/58">{description}</p>
        </div>
        <label className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.03] px-3 py-1.5 text-[12px] text-black/72">
          <input
            type="checkbox"
            checked={boundaryOnly}
            onChange={(event) => setBoundaryOnly(event.target.checked)}
            className="h-4 w-4 rounded border border-black/25"
          />
          只看边界样本（Top1-Top2 ≤ {BOUNDARY_GAP}）
        </label>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-black/10 bg-[#fbfcff] px-3 py-2">
          <p className="text-[11px] text-black/52">穷举组合</p>
          <p className="text-[22px] font-semibold text-black/84">{fmt(allRows.length)}</p>
        </div>
        <div className="rounded-xl border border-black/10 bg-[#fbfcff] px-3 py-2">
          <p className="text-[11px] text-black/52">输出路线数</p>
          <p className="text-[22px] font-semibold text-black/84">{fmt(distribution.length)}</p>
        </div>
        <div className="rounded-xl border border-black/10 bg-[#fbfcff] px-3 py-2">
          <p className="text-[11px] text-black/52">边界样本</p>
          <p className="text-[22px] font-semibold text-amber-700">{fmt(boundaryCount)}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setRouteFilter("all")}
          className={`rounded-full border px-3 py-1.5 text-[12px] font-medium ${routeFilter === "all" ? "border-black bg-black text-white" : "border-black/12 bg-white text-black/72"}`}
        >
          全部路线 · {fmt(allRows.length)}
        </button>
        {distribution.map((item) => (
          <button
            key={item.category}
            type="button"
            onClick={() => setRouteFilter(item.category)}
            className={`rounded-full border px-3 py-1.5 text-[12px] font-medium ${routeFilter === item.category ? "border-black bg-black text-white" : "border-black/12 bg-white text-black/72"}`}
          >
            {item.category} · {fmt(item.count)}
          </button>
        ))}
      </div>

      <div className="mt-2 text-[12px] text-black/54">
        当前展示 {fmt(filteredRows.length)} / {fmt(allRows.length)} 组。按主干当前规则实时穷举，不引入分支试验权重。
      </div>

      <div className="mt-3 max-h-[420px] overflow-auto rounded-xl border border-black/10">
        <table className="min-w-full table-fixed border-separate border-spacing-0">
          <thead className="sticky top-0 bg-white/96">
            <tr>
              <th className="w-[180px] border-b border-black/10 px-2 py-2 text-left text-[11px] uppercase text-black/52">输出</th>
              <th className="w-[96px] border-b border-black/10 px-2 py-2 text-left text-[11px] uppercase text-black/52">差值</th>
              <th className="border-b border-black/10 px-2 py-2 text-left text-[11px] uppercase text-black/52">答案组合</th>
              <th className="w-[260px] border-b border-black/10 px-2 py-2 text-left text-[11px] uppercase text-black/52">Top2</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={row.key} className="bg-white">
                <td className="border-b border-black/[0.06] px-2 py-2 align-top text-[12px] text-black/78">
                  <div className="font-semibold">{row.bestMatch}</div>
                  {row.gap <= BOUNDARY_GAP ? <div className="mt-1 text-[11px] text-amber-700">边界样本</div> : null}
                </td>
                <td className="border-b border-black/[0.06] px-2 py-2 align-top text-[12px] text-black/72">{formatScore(row.gap)}</td>
                <td className="border-b border-black/[0.06] px-2 py-2 align-top text-[12px] leading-[1.55] text-black/80">{row.answerSummary}</td>
                <td className="border-b border-black/[0.06] px-2 py-2 align-top text-[12px] leading-[1.55] text-black/72">{row.top2Summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
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
        <p className="mt-2 text-[12px] leading-[1.55] text-black/52">
          当前页面基于主干现行矩阵规则；穷举模拟器只做全组合可视化，不偷偷改规则权重。
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

      <article className="rounded-2xl border border-black/10 bg-white/90 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold text-black/86">穷举规则模拟器</h2>
            <p className="mt-1 text-[12px] text-black/56">把所有可能答案组合全部跑一遍，快速看路线分布、边界样本和可疑规则角落。</p>
          </div>
          <div className="rounded-full border border-black/10 bg-black/[0.03] px-3 py-1.5 text-[12px] text-black/68">
            exhaustive rules simulator
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <ExhaustiveSimulatorPanel
            title="洗发水全组合"
            description="当前主干题目共 36 组组合，按 best match、Top2 差值和边界样本展开。"
            questions={SHAMPOO_QUESTIONS}
            config={SHAMPOO_CONFIG}
          />
          <ExhaustiveSimulatorPanel
            title="护发素全组合"
            description="当前主干题目共 27 组组合，便于看路线覆盖度和相邻路线挤压。"
            questions={CONDITIONER_QUESTIONS}
            config={CONDITIONER_CONFIG}
          />
        </div>
      </article>
    </section>
  );
}
