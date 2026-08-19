"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { Dict } from "@/lib/i18n";

export interface DashboardFilterVenue {
  id: string;
  name: string;
  siteCode: string;
}

const chip: React.CSSProperties = {
  height: 32,
  borderRadius: 7,
  border: "1px solid #C7D1DA",
  padding: "0 10px",
  fontSize: 12,
  background: "#fff",
  color: "#33475B",
};

/** Combined venue + "Du/Au" date-range filter for the shared Admin/VLM
 *  dashboard. Drives both the summary cards and the venue-load section below;
 *  defaults to Today and the Today link always resets back to it, dropping
 *  the legacy single-day `date` param so from/to stay the source of truth. */
export function DashboardFilters({
  t,
  venues,
  selectedVenueId,
  from,
  to,
  today,
}: {
  t: Dict;
  venues: DashboardFilterVenue[];
  selectedVenueId: string;
  from: string;
  to: string;
  today: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    next.delete("date");
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    startTransition(() => router.push(`/vlm/dashboard?${next.toString()}`));
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
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      {venues.length > 1 && (
        <select
          value={selectedVenueId}
          onChange={(e) => update({ venueId: e.target.value || undefined })}
          disabled={pending}
          style={chip}
        >
          <option value="">{t.fVenue}: {t.all}</option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} ({v.siteCode})
            </option>
          ))}
        </select>
      )}
      <label style={labelStyle}>
        {t.fFrom}
        <input type="date" value={from} onChange={(e) => update({ from: e.target.value })} disabled={pending} style={chip} />
      </label>
      <label style={labelStyle}>
        {t.fTo}
        <input type="date" value={to} onChange={(e) => update({ to: e.target.value })} disabled={pending} style={chip} />
      </label>
      <button
        type="button"
        disabled={pending}
        onClick={() => update({ from: today, to: today })}
        style={{ height: 32, borderRadius: 7, border: "1px solid #C7D1DA", background: "#fff", color: "var(--blue)", fontWeight: 600, fontSize: 12, padding: "0 12px" }}
      >
        {t.today}
      </button>
    </div>
  );
}
