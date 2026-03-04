import GitDashboardClient, { type GitDashboardBundle } from "@/app/git/page-client";
import { getGitChurnDashboard } from "@/lib/mobile/gitChurn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function GitDesktopPage() {
  const datasets: GitDashboardBundle = {
    "7": getGitChurnDashboard({ sinceDays: 7, maxCommits: 180 }),
    "30": getGitChurnDashboard({ sinceDays: 30, maxCommits: 360 }),
    "90": getGitChurnDashboard({ sinceDays: 90, maxCommits: 720 }),
  };

  return <GitDashboardClient datasets={datasets} />;
}
