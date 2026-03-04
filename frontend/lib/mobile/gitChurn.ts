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

type GitChurnOptions = {
  sinceDays?: number | "all";
  maxCommits?: number;
};

type GitRecentDiffOptions = {
  count?: number;
  maxFilesPerCommit?: number;
  maxPatchCharsPerFile?: number;
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

function emptyModuleTotal(): GitChurnModuleTotal {
  return { commits: 0, insertions: 0, deletions: 0, net: 0 };
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
  const generatedAtIso = new Date().toISOString();

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
      ...(useAllHistory ? [] : [`--since=${sinceDays} days ago`]),
      `--max-count=${maxCommits}`,
      "--date=iso-strict",
      `--pretty=format:${COMMIT_PREFIX}%H|%ad|%s`,
      "--numstat",
      "--",
    ];
    stdout = execFileSync(
      "git",
      args,
      {
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
      },
    );
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

  for (const commit of commits) {
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

  const daily = Array.from(dailyMap.values()).sort((a, b) => a.day.localeCompare(b.day));

  return {
    ...base,
    available: true,
    commits,
    daily,
    heatmap,
    moduleTotals,
    totals: {
      commits: commits.length,
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

  let metaOutput = "";
  try {
    metaOutput = execFileSync(
      "git",
      [
        "log",
        `--max-count=${count}`,
        "--date=iso-strict",
        "--pretty=format:%H|%ad|%an|%s",
      ],
      {
        encoding: "utf8",
        maxBuffer: 8 * 1024 * 1024,
      },
    );
  } catch {
    return [];
  }

  const commits: GitRecentDiffCommit[] = [];
  const metaLines = metaOutput.split(/\r?\n/).filter(Boolean);

  for (const line of metaLines) {
    const meta = parseCommitMeta(line);
    if (!meta) continue;

    let numstatOutput = "";
    try {
      numstatOutput = execFileSync(
        "git",
        ["show", "--no-color", "--format=", "--numstat", meta.hash],
        {
          encoding: "utf8",
          maxBuffer: 8 * 1024 * 1024,
        },
      );
    } catch {
      numstatOutput = "";
    }

    const files: GitRecentDiffFile[] = [];
    const rows = numstatOutput.split(/\r?\n/).filter(Boolean).slice(0, maxFilesPerCommit);
    for (const row of rows) {
      const parts = row.split("\t");
      if (parts.length < 3) continue;
      const insRaw = parts[0];
      const delRaw = parts[1];
      const path = parts.slice(2).join("\t");
      const isBinary = insRaw === "-" || delRaw === "-";
      const insertions = Number.isFinite(Number.parseInt(insRaw, 10)) ? Number.parseInt(insRaw, 10) : 0;
      const deletions = Number.isFinite(Number.parseInt(delRaw, 10)) ? Number.parseInt(delRaw, 10) : 0;

      let patch: string | null = null;
      if (!isBinary) {
        try {
          const patchRaw = execFileSync(
            "git",
            ["show", "--no-color", "--format=", "--unified=2", meta.hash, "--", path],
            {
              encoding: "utf8",
              maxBuffer: 8 * 1024 * 1024,
            },
          );
          if (patchRaw.trim().length > 0) {
            patch =
              patchRaw.length > maxPatchCharsPerFile
                ? `${patchRaw.slice(0, maxPatchCharsPerFile)}\n... (truncated)`
                : patchRaw;
          }
        } catch {
          patch = null;
        }
      }

      files.push({
        path,
        insertions,
        deletions,
        isBinary,
        patch,
      });
    }

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
