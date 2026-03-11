import ProductAnalysisGenerator from "@/components/ProductAnalysisGenerator";
import ProductDedupManager from "@/components/ProductDedupManager";
import ProductIngestWorkbench from "@/components/ProductIngestWorkbench";
import ProductManagementShell, {
  ProductManagementStageErrorCard,
} from "@/components/ProductManagementShell";
import ProductRouteMappingGenerator from "@/components/ProductRouteMappingGenerator";
import IngredientLibraryGenerator from "@/components/IngredientLibraryGenerator";
import {
  getProductManagementError,
  hasProductManagementData,
  loadProductManagementData,
} from "@/lib/productManagementData";

export default async function ProductPipelinePage() {
  const data = await loadProductManagementData();
  const products = hasProductManagementData(data.products) ? data.products.data : null;
  const analysisIndex = hasProductManagementData(data.analysisIndex) ? data.analysisIndex.data : null;
  const productsCount = products ? products.length : null;
  const aiMetrics = hasProductManagementData(data.aiMetrics) ? data.aiMetrics.data : null;
  const productError = getProductManagementError(data.products);
  const analysisError = getProductManagementError(data.analysisIndex);

  return (
    <ProductManagementShell
      activeSection="pipeline"
      productsCount={productsCount}
      categoryStats={data.categoryStats}
      aiMetrics={aiMetrics}
      issues={data.issues}
    >
      <section id="product-ingest-workbench" className="mt-10 scroll-mt-20">
        <ProductIngestWorkbench />
      </section>
      <section id="product-dedup-manager" className="scroll-mt-20">
        {products ? (
          <ProductDedupManager initialProducts={products} />
        ) : (
          <ProductManagementStageErrorCard title="同品归并台不可用" errors={productError ? [productError] : []} />
        )}
      </section>
      <section id="ingredient-library-generator" className="scroll-mt-20">
        {products ? (
          <IngredientLibraryGenerator initialProducts={products} showCleanupConsole={false} />
        ) : (
          <ProductManagementStageErrorCard title="成分分析台不可用" errors={productError ? [productError] : []} />
        )}
      </section>
      <section id="product-route-mapping-generator" className="scroll-mt-20">
        {products ? (
          <ProductRouteMappingGenerator initialProducts={products} />
        ) : (
          <ProductManagementStageErrorCard title="产品类型映射台不可用" errors={productError ? [productError] : []} />
        )}
      </section>
      <section id="product-analysis-generator" className="scroll-mt-20">
        {products && analysisIndex ? (
          <ProductAnalysisGenerator initialProducts={products} initialAnalysisIndex={analysisIndex} />
        ) : (
          <ProductManagementStageErrorCard
            title="产品增强分析台不可用"
            errors={[
              ...(productError ? [productError] : []),
              ...(analysisError ? [analysisError] : []),
            ].filter((item, index, arr) => arr.findIndex((x) => x.stage === item.stage && x.detail === item.detail) === index)}
          />
        )}
      </section>
    </ProductManagementShell>
  );
}
