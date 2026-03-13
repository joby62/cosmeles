"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  deleteMobileSelectionHistoryCleanup,
  deleteMobileSelectionSessionsBatch,
  listMobileSelectionSessions,
  pinMobileSelectionSession,
  previewMobileSelectionHistoryCleanup,
  type MobileSelectionHistoryCleanupPreviewResponse,
  type MobileSelectionResolveResponse,
} from "@/lib/api";
import MobileHistoryCleanupSheet from "@/components/mobile/MobileHistoryCleanupSheet";
import {
  appendMobileUtilityRouteState,
  type MobileUtilityRouteState,
} from "@/features/mobile-utility/routeState";
import { describeMobileRouteFocus, getMobileCategoryLabel } from "@/lib/mobile/routeCopy";

const SWIPE_ACTION_WIDTH = 84;
const SWIPE_ACTION_TOTAL = SWIPE_ACTION_WIDTH * 2;
const SWIPE_OPEN_RATIO = 0.46;
const SWIPE_FAST_OPEN_VELOCITY = -0.38;
const SWIPE_FAST_CLOSE_VELOCITY = 0.34;
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

function sortSessions(items: MobileSelectionResolveResponse[]): MobileSelectionResolveResponse[] {
  return [...items].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    const aPinned = a.pinned_at || "";
    const bPinned = b.pinned_at || "";
    if (aPinned !== bPinned) return bPinned.localeCompare(aPinned);
    return String(b.created_at || "").localeCompare(String(a.created_at || ""));
  });
}

