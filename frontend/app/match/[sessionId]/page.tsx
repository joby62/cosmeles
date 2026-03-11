import MatchResultView from "@/components/site/MatchResultView";

export const dynamic = "force-dynamic";

export default async function MatchResultPage({
  params,
}: {
  params: Promise<{ sessionId: string }> | { sessionId: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  const sessionId = String(resolvedParams.sessionId || "").trim();

  return <MatchResultView sessionId={sessionId} />;
}
