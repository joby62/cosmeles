"use client";

import { usePathname } from "next/navigation";
import TopNav from "@/components/TopNav";

export default function DesktopTopNavGate() {
  const pathname = usePathname();
  const isMobileShell = pathname === "/m" || pathname?.startsWith("/m/");
  if (isMobileShell) return null;
  return <TopNav />;
}
