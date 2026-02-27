"use client";

import { useEffect, useRef } from "react";
import { pushPickHistory, type NewPickHistoryEntry } from "@/lib/mobile/pickHistory";

export default function SelectionRecorder({ record }: { record: NewPickHistoryEntry }) {
  const written = useRef(false);

  useEffect(() => {
    if (written.current) return;
    pushPickHistory(record);
    written.current = true;
  }, [record]);

  return null;
}
