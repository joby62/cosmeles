import CompareResultView from "@/components/site/CompareResultView";

export default async function CompareResultPage({
  params,
}: {
  params: Promise<{ compareId: string }> | { compareId: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const compareId = String(resolvedParams.compareId || "").trim();

  return <CompareResultView compareId={compareId} />;
}
