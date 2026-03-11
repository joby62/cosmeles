"use client";

import { useEffect, useRef } from "react";
import { trackMobileEvent } from "@/lib/mobileAnalytics";

export default function MobileEventBeacon({
  name,
  props,
}: {
  name: string;
  props?: Record<string, unknown>;
}) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    void trackMobileEvent(name, props || {});
  }, [name, props]);

  return null;
}
