"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Polling is the guaranteed live-update baseline (spec §16 — Citrix-friendly).
export function Poller({ intervalMs = 30_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
