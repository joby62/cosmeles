import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveImageUrl, resolveMobileSelection } from "@/lib/api";

type Search = Record<string, string | string[] | undefined>;

function getValue(raw: Search, key: string): string | null {
  const value = raw[key];
  const picked = Array.isArray(value) ? value[0] : value;
  return typeof picked === "string" && picked.trim() ? picked.trim() : null;
}

function parseAnswers(raw: Search): Record<string, string> | null {
  const skin = getValue(raw, "skin");
  const issue = getValue(raw, "issue");
  const scene = getValue(raw, "scene");
  const avoid = getValue(raw, "avoid");
  if (!skin || !issue || !scene || !avoid) return null;
  return { skin, issue, scene, avoid };
}

export default async function CleanserResultPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const answers = parseAnswers(raw);
  if (!answers) {
    redirect("/m/cleanser/profile");
  }

  const resolved = await resolveMobileSelection({
    category: "cleanser",
    answers,
    reuse_existing: true,
  });

  const product = resolved.recommended_product;
  return (
    <section className="pb-12">
      <div className="text-[13px] font-medium text-black/45">洗面奶决策 · 最终答案</div>
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
              <div className="flex h-full items-center justify-center text-[12px] text-black/40">Cleanser</div>
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
                {item.key} · {item.label}
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
          href="/m/cleanser/start"
          className="inline-flex h-11 items-center justify-center rounded-full border border-black/15 px-5 text-[15px] font-semibold text-black/80 active:bg-black/[0.03]"
        >
          重新判断一次
        </Link>
      </div>
    </section>
  );
}
