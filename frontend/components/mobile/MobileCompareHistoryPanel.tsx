"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  deleteMobileCompareHistoryCleanup,
  deleteMobileCompareSessionsBatch,
  listMobileCompareSessions,
  previewMobileCompareHistoryCleanup,
  type MobileCompareHistoryCleanupPreviewResponse,
  type MobileCompareSession,
} from "@/lib/api";
import MobileHistoryCleanupSheet from "@/components/mobile/MobileHistoryCleanupSheet";

const SWIPE_ACTION_WIDTH = 84;
const SWIPE_ACTION_TOTAL = SWIPE_ACTION_WIDTH;
const SWIPE_OPEN_RATIO = 0.42;
const SWIPE_FAST_OPEN_VELOCITY = -0.32;
const SWIPE_FAST_CLOSE_VELOCITY = 0.28;
const SWIPE_RUBBER_FACTOR = 0.2;

type ConfirmDeleteState = {
  ids: string[];
  title: string;
  message: string;
} | null;

type DragState = {
  sessionId: string;
  pointerId: number;
  startX: number;
  startY: number;
  baseOffset: number;
  lastX: number;
  lastTs: number;
  velocityX: number;
  lock: "pending" | "horizontal" | "vertical";
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function decisionLabel(decision?: string | null): string {
  if (decision === "keep") return "继续用";
  if (decision === "switch") return "建议换";
  if (decision === "hybrid") return "分场景";
  return "进行中";
}

function cleanupStatusLabel(value: "running" | "done" | "failed"): string {
  if (value === "done") return "已完成";
  if (value === "failed") return "失败";
  return "进行中";
}

function sortSessions(items: MobileCompareSession[]): MobileCompareSession[] {
  return [...items].sort((a, b) => {
    const updatedDiff = String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
    if (updatedDiff !== 0) return updatedDiff;
    const createdDiff = String(b.created_at || "").localeCompare(String(a.created_at || ""));
    if (createdDiff !== 0) return createdDiff;
    return String(b.compare_id || "").localeCompare(String(a.compare_id || ""));
  });
}

function sessionById(entries: MobileCompareSession[], compareId: string): MobileCompareSession | null {
  return entries.find((item) => item.compare_id === compareId) || null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function applyRubberBand(value: number, min: number, max: number): number {
  if (value < min) return min - (min - value) * SWIPE_RUBBER_FACTOR;
  if (value > max) return max + (value - max) * SWIPE_RUBBER_FACTOR;
  return value;
}

function swipeProgressFromOffset(offset: number): number {
  return clamp(-offset / SWIPE_ACTION_TOTAL, 0, 1);
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export default function MobileCompareHistoryPanel() {
  const [entries, setEntries] = useState<MobileCompareSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<ConfirmDeleteState>(null);
  const [error, setError] = useState<string | null>(null);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [cleanupDays, setCleanupDays] = useState(90);
  const [cleanupStatuses, setCleanupStatuses] = useState<Array<"running" | "done" | "failed">>(["done", "failed"]);
  const [cleanupPreview, setCleanupPreview] = useState<MobileCompareHistoryCleanupPreviewResponse | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupApplying, setCleanupApplying] = useState(false);
  const dragRef = useRef<DragState | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const sessions = await listMobileCompareSessions({ limit: 80, offset: 0 });
      setEntries(sortSessions(sessions));
    } catch (err) {
      setEntries([]);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void load();
      }
    };
    const onFocus = () => {
      void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const valid = new Set(entries.map((item) => item.compare_id));
      return prev.filter((id) => valid.has(id));
    });
  }, [entries]);

  useEffect(() => {
    if (!selectionMode) return;
    setOpenRowId(null);
    setDraggingId(null);
    setDragOffset(0);
    dragRef.current = null;
  }, [selectionMode]);

  const selectedCount = selectedIds.length;

  const toggleSelected = useCallback((compareId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(compareId)) return prev.filter((id) => id !== compareId);
      return [...prev, compareId];
    });
  }, []);

  const handleDeleteConfirmed = useCallback(async () => {
    if (!confirmDelete || confirmDelete.ids.length === 0) return;
    try {
      setDeleting(true);
      setError(null);
      const result = await deleteMobileCompareSessionsBatch({ ids: confirmDelete.ids });
      if (result.deleted_ids.length > 0) {
        const deleted = new Set(result.deleted_ids);
        setEntries((prev) => prev.filter((item) => !deleted.has(item.compare_id)));
        setSelectedIds((prev) => prev.filter((id) => !deleted.has(id)));
      }
      if (result.forbidden_ids.length > 0) {
        setError(`有 ${result.forbidden_ids.length} 条记录不属于当前设备，未删除。`);
      } else if (result.deleted_ids.length === 0) {
        setError("没有可删除的记录。");
      }
      setOpenRowId(null);
      setConfirmDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  }, [confirmDelete]);

  const askDeleteSingle = useCallback(
    (compareId: string) => {
      const target = sessionById(entries, compareId);
      if (!target) return;
      const title = "删除这条对比记录？";
      const message = `${target.result?.headline || target.message || "对比记录"} (${target.category})`;
      setConfirmDelete({ ids: [compareId], title, message });
    },
    [entries],
  );

  const askDeleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    setConfirmDelete({
      ids: [...selectedIds],
      title: `删除已选 ${selectedIds.length} 条记录？`,
      message: "删除后无法恢复。",
    });
  }, [selectedIds]);

  const toggleCleanupStatus = useCallback((status: "running" | "done" | "failed") => {
    setCleanupStatuses((prev) => {
      if (prev.includes(status)) return prev.filter((item) => item !== status);
      return [...prev, status];
    });
  }, []);

  const handleCleanupPreview = useCallback(async () => {
    if (cleanupStatuses.length === 0) {
      setError("至少选择一种状态。");
      return;
    }
    try {
      setCleanupLoading(true);
      setError(null);
      setNotice(null);
      const preview = await previewMobileCompareHistoryCleanup({
        older_than_days: cleanupDays,
        statuses: cleanupStatuses,
        limit_preview: 12,
      });
      setCleanupPreview(preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCleanupLoading(false);
    }
  }, [cleanupDays, cleanupStatuses]);

  const handleCleanupApply = useCallback(async () => {
    if (!cleanupPreview) {
      setError("请先预览命中的陈旧记录。");
      return;
    }
    try {
      setCleanupApplying(true);
      setError(null);
      const result = await deleteMobileCompareHistoryCleanup({
        older_than_days: cleanupDays,
        statuses: cleanupStatuses,
        limit_preview: 12,
      });
      setCleanupOpen(false);
      setCleanupPreview(null);
      setSelectionMode(false);
      setSelectedIds([]);
      setNotice(`已清理 ${result.deleted_ids.length} 条历史对比记录。`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCleanupApplying(false);
    }
  }, [cleanupDays, cleanupPreview, cleanupStatuses, load]);

  const cleanupSummary = useMemo(() => {
    if (!cleanupPreview) return null;
    return `命中 ${cleanupPreview.matched_count} 条 ${cleanupDays} 天前的记录；状态：${cleanupPreview.statuses.map(cleanupStatusLabel).join(" / ")}。`;
  }, [cleanupDays, cleanupPreview]);

  const cleanupPreviewItems = useMemo(
    () =>
      (cleanupPreview?.sample || []).map((item) => ({
        id: item.compare_id,
        title: `${item.category} · ${cleanupStatusLabel(item.status)}`,
        meta: `${formatTime(item.updated_at)} · ${item.message || item.compare_id}`,
      })),
    [cleanupPreview],
  );

  const closeSwipe = useCallback(() => {
    setOpenRowId(null);
    setDraggingId(null);
    setDragOffset(0);
    dragRef.current = null;
  }, []);

  const finishDrag = useCallback(() => {
    const current = dragRef.current;
    dragRef.current = null;
    if (!current) {
      setDraggingId(null);
      setDragOffset(0);
      return;
    }
    if (current.lock !== "horizontal") {
      setDraggingId(null);
      setDragOffset(0);
      return;
    }
    const finalOffset = clamp(dragOffset, -SWIPE_ACTION_TOTAL, 0);
    const shouldOpen =
      current.velocityX <= SWIPE_FAST_OPEN_VELOCITY ||
      (current.velocityX < SWIPE_FAST_CLOSE_VELOCITY && finalOffset <= -(SWIPE_ACTION_TOTAL * SWIPE_OPEN_RATIO));
    setOpenRowId(shouldOpen ? current.sessionId : null);
    setDraggingId(null);
    setDragOffset(0);
  }, [dragOffset]);

  const onPointerDown = useCallback(
    (compareId: string, event: ReactPointerEvent<HTMLElement>) => {
      if (selectionMode || deleting || Boolean(confirmDelete)) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;

      const currentTarget = event.currentTarget;
      currentTarget.setPointerCapture(event.pointerId);
      const baseOffset = openRowId === compareId ? -SWIPE_ACTION_TOTAL : 0;
      dragRef.current = {
        sessionId: compareId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        baseOffset,
        lastX: event.clientX,
        lastTs: performance.now(),
        velocityX: 0,
        lock: "pending",
      };
      setDraggingId(compareId);
      setDragOffset(baseOffset);
      if (openRowId && openRowId !== compareId) {
        setOpenRowId(null);
      }
    },
    [confirmDelete, deleting, openRowId, selectionMode],
  );

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const current = dragRef.current;
    if (!current) return;
    if (current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;

    if (current.lock === "pending") {
      if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return;
      current.lock = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      dragRef.current = current;
    }

    if (current.lock === "vertical") return;

    event.preventDefault();
    const now = performance.now();
    const dt = Math.max(1, now - current.lastTs);
    current.velocityX = (event.clientX - current.lastX) / dt;
    current.lastX = event.clientX;
    current.lastTs = now;
    dragRef.current = current;

    const rawNext = current.baseOffset + dx;
    const next = applyRubberBand(rawNext, -SWIPE_ACTION_TOTAL, 0);
    setDragOffset(next);
  }, []);

  const rowOffset = useCallback(
    (compareId: string) => {
      if (selectionMode) return 0;
      if (draggingId === compareId) return dragOffset;
      if (openRowId === compareId) return -SWIPE_ACTION_TOTAL;
      return 0;
    },
    [dragOffset, draggingId, openRowId, selectionMode],
  );

  const selectableHint = useMemo(() => {
    if (!selectionMode) return "";
    if (selectedCount === 0) return "点击记录可多选，右下角垃圾桶批量删除。";
    return `已选择 ${selectedCount} 条记录。`;
  }, [selectedCount, selectionMode]);

  return (
    <section className="m-me-page relative pb-28" onClick={() => {
      if (openRowId && !selectionMode) closeSwipe();
    }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[30px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/90">历史对比</h1>
          <p className="mt-3 text-[15px] leading-[1.55] text-black/60">这里展示当前设备完成过的横向对比记录。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setSelectionMode((prev) => !prev);
              setSelectedIds([]);
            }}
            disabled={loading || entries.length === 0 || deleting}
            className="inline-flex h-9 items-center rounded-full border border-black/15 bg-[rgba(255,255,255,0.62)] px-4 text-[13px] font-medium text-black/78 backdrop-blur disabled:opacity-40 active:bg-[rgba(24,36,58,0.05)] dark:border-[rgba(122,158,214,0.34)] dark:bg-[rgba(42,55,82,0.66)] dark:text-[rgba(220,233,252,0.9)] dark:active:bg-[rgba(70,102,153,0.34)]"
          >
            {selectionMode ? "完成" : "多选"}
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setCleanupOpen(true);
            }}
            disabled={loading || deleting || entries.length === 0}
            className="inline-flex h-9 items-center rounded-full border border-black/15 bg-[rgba(255,255,255,0.62)] px-4 text-[13px] font-medium text-black/78 backdrop-blur disabled:opacity-40"
          >
            清理旧记录
          </button>
        </div>
      </div>

      {selectionMode ? <div className="mt-3 text-[12px] text-black/48">{selectableHint}</div> : null}

      <div className="mt-6 space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-black/10 bg-white px-4 py-4 text-[14px] text-black/55">正在加载记录...</div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-[#ff8f8f]/45 bg-[#ff5f5f]/10 px-4 py-4 text-[14px] text-[#b53a3a]">操作失败：{error}</div>
        ) : null}

        {notice ? (
          <div className="rounded-2xl border border-[#b7e2c6] bg-[#effaf3] px-4 py-4 text-[14px] text-[#1f6a4e]">{notice}</div>
        ) : null}

        {!loading && entries.length === 0 ? (
          <div className="rounded-2xl border border-black/10 bg-white px-4 py-4 text-[14px] text-black/55">
            还没有对比记录。先去横向对比完成一次分析。
          </div>
        ) : null}

        {!loading
          ? entries.map((entry) => {
              const checked = selectedIds.includes(entry.compare_id);
              const offset = rowOffset(entry.compare_id);
              const showingAction = openRowId === entry.compare_id && !selectionMode;
              const swipeProgress = swipeProgressFromOffset(offset);
              const actionOpacity = swipeProgress <= 0.08 ? 0 : (swipeProgress - 0.08) / 0.92;
              const actionShift = (1 - swipeProgress) * 18;
              const actionVisible = !selectionMode && swipeProgress > 0.01;
              const actionInteractive = !selectionMode && swipeProgress > 0.38;

              return (
                <div
                  key={entry.compare_id}
                  className="relative overflow-hidden rounded-[24px]"
                  onClick={(event) => event.stopPropagation()}
                >
                  {!selectionMode ? (
                    <div
                      className={`m-me-swipe-track absolute inset-y-0 right-0 z-0 flex rounded-r-[24px] ${
                        actionVisible ? "" : "pointer-events-none"
                      }`}
                      style={{
                        opacity: clamp(actionOpacity, 0, 1),
                        transform: `translate3d(${actionShift}px,0,0)`,
                        transition: draggingId === entry.compare_id ? "none" : "opacity 180ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
                        pointerEvents: actionInteractive ? "auto" : "none",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setOpenRowId(null);
                          setDraggingId(null);
                          setDragOffset(0);
                          dragRef.current = null;
                          askDeleteSingle(entry.compare_id);
                        }}
                        disabled={deleting}
                        className="m-me-swipe-action m-me-swipe-action-delete flex w-[84px] items-center justify-center text-[13px] font-semibold disabled:opacity-55"
                      >
                        删除
                      </button>
                    </div>
                  ) : null}

                  <article
                    onPointerDown={(event) => onPointerDown(entry.compare_id, event)}
                    onPointerMove={onPointerMove}
                    onPointerUp={finishDrag}
                    onPointerCancel={finishDrag}
                    onClick={() => {
                      if (selectionMode) {
                        toggleSelected(entry.compare_id);
                        return;
                      }
                      if (showingAction) {
                        closeSwipe();
                      }
                    }}
                    style={{
                      transform: `translate3d(${offset}px, 0, 0)`,
                      transition:
                        draggingId === entry.compare_id
                          ? "none"
                          : "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                    className={`m-me-record-card relative z-10 rounded-[24px] border px-4 py-4 ${
                      checked ? "border-[#6f9dff]/60 ring-2 ring-[#6f9dff]/20" : "border-black/10"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {selectionMode ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleSelected(entry.compare_id);
                            }}
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[12px] ${
                              checked
                                ? "border-[#0a84ff] bg-[#0a84ff] text-white shadow-[0_0_0_2px_rgba(10,132,255,0.2)]"
                                : "border-black/22 bg-white text-black/40"
                            }`}
                            aria-label={`选择记录 ${entry.compare_id}`}
                          >
                            {checked ? "✓" : ""}
                          </button>
                        ) : null}
                        <span className="inline-flex h-7 items-center rounded-full bg-black/[0.06] px-3 text-[12px] text-black/72">
                          {entry.category} · {entry.status}
                        </span>
                      </div>
                      <span className="text-[12px] text-black/45">{formatTime(entry.updated_at)}</span>
                    </div>

                    <h2 className="mt-3 text-[17px] font-semibold leading-[1.35] text-black/88">
                      {entry.result?.headline || entry.message || "对比进行中"}
                    </h2>
                    <p className="mt-2 text-[13px] leading-[1.5] text-black/60">
                      结论：{decisionLabel(entry.result?.decision)} · 置信度 {Math.round((entry.result?.confidence || 0) * 100)}%
                    </p>

                    {!selectionMode ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          href={`/m/compare/result/${encodeURIComponent(entry.compare_id)}`}
                          className="inline-flex h-9 items-center rounded-full border border-black/15 px-4 text-[13px] font-medium text-black/78 active:bg-black/[0.03]"
                        >
                          查看结果
                        </Link>
                        <Link
                          href={`/m/compare?category=${encodeURIComponent(String(entry.category || ""))}`}
                          className="inline-flex h-9 items-center rounded-full border border-black/15 px-4 text-[13px] font-medium text-black/78 active:bg-black/[0.03]"
                        >
                          再做一次
                        </Link>
                      </div>
                    ) : null}
                  </article>
                </div>
              );
            })
          : null}
      </div>

      {selectionMode ? (
        <button
          type="button"
          onClick={askDeleteSelected}
          disabled={selectedCount === 0 || deleting}
          className="fixed bottom-[112px] right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full border border-[#ff3b30]/28 bg-[#ff3b30] text-white shadow-[0_10px_26px_rgba(255,59,48,0.33)] transition-transform duration-200 active:scale-[0.96] disabled:opacity-45"
          aria-label="删除已选记录"
        >
          <TrashIcon />
        </button>
      ) : null}

      {confirmDelete ? (
        <div
          className="fixed inset-0 z-[120] flex items-end bg-[rgba(6,10,18,0.52)] px-4 pb-5 backdrop-blur-[1.5px]"
          onClick={() => {
            if (deleting) return;
            setConfirmDelete(null);
          }}
        >
          <div
            className="w-full rounded-[28px] border border-[rgba(255,255,255,0.42)] bg-[rgba(255,255,255,0.94)] p-4 shadow-[0_16px_42px_rgba(0,0,0,0.28)] dark:border-[rgba(130,166,224,0.3)] dark:bg-[rgba(19,30,47,0.96)] dark:shadow-[0_20px_52px_rgba(0,0,0,0.54)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-2 text-center">
              <div className="text-[18px] font-semibold tracking-[-0.01em] text-black/90">{confirmDelete.title}</div>
              <div className="mt-2 text-[13px] leading-[1.5] text-black/58">{confirmDelete.message}</div>
            </div>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => {
                  void handleDeleteConfirmed();
                }}
                disabled={deleting}
                className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[#ff3b30] text-[15px] font-semibold text-white disabled:opacity-55"
              >
                {deleting ? "删除中..." : "确认删除"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-[rgba(23,35,55,0.14)] bg-[rgba(255,255,255,0.94)] text-[15px] font-medium text-black/78 disabled:opacity-55 dark:border-[rgba(122,157,214,0.34)] dark:bg-[rgba(31,47,74,0.9)] dark:text-[rgba(216,230,252,0.92)]"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <MobileHistoryCleanupSheet
        open={cleanupOpen}
        title="清理陈旧对比记录"
        description="先预览，再批量删除。默认只清理较早的已完成 / 失败记录，不碰近期记录。"
        days={cleanupDays}
        onDaysChange={(value) => {
          setCleanupDays(value);
          setCleanupPreview(null);
        }}
        filterControls={
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-black/45">状态</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["done", "failed", "running"] as const).map((status) => {
                const active = cleanupStatuses.includes(status);
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      toggleCleanupStatus(status);
                      setCleanupPreview(null);
                    }}
                    className={`inline-flex h-9 items-center rounded-full border px-4 text-[13px] font-medium ${
                      active ? "border-black bg-black text-white" : "border-black/10 bg-white text-black/68"
                    }`}
                  >
                    {cleanupStatusLabel(status)}
                  </button>
                );
              })}
            </div>
          </div>
        }
        previewSummary={cleanupSummary}
        previewItems={cleanupPreviewItems}
        previewLoading={cleanupLoading}
        applying={cleanupApplying}
        onPreview={() => {
          void handleCleanupPreview();
        }}
        onApply={() => {
          void handleCleanupApply();
        }}
        onClose={() => {
          if (cleanupLoading || cleanupApplying) return;
          setCleanupOpen(false);
        }}
      />
    </section>
  );
}
