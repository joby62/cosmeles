import "server-only";

import { execFileSync } from "node:child_process";

export type GitModuleBucket = "mobile" | "backend" | "infra" | "mixed";

export type GitChurnCommit = {
  hash: string;
  dateIso: string;
  dayKey: string;
  hour: number;
  weekday: number;
  subject: string;
  insertions: number;
  deletions: number;
  files: number;
  module: GitModuleBucket;
};

export type GitChurnDay = {
  day: string;
  commits: number;
  insertions: number;
  deletions: number;
  net: number;
};

export type GitChurnModuleTotal = {
  commits: number;
  insertions: number;
  deletions: number;
  net: number;
};

export type GitChurnDashboard = {
  available: boolean;
  error: string | null;
  generatedAtIso: string;
  sinceDays: number;
  totals: {
    commits: number;
    insertions: number;
    deletions: number;
    net: number;
    files: number;
  };
  moduleTotals: Record<GitModuleBucket, GitChurnModuleTotal>;
  daily: GitChurnDay[];
  heatmap: number[][];
  commits: GitChurnCommit[];
};

export type GitRecentDiffFile = {
  path: string;
  insertions: number;
  deletions: number;
  isBinary: boolean;
  patch: string | null;
};

export type GitRecentDiffCommit = {
  hash: string;
  shortHash: string;
  dateIso: string;
  author: string;
  subject: string;
  files: GitRecentDiffFile[];
};

export type GitBranchRef = {
  ref: string;
  label: string;
};

type GitChurnOptions = {
  sinceDays?: number | "all";
  maxCommits?: number;
  ref?: string;
};

type GitRecentDiffOptions = {
  count?: number;
  maxFilesPerCommit?: number;
  maxPatchCharsPerFile?: number;
  ref?: string;
};

type MutableCommitState = {
  hash: string;
  dateIso: string;
  subject: string;
  insertions: number;
  deletions: number;
  files: number;
  touchedMobile: boolean;
  touchedBackend: boolean;
  touchedInfra: boolean;
};

const COMMIT_PREFIX = "__COMMIT__";
const MOBILE_PREFIXES = ["frontend/app/m/", "frontend/components/mobile/", "frontend/lib/mobile/"] as const;
const DEFAULT_BRANCH_PRIORITY = ["origin/main", "main"] as const;
const GIT_REPO_DIR = (process.env.GIT_REPO_DIR || "").trim() || process.cwd();

function runGit(args: string[], maxBuffer = 16 * 1024 * 1024): string {
  return execFileSync("git", args, {
    cwd: GIT_REPO_DIR,
    encoding: "utf8",
    maxBuffer,
  });
}

function normalizeBranchLabel(ref: string, hasOriginMain: boolean): string {
  if (ref === "origin/main") return "main";
  if (ref === "main" && hasOriginMain) return "main (local)";
  if (ref.startsWith("origin/")) return `${ref.slice("origin/".length)} (origin)`;
  return ref;
}

function branchPriority(ref: string): number {
  const fixed = DEFAULT_BRANCH_PRIORITY.indexOf(ref as (typeof DEFAULT_BRANCH_PRIORITY)[number]);
  if (fixed >= 0) return fixed;
  if (ref.startsWith("origin/")) return 10;
  return 20;
}

