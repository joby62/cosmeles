import ProductShowcase from "@/components/ProductShowcase";
import { fetchProductDoc } from "@/lib/api";

export default async function ProductShowcasePage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const { id } = await Promise.resolve(params);
  const doc = await fetchProductDoc(id);
  return <ProductShowcase id={id} doc={doc} />;
}
