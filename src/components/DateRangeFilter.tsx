"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { Dict } from "@/lib/i18n";

const chip: React.CSSProperties = {
  height: 32,
  borderRadius: 7,
  border: "1px solid #C7D1DA",
  padding: "0 10px",
  fontSize: 12,
  background: "#fff",
  color: "#33475B",
};

/** The standard "Du / Au" (From/To) date-range control shared by every booking
 *  list — VLM, Admin (via the VLM route) and Supplier. Filters on serviceDate,
 *  preserves whatever other query params are already on the URL, and pushes to
 *  the given basePath so each view keeps its own route. */
export function DateRangeFilter({ t, basePath }: { t: Dict; basePath: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.push(`${basePath}?${next.toString()}`));
  }

  const labelStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11.5,
    color: "#5A6B7C",
    opacity: pending ? 0.7 : 1,
  };

  return (
    <>
      <label style={labelStyle}>
        {t.fFrom}
        <input type="date" defaultValue={params.get("from") ?? ""} onChange={(e) => update("from", e.target.value)} style={chip} />
      </label>
      <label style={labelStyle}>
        {t.fTo}
        <input type="date" defaultValue={params.get("to") ?? ""} onChange={(e) => update("to", e.target.value)} style={chip} />
      </label>
    </>
  );
}
