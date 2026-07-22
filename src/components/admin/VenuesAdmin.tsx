"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dict } from "@/lib/i18n";
import {
  createVenueAction,
  setVenueStatusAction,
  updateVenueSlotDurationAction,
} from "@/app/admin/actions";

export interface VenueRow {
  id: string;
  name: string;
  siteCode: string;
  city: string;
  status: string;
  slotDuration: number;
  bookings: number;
}

const card: React.CSSProperties = { background: "#fff", border: "1px solid var(--border-card)", borderRadius: 10, padding: "20px 22px" };
const labelS: React.CSSProperties = { fontWeight: 600, fontSize: 11, color: "#33475B", display: "block", marginBottom: 4 };
const control: React.CSSProperties = { height: 36, borderRadius: 7, border: "1px solid #C7D1DA", padding: "0 10px", fontSize: 12.5, width: "100%", background: "#fff" };
const th: React.CSSProperties = { fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em", color: "#5A6B7C", textAlign: "left", padding: "10px 14px" };
const td: React.CSSProperties = { padding: "10px 14px", fontSize: 12.5, borderTop: "1px solid #F0F3F6" };

export function VenuesAdmin({ t, venues }: { t: Dict; venues: VenueRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [siteCode, setSiteCode] = useState("");
  const [city, setCity] = useState("");
  const [slotDuration, setSlotDuration] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function submit() {
    setError(null);
    setOk(null);
    startTransition(async () => {
      const res = await createVenueAction({ name, siteCode, city, slotDuration });
      if (res.ok) {
        setOk(siteCode.toUpperCase());
        setName("");
        setSiteCode("");
        setCity("");
        setSlotDuration(30);
        router.refresh();
      } else {
        setError(res.error ?? "Error");
      }
    });
  }

  function toggleStatus(v: VenueRow) {
    const next = v.status === "active" ? "inactive" : "active";
    startTransition(async () => {
      await setVenueStatusAction(v.id, next);
      router.refresh();
    });
  }

  function changeDuration(v: VenueRow, minutes: number) {
    if (minutes === v.slotDuration) return;
    startTransition(async () => {
      const res = await updateVenueSlotDurationAction(v.id, minutes);
      if (!res.ok) setError(res.error ?? "Error");
      else router.refresh();
    });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 22, alignItems: "start" }}>
      {/* Create venue */}
      <div style={card}>
        <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>{t.newVenue}</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div><label style={labelS}>{t.name}</label><input value={name} onChange={(e) => setName(e.target.value)} style={control} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelS}>{t.siteCode}</label>
              <input value={siteCode} onChange={(e) => setSiteCode(e.target.value.toUpperCase().slice(0, 3))} maxLength={3} className="mono" style={control} />
            </div>
            <div><label style={labelS}>{t.city}</label><input value={city} onChange={(e) => setCity(e.target.value)} style={control} /></div>
          </div>
          <div>
            <label style={labelS}>{t.slotDuration}</label>
            <input type="number" min={5} max={240} step={5} value={slotDuration} onChange={(e) => setSlotDuration(Number(e.target.value))} style={control} />
          </div>
          {error && <p style={{ color: "var(--st-cancelled-text)", fontSize: 12 }}>{error}</p>}
          {ok && <p style={{ color: "var(--st-confirmed-text)", fontSize: 12 }}>✓ {ok}</p>}
          <button type="button" disabled={pending} onClick={submit} style={{ height: 40, borderRadius: 7, border: "none", background: "var(--blue)", color: "#fff", fontWeight: 700, fontSize: 13 }}>
            {t.create}
          </button>
        </div>
      </div>

      {/* Venues table */}
      <div style={{ background: "#fff", border: "1px solid var(--border-card)", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#F8FAFB" }}>
            <tr>
              <th style={th}>{t.name}</th>
              <th style={th}>{t.siteCode}</th>
              <th style={th}>{t.city}</th>
              <th style={th}>{t.slotDuration}</th>
              <th style={th}>{t.colStatus}</th>
              <th style={{ ...th, textAlign: "right" }}>{t.colActions}</th>
            </tr>
          </thead>
          <tbody>
            {venues.length === 0 && (
              <tr><td style={{ ...td, color: "#9AA7B2" }} colSpan={6}>{t.noVenues}</td></tr>
            )}
            {venues.map((v) => (
              <tr key={v.id} style={{ opacity: v.status === "inactive" ? 0.6 : 1 }}>
                <td style={td}>{v.name}</td>
                <td style={{ ...td, fontFamily: "var(--font-mono)", fontWeight: 600 }}>{v.siteCode}</td>
                <td style={td}>{v.city}</td>
                <td style={td}>
                  <input
                    type="number"
                    min={5}
                    max={240}
                    step={5}
                    defaultValue={v.slotDuration}
                    disabled={pending}
                    onBlur={(e) => changeDuration(v, Number(e.target.value))}
                    style={{ ...control, width: 74, height: 30 }}
                  />
                </td>
                <td style={td}>{v.status === "active" ? t.active : t.inactive}</td>
                <td style={{ ...td, textAlign: "right" }}>
                  <button type="button" disabled={pending} onClick={() => toggleStatus(v)} style={{ background: "none", border: "none", color: v.status === "active" ? "#B3261E" : "var(--st-confirmed-text)", fontWeight: 600, fontSize: 12 }}>
                    {v.status === "active" ? t.deactivate : t.activate}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
