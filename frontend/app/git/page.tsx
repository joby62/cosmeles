import GitDashboardClient, { type GitDashboardBundle } from "@/app/git/page-client";
import { getGitChurnDashboard, getRecentCommitDiffs } from "@/lib/mobile/gitChurn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function GitDesktopPage() {
  const datasets: GitDashboardBundle = {
    "3": getGitChurnDashboard({ sinceDays: 3, maxCommits: 120 }),
    "5": getGitChurnDashboard({ sinceDays: 5, maxCommits: 150 }),
    "7": getGitChurnDashboard({ sinceDays: 7, maxCommits: 180 }),
    "30": getGitChurnDashboard({ sinceDays: 30, maxCommits: 360 }),
    all: getGitChurnDashboard({ sinceDays: "all", maxCommits: 3000 }),
  };
  const recentDiffs = getRecentCommitDiffs({
    count: 6,
    maxFilesPerCommit: 8,
    maxPatchCharsPerFile: 10000,
  });

  return <GitDashboardClient datasets={datasets} recentDiffs={recentDiffs} />;
}
