import Link from "next/link";
import Image from "next/image";
import { ProductDoc, resolveStoredImageUrl } from "@/lib/api";

export default function ProductShowcase({ id, doc }: { id: string; doc: ProductDoc }) {
  const imageUrl = resolveStoredImageUrl(doc.evidence?.image_path);
  const models = doc.evidence?.doubao_models || {};
  const artifacts = doc.evidence?.doubao_artifacts || {};

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1180px] px-6 py-10">
      <section className="relative overflow-hidden rounded-[34px] border border-black/10 bg-gradient-to-br from-[#f8fbff] via-white to-[#f3f7f2] p-7">
        <div className="pointer-events-none absolute -right-8 -top-10 h-44 w-44 rounded-full bg-[#2475ff]/10 blur-2xl" />
        <div className="pointer-events-none absolute -left-14 -bottom-16 h-56 w-56 rounded-full bg-[#00a86b]/10 blur-2xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/product" className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/68 transition-colors hover:bg-black/[0.03]">
              返回产品列表
            </Link>
            <Link href="/upload" className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/68 transition-colors hover:bg-black/[0.03]">
              继续上传
            </Link>
            <span className="rounded-full border border-black/12 bg-white px-3 py-1 text-[12px] text-black/62">ID: {id}</span>
          </div>

          <h1 className="mt-4 text-[42px] font-semibold tracking-[-0.03em] text-black/90">{doc.product?.name || "未命名产品"}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2.5 text-[13px]">
            <Badge>{doc.product?.category || "-"}</Badge>
            <Badge>{doc.product?.brand || "品牌未识别"}</Badge>
            <Badge>pipeline: {doc.evidence?.doubao_pipeline_mode || "-"}</Badge>
            <Badge>vision: {models.vision || "-"}</Badge>
            <Badge>struct: {models.struct || "-"}</Badge>
          </div>
          <p className="mt-4 max-w-[920px] text-[17px] leading-[1.7] tracking-[-0.01em] text-black/72">
            {doc.summary?.one_sentence || "暂无一句话总结。"}
          </p>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">
        <article className="overflow-hidden rounded-[28px] border border-black/10 bg-white">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={doc.product?.name || `product-${id}`}
              width={960}
              height={1200}
              className="aspect-[4/5] w-full object-cover"
              priority
            />
          ) : (
            <div className="flex aspect-[4/5] items-center justify-center text-[14px] text-black/45">无图片</div>
          )}
        </article>

        <article className="rounded-[28px] border border-black/10 bg-white p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SummaryPanel title="优点" items={doc.summary?.pros || []} tone="positive" />
            <SummaryPanel title="注意点" items={doc.summary?.cons || []} tone="caution" />
            <SummaryPanel title="适合人群" items={doc.summary?.who_for || []} tone="neutral" />
            <SummaryPanel title="不适合人群" items={doc.summary?.who_not_for || []} tone="neutral" />
          </div>

          <div className="mt-5 rounded-2xl border border-black/10 bg-[#f8fafc] p-3.5">
            <h2 className="text-[13px] font-semibold tracking-[0.03em] text-black/62">Evidence Snapshot</h2>
            <div className="mt-2 grid grid-cols-1 gap-1.5 text-[12px] text-black/68 sm:grid-cols-2">
              <div>image_path: {doc.evidence?.image_path || "-"}</div>
              <div>artifact.vision: {artifacts.vision || "-"}</div>
              <div>artifact.struct: {artifacts.struct || "-"}</div>
              <div>artifact.context: {artifacts.context || "-"}</div>
            </div>
          </div>
        </article>
      </section>

      <section className="mt-6 rounded-[28px] border border-black/10 bg-white p-5">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-black/86">Ingredients ({doc.ingredients?.length || 0})</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {(doc.ingredients || []).map((item, idx) => (
            <article key={`${item.name}-${idx}`} className="rounded-2xl border border-black/10 bg-black/[0.015] p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[15px] font-semibold text-black/86">{item.name || "未命名成分"}</div>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${riskClass(item.risk)}`}>{item.risk}</span>
              </div>
              <div className="mt-1 text-[12px] text-black/62">类型：{item.type || "-"}</div>
              <div className="mt-1 text-[12px] text-black/72">功能：{(item.functions || []).join(" / ") || "-"}</div>
              <div className="mt-1 text-[12px] text-black/72">备注：{item.notes || "-"}</div>
            </article>
          ))}
          {(!doc.ingredients || doc.ingredients.length === 0) && (
            <div className="rounded-2xl border border-dashed border-black/16 px-4 py-6 text-[13px] text-black/50">无成分数据</div>
          )}
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <article className="rounded-[24px] border border-black/10 bg-white p-[18px]">
          <h3 className="text-[14px] font-semibold text-black/82">Stage1 视觉识别文本</h3>
          <pre className="mt-2 max-h-72 overflow-auto rounded-xl border border-black/10 bg-[#fbfcff] p-2.5 text-[12px] leading-[1.55] text-black/72 whitespace-pre-wrap">
            {doc.evidence?.doubao_vision_text || "-"}
          </pre>
        </article>
        <article className="rounded-[24px] border border-black/10 bg-white p-[18px]">
          <h3 className="text-[14px] font-semibold text-black/82">Stage2 结构化原文</h3>
          <pre className="mt-2 max-h-72 overflow-auto rounded-xl border border-black/10 bg-[#f8fafc] p-2.5 text-[12px] leading-[1.55] text-black/72 whitespace-pre-wrap">
            {doc.evidence?.doubao_raw || "-"}
          </pre>
        </article>
      </section>

      <section className="mt-6 rounded-[24px] border border-black/10 bg-white p-[18px]">
        <h3 className="text-[14px] font-semibold text-black/82">Raw JSON</h3>
        <pre className="mt-2 max-h-[520px] overflow-auto rounded-xl border border-black/10 bg-[#f8fafc] p-3 text-[12px] leading-[1.55] text-black/72 whitespace-pre-wrap">
          {JSON.stringify(doc, null, 2)}
        </pre>
      </section>
    </main>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[12px] text-black/68">{children}</span>;
}

function SummaryPanel({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "positive" | "caution" | "neutral";
}) {
  const toneClass =
    tone === "positive"
      ? "bg-[#f4fbf7] border-[#d8f1e3]"
      : tone === "caution"
        ? "bg-[#fff8f4] border-[#f4e2d5]"
        : "bg-[#f8fafc] border-black/10";

  return (
    <section className={`rounded-2xl border p-3.5 ${toneClass}`}>
      <h3 className="text-[13px] font-semibold text-black/75">{title}</h3>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-1.5 text-[13px] leading-[1.55] text-black/74">
          {items.map((item, idx) => (
            <li key={`${title}-${idx}`} className="flex items-start gap-2">
              <span className="mt-[6px] h-1.5 w-1.5 flex-none rounded-full bg-black/35" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-2 text-[12px] text-black/45">-</div>
      )}
    </section>
  );
}

function riskClass(risk: "low" | "mid" | "high"): string {
  if (risk === "high") return "bg-[#fdeaea] text-[#9f1d1d]";
  if (risk === "mid") return "bg-[#fff3dd] text-[#9b5a00]";
  return "bg-[#eaf8ef] text-[#116a3f]";
}