function parsePatchSections(
  patchRaw: string,
  maxFilesPerCommit: number,
  maxPatchCharsPerFile: number,
): GitRecentDiffFile[] {
  type MutableSection = {
    path: string;
    lines: string[];
    insertions: number;
    deletions: number;
    isBinary: boolean;
  };
  const sections: MutableSection[] = [];
  let current: MutableSection | null = null;

  function finalizeCurrent() {
    if (!current) return;
    sections.push(current);
    current = null;
  }

  const lines = patchRaw.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      finalizeCurrent();
      const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
      const fromPath = match?.[1] ?? "unknown";
      const toPath = match?.[2] ?? "unknown";
      const path = toPath !== "/dev/null" ? toPath : fromPath;
      current = {
        path,
        lines: [line],
        insertions: 0,
        deletions: 0,
        isBinary: false,
      };
      continue;
    }

    if (!current) continue;
    current.lines.push(line);
    if (line.startsWith("Binary files ") || line === "GIT binary patch") {
      current.isBinary = true;
      continue;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      current.insertions += 1;
      continue;
    }
    if (line.startsWith("-") && !line.startsWith("---")) {
      current.deletions += 1;
    }
  }
  finalizeCurrent();

  return sections.slice(0, maxFilesPerCommit).map((section) => {
    const patch = section.lines.join("\n");
    return {
      path: section.path,
      insertions: section.insertions,
      deletions: section.deletions,
      isBinary: section.isBinary,
      patch:
        patch.length > maxPatchCharsPerFile
          ? `${patch.slice(0, maxPatchCharsPerFile)}\n... (truncated)`
          : patch,
    };
  });
}

export function getGitBranchRefs(): GitBranchRef[] {
  let output = "";
  try {
    output = runGit(["for-each-ref", "--format=%(refname:short)", "refs/heads", "refs/remotes"], 4 * 1024 * 1024);
  } catch {
    return [{ ref: "HEAD", label: "HEAD" }];
  }

  const refs = output
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((ref) => ref !== "origin/HEAD" && !ref.endsWith("/HEAD"));

  const uniq = Array.from(new Set(refs));
  uniq.sort((a, b) => {
    const pa = branchPriority(a);
    const pb = branchPriority(b);
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b);
  });

  const hasOriginMain = uniq.includes("origin/main");
  return uniq.map((ref) => ({
    ref,
    label: normalizeBranchLabel(ref, hasOriginMain),
  }));
}

