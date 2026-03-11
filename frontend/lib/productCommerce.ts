import type { Product, ProductDoc } from "@/lib/api";

export type StorefrontCommerce = Product["commerce"] | ProductDoc["commerce"] | null | undefined;

const MISSING_FIELD_LABELS: Record<string, string> = {
  price: "price",
  inventory: "live inventory",
  shipping_eta: "shipping ETA",
};

export function commerceBadgeLabel(commerce: StorefrontCommerce): string {
  if (commerce?.status === "ready") return "Commerce ready";
  if (commerce?.status === "partial") return "Partial commerce";
  return "Catalog live";
}

export function commercePackSizeLabel(commerce: StorefrontCommerce): string | null {
  return commerce?.pack_size?.label || null;
}

export function commerceMissingFieldsLabel(commerce: StorefrontCommerce): string {
  const fields = (commerce?.missing_fields || []).map((item) => MISSING_FIELD_LABELS[item] || item);
  if (fields.length === 0) return "Commerce fields are available in the current product feed.";
  if (fields.length === 1) return `${fields[0]} is not in the current product feed yet.`;
  if (fields.length === 2) return `${fields[0]} and ${fields[1]} are not in the current product feed yet.`;
  return `${fields.slice(0, -1).join(", ")}, and ${fields[fields.length - 1]} are not in the current product feed yet.`;
}
