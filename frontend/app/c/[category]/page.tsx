import { fetchProducts, resolveImageUrl } from "@/lib/api";
import Image from "next/image";

export default async function CategoryPage({
  params,
}: {
  params: { category: string };
}) {
  const products = await fetchProducts();
  const filtered = products.filter(
    (p) => p.category === params.category
  );

  return (
    <main className="min-h-screen p-12">
      <h1 className="text-2xl font-semibold mb-8">
        {params.category}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {filtered.map((p) => (
          <div key={p.id}>
            <div className="relative aspect-square bg-neutral-100 mb-2">
              <Image
                src={resolveImageUrl(p)}
                alt={p.name}
                fill
                className="object-contain"
              />
            </div>
            <div className="text-sm">{p.name}</div>
          </div>
        ))}
      </div>
    </main>
  );
}