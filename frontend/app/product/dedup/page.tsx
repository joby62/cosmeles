import ProductDedupManager from "@/components/ProductDedupManager";
import { fetchAllProducts } from "@/lib/api";

export default async function ProductDedupPage() {
  const products = await fetchAllProducts();
  return <ProductDedupManager initialProducts={products} />;
}