function sessionById(
  entries: MobileSelectionResolveResponse[],
  sessionId: string,
): MobileSelectionResolveResponse | null {
  return entries.find((item) => item.session_id === sessionId) || null;
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

type Props = {
  routeState?: MobileUtilityRouteState | null;
};

export default function MobileSelectionHistoryPanel({ routeState = null }: Props) {
  const [entries, setEntries] = useState<MobileSelectionResolveResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [pinningId, setPinningId] = useState<string | null>(null);
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
  const [cleanupExcludePinned, setCleanupExcludePinned] = useState(true);
  const [cleanupPreview, setCleanupPreview] = useState<MobileSelectionHistoryCleanupPreviewResponse | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupApplying, setCleanupApplying] = useState(false);
  const dragRef = useRef<DragState | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listMobileSelectionSessions({ limit: 80 });
      setEntries(sortSessions(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setEntries([]);
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
      const valid = new Set(entries.map((item) => item.session_id));
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

  const toggleSelected = useCallback((sessionId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(sessionId)) return prev.filter((id) => id !== sessionId);
      return [...prev, sessionId];
    });
  }, []);

  const handleDeleteConfirmed = useCallback(async () => {
    if (!confirmDelete || confirmDelete.ids.length === 0) return;
    try {
      setDeleting(true);
      setError(null);
      const result = await deleteMobileSelectionSessionsBatch({ ids: confirmDelete.ids });
      if (result.deleted_ids.length > 0) {
        const deleted = new Set(result.deleted_ids);
        setEntries((prev) => prev.filter((item) => !deleted.has(item.session_id)));
        setSelectedIds((prev) => prev.filter((id) => !deleted.has(id)));
      }
      if (result.forbidden_ids.length > 0) {
        setError(`有 ${result.forbidden_ids.length} 条记录不属于当前设备，未删除。`);
      } else if (result.deleted_ids.length === 0) {
        setError("没有可删除的记录。");
      }
      setOpenRowId(null);
      setConfirmDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  }, [confirmDelete]);

  const askDeleteSingle = useCallback(
    (sessionId: string) => {
      const target = sessionById(entries, sessionId);
      if (!target) return;
      const title = "删除这条记录？";
      const message = `${target.route.title} · ${target.recommended_product.brand || "未知品牌"} ${target.recommended_product.name || "未命名产品"}`;
      setConfirmDelete({ ids: [sessionId], title, message });
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

  const handleCleanupPreview = useCallback(async () => {
    try {
      setCleanupLoading(true);
      setError(null);
      setNotice(null);
      const preview = await previewMobileSelectionHistoryCleanup({
        older_than_days: cleanupDays,
        exclude_pinned: cleanupExcludePinned,
        limit_preview: 12,
      });
      setCleanupPreview(preview);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCleanupLoading(false);
    }
  }, [cleanupDays, cleanupExcludePinned]);

  const handleCleanupApply = useCallback(async () => {
    if (!cleanupPreview) {
      setError("请先预览命中的陈旧记录。");
      return;
    }
    try {
      setCleanupApplying(true);
      setError(null);
      const result = await deleteMobileSelectionHistoryCleanup({
        older_than_days: cleanupDays,
        exclude_pinned: cleanupExcludePinned,
        limit_preview: 12,
      });
      setCleanupOpen(false);
      setCleanupPreview(null);
      setSelectionMode(false);
      setSelectedIds([]);
      setNotice(`已清理 ${result.deleted_ids.length} 条历史选择记录。`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCleanupApplying(false);
    }
  }, [cleanupDays, cleanupExcludePinned, cleanupPreview, load]);

  const togglePin = useCallback(
    async (entry: MobileSelectionResolveResponse) => {
      try {
        setPinningId(entry.session_id);
        setError(null);
        const updated = await pinMobileSelectionSession(entry.session_id, {
          pinned: !entry.is_pinned,
        });
        setEntries((prev) =>
          sortSessions(
            prev.map((item) =>
              item.session_id === entry.session_id
                ? { ...item, is_pinned: updated.is_pinned, pinned_at: updated.pinned_at || null }
                : item,
            ),
          ),
        );
        setOpenRowId(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setPinningId(null);
      }
    },
    [],
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
    (sessionId: string, event: ReactPointerEvent<HTMLElement>) => {
      if (selectionMode || deleting || Boolean(confirmDelete)) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;

      const currentTarget = event.currentTarget;
      currentTarget.setPointerCapture(event.pointerId);
      const baseOffset = openRowId === sessionId ? -SWIPE_ACTION_TOTAL : 0;
      dragRef.current = {
        sessionId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        baseOffset,
        lastX: event.clientX,
        lastTs: performance.now(),
        velocityX: 0,
        lock: "pending",
      };
      setDraggingId(sessionId);
      setDragOffset(baseOffset);
      if (openRowId && openRowId !== sessionId) {
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
    (sessionId: string) => {
      if (selectionMode) return 0;
      if (draggingId === sessionId) return dragOffset;
      if (openRowId === sessionId) return -SWIPE_ACTION_TOTAL;
      return 0;
    },
    [dragOffset, draggingId, openRowId, selectionMode],
  );

  const selectableHint = useMemo(() => {
    if (!selectionMode) return "";
    if (selectedCount === 0) return "点击记录可多选，右下角垃圾桶批量删除。";
    return `已选择 ${selectedCount} 条记录。`;
  }, [selectedCount, selectionMode]);

  const cleanupSummary = useMemo(() => {
    if (!cleanupPreview) return null;
    return `命中 ${cleanupPreview.matched_count} 条 ${cleanupDays} 天前的记录${cleanupExcludePinned ? "，已排除置顶" : ""}。`;
  }, [cleanupDays, cleanupExcludePinned, cleanupPreview]);

  const cleanupPreviewItems = useMemo(
    () =>
      (cleanupPreview?.sample || []).map((item) => ({
        id: item.session_id,
        title: `${getMobileCategoryLabel(item.category)} · ${item.route_title}`,
        meta: `${formatTime(item.created_at)}${item.is_pinned ? " · 已置顶" : ""}`,
      })),
    [cleanupPreview],
  );

  return (
    <section className="m-me-page relative pb-28" onClick={() => {
      if (openRowId && !selectionMode) closeSwipe();
    }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[30px] leading-[1.12] font-semibold tracking-[-0.02em] text-black/90">历史选择</h1>
          <p className="mt-3 text-[15px] leading-[1.55] text-black/60">这里展示当前设备的真实推荐记录。</p>
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
            disabled={loading || entries.length === 0 || deleting}
            className="inline-flex h-9 items-center rounded-full border border-black/15 bg-[rgba(255,255,255,0.62)] px-4 text-[13px] font-medium text-black/78 backdrop-blur disabled:opacity-40"
          >
            清理旧记录
          </button>
        </div>
      </div>

      {selectionMode && (
        <div className="mt-3 text-[12px] text-black/48">{selectableHint}</div>
      )}

      <div className="mt-6 space-y-3">
        {loading && (
          <div className="rounded-2xl border border-black/10 bg-white px-4 py-4 text-[14px] text-black/55">
            正在加载记录...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-[#ff8f8f]/45 bg-[#ff5f5f]/10 px-4 py-4 text-[14px] text-[#b53a3a]">
            操作失败：{error}
          </div>
        )}

        {notice && (
          <div className="rounded-2xl border border-[#b7e2c6] bg-[#effaf3] px-4 py-4 text-[14px] text-[#1f6a4e]">
            {notice}
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="rounded-2xl border border-black/10 bg-white px-4 py-4 text-[14px] text-black/55">
            还没有后端记录。完成一次“开始选择”后会自动落库。
          </div>
        )}

        {!loading &&
          entries.map((entry) => {
            const product = entry.recommended_product;
            const categoryLabel = getMobileCategoryLabel(entry.category);
            const routeFocus = describeMobileRouteFocus(entry.category, entry.route.key);
            const checked = selectedIds.includes(entry.session_id);
            const offset = rowOffset(entry.session_id);
            const showingAction = openRowId === entry.session_id && !selectionMode;
            const swipeProgress = swipeProgressFromOffset(offset);
            const actionOpacity = swipeProgress <= 0.08 ? 0 : (swipeProgress - 0.08) / 0.92;
            const actionShift = (1 - swipeProgress) * 18;
            const actionVisible = !selectionMode && swipeProgress > 0.01;
            const actionInteractive = !selectionMode && swipeProgress > 0.38;

            return (
              <div
                key={entry.session_id}
                className="relative overflow-hidden rounded-[24px]"
                onClick={(event) => event.stopPropagation()}
              >
                {!selectionMode && (
                  <div
                    className={`m-me-swipe-track absolute inset-y-0 right-0 z-0 flex rounded-r-[24px] ${
                      actionVisible ? "" : "pointer-events-none"
                    }`}
                    style={{
                      opacity: clamp(actionOpacity, 0, 1),
                      transform: `translate3d(${actionShift}px,0,0)`,
                      transition: draggingId === entry.session_id ? "none" : "opacity 180ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
                      pointerEvents: actionInteractive ? "auto" : "none",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        void togglePin(entry);
                      }}
                      disabled={Boolean(pinningId) || deleting}
                      className="m-me-swipe-action m-me-swipe-action-pin flex w-[84px] items-center justify-center text-[13px] font-semibold disabled:opacity-55"
                    >
                      {pinningId === entry.session_id ? "处理中" : entry.is_pinned ? "取消置顶" : "置顶"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenRowId(null);
                        setDraggingId(null);
                        setDragOffset(0);
                        dragRef.current = null;
                        askDeleteSingle(entry.session_id);
                      }}
                      disabled={deleting}
                      className="m-me-swipe-action m-me-swipe-action-delete flex w-[84px] items-center justify-center text-[13px] font-semibold disabled:opacity-55"
                    >
                      删除
                    </button>
                  </div>
                )}

                <article
                  onPointerDown={(event) => onPointerDown(entry.session_id, event)}
                  onPointerMove={onPointerMove}
                  onPointerUp={finishDrag}
                  onPointerCancel={finishDrag}
                  onClick={() => {
                    if (selectionMode) {
                      toggleSelected(entry.session_id);
                      return;
                    }
                    if (showingAction) {
                      closeSwipe();
                    }
                  }}
                  style={{
                    transform: `translate3d(${offset}px, 0, 0)`,
                    transition:
                      draggingId === entry.session_id
                        ? "none"
                        : "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
                  }}
                  className={`m-me-record-card relative z-10 rounded-[24px] border px-4 py-4 ${
                    checked ? "border-[#6f9dff]/60 ring-2 ring-[#6f9dff]/20" : "border-black/10"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {selectionMode && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleSelected(entry.session_id);
                          }}
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-[12px] ${
                            checked
                              ? "border-[#0a84ff] bg-[#0a84ff] text-white shadow-[0_0_0_2px_rgba(10,132,255,0.2)]"
                              : "border-black/22 bg-white text-black/40"
                          }`}
                          aria-label={`选择记录 ${entry.session_id}`}
                        >
                          {checked ? "✓" : ""}
                        </button>
                      )}
                      <span className="inline-flex h-7 items-center rounded-full bg-black/[0.06] px-3 text-[12px] text-black/72">
                        {categoryLabel} · {entry.route.title}
                      </span>
                      {entry.is_pinned && (
                        <span className="inline-flex h-7 items-center rounded-full border border-[#ff9f0a]/35 bg-[#ff9f0a]/12 px-3 text-[12px] font-medium text-[#b06b00]">
                          已置顶
                        </span>
                      )}
                    </div>
                    <span className="text-[12px] text-black/45">{formatTime(entry.created_at)}</span>
                  </div>

                  <h2 className="mt-3 text-[17px] font-semibold leading-[1.35] text-black/88">
                    {product.brand || "未知品牌"} {product.name || "未命名产品"}
                  </h2>
                  <p className="mt-2 text-[13px] leading-[1.6] text-black/62">{routeFocus}</p>
                  <p className="mt-2 text-[12px] leading-[1.5] text-black/48">
                    规则版本 {entry.rules_version}
                    {entry.reused ? " · 复用同一答案结果" : ""}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {entry.choices.slice(0, 3).map((item) => (
                      <span
                        key={`${entry.session_id}-${item.key}-${item.value}`}
                        className="inline-flex max-w-full items-center rounded-full bg-black/[0.04] px-3 py-1 text-[12px] text-black/62"
                      >
                        {item.key} {item.value} · {item.label}
                      </span>
                    ))}
                  </div>

                  {!selectionMode && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={appendMobileUtilityRouteState(entry.links.product, routeState)}
                        className="inline-flex h-9 items-center rounded-full border border-black/15 px-4 text-[13px] font-medium text-black/78 active:bg-black/[0.03]"
                      >
                        查看产品
                      </Link>
                      <Link
                        href={appendMobileUtilityRouteState(entry.links.wiki, routeState)}
                        className="inline-flex h-9 items-center rounded-full border border-black/15 px-4 text-[13px] font-medium text-black/78 active:bg-black/[0.03]"
                      >
                        查看成份
                      </Link>
                    </div>
                  )}
                </article>
              </div>
            );
          })}
      </div>

      {selectionMode && (
        <button
          type="button"
          onClick={askDeleteSelected}
          disabled={selectedCount === 0 || deleting}
          className="fixed bottom-[112px] right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full border border-[#ff3b30]/28 bg-[#ff3b30] text-white shadow-[0_10px_26px_rgba(255,59,48,0.33)] transition-transform duration-200 active:scale-[0.96] disabled:opacity-45"
          aria-label="删除已选记录"
        >
          <TrashIcon />
        </button>
      )}

      {confirmDelete && (
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
      )}

      <MobileHistoryCleanupSheet
        open={cleanupOpen}
        title="清理陈旧选择记录"
        description="按时间阈值预览旧记录，默认排除置顶项，避免把你保留的长期样本一起删掉。"
        days={cleanupDays}
        onDaysChange={(value) => {
          setCleanupDays(value);
          setCleanupPreview(null);
        }}
        filterControls={
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-black/45">保护条件</div>
            <button
              type="button"
              onClick={() => {
                setCleanupExcludePinned((prev) => !prev);
                setCleanupPreview(null);
              }}
              className={`mt-2 inline-flex h-9 items-center rounded-full border px-4 text-[13px] font-medium ${
                cleanupExcludePinned ? "border-black bg-black text-white" : "border-black/10 bg-white text-black/68"
              }`}
            >
              {cleanupExcludePinned ? "已排除置顶" : "包含置顶"}
            </button>
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
