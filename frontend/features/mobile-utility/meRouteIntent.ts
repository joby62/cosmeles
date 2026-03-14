type SearchValue = string | string[] | undefined;

export type MobileMeHistoryTab = "selection" | "compare";

export function pickMobileMeTab(raw: SearchValue): string {
  if (Array.isArray(raw)) return String(raw[0] || "").trim().toLowerCase();
  return String(raw || "").trim().toLowerCase();
}

export function resolveMobileMeEntryPath(tab: string): string {
  if (tab === "selection" || tab === "compare") return `/m/me/history?tab=${tab}`;
  if (tab === "bag") return "/m/me/bag";
  return "/m/me/use";
}

export function resolveMobileMeHistoryRedirectPath(tab: string): string | null {
  if (tab === "bag") return "/m/me/bag";
  return null;
}

export function normalizeMobileMeHistoryTab(tab: string): MobileMeHistoryTab {
  if (tab === "compare") return "compare";
  return "selection";
}
