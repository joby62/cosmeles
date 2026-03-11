import ProductAnalysisGenerator from "@/components/ProductAnalysisGenerator";
import ProductDedupManager from "@/components/ProductDedupManager";
import ProductIngestWorkbench from "@/components/ProductIngestWorkbench";
import ProductManagementShell from "@/components/ProductManagementShell";
import ProductRouteMappingGenerator from "@/components/ProductRouteMappingGenerator";
import IngredientLibraryGenerator from "@/components/IngredientLibraryGenerator";
import { loadProductManagementData } from "@/lib/productManagementData";

export default async function ProductPipelinePage() {
  const data = await loadProductManagementData();

  return (
    <ProductManagementShell
      activeSection="pipeline"
      productsCount={data.products.length}
      categoryStats={data.categoryStats}
      aiMetrics={data.aiMetrics}
    >
      <section id="product-ingest-workbench" className="mt-10 scroll-mt-6">
        <ProductIngestWorkbench />
      </section>
      <section id="product-dedup-manager" className="scroll-mt-6">
        <ProductDedupManager initialProducts={data.products} />
      </section>
      <section id="ingredient-library-generator" className="scroll-mt-6">
        <IngredientLibraryGenerator initialProducts={data.products} showCleanupConsole={false} />
      </section>
      <section id="product-route-mapping-generator" className="scroll-mt-6">
        <ProductRouteMappingGenerator initialProducts={data.products} />
      </section>
      <section id="product-analysis-generator" className="scroll-mt-6">
        <ProductAnalysisGenerator initialProducts={data.products} initialAnalysisIndex={data.analysisIndex} />
      </section>
    </ProductManagementShell>
  );
}
