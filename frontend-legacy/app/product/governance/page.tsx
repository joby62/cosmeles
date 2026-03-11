import ProductCatalogManager from "@/components/ProductCatalogManager";
import ProductCleanupWorkbench from "@/components/ProductCleanupWorkbench";
import ProductManagementShell, {
  ProductManagementStageErrorCard,
} from "@/components/ProductManagementShell";
import {
  getProductManagementError,
  hasProductManagementData,
  loadProductManagementData,
} from "@/lib/productManagementData";

export default async function ProductGovernancePage() {
  const data = await loadProductManagementData();
  const products = hasProductManagementData(data.products) ? data.products.data : null;
  const routeMappings = hasProductManagementData(data.routeMappings) ? data.routeMappings.data : null;
  const featuredSlots = hasProductManagementData(data.featuredSlots) ? data.featuredSlots.data : null;
  const aiMetrics = hasProductManagementData(data.aiMetrics) ? data.aiMetrics.data : null;
  const productError = getProductManagementError(data.products);
  const routeMappingError = getProductManagementError(data.routeMappings);
  const featuredSlotsError = getProductManagementError(data.featuredSlots);

  return (
    <ProductManagementShell
      activeSection="governance"
      productsCount={products ? products.length : null}
      categoryStats={data.categoryStats}
      aiMetrics={aiMetrics}
      issues={data.issues}
    >
      <section id="product-catalog-manager" className="mt-10 scroll-mt-20">
        {products && routeMappings && featuredSlots ? (
          <ProductCatalogManager
            initialProducts={products}
            initialRouteMappings={routeMappings}
            initialFeaturedSlots={featuredSlots}
          />
        ) : (
          <ProductManagementStageErrorCard
            title="产品展示与主推配置不可用"
            errors={[
              ...(productError ? [productError] : []),
              ...(routeMappingError ? [routeMappingError] : []),
              ...(featuredSlotsError ? [featuredSlotsError] : []),
            ].filter((item, index, arr) => arr.findIndex((x) => x.stage === item.stage && x.detail === item.detail) === index)}
          />
        )}
      </section>
      <section id="product-cleanup-workbench" className="scroll-mt-20">
        {products ? (
          <ProductCleanupWorkbench initialProducts={products} />
        ) : (
          <ProductManagementStageErrorCard title="产品清理台不可用" errors={productError ? [productError] : []} />
        )}
      </section>
    </ProductManagementShell>
  );
}
