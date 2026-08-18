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

/** Newest ⇄ Oldest sort toggle shared by every booking table (item #10).
 *  Preserves whatever other query params are already on the URL and pushes
 *  to the given basePath, mirroring DateRangeFilter's pattern. */
export function SortControl({ t, basePath }: { t: Dict; basePath: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("sort", value);
    else next.delete("sort");
    startTransition(() => router.push(`${basePath}?${next.toString()}`));
  }

  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11.5,
        color: "#5A6B7C",
        opacity: pending ? 0.7 : 1,
      }}
    >
      {t.sortLabel}
      <select defaultValue={params.get("sort") ?? "newest"} onChange={(e) => update(e.target.value)} style={chip}>
        <option value="newest">{t.sortNewest}</option>
        <option value="oldest">{t.sortOldest}</option>
      </select>
    </label>
  );
}
