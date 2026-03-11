"use client";

import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { trackMobileEvent } from "@/lib/mobileAnalytics";

type Props = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    eventName?: string;
    eventProps?: Record<string, unknown>;
    children: ReactNode;
  };

export default function MobileTrackedLink({
  eventName,
  eventProps,
  onClick,
  children,
  ...rest
}: Props) {
  return (
    <Link
      {...rest}
      onClick={(event) => {
        if (eventName) {
          void trackMobileEvent(eventName, eventProps || {});
        }
        onClick?.(event);
      }}
    >
      {children}
    </Link>
  );
}
