"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  resolveImageUrl,
  type Product,
  type ProductCommerceUpdatePayload,
  updateProduct,
} from "@/lib/api";
import {
  commerceBadgeLabel,
  commerceInventoryLabel,
  commercePackSizeLabel,
  commercePriceLabel,
  commerceShippingEtaLabel,
} from "@/lib/productCommerce";
import { CATEGORIES, getCategoryMeta, normalizeCategoryKey } from "@/lib/site";

type CommerceWorkbenchProps = {
  initialProducts: Product[];
};

type EditorState = {
  price_label: string;
  inventory_label: string;
  shipping_eta_label: string;
  pack_size_label: string;
  pack_size_unit: string;
  pack_size_value: string;
};

type ImportRow = {
  product_id: string;
  price_label?: string;
  inventory_label?: string;
  shipping_eta_label?: string;
  pack_size?: {
    label?: string;
    unit?: string;
    value?: number | null;
  };
};

const IMPORT_HEADERS = [
  "product_id",
  "price_label",
  "inventory_label",
  "shipping_eta_label",
  "pack_size_label",
  "pack_size_unit",
  "pack_size_value",
] as const;

const TSV_TEMPLATE = `${IMPORT_HEADERS.join("\t")}
replace-with-product-id\t$24\tIn stock\tShips in 2-4 business days\t250 mL\tmL\t250`;

function makeEditorState(product: Product | null): EditorState {
  const commerce = product?.commerce || null;
  return {
    price_label: commerce?.price_label || "",
    inventory_label: commerce?.inventory_label || "",
    shipping_eta_label: commerce?.shipping_eta_label || "",
    pack_size_label: commerce?.pack_size?.label || "",
    pack_size_unit: commerce?.pack_size?.unit || "",
    pack_size_value:
      typeof commerce?.pack_size?.value === "number" && Number.isFinite(commerce.pack_size.value)
        ? String(commerce.pack_size.value)
        : "",
  };
}

function sortProducts(items: Product[]): Product[] {
  return [...items].sort((left, right) => {
    const leftStatus = left.commerce?.status || "catalog_only";
    const rightStatus = right.commerce?.status || "catalog_only";
    const statusOrder = { ready: 0, partial: 1, catalog_only: 2 } as const;
    const statusDelta = statusOrder[leftStatus] - statusOrder[rightStatus];
    if (statusDelta !== 0) return statusDelta;
    return `${left.brand || ""} ${left.name || ""}`.localeCompare(`${right.brand || ""} ${right.name || ""}`);
  });
}

function buildCommercePayload(state: EditorState): ProductCommerceUpdatePayload {
  const payload: ProductCommerceUpdatePayload = {
    price_label: state.price_label,
    inventory_label: state.inventory_label,
    shipping_eta_label: state.shipping_eta_label,
  };

  if (state.pack_size_label || state.pack_size_unit || state.pack_size_value) {
    payload.pack_size = {
      label: state.pack_size_label,
      unit: state.pack_size_unit,
      value: state.pack_size_value ? Number(state.pack_size_value) : null,
    };
  }

  return payload;
}

function splitDelimitedLine(line: string, delimiter: "," | "\t"): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseDelimitedImport(raw: string): ImportRow[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const headerLine = lines[0];
  const delimiter: "," | "\t" = headerLine.includes("\t") ? "\t" : ",";
  const headers = splitDelimitedLine(headerLine, delimiter).map((item) => item.trim());
  if (!headers.includes("product_id")) {
    throw new Error("Delimited import must include a product_id column.");
  }

  return lines.slice(1).map((line, index) => {
    const cells = splitDelimitedLine(line, delimiter);
    const record = new Map<string, string>();
    headers.forEach((header, headerIndex) => {
      record.set(header, String(cells[headerIndex] || "").trim());
    });

    const productId = String(record.get("product_id") || "").trim();
    if (!productId) {
      throw new Error(`Row ${index + 2} is missing product_id.`);
    }

    const packSizeValueRaw = String(record.get("pack_size_value") || "").trim();
    const packSizeValue = packSizeValueRaw ? Number(packSizeValueRaw) : null;
    if (packSizeValueRaw && !Number.isFinite(packSizeValue)) {
      throw new Error(`Row ${index + 2} has an invalid pack_size_value.`);
    }

    const packSizeLabel = String(record.get("pack_size_label") || "").trim();
    const packSizeUnit = String(record.get("pack_size_unit") || "").trim();

    return {
      product_id: productId,
      price_label: String(record.get("price_label") || "").trim() || undefined,
      inventory_label: String(record.get("inventory_label") || "").trim() || undefined,
      shipping_eta_label: String(record.get("shipping_eta_label") || "").trim() || undefined,
      pack_size:
        packSizeLabel || packSizeUnit || packSizeValueRaw
          ? {
              label: packSizeLabel || undefined,
              unit: packSizeUnit || undefined,
              value: packSizeValue,
            }
          : undefined,
    };
  });
}

