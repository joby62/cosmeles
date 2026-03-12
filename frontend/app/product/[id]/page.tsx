import MobileEventBeacon from "@/components/mobile/MobileEventBeacon";
import ProductShowcase from "@/components/ProductShowcase";
import { fetchProductDoc, fetchProductRouteMapping } from "@/lib/api";

export default async function ProductShowcasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await Promise.resolve(params);
  const search = (await Promise.resolve(searchParams)) || {};
  const resultCta = Array.isArray(search.result_cta) ? search.result_cta[0] : search.result_cta;
  const fromCompareId = Array.isArray(search.from_compare_id) ? search.from_compare_id[0] : search.from_compare_id;
  const [doc, routeMappingDetail] = await Promise.all([
    fetchProductDoc(id),
    fetchProductRouteMapping(id).catch(() => null),
  ]);
  return (
    <>
      {resultCta && fromCompareId ? (
        <MobileEventBeacon
          name="compare_result_cta_land"
          props={{
            page: "product_showcase",
            route: `/product/${id}`,
            source: "m_compare_result",
            category: doc.product.category,
            product_id: id,
            compare_id: fromCompareId,
            cta: resultCta,
          }}
        />
      ) : null}
      <ProductShowcase id={id} doc={doc} routeMapping={routeMappingDetail?.item || null} />
    </>
  );
}
