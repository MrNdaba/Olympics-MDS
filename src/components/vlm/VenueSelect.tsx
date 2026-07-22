"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export interface VenueOption {
  id: string;
  name: string;
  siteCode: string;
}

/** Venue selector for the VLM/Admin dashboard. Navigates preserving the current
 *  date, so the dashboard metrics and load grid update for the chosen venue. */
export function DashboardVenueSelect({
  venues,
  selected,
  allLabel,
}: {
  venues: VenueOption[];
  selected: string;
  allLabel: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function onChange(venueId: string) {
    const next = new URLSearchParams(params.toString());
    if (venueId) next.set("venueId", venueId);
    else next.delete("venueId");
    startTransition(() => router.push(`/vlm/dashboard?${next.toString()}`));
  }

  return (
    <select
      value={selected}
      onChange={(e) => onChange(e.target.value)}
      disabled={pending}
      style={{
        height: 30,
        borderRadius: 7,
        border: "1px solid #C7D1DA",
        padding: "0 10px",
        fontSize: 12,
        background: "#fff",
        color: "#33475B",
        opacity: pending ? 0.7 : 1,
      }}
    >
      <option value="">{allLabel}</option>
      {venues.map((v) => (
        <option key={v.id} value={v.id}>
          {v.name} ({v.siteCode})
        </option>
      ))}
    </select>
  );
}
