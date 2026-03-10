"use client";

import { ReactNode } from "react";
import ProductWorkbenchJobConsole, { ProductWorkbenchJobConsoleProps } from "@/components/workbench/ProductWorkbenchJobConsole";
import { WorkbenchJobLike } from "@/components/workbench/useProductWorkbenchJobs";

type WorkbenchTaskSectionProps<TJob extends WorkbenchJobLike> = {
  errorMessage?: string | null;
  onRefresh?: () => void;
  refreshDisabled?: boolean;
  refreshLabel?: string;
  onCancelActive?: () => void;
  cancelActiveDisabled?: boolean;
  cancelActiveLabel?: string;
  toolbarExtra?: ReactNode;
  consoleProps: ProductWorkbenchJobConsoleProps<TJob>;
};

export default function WorkbenchTaskSection<TJob extends WorkbenchJobLike>({
  errorMessage,
  onRefresh,
  refreshDisabled = false,
  refreshLabel = "刷新任务",
  onCancelActive,
  cancelActiveDisabled = false,
  cancelActiveLabel = "中止当前任务",
  toolbarExtra,
  consoleProps,
}: WorkbenchTaskSectionProps<TJob>) {
  const showToolbar = Boolean(onRefresh || onCancelActive || toolbarExtra);

  return (
    <>
      {showToolbar ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshDisabled}
              className="inline-flex h-10 items-center justify-center rounded-full border border-black/14 bg-white px-5 text-[13px] font-semibold text-black/78 disabled:opacity-45"
            >
              {refreshLabel}
            </button>
          ) : null}
          {onCancelActive ? (
            <button
              type="button"
              onClick={onCancelActive}
              disabled={cancelActiveDisabled}
              className="inline-flex h-10 items-center justify-center rounded-full border border-[#ef4444]/40 bg-[#fff5f5] px-5 text-[13px] font-semibold text-[#b42318] disabled:opacity-45"
            >
              {cancelActiveLabel}
            </button>
          ) : null}
          {toolbarExtra}
        </div>
      ) : null}

      {errorMessage ? <div className="mt-3 whitespace-pre-wrap text-[13px] text-[#b42318]">{errorMessage}</div> : null}

      <ProductWorkbenchJobConsole {...consoleProps} />
    </>
  );
}