function parseImportPayload(raw: string): ImportRow[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
      throw new Error("Bulk import JSON must be an array.");
    }

    return parsed.map((item, index) => {
      if (!item || typeof item !== "object") {
        throw new Error(`Row ${index + 1} must be an object.`);
      }
      const record = item as Record<string, unknown>;
      const productId = String(record.product_id || "").trim();
      if (!productId) {
        throw new Error(`Row ${index + 1} is missing product_id.`);
      }

      const packSizeRaw = record.pack_size;
      let packSize: ImportRow["pack_size"];
      if (packSizeRaw && typeof packSizeRaw === "object") {
        const packSizeRecord = packSizeRaw as Record<string, unknown>;
        packSize = {
          label: packSizeRecord.label == null ? undefined : String(packSizeRecord.label),
          unit: packSizeRecord.unit == null ? undefined : String(packSizeRecord.unit),
          value:
            packSizeRecord.value == null || packSizeRecord.value === ""
              ? null
              : Number(packSizeRecord.value),
        };
        if (packSize.value != null && !Number.isFinite(packSize.value)) {
          throw new Error(`Row ${index + 1} has an invalid pack_size.value.`);
        }
      }

      return {
        product_id: productId,
        price_label: record.price_label == null ? undefined : String(record.price_label),
        inventory_label: record.inventory_label == null ? undefined : String(record.inventory_label),
        shipping_eta_label: record.shipping_eta_label == null ? undefined : String(record.shipping_eta_label),
        pack_size: packSize,
      };
    });
  }
  return parseDelimitedImport(trimmed);
}

