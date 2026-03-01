import { ProductDoc, resolveStoredImageUrl } from "@/lib/api";

export default function ProductShowcase({
  id,
  doc,
}: {
  id: string;
  doc: ProductDoc;
}) {
  const imageUrl = resolveStoredImageUrl(doc.evidence?.image_path);
  const models = doc.evidence?.doubao_models || {};
  const artifacts = doc.evidence?.doubao_artifacts || {};

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1080px] px-6 py-10">
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
          {imageUrl ? (
            <img src={imageUrl} alt={doc.product?.name || `product-${id}`} className="h-full w-full object-cover" />
          ) : (
            <div className="flex aspect-square items-center justify-center text-[13px] text-black/45">无图片</div>
          )}
        </div>

        <div className="space-y-4 rounded-2xl border border-black/10 bg-white p-5">
          <div className="text-[12px] text-black/55">ID: {id}</div>
          <h1 className="text-[28px] font-semibold leading-[1.2] text-black/88">{doc.product?.name || "未命名产品"}</h1>
          <div className="grid grid-cols-1 gap-2 text-[14px] text-black/72 sm:grid-cols-2">
            <div>品类：{doc.product?.category || "-"}</div>
            <div>品牌：{doc.product?.brand || "-"}</div>
            <div>流程：{doc.evidence?.doubao_pipeline_mode || "-"}</div>
            <div>
              模型：vision={models.vision || "-"} / struct={models.struct || "-"}
            </div>
          </div>
          <div className="rounded-xl border border-black/8 bg-black/[0.02] p-3 text-[14px] leading-[1.7] text-black/76">
            {doc.summary?.one_sentence || "无一句话总结"}
          </div>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-black/10 bg-white p-5">
          <h2 className="text-[16px] font-semibold text-black/85">Summary</h2>
          <div className="mt-3 space-y-3 text-[14px] text-black/74">
            <FieldList title="优点" items={doc.summary?.pros || []} />
            <FieldList title="注意点" items={doc.summary?.cons || []} />
            <FieldList title="适合人群" items={doc.summary?.who_for || []} />
            <FieldList title="不适合人群" items={doc.summary?.who_not_for || []} />
          </div>
        </article>

        <article className="rounded-2xl border border-black/10 bg-white p-5">
          <h2 className="text-[16px] font-semibold text-black/85">Evidence</h2>
          <div className="mt-3 space-y-2 text-[13px] leading-[1.6] text-black/72">
            <div>image_path: {doc.evidence?.image_path || "-"}</div>
            <div>artifact.vision: {artifacts.vision || "-"}</div>
            <div>artifact.struct: {artifacts.struct || "-"}</div>
            <div>artifact.context: {artifacts.context || "-"}</div>
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-[13px] font-medium text-black/76">stage1 识别文本</summary>
            <pre className="mt-2 max-h-56 overflow-auto rounded-xl border border-black/8 bg-[#fbfcff] p-2.5 text-[12px] leading-[1.55] text-black/72 whitespace-pre-wrap">
              {doc.evidence?.doubao_vision_text || "-"}
            </pre>
          </details>
          <details className="mt-3">
            <summary className="cursor-pointer text-[13px] font-medium text-black/76">stage2 结构化原文</summary>
            <pre className="mt-2 max-h-56 overflow-auto rounded-xl border border-black/8 bg-[#f8fafc] p-2.5 text-[12px] leading-[1.55] text-black/72 whitespace-pre-wrap">
              {doc.evidence?.doubao_raw || "-"}
            </pre>
          </details>
        </article>
      </section>

      <section className="mt-6 rounded-2xl border border-black/10 bg-white p-5">
        <h2 className="text-[16px] font-semibold text-black/85">Ingredients ({doc.ingredients?.length || 0})</h2>
        <div className="mt-3 space-y-3">
          {(doc.ingredients || []).map((item, idx) => (
            <article key={`${item.name}-${idx}`} className="rounded-xl border border-black/8 bg-black/[0.02] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[14px] font-semibold text-black/84">{item.name || "未命名成分"}</div>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-black/68">risk: {item.risk}</span>
              </div>
              <div className="mt-1 text-[12px] text-black/62">类型：{item.type || "-"}</div>
              <div className="mt-1 text-[12px] text-black/72">功能：{(item.functions || []).join(" / ") || "-"}</div>
              <div className="mt-1 text-[12px] text-black/72">备注：{item.notes || "-"}</div>
            </article>
          ))}
          {(!doc.ingredients || doc.ingredients.length === 0) && (
            <div className="rounded-xl border border-dashed border-black/14 px-3 py-4 text-[12px] text-black/52">无成分数据</div>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-black/10 bg-white p-5">
        <h2 className="text-[16px] font-semibold text-black/85">Raw JSON</h2>
        <pre className="mt-3 max-h-[520px] overflow-auto rounded-xl border border-black/8 bg-[#f8fafc] p-3 text-[12px] leading-[1.55] text-black/72 whitespace-pre-wrap">
          {JSON.stringify(doc, null, 2)}
        </pre>
      </section>
    </main>
  );
}

function FieldList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-[12px] font-semibold text-black/65">{title}</div>
      {items.length > 0 ? (
        <div className="mt-1 text-[13px] leading-[1.6] text-black/74">{items.join("；")}</div>
      ) : (
        <div className="mt-1 text-[12px] text-black/45">-</div>
      )}
    </div>
  );
}
