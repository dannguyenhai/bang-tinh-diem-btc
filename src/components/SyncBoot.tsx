"use client";

import { useEffect } from "react";
import { useGameStore } from "@/lib/store";

/** Nạp state và mở kênh realtime đúng một lần cho cả app. */
export function SyncBoot() {
  const init = useGameStore((s) => s.init);
  useEffect(() => {
    void init();
  }, [init]);
  return null;
}
