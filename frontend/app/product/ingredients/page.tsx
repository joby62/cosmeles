import IngredientCleanupWorkbench from "@/components/IngredientCleanupWorkbench";
import ProductManagementShell from "@/components/ProductManagementShell";
import { loadProductManagementData } from "@/lib/productManagementData";

export default async function IngredientGovernancePage() {
  const data = await loadProductManagementData();

  return (
    <ProductManagementShell
      activeSection="ingredients"
      productsCount={data.products.length}
      categoryStats={data.categoryStats}
      aiMetrics={data.aiMetrics}
    >
      <section id="ingredient-cleanup-workbench" className="mt-10 scroll-mt-6">
        <IngredientCleanupWorkbench initialProducts={data.products} initialRouteMappings={data.routeMappings} />
      </section>
    </ProductManagementShell>
  );
}
