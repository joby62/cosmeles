import ProductCatalogManager from "@/components/ProductCatalogManager";
import ProductCleanupWorkbench from "@/components/ProductCleanupWorkbench";
import ProductManagementShell from "@/components/ProductManagementShell";
import { loadProductManagementData } from "@/lib/productManagementData";

export default async function ProductGovernancePage() {
  const data = await loadProductManagementData();

  return (
    <ProductManagementShell
      activeSection="governance"
      productsCount={data.products.length}
      categoryStats={data.categoryStats}
      aiMetrics={data.aiMetrics}
    >
      <section id="product-catalog-manager" className="mt-10 scroll-mt-6">
        <ProductCatalogManager
          initialProducts={data.products}
          initialRouteMappings={data.routeMappings}
          initialFeaturedSlots={data.featuredSlots}
        />
      </section>
      <section id="product-cleanup-workbench" className="scroll-mt-6">
        <ProductCleanupWorkbench initialProducts={data.products} />
      </section>
    </ProductManagementShell>
  );
}
