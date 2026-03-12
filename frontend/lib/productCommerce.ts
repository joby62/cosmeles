import type { Product, ProductDoc } from "@/lib/api";

export type StorefrontCommerce = Product["commerce"] | ProductDoc["commerce"] | null | undefined;
export type CommerceFieldKey = "price" | "inventory" | "shipping_eta" | "pack_size";

const MISSING_FIELD_LABELS: Record<string, string> = {
  price: "price",
  inventory: "live inventory",
  shipping_eta: "shipping ETA",
};

const PUBLIC_STATUS_ORDER = {
  ready: 0,
  partial: 1,
  catalog_only: 2,
} as const;

const OPS_STATUS_ORDER = {
  catalog_only: 0,
  partial: 1,
  ready: 2,
} as const;

export function commerceBadgeLabel(commerce: StorefrontCommerce): string {
  if (commerce?.status === "ready") return "Commerce ready";
  if (commerce?.status === "partial") return "Partial commerce";
  return "Catalog live";
}

export function commercePackSizeLabel(commerce: StorefrontCommerce): string | null {
  return commerce?.pack_size?.label || null;
}

export function commercePriceLabel(commerce: StorefrontCommerce): string | null {
  return commerce?.price_label || null;
}

export function commerceInventoryLabel(commerce: StorefrontCommerce): string | null {
  return commerce?.inventory_label || null;
}

export function commerceShippingEtaLabel(commerce: StorefrontCommerce): string | null {
  return commerce?.shipping_eta_label || null;
}

export function commerceHasField(commerce: StorefrontCommerce, field: CommerceFieldKey): boolean {
  if (!commerce) return false;
  if (field === "price") return Boolean(commerce.price_label);
  if (field === "inventory") return Boolean(commerce.inventory_label);
  if (field === "shipping_eta") return Boolean(commerce.shipping_eta_label);
  return Boolean(commerce.pack_size?.label);
}

export function commerceFilledFieldCount(commerce: StorefrontCommerce): number {
  return ["price", "inventory", "shipping_eta", "pack_size"].filter((field) =>
    commerceHasField(commerce, field as CommerceFieldKey),
  ).length;
}

export function commerceStatusRank(commerce: StorefrontCommerce, mode: "public" | "ops" = "public"): number {
  const status = commerce?.status || "catalog_only";
  return mode === "ops" ? OPS_STATUS_ORDER[status] : PUBLIC_STATUS_ORDER[status];
}

export function buildCommerceCoverageSummary(items: Array<{ commerce?: StorefrontCommerce }>) {
  const summary = {
    total: items.length,
    ready: 0,
    partial: 0,
    catalog_only: 0,
    fields: {
      price: 0,
      inventory: 0,
      shipping_eta: 0,
      pack_size: 0,
    },
  };

  for (const item of items) {
    const commerce = item.commerce;
    const status = commerce?.status || "catalog_only";
    summary[status] += 1;
    if (commerceHasField(commerce, "price")) summary.fields.price += 1;
    if (commerceHasField(commerce, "inventory")) summary.fields.inventory += 1;
    if (commerceHasField(commerce, "shipping_eta")) summary.fields.shipping_eta += 1;
    if (commerceHasField(commerce, "pack_size")) summary.fields.pack_size += 1;
  }

  return summary;
}

export function commerceCoveragePercent(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 100);
}

export function sortProductsByCommerceReadiness<T extends { brand?: string | null; name?: string | null; commerce?: StorefrontCommerce }>(
  items: T[],
  mode: "public" | "ops" = "public",
): T[] {
  return [...items].sort((left, right) => {
    const statusDelta = commerceStatusRank(left.commerce, mode) - commerceStatusRank(right.commerce, mode);
    if (statusDelta !== 0) return statusDelta;

    const filledDelta = commerceFilledFieldCount(right.commerce) - commerceFilledFieldCount(left.commerce);
    if (filledDelta !== 0) return filledDelta;

    return `${left.brand || ""} ${left.name || ""}`.localeCompare(`${right.brand || ""} ${right.name || ""}`);
  });
}

export function commerceMissingFieldsLabel(commerce: StorefrontCommerce): string {
  const fields = (commerce?.missing_fields || []).map((item) => MISSING_FIELD_LABELS[item] || item);
  if (fields.length === 0) return "Commerce fields are available in the current product feed.";
  if (fields.length === 1) return `${fields[0]} is not in the current product feed yet.`;
  if (fields.length === 2) return `${fields[0]} and ${fields[1]} are not in the current product feed yet.`;
  return `${fields.slice(0, -1).join(", ")}, and ${fields[fields.length - 1]} are not in the current product feed yet.`;
}
