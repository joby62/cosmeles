"use client";

import { usePathname } from "next/navigation";
import TopNav from "@/components/TopNav";

export default function DesktopTopNavGate() {
  const pathname = usePathname();
  if (pathname?.startsWith("/m")) return null;
  return <TopNav />;
}
