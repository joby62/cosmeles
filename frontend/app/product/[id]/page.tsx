import MobileEventBeacon from "@/components/mobile/MobileEventBeacon";
import ProductShowcase from "@/components/ProductShowcase";
import { fetchProductDoc, fetchProductRouteMapping } from "@/lib/api";
import { parseResultCtaAttribution } from "@/lib/mobile/resultCtaAttribution";

export default async function ProductShowcasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await Promise.resolve(params);
  const search = (await Promise.resolve(searchParams)) || {};
  const resultAttribution = parseResultCtaAttribution(search);
  const resultCta = resultAttribution?.resultCta || "";
  const compareId = resultAttribution?.fromCompareId || "";
  const [doc, routeMappingDetail] = await Promise.all([
    fetchProductDoc(id),
    fetchProductRouteMapping(id).catch(() => null),
  ]);
  return (
    <>
      {resultAttribution ? (
        <MobileEventBeacon
          name="compare_result_cta_land"
          props={{
            page: "product_showcase",
            route: `/product/${id}`,
            source: "m_compare_result",
            category: doc.product.category,
            product_id: id,
            compare_id: compareId,
            cta: resultCta,
          }}
        />
      ) : null}
      <ProductShowcase
        id={id}
        doc={doc}
        routeMapping={routeMappingDetail?.item || null}
        analyticsContext={
          resultAttribution
            ? {
                resultCta,
                fromCompareId: compareId,
              }
            : null
        }
      />
    </>
  );
}