function emptyModuleTotal(): GitChurnModuleTotal {
  return { commits: 0, insertions: 0, deletions: 0, net: 0 };
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDayOffset(date: Date, offset: number): Date {
  const next = startOfDay(date);
  next.setDate(next.getDate() + offset);
  return next;
}

function formatDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseCommitHead(line: string): { hash: string; dateIso: string; subject: string } | null {
  if (!line.startsWith(COMMIT_PREFIX)) return null;
  const raw = line.slice(COMMIT_PREFIX.length);
  const firstBar = raw.indexOf("|");
  const secondBar = raw.indexOf("|", firstBar + 1);
  if (firstBar <= 0 || secondBar <= firstBar) return null;
  return {
    hash: raw.slice(0, firstBar),
    dateIso: raw.slice(firstBar + 1, secondBar),
    subject: raw.slice(secondBar + 1),
  };
}

function parseNumstat(line: string): { insertions: number; deletions: number; path: string } | null {
  if (!line || line.startsWith(COMMIT_PREFIX)) return null;
  const parts = line.split("\t");
  if (parts.length < 3) return null;
  const insertions = Number.parseInt(parts[0], 10);
  const deletions = Number.parseInt(parts[1], 10);
  return {
    insertions: Number.isFinite(insertions) ? insertions : 0,
    deletions: Number.isFinite(deletions) ? deletions : 0,
    path: parts.slice(2).join("\t"),
  };
}

function bucketByTouchedPath(path: string, state: MutableCommitState): void {
  if (MOBILE_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    state.touchedMobile = true;
    return;
  }
  if (path.startsWith("backend/")) {
    state.touchedBackend = true;
    return;
  }
  state.touchedInfra = true;
}

function finalizeState(state: MutableCommitState | null): GitChurnCommit | null {
  if (!state) return null;
  const date = new Date(state.dateIso);
  const validDate = Number.isNaN(date.getTime()) ? new Date(0) : date;
  let bucket: GitModuleBucket = "infra";
  if (state.touchedMobile && !state.touchedBackend && !state.touchedInfra) {
    bucket = "mobile";
  } else if (!state.touchedMobile && state.touchedBackend && !state.touchedInfra) {
    bucket = "backend";
  } else if (!state.touchedMobile && !state.touchedBackend && state.touchedInfra) {
    bucket = "infra";
  } else if (state.touchedMobile || state.touchedBackend || state.touchedInfra) {
    bucket = "mixed";
  }
  return {
    hash: state.hash,
    dateIso: state.dateIso,
    dayKey: formatDayKey(validDate),
    hour: validDate.getHours(),
    weekday: validDate.getDay(),
    subject: state.subject,
    insertions: state.insertions,
    deletions: state.deletions,
    files: state.files,
    module: bucket,
  };
}

function parseCommitMeta(line: string): {
  hash: string;
  dateIso: string;
  author: string;
  subject: string;
} | null {
  const first = line.indexOf("|");
  const second = line.indexOf("|", first + 1);
  const third = line.indexOf("|", second + 1);
  if (first <= 0 || second <= first || third <= second) return null;
  return {
    hash: line.slice(0, first),
    dateIso: line.slice(first + 1, second),
    author: line.slice(second + 1, third),
    subject: line.slice(third + 1),
  };
}

export function getGitChurnDashboard(options: GitChurnOptions = {}): GitChurnDashboard {
  const useAllHistory = options.sinceDays === "all";
  const sinceDaysInput = typeof options.sinceDays === "number" ? options.sinceDays : 30;
  const sinceDays = useAllHistory ? 0 : Math.max(1, Math.floor(sinceDaysInput));
  const maxCommits = Math.max(20, Math.floor(options.maxCommits ?? 140));
  const ref = options.ref?.trim();
  const generatedAt = new Date();
  const generatedAtIso = generatedAt.toISOString();

  const base: GitChurnDashboard = {
    available: false,
    error: null,
    generatedAtIso,
    sinceDays,
    totals: { commits: 0, insertions: 0, deletions: 0, net: 0, files: 0 },
    moduleTotals: {
      mobile: emptyModuleTotal(),
      backend: emptyModuleTotal(),
      infra: emptyModuleTotal(),
      mixed: emptyModuleTotal(),
    },
    daily: [],
    heatmap: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0)),
    commits: [],
  };

  let stdout = "";
  try {
    const args = [
      "log",
      ...(ref ? [ref] : []),
      ...(useAllHistory ? [] : [`--since=${sinceDays} days ago`]),
      `--max-count=${maxCommits}`,
      "--date=iso-strict",
      `--pretty=format:${COMMIT_PREFIX}%H|%ad|%s`,
      "--numstat",
      "--",
    ];
    stdout = runGit(args);
  } catch (error) {
    return {
      ...base,
      error: error instanceof Error ? error.message : "无法读取 git 历史。",
    };
  }

  const lines = stdout.split(/\r?\n/);
  const commits: GitChurnCommit[] = [];
  let current: MutableCommitState | null = null;

  for (const line of lines) {
    const commitHead = parseCommitHead(line);
    if (commitHead) {
      const finished = finalizeState(current);
      if (finished) commits.push(finished);
      current = {
        hash: commitHead.hash,
        dateIso: commitHead.dateIso,
        subject: commitHead.subject,
        insertions: 0,
        deletions: 0,
        files: 0,
        touchedMobile: false,
        touchedBackend: false,
        touchedInfra: false,
      };
      continue;
    }

    if (!current) continue;
    const row = parseNumstat(line);
    if (!row) continue;
    current.insertions += row.insertions;
    current.deletions += row.deletions;
    current.files += 1;
    bucketByTouchedPath(row.path, current);
  }
  const tail = finalizeState(current);
  if (tail) commits.push(tail);

  const rangeStartDayKey = useAllHistory ? null : formatDayKey(addDayOffset(generatedAt, -(sinceDays - 1)));
  const rangeEndDayKey = useAllHistory ? null : formatDayKey(startOfDay(generatedAt));
  const scopedCommits =
    useAllHistory || !rangeStartDayKey || !rangeEndDayKey
      ? commits
      : commits.filter((commit) => commit.dayKey >= rangeStartDayKey && commit.dayKey <= rangeEndDayKey);

  const dailyMap = new Map<string, GitChurnDay>();
  const heatmap = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  const moduleTotals: Record<GitModuleBucket, GitChurnModuleTotal> = {
    mobile: emptyModuleTotal(),
    backend: emptyModuleTotal(),
    infra: emptyModuleTotal(),
    mixed: emptyModuleTotal(),
  };

  let totalInsertions = 0;
  let totalDeletions = 0;
  let totalFiles = 0;

  for (const commit of scopedCommits) {
    totalInsertions += commit.insertions;
    totalDeletions += commit.deletions;
    totalFiles += commit.files;

    const byModule = moduleTotals[commit.module];
    byModule.commits += 1;
    byModule.insertions += commit.insertions;
    byModule.deletions += commit.deletions;
    byModule.net = byModule.insertions - byModule.deletions;

    const day = dailyMap.get(commit.dayKey) ?? {
      day: commit.dayKey,
      commits: 0,
      insertions: 0,
      deletions: 0,
      net: 0,
    };
    day.commits += 1;
    day.insertions += commit.insertions;
    day.deletions += commit.deletions;
    day.net = day.insertions - day.deletions;
    dailyMap.set(commit.dayKey, day);

    if (commit.weekday >= 0 && commit.weekday < 7 && commit.hour >= 0 && commit.hour < 24) {
      heatmap[commit.weekday][commit.hour] += 1;
    }
  }

  const daily = useAllHistory || !rangeStartDayKey || !rangeEndDayKey
    ? Array.from(dailyMap.values()).sort((a, b) => a.day.localeCompare(b.day))
    : Array.from({ length: sinceDays }, (_, index) => {
        const day = formatDayKey(addDayOffset(generatedAt, -(sinceDays - index - 1)));
        return (
          dailyMap.get(day) ?? {
            day,
            commits: 0,
            insertions: 0,
            deletions: 0,
            net: 0,
          }
        );
      });

  return {
    ...base,
    available: true,
    commits: scopedCommits,
    daily,
    heatmap,
    moduleTotals,
    totals: {
      commits: scopedCommits.length,
      insertions: totalInsertions,
      deletions: totalDeletions,
      net: totalInsertions - totalDeletions,
      files: totalFiles,
    },
  };
}

