import ProductShowcase from "@/components/ProductShowcase";
import { fetchProductDoc } from "@/lib/api";

export default async function ProductShowcasePage({
  params,
}: {
  params: { id: string };
}) {
  const doc = await fetchProductDoc(params.id);
  return <ProductShowcase id={params.id} doc={doc} />;
}
