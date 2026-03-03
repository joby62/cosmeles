import ProductShowcase from "@/components/ProductShowcase";
import { fetchProductDoc, fetchProductRouteMapping } from "@/lib/api";

export default async function ProductShowcasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await Promise.resolve(params);
  const [doc, routeMappingDetail] = await Promise.all([
    fetchProductDoc(id),
    fetchProductRouteMapping(id).catch(() => null),
  ]);
  return <ProductShowcase id={id} doc={doc} routeMapping={routeMappingDetail?.item || null} />;
}
