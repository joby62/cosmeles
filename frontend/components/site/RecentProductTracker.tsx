"use client";

import { useEffect } from "react";
import { rememberRecentProduct, type RecentProductInput } from "@/lib/recentProducts";

type RecentProductTrackerProps = {
  snapshot: RecentProductInput;
};

export default function RecentProductTracker({ snapshot }: RecentProductTrackerProps) {
  const { productId, category, name, brand, summary, imageUrl, routeTitle, routeSummary } = snapshot;

  useEffect(() => {
    rememberRecentProduct({ productId, category, name, brand, summary, imageUrl, routeTitle, routeSummary });
  }, [productId, category, name, brand, summary, imageUrl, routeTitle, routeSummary]);

  return null;
}
