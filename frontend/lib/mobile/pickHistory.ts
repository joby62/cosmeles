export type PickHistoryEntry = {
  id: string;
  categoryKey: "shampoo" | "bodywash" | "conditioner" | "lotion" | "cleanser";
  categoryLabel: string;
  resultTitle: string;
  resultSummary: string;
  signals: string[];
  resultHref: string;
  createdAt: string;
};

export type NewPickHistoryEntry = Omit<PickHistoryEntry, "id" | "createdAt">;

const KEY = "matchup.pick-history.v1";

export function readPickHistory(): PickHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PickHistoryEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function pushPickHistory(entry: NewPickHistoryEntry): void {
  if (typeof window === "undefined") return;

  const now = new Date().toISOString();
  const next: PickHistoryEntry = {
    ...entry,
    id: `${entry.categoryKey}-${Date.now()}`,
    createdAt: now,
  };

  const old = readPickHistory();
  const deduped = old.filter((item) => !(item.categoryKey === entry.categoryKey && item.resultHref === entry.resultHref));
  const merged = [next, ...deduped].slice(0, 40);
  window.localStorage.setItem(KEY, JSON.stringify(merged));
  window.dispatchEvent(new Event("matchup-history-change"));
}

export function clearPickHistory(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("matchup-history-change"));
}
