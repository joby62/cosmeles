import IngredientCleanupWorkbench from "@/components/IngredientCleanupWorkbench";
import ProductManagementShell, {
  ProductManagementStageErrorCard,
} from "@/components/ProductManagementShell";
import {
  getProductManagementError,
  hasProductManagementData,
  loadProductManagementData,
} from "@/lib/productManagementData";

export default async function IngredientGovernancePage() {
  const data = await loadProductManagementData();
  const products = hasProductManagementData(data.products) ? data.products.data : null;
  const routeMappings = hasProductManagementData(data.routeMappings) ? data.routeMappings.data : null;
  const aiMetrics = hasProductManagementData(data.aiMetrics) ? data.aiMetrics.data : null;
  const productError = getProductManagementError(data.products);
  const routeMappingError = getProductManagementError(data.routeMappings);

  return (
    <ProductManagementShell
      activeSection="ingredients"
      productsCount={products ? products.length : null}
      categoryStats={data.categoryStats}
      aiMetrics={aiMetrics}
      issues={data.issues}
    >
      <section id="ingredient-cleanup-workbench" className="mt-10 scroll-mt-20">
        {products && routeMappings ? (
          <IngredientCleanupWorkbench initialProducts={products} initialRouteMappings={routeMappings} />
        ) : (
          <ProductManagementStageErrorCard
            title="成分治理台不可用"
            errors={[
              ...(productError ? [productError] : []),
              ...(routeMappingError ? [routeMappingError] : []),
            ].filter((item, index, arr) => arr.findIndex((x) => x.stage === item.stage && x.detail === item.detail) === index)}
          />
        )}
      </section>
    </ProductManagementShell>
  );
}
