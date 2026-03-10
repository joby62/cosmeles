import { redirect } from "next/navigation";

type Search = Record<string, string | string[] | undefined>;

function pickTab(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) return String(raw[0] || "").trim().toLowerCase();
  return String(raw || "").trim().toLowerCase();
}

export default async function MobileMeEntryPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const raw = (await Promise.resolve(searchParams)) || {};
  const tab = pickTab(raw.tab);

  if (tab === "selection" || tab === "compare") {
    redirect(`/m/me/history?tab=${tab}`);
  }

  if (tab === "bag") {
    redirect("/m/me/bag");
  }

  redirect("/m/me/use");
}