export default function CommerceWorkbench({ initialProducts }: CommerceWorkbenchProps) {
  const [products, setProducts] = useState<Product[]>(() => sortProducts(initialProducts));
  const [selectedProductId, setSelectedProductId] = useState<string>(initialProducts[0]?.id || "");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editor, setEditor] = useState<EditorState>(() => makeEditorState(initialProducts[0] || null));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "done">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [importDraft, setImportDraft] = useState(TSV_TEMPLATE);
  const [importState, setImportState] = useState<"idle" | "running" | "done">("idle");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(searchQuery.trim().toLowerCase());

  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      const category = normalizeCategoryKey(item.category);
      if (categoryFilter !== "all" && category !== categoryFilter) return false;
      if (!deferredQuery) return true;
      const haystack = [item.brand, item.name, item.one_sentence, commercePriceLabel(item.commerce), commerceInventoryLabel(item.commerce)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(deferredQuery);
    });
  }, [products, categoryFilter, deferredQuery]);

  const selectedProduct = useMemo(
    () => products.find((item) => item.id === selectedProductId) || filteredProducts[0] || null,
    [products, selectedProductId, filteredProducts],
  );

  const summary = useMemo(() => {
    const counts = {
      ready: 0,
      partial: 0,
      catalog_only: 0,
    };
    for (const product of products) {
      counts[product.commerce?.status || "catalog_only"] += 1;
    }
    return counts;
  }, [products]);

  useEffect(() => {
    if (!selectedProduct) return;
    if (selectedProduct.id !== selectedProductId) {
      startTransition(() => setSelectedProductId(selectedProduct.id));
    }
    setEditor(makeEditorState(selectedProduct));
    setSaveError(null);
  }, [selectedProduct, selectedProductId]);

  async function handleSave() {
    if (!selectedProduct) return;
    try {
      if (editor.pack_size_value && !Number.isFinite(Number(editor.pack_size_value))) {
        throw new Error("Pack size value must be a valid number.");
      }
      setSaveState("saving");
      setSaveError(null);
      const updated = await updateProduct(selectedProduct.id, {
        commerce: buildCommercePayload(editor),
      });
      setProducts((current) =>
        sortProducts(current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))),
      );
      setSaveState("done");
      window.setTimeout(() => setSaveState("idle"), 1800);
    } catch (error) {
      setSaveState("idle");
      setSaveError(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleImport() {
    try {
      setImportState("running");
      setImportMessage(null);
      const rows = parseImportPayload(importDraft);
      if (rows.length === 0) {
        throw new Error("Bulk import JSON is empty.");
      }

      let applied = 0;
      const updatesById = new Map<string, Product>();
      for (const row of rows) {
        const updated = await updateProduct(row.product_id, {
          commerce: {
            price_label: row.price_label,
            inventory_label: row.inventory_label,
            shipping_eta_label: row.shipping_eta_label,
            pack_size: row.pack_size,
          },
        });
        updatesById.set(updated.id, updated);
        applied += 1;
      }

      setProducts((current) =>
        sortProducts(current.map((item) => updatesById.get(item.id) || item)),
      );
      setImportState("done");
      setImportMessage(`Applied ${applied} commerce updates.`);
      window.setTimeout(() => setImportState("idle"), 1800);
    } catch (error) {
      setImportState("idle");
      setImportMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-[26px] border border-black/8 bg-white/92 px-5 py-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Commerce ready</p>
          <div className="mt-3 text-[34px] font-semibold tracking-[-0.05em] text-slate-950">{summary.ready}</div>
        </article>
        <article className="rounded-[26px] border border-black/8 bg-white/92 px-5 py-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Partial commerce</p>
          <div className="mt-3 text-[34px] font-semibold tracking-[-0.05em] text-slate-950">{summary.partial}</div>
        </article>
        <article className="rounded-[26px] border border-black/8 bg-white/92 px-5 py-5 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Catalog only</p>
          <div className="mt-3 text-[34px] font-semibold tracking-[-0.05em] text-slate-950">{summary.catalog_only}</div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <article className="rounded-[32px] border border-black/8 bg-white/94 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Product list</p>
              <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">Select a product and patch commerce fields.</h2>
            </div>
            <Link
              href="/shop"
              className="inline-flex h-10 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-[13px] font-medium text-slate-700"
            >
              Open public shop
            </Link>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[0.9fr_0.42fr]">
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by brand, product, price, or inventory"
              className="h-11 rounded-full border border-black/10 bg-white px-4 text-[14px] text-slate-900 outline-none ring-0 transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="h-11 rounded-full border border-black/10 bg-white px-4 text-[14px] text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            >
              <option value="all">All categories</option>
              {CATEGORIES.map((category) => (
                <option key={category.key} value={category.key}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-5 space-y-3">
            {filteredProducts.map((product) => {
              const category = getCategoryMeta(product.category);
              const isSelected = selectedProduct?.id === product.id;
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => {
                    setSelectedProductId(product.id);
                    setEditor(makeEditorState(product));
                  }}
                  className={`flex w-full flex-col gap-4 rounded-[24px] border p-4 text-left transition sm:flex-row ${
                    isSelected
                      ? "border-sky-300 bg-sky-50 shadow-[0_14px_30px_rgba(0,113,227,0.1)]"
                      : "border-black/8 bg-slate-50 hover:border-slate-300 hover:bg-white"
                  }`}
                >
                  <div className="relative h-[92px] w-[92px] shrink-0 overflow-hidden rounded-[20px] bg-white">
                    <Image src={resolveImageUrl(product)} alt={product.name || "Product"} fill sizes="92px" className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-2">
                      {category ? (
                        <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                          {category.label}
                        </span>
                      ) : null}
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-medium text-amber-700">
                        {commerceBadgeLabel(product.commerce)}
                      </span>
                      {commercePackSizeLabel(product.commerce) ? (
                        <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-[11px] font-medium text-slate-600">
                          {commercePackSizeLabel(product.commerce)}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-3 text-[20px] font-semibold tracking-[-0.03em] text-slate-950">
                      {product.brand || "Jeslect"} {product.name || "Untitled product"}
                    </h3>
                    <p className="mt-2 text-[14px] leading-6 text-slate-600">
                      {product.one_sentence || "No one-line summary is stored for this product yet."}
                    </p>
                    {(commercePriceLabel(product.commerce) || commerceInventoryLabel(product.commerce) || commerceShippingEtaLabel(product.commerce)) ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {commercePriceLabel(product.commerce) ? (
                          <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-[11px] font-medium text-slate-700">
                            {commercePriceLabel(product.commerce)}
                          </span>
                        ) : null}
                        {commerceInventoryLabel(product.commerce) ? (
                          <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-[11px] font-medium text-slate-700">
                            {commerceInventoryLabel(product.commerce)}
                          </span>
                        ) : null}
                        {commerceShippingEtaLabel(product.commerce) ? (
                          <span className="rounded-full border border-black/8 bg-white px-3 py-1 text-[11px] font-medium text-slate-700">
                            {commerceShippingEtaLabel(product.commerce)}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </article>

        <div className="space-y-6">
          <article className="rounded-[32px] border border-black/8 bg-white/94 p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-500">Single product editor</p>
            <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">
              {selectedProduct ? "Edit the live commerce snapshot." : "Select a product first."}
            </h2>

            {selectedProduct ? (
              <>
                <p className="mt-3 text-[14px] leading-6 text-slate-600">
                  Product ID: <span className="font-mono text-[12px] text-slate-500">{selectedProduct.id}</span>
                </p>

                <div className="mt-5 grid gap-3">
                  <label className="grid gap-2">
                    <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">Price label</span>
                    <input
                      value={editor.price_label}
                      onChange={(event) => setEditor((current) => ({ ...current, price_label: event.target.value }))}
                      placeholder="$24"
                      className="h-11 rounded-[18px] border border-black/10 bg-white px-4 text-[14px] text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">Inventory label</span>
                    <input
                      value={editor.inventory_label}
                      onChange={(event) => setEditor((current) => ({ ...current, inventory_label: event.target.value }))}
                      placeholder="In stock"
                      className="h-11 rounded-[18px] border border-black/10 bg-white px-4 text-[14px] text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">Shipping ETA label</span>
                    <input
                      value={editor.shipping_eta_label}
                      onChange={(event) => setEditor((current) => ({ ...current, shipping_eta_label: event.target.value }))}
                      placeholder="Ships in 2-4 business days"
                      className="h-11 rounded-[18px] border border-black/10 bg-white px-4 text-[14px] text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                    />
                  </label>

                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="grid gap-2 md:col-span-2">
                      <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">Pack size label</span>
                      <input
                        value={editor.pack_size_label}
                        onChange={(event) => setEditor((current) => ({ ...current, pack_size_label: event.target.value }))}
                        placeholder="250 mL"
                        className="h-11 rounded-[18px] border border-black/10 bg-white px-4 text-[14px] text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">Unit</span>
                      <input
                        value={editor.pack_size_unit}
                        onChange={(event) => setEditor((current) => ({ ...current, pack_size_unit: event.target.value }))}
                        placeholder="mL"
                        className="h-11 rounded-[18px] border border-black/10 bg-white px-4 text-[14px] text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                      />
                    </label>
                  </div>

                  <label className="grid gap-2">
                    <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500">Pack size value</span>
                    <input
                      value={editor.pack_size_value}
                      onChange={(event) => setEditor((current) => ({ ...current, pack_size_value: event.target.value }))}
                      placeholder="250"
                      inputMode="decimal"
                      className="h-11 rounded-[18px] border border-black/10 bg-white px-4 text-[14px] text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                    />
                  </label>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saveState === "saving"}
                    className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[14px] font-semibold text-white disabled:opacity-60"
                  >
                    {saveState === "saving" ? "Saving..." : saveState === "done" ? "Saved" : "Save commerce"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditor(makeEditorState(selectedProduct))}
                    className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-[14px] font-semibold text-slate-700"
                  >
                    Reset form
                  </button>
                </div>
                {saveError ? <p className="mt-3 text-[13px] leading-6 text-rose-700">{saveError}</p> : null}
              </>
            ) : null}
          </article>

          <article className="rounded-[32px] border border-black/8 bg-[linear-gradient(180deg,#eef6ff_0%,#ffffff_100%)] p-6 shadow-[0_20px_46px_rgba(15,23,42,0.06)]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-sky-700">Bulk import</p>
            <h2 className="mt-3 text-[30px] font-semibold tracking-[-0.04em] text-slate-950">
              Apply JSON, CSV, or TSV commerce updates without manual API calls.
            </h2>
            <p className="mt-3 text-[14px] leading-6 text-slate-600">
              Accepted headers: <span className="font-mono text-[12px]">{IMPORT_HEADERS.join(", ")}</span>. Each row must
              include `product_id`. Empty strings clear a field.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setImportDraft(TSV_TEMPLATE)}
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-[12px] font-medium text-slate-700"
              >
                Load TSV template
              </button>
              <button
                type="button"
                onClick={() =>
                  setImportDraft(
                    JSON.stringify(
                      [
                        {
                          product_id: "replace-with-product-id",
                          price_label: "$24",
                          inventory_label: "In stock",
                          shipping_eta_label: "Ships in 2-4 business days",
                          pack_size: { label: "250 mL", unit: "mL", value: 250 },
                        },
                      ],
                      null,
                      2,
                    ),
                  )
                }
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-[12px] font-medium text-slate-700"
              >
                Load JSON template
              </button>
            </div>
            <textarea
              value={importDraft}
              onChange={(event) => setImportDraft(event.target.value)}
              spellCheck={false}
              className="mt-5 min-h-[260px] w-full rounded-[24px] border border-black/10 bg-white px-4 py-4 font-mono text-[12px] leading-6 text-slate-900 outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            />
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleImport}
                disabled={importState === "running"}
                className="inline-flex h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2997ff_0%,#0071e3_100%)] px-5 text-[14px] font-semibold text-white disabled:opacity-60"
              >
                {importState === "running" ? "Applying..." : importState === "done" ? "Applied" : "Run import"}
              </button>
            </div>
            {importMessage ? <p className="mt-3 text-[13px] leading-6 text-slate-700">{importMessage}</p> : null}
          </article>
        </div>
      </section>
    </div>
  );
}
