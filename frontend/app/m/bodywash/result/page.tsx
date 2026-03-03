import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveImageUrl, resolveMobileSelection } from "@/lib/api";
import { formatRuntimeError } from "@/lib/error";

type Search = Record<string, string | string[] | undefined>;

function getValue(raw: Search, key: string): string | null {
  const value = raw[key];
  const picked = Array.isArray(value) ? value[0] : value;
  return typeof picked === "string" && picked.trim() ? picked.trim() : null;
}

function parseAnswers(raw: Search): Record<string, string> | null {
  const q1 = getValue(raw, "q1");
  const q2 = getValue(raw, "q2");
  const q3 = getValue(raw, "q3");
  const q4 = getValue(raw, "q4");
  const q5 = getValue(raw, "q5");

  const isQ1 = (v: string | null) => v === "A" || v === "B" || v === "C" || v === "D";
  const isQ2 = (v: string | null) => v === "A" || v === "B";
  const isQ3 = (v: string | null) => v === "A" || v === "B" || v === "C" || v === "D";
  const isQ4 = (v: string | null) => v === "A" || v === "B";
  const isQ5 = (v: string | null) => v === "A" || v === "B";

  if (!isQ1(q1) || !isQ2(q2)) return null;

  const out: Record<string, string> = { q1, q2 };
  if (q2 === "B") {
    if (!isQ3(q3) || !isQ4(q4) || !isQ5(q5)) return null;
    out.q3 = q3;
    out.q4 = q4;
    out.q5 = q5;
  } else {
    if (q3 && !isQ3(q3)) return null;
    if (q4 && !isQ4(q4)) return null;
    if (q5 && !isQ5(q5)) return null;
    if (q3) out.q3 = q3;
    if (q4) out.q4 = q4;
    if (q5) out.q5 = q5;
  }
  return out;
}

export default async function BodyWashResultPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const answers = parseAnswers(raw);
  if (!answers) {
    redirect("/m/bodywash/profile");
  }

  let resolved: Awaited<ReturnType<typeof resolveMobileSelection>> | null = null;
  let resolveError: string | null = null;
  try {
    resolved = await resolveMobileSelection({
      category: "bodywash",
      answers,
      reuse_existing: true,
    });
  } catch (err) {
    resolveError = formatRuntimeError(err);
  }

  if (!resolved) {
    return (
      <section className="pb-12">
        <article className="rounded-[24px] border border-[#ffb39e]/55 bg-[linear-gradient(180deg,#fff8f4_0%,#fff2ed_100%)] px-5 py-5">
          <div className="text-[12px] font-semibold tracking-[0.04em] text-[#b6543f]">结果生成失败</div>
          <h1 className="mt-2 text-[26px] leading-[1.18] font-semibold tracking-[-0.02em] text-[#452016]">沐浴露推荐暂时不可用</h1>
          <p className="mt-3 text-[14px] leading-[1.55] text-[#6c3428]">已阻止页面崩溃，并展示后端返回的真实错误。</p>
          <p className="mt-3 rounded-2xl border border-[#f6c6bc] bg-white/82 px-3 py-2 text-[13px] leading-[1.55] text-[#7a2d21]">
            真实错误：{resolveError || "unknown"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link
              href="/m/bodywash/start"
              className="inline-flex h-10 items-center justify-center rounded-full bg-black px-4 text-[14px] font-semibold text-white"
            >
              重新开始
            </Link>
            <Link
              href="/m/bodywash/profile"
              className="inline-flex h-10 items-center justify-center rounded-full border border-black/15 px-4 text-[14px] font-semibold text-black/78"
            >
              返回个人情况
            </Link>
          </div>
        </article>
      </section>
    );
  }

  const product = resolved.recommended_product;
  return (
    <section className="pb-12">
      <div className="text-[13px] font-medium text-black/45">沐浴挑选 · 最终答案</div>
      <h1 className="mt-2 text-[30px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/92">{resolved.route.title}</h1>
      <p className="mt-2 text-[14px] leading-[1.55] text-black/62">
        route_key: {resolved.route.key} · rules: {resolved.rules_version}
      </p>

      <article className="mt-6 rounded-3xl border border-black/10 bg-white p-5">
        <div className="flex items-start gap-4">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-black/[0.03]">
            {product.image_url ? (
              <Image src={resolveImageUrl(product)} alt={product.name ?? product.brand ?? "产品图片"} fill className="object-contain p-2" />
            ) : (
              <div className="flex h-full items-center justify-center text-[12px] text-black/40">Body Wash</div>
            )}
          </div>
          <div>
            <div className="text-[12px] font-medium text-black/50">推荐产品（真实数据）</div>
            <div className="mt-1 text-[19px] leading-[1.3] font-semibold tracking-[-0.01em] text-black/90">{product.brand || "未知品牌"}</div>
            <div className="mt-1 text-[15px] leading-[1.45] text-black/75">{product.name || "未命名产品"}</div>
          </div>
        </div>

        <section className="mt-6 rounded-2xl bg-black/[0.03] px-4 py-3">
          <h2 className="text-[14px] font-semibold text-black/85">你的选择记录</h2>
          <ul className="mt-2 space-y-1.5">
            {resolved.choices.map((item) => (
              <li key={`${item.key}-${item.value}`} className="text-[13px] leading-[1.5] text-black/68">
                {item.key.toUpperCase()} {item.value} · {item.label}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6">
          <h2 className="text-[14px] font-semibold text-black/85">规则命中</h2>
          <ul className="mt-2 space-y-2">
            {resolved.rule_hits.map((hit, idx) => (
              <li key={`${hit.rule}-${idx}`} className="text-[13px] leading-[1.55] text-black/67">
                {hit.rule} · {hit.effect}
              </li>
            ))}
          </ul>
        </section>
      </article>

      <div className="mt-8 flex flex-wrap gap-2.5">
        <Link
          href={resolved.links.product}
          className="inline-flex h-11 items-center justify-center rounded-full bg-black px-5 text-[15px] font-semibold tracking-[-0.01em] text-white active:opacity-90"
        >
          查看产品详情
        </Link>
        <Link
          href={resolved.links.wiki}
          className="inline-flex h-11 items-center justify-center rounded-full border border-black/15 px-5 text-[15px] font-semibold text-black/80 active:bg-black/[0.03]"
        >
          查看成份百科
        </Link>
        <Link
          href="/m/bodywash/start"
          className="inline-flex h-11 items-center justify-center rounded-full border border-black/15 px-5 text-[15px] font-semibold text-black/80 active:bg-black/[0.03]"
        >
          重新判断一次
        </Link>
        <Link
          href="/m/compare?category=bodywash"
          className="inline-flex h-11 items-center justify-center rounded-full border border-black/15 px-5 text-[15px] font-semibold text-black/80 active:bg-black/[0.03]"
        >
          和我在用的对比
        </Link>
      </div>
    </section>
  );
}
