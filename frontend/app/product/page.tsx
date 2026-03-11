import Link from "next/link";
import ProductManagementShell from "@/components/ProductManagementShell";
import { loadProductManagementData } from "@/lib/productManagementData";
import {
  PRODUCT_MANAGEMENT_SECTIONS,
  type ProductManagementSectionKey,
} from "@/lib/productManagementNav";

export default async function ProductManagementOverviewPage() {
  const data = await loadProductManagementData();
  const sections = PRODUCT_MANAGEMENT_SECTIONS.filter((item) => item.key !== "overview");

  return (
    <ProductManagementShell
      activeSection="overview"
      productsCount={data.products.length}
      categoryStats={data.categoryStats}
      aiMetrics={data.aiMetrics}
    >
      <section className="mt-10 grid gap-4 lg:grid-cols-3">
        {sections.map((section) => (
          <SectionCard
            key={section.key}
            sectionKey={section.key}
            href={section.href}
            title={section.titleZh}
            summary={section.summaryZh}
            bullets={section.bulletsZh}
          />
        ))}
      </section>
    </ProductManagementShell>
  );
}

function SectionCard({
  sectionKey,
  href,
  title,
  summary,
  bullets,
}: {
  sectionKey: ProductManagementSectionKey;
  href: string;
  title: string;
  summary: string;
  bullets: string[];
}) {
  return (
    <article className="rounded-[28px] border border-black/10 bg-white p-6 shadow-[0_18px_44px_rgba(16,24,40,0.06)]">
      <div className="text-[11px] font-semibold tracking-[0.12em] text-black/42">{sectionKey.toUpperCase()}</div>
      <h2 className="mt-2 text-[28px] font-semibold tracking-[-0.02em] text-black/88">{title}</h2>
      <p className="mt-3 text-[14px] leading-[1.6] text-black/62">{summary}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {bullets.map((item) => (
          <span key={item} className="rounded-full border border-black/10 bg-[#f7f8fb] px-3 py-1 text-[12px] text-black/66">
            {item}
          </span>
        ))}
      </div>
      <Link
        href={href}
        className="mt-6 inline-flex h-10 items-center justify-center rounded-full border border-black bg-black px-5 text-[13px] font-semibold text-white hover:bg-black/88"
      >
        进入{title}
      </Link>
    </article>
  );
}
