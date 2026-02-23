import Link from "next/link";
import { fetchProduct } from "@/lib/api";
import { TOP_CATEGORIES, CATEGORY_CONFIG } from "@/lib/catalog";

export default async function ComparePage(props: {
  searchParams?: Promise<{ ids?: string }>;
}) {
  const sp = props.searchParams ? await props.searchParams : undefined;

  // 默认对比 5 个主推（也可 /compare?ids=a,b,c 自定义）
  const defaultIds = TOP_CATEGORIES.map((k) => CATEGORY_CONFIG[k].featuredProductId);
  const ids = (sp?.ids || defaultIds.join(","))
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const docs = await Promise.all(ids.map((id) => fetchProduct(id).catch(() => null)));

  return (
    <main className="bg-white text-black">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">横向对比</h1>
            <p className="mt-2 text-sm text-black/60">
              MVP：默认对比 5 个主推产品（或用 <code>/compare?ids=a,b,c</code> 自定义）。
            </p>
          </div>
          <Link href="/" className="rounded-full border border-black/15 px-4 py-2 text-sm hover:bg-black/[0.03]">
            返回橱窗
          </Link>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {docs.map((doc, idx) => {
            const id = ids[idx];
            const p = doc?.product;
            const s = doc?.summary;

            return (
              <section key={id} className="rounded-[24px] border border-black/10 bg-white p-6 shadow-sm">
                <div className="text-xs uppercase tracking-widest text-black/40">{p?.category || "product"}</div>
                <h2 className="mt-2 text-2xl font-semibold">{p?.name || "string"}</h2>
                <p className="mt-3 text-sm leading-relaxed text-black/60">{s?.one_sentence || ""}</p>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-sm font-medium">优点</div>
                    <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-black/70">
                      {(Array.isArray(s?.pros) ? s.pros : []).slice(0, 4).map((x: string, i: number) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-sm font-medium">注意点</div>
                    <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-black/70">
                      {(Array.isArray(s?.cons) ? s.cons : []).slice(0, 4).map((x: string, i: number) => (
                        <li key={i}>{x}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-6">
                  <Link href={`/products/${id}`} className="text-sm font-medium underline">
                    查看详情
                  </Link>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}