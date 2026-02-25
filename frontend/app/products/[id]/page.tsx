import Image from "next/image";
import { fetchProduct, resolveImageUrl } from "@/lib/api";

export default async function ProductPage({
  params,
}: {
  params: { id: string };
}) {
  const product = await fetchProduct(params.id);

  return (
    <main className="min-h-screen p-12">
      <div className="mx-auto max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="relative aspect-square bg-neutral-100">
          <Image
            src={resolveImageUrl(product)}
            alt={product.name}
            fill
            className="object-contain"
            priority
          />
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl font-semibold">{product.name}</h1>
          {product.brand && (
            <p className="text-neutral-500">{product.brand}</p>
          )}
          {product.description && (
            <p className="text-neutral-700">{product.description}</p>
          )}
        </div>
      </div>
    </main>
  );
}