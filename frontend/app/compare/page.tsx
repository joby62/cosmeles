import { fetchProducts, resolveImageUrl } from "@/lib/api";
import Image from "next/image";

export default async function ComparePage({
  searchParams,
}: {
  searchParams?: { ids?: string };
}) {
  const allProducts = await fetchProducts();
  const ids = searchParams?.ids?.split(",") ?? [];

  const products = allProducts.filter((p) => ids.includes(p.id));

  return (
    <main className="min-h-screen p-12">
      <h1 className="text-2xl font-semibold mb-8">产品对比</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {products.map((p) => (
          <div key={p.id} className="border p-4">
            <div className="relative aspect-square bg-neutral-100 mb-4">
              <Image
                src={resolveImageUrl(p)}
                alt={p.name ?? p.brand ?? "产品图片"}
                fill
                className="object-contain"
              />
            </div>
            <h2 className="font-medium">{p.name ?? "未命名产品"}</h2>
          </div>
        ))}
      </div>
    </main>
  );
}