export function getRecentCommitDiffs(options: GitRecentDiffOptions = {}): GitRecentDiffCommit[] {
  const count = Math.max(1, Math.floor(options.count ?? 5));
  const maxFilesPerCommit = Math.max(1, Math.floor(options.maxFilesPerCommit ?? 8));
  const maxPatchCharsPerFile = Math.max(800, Math.floor(options.maxPatchCharsPerFile ?? 9000));
  const ref = options.ref?.trim();

  let metaOutput = "";
  try {
    metaOutput = runGit(
      [
        "log",
        ...(ref ? [ref] : []),
        "--no-merges",
        `--max-count=${count}`,
        "--date=iso-strict",
        "--pretty=format:%H|%ad|%an|%s",
      ],
      8 * 1024 * 1024,
    );
  } catch {
    return [];
  }

  const commits: GitRecentDiffCommit[] = [];
  const metaLines = metaOutput.split(/\r?\n/).filter(Boolean);

  for (const line of metaLines) {
    const meta = parseCommitMeta(line);
    if (!meta) continue;

    let patchOutput = "";
    try {
      patchOutput = runGit(
        ["show", "--no-color", "--format=", "--unified=2", `${meta.hash}^!`, "--"],
        8 * 1024 * 1024,
      );
    } catch {
      try {
        patchOutput = runGit(
          ["show", "--no-color", "--format=", "--unified=2", meta.hash, "--"],
          8 * 1024 * 1024,
        );
      } catch {
        patchOutput = "";
      }
    }

    const files = parsePatchSections(patchOutput, maxFilesPerCommit, maxPatchCharsPerFile);

    commits.push({
      hash: meta.hash,
      shortHash: meta.hash.slice(0, 7),
      dateIso: meta.dateIso,
      author: meta.author,
      subject: meta.subject,
      files,
    });
  }

  return commits;
}
