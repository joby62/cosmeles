import GitDashboardClient, { type GitDashboardBundle } from "@/app/git/page-client";
import { getGitBranchRefs, getGitChurnDashboard, getRecentCommitDiffs } from "@/lib/mobile/gitChurn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Search = Record<string, string | string[] | undefined>;

function queryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function GitDesktopPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const search = (await Promise.resolve(searchParams)) || {};
  const branchRefs = getGitBranchRefs();
  const refSet = new Set(branchRefs.map((item) => item.ref));
  const defaultRef = refSet.has("origin/main")
    ? "origin/main"
    : refSet.has("main")
      ? "main"
      : branchRefs[0]?.ref ?? "HEAD";
  const branchQuery = queryValue(search.branch)?.trim();
  const selectedRef = branchQuery && refSet.has(branchQuery) ? branchQuery : defaultRef;

  const datasets: GitDashboardBundle = {
    "3": getGitChurnDashboard({ sinceDays: 3, maxCommits: 120, ref: selectedRef }),
    "5": getGitChurnDashboard({ sinceDays: 5, maxCommits: 150, ref: selectedRef }),
    "7": getGitChurnDashboard({ sinceDays: 7, maxCommits: 180, ref: selectedRef }),
    "30": getGitChurnDashboard({ sinceDays: 30, maxCommits: 360, ref: selectedRef }),
    all: getGitChurnDashboard({ sinceDays: "all", maxCommits: 3000, ref: selectedRef }),
  };
  const recentDiffs = getRecentCommitDiffs({
    count: 6,
    maxFilesPerCommit: 8,
    maxPatchCharsPerFile: 10000,
    ref: selectedRef,
  });

  return (
    <GitDashboardClient
      datasets={datasets}
      recentDiffs={recentDiffs}
      branchRefs={branchRefs}
      selectedRef={selectedRef}
    />
  );
}
