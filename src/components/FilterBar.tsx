"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { Dict } from "@/lib/i18n";
import { DateRangeFilter } from "./DateRangeFilter";
import { SortControl } from "./SortControl";

const chip: React.CSSProperties = {
  height: 32,
  borderRadius: 7,
  border: "1px solid #C7D1DA",
  padding: "0 10px",
  fontSize: 12,
  background: "#fff",
  color: "#33475B",
};

export interface FilterVenue {
  id: string;
  name: string;
  siteCode: string;
}

export function FilterBar({
  t,
  pendingCount,
  venues = [],
}: {
  t: Dict;
  pendingCount: number;
  venues?: FilterVenue[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.push(`/vlm?${next.toString()}`));
  }

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--border-card)",
        borderRadius: 9,
        padding: "10px 12px",
        display: "flex",
        gap: 10,
        alignItems: "center",
        flexWrap: "wrap",
        opacity: pending ? 0.7 : 1,
      }}
    >
      <input
        defaultValue={params.get("q") ?? ""}
        onChange={(e) => update("q", e.target.value)}
        placeholder={t.fSearch}
        style={{ ...chip, flex: 1.3, minWidth: 180 }}
      />
      {venues.length > 1 && (
        <select defaultValue={params.get("venueId") ?? ""} onChange={(e) => update("venueId", e.target.value)} style={chip}>
          <option value="">{t.fVenue}: {t.all}</option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} ({v.siteCode})
            </option>
          ))}
        </select>
      )}
      <select defaultValue={params.get("status") ?? ""} onChange={(e) => update("status", e.target.value)} style={chip}>
        <option value="">{t.fStatus}: {t.all}</option>
        <option value="PendingValidation">{t.stPendingPl}</option>
        <option value="Confirmed">{t.stConfirmed}</option>
        <option value="Cancelled">{t.stCancelled}</option>
        <option value="Expired">{t.stExpired}</option>
      </select>
      <select defaultValue={params.get("type") ?? ""} onChange={(e) => update("type", e.target.value)} style={chip}>
        <option value="">{t.fType}: {t.all}</option>
        <option value="delivery">{t.delivery}</option>
        <option value="collection">{t.collection}</option>
      </select>
      <DateRangeFilter t={t} basePath="/vlm" />
      <SortControl t={t} basePath="/vlm" />
      <span
        style={{
          marginLeft: "auto",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 11px",
          borderRadius: 20,
          background: "#FCF3E1",
          border: "1px solid #F2DDAE",
          color: "#9A6400",
          fontSize: 11.5,
          fontWeight: 600,
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#E08A00" }} />
        {pendingCount} {t.pendingCount}
      </span>
    </div>
  );
}
