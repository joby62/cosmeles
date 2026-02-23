import Link from "next/link";
import Image from "next/image";
import { fetchProduct, imageUrl } from "@/lib/api";

export default async function ProductPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  const doc = await fetchProduct(id);
  const p = doc?.product || ({} as any);
  const s = doc?.summary || ({} as any);

  const title = p?.name || "未命名产品";
  const brand = p?.brand || "Cosmeles";
  const one = s?.one_sentence || "";

  const pros: string[] = Array.isArray(s?.pros) ? s.pros : [];
  const cons: string[] = Array.isArray(s?.cons) ? s.cons : [];
  const whoFor: string[] = Array.isArray(s?.who_for) ? s.who_for : [];
  const whoNot: string[] = Array.isArray(s?.who_not_for) ? s.who_not_for : [];

  return (
    <main className="bg-white text-black">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <Link href="/" className="text-sm text-black/60 hover:text-black">
          ← 返回
        </Link>

        <section className="mt-8 grid gap-8 md:grid-cols-2">
          <div className="relative aspect-square overflow-hidden rounded-[28px] border border-black/10 bg-neutral-50">
            <Image
              src={imageUrl(id)}
              alt={title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
            />
          </div>

          <div className="pt-2">
            <div className="text-xs uppercase tracking-widest text-black/40">{p?.category || "product"}</div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm text-black/60">{brand}</p>

            <p className="mt-5 max-w-xl text-sm leading-relaxed text-black/70">{one}</p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-5">
                <div className="text-sm font-medium">优点</div>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-black/70">
                  {pros.slice(0, 4).map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-5">
                <div className="text-sm font-medium">注意点</div>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-black/70">
                  {cons.slice(0, 4).map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-5">
                <div className="text-sm font-medium">适合</div>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-black/70">
                  {whoFor.slice(0, 4).map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-5">
                <div className="text-sm font-medium">不太适合</div>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-black/70">
                  {whoNot.slice(0, 4).map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            </div>

            <details className="mt-8 rounded-2xl border border-black/10 bg-black/[0.02] p-5">
              <summary className="cursor-pointer text-sm font-medium">展开原始分析（调试用）</summary>
              <pre className="mt-4 overflow-x-auto text-xs leading-relaxed text-black/70">
                {JSON.stringify(doc, null, 2)}
              </pre>
            </details>
          </div>
        </section>
      </div>
    </main>
  );
}