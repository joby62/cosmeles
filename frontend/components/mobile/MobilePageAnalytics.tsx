"use client";

import { useEffect, useRef, useState } from "react";
import { trackMobileEvent, trackMobileEventWithBeacon } from "@/lib/mobileAnalytics";

type Props = {
  page: string;
  route: string;
  source?: string;
  category?: string | null;
  productId?: string | null;
  userProductId?: string | null;
  compareId?: string | null;
};

type AnalyticsProps = Record<string, unknown>;

function buildProps(input: Props): AnalyticsProps {
  return {
    page: input.page,
    route: input.route,
    source: input.source || undefined,
    category: input.category || undefined,
    product_id: input.productId || undefined,
    user_product_id: input.userProductId || undefined,
    compare_id: input.compareId || undefined,
  };
}

export default function MobilePageAnalytics(props: Props) {
  const { page, route, source, category, productId, userProductId, compareId } = props;
  const startedAtRef = useRef<number | null>(null);
  const [initialPayload] = useState<AnalyticsProps>(() => buildProps(props));
  const latestPropsRef = useRef<AnalyticsProps>(initialPayload);
  const exitedRef = useRef(false);

  useEffect(() => {
    latestPropsRef.current = buildProps({ page, route, source, category, productId, userProductId, compareId });
  }, [category, compareId, page, productId, route, source, userProductId]);

  useEffect(() => {
    startedAtRef.current = Date.now();
    const viewPayload = initialPayload;
    latestPropsRef.current = viewPayload;
    void trackMobileEvent("page_view", viewPayload);

    const emitExit = (exitType: string) => {
      if (exitedRef.current) return;
      exitedRef.current = true;
      trackMobileEventWithBeacon("page_exit", {
        ...latestPropsRef.current,
        dwell_ms: startedAtRef.current ? Date.now() - startedAtRef.current : undefined,
        exit_type: exitType,
      });
    };

    const handlePageHide = () => {
      emitExit("pagehide");
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      emitExit("hidden");
    };

    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [initialPayload]);

  return null;
}
