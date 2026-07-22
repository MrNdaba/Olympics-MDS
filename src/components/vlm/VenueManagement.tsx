"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dict } from "@/lib/i18n";
import {
  setOperatingDayAction,
  closeOperatingDayAction,
  setVenueSlotDurationAction,
  setBookingWindowAction,
  addCompoundAction,
  removeCompoundAction,
  addGateAction,
  removeGateAction,
  setRouteAction,
} from "@/app/vlm/venue/actions";
import { DEPARTMENTS } from "@/lib/constants";

export interface OperatingDayRow {
  dateIso: string;
  dateDisplay: string;
  openTime: string;
  closeTime: string;
  active: boolean;
}

export interface ManagedVenue {
  id: string;
  name: string;
  siteCode: string;
  city: string;
  status: string;
  bookingWindowOpen: boolean;
  slotDuration: number;
  days: OperatingDayRow[];
  compounds: { id: string; department: string; label: string }[];
  gates: { id: string; label: string }[];
  routes: { compoundId: string; gateId: string }[];
}

const card: React.CSSProperties = { background: "#fff", border: "1px solid var(--border-card)", borderRadius: 10, padding: "20px 22px" };
const labelS: React.CSSProperties = { fontWeight: 600, fontSize: 11, color: "#33475B", display: "block", marginBottom: 4 };
const control: React.CSSProperties = { height: 36, borderRadius: 7, border: "1px solid #C7D1DA", padding: "0 10px", fontSize: 12.5, background: "#fff" };
const th: React.CSSProperties = { fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em", color: "#5A6B7C", textAlign: "left", padding: "10px 14px" };
const td: React.CSSProperties = { padding: "10px 14px", fontSize: 12.5, borderTop: "1px solid #F0F3F6" };

export function VenueManagement({ t, venues }: { t: Dict; venues: ManagedVenue[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState(venues[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  const [newDate, setNewDate] = useState("");
  const [newOpen, setNewOpen] = useState("08:00");
  const [newClose, setNewClose] = useState("18:00");

  const [newCompoundDept, setNewCompoundDept] = useState<string>(DEPARTMENTS[0]);
  const [newCompoundLabel, setNewCompoundLabel] = useState("");
  const [newGateLabel, setNewGateLabel] = useState("");

  const venue = useMemo(() => venues.find((v) => v.id === selectedId), [venues, selectedId]);

  const routeSet = useMemo(
    () => new Set((venue?.routes ?? []).map((r) => `${r.compoundId}|${r.gateId}`)),
    [venue],
  );

  if (!venue) {
    return <p style={{ color: "#9AA7B2", fontSize: 13 }}>{t.noVenues}</p>;
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Error");
      else router.refresh();
    });
  }

  function addOrUpdateDay(dateIso: string, open: string, close: string) {
    if (!dateIso) {
      setError("Date is required.");
      return;
    }
    run(() => setOperatingDayAction(venue!.id, dateIso, open, close));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {venues.length > 1 && (
        <div style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ ...labelS, marginBottom: 0 }}>{t.venue}</label>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} style={{ ...control, minWidth: 240 }}>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>{v.name} · {v.siteCode}</option>
            ))}
          </select>
        </div>
      )}

      {error && <p style={{ color: "var(--st-cancelled-text)", fontSize: 12.5 }}>{error}</p>}

      {/* Booking window + slot duration */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div style={card}>
          <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{t.bookingWindow}</h2>
          <p style={{ fontSize: 11.5, color: "var(--text-secondary)", marginBottom: 14 }}>{t.bookingWindowNote}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                padding: "4px 12px",
                borderRadius: 20,
                fontSize: 11.5,
                fontWeight: 700,
                background: venue.bookingWindowOpen ? "var(--st-confirmed-bg)" : "var(--st-cancelled-bg)",
                color: venue.bookingWindowOpen ? "var(--st-confirmed-text)" : "var(--st-cancelled-text)",
              }}
            >
              {venue.bookingWindowOpen ? t.windowOpen : t.windowClosed}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => setBookingWindowAction(venue.id, !venue.bookingWindowOpen))}
              style={{ height: 36, borderRadius: 7, border: "1px solid #C7D1DA", background: "#fff", fontWeight: 600, fontSize: 12.5, padding: "0 14px", color: "#33475B" }}
            >
              {venue.bookingWindowOpen ? t.windowClosed : t.windowOpen}
            </button>
          </div>
        </div>

        <div style={card}>
          <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{t.slotDuration}</h2>
          <p style={{ fontSize: 11.5, color: "var(--text-secondary)", marginBottom: 14 }}>{t.slotHint}</p>
          <input
            type="number"
            min={5}
            max={240}
            step={5}
            defaultValue={venue.slotDuration}
            disabled={pending}
            onBlur={(e) => {
              const minutes = Number(e.target.value);
              if (minutes !== venue.slotDuration) run(() => setVenueSlotDurationAction(venue.id, minutes));
            }}
            style={{ ...control, width: 100 }}
          />
        </div>
      </div>

      {/* Operating hours */}
      <div style={card}>
        <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{t.operatingHours}</h2>
        <p style={{ fontSize: 11.5, color: "var(--text-secondary)", marginBottom: 14 }}>{t.operatingHoursNote}</p>

        {/* Add / set a day */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <div>
            <label style={labelS}>{t.date}</label>
            <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} style={control} />
          </div>
          <div>
            <label style={labelS}>{t.openTime}</label>
            <input type="time" value={newOpen} onChange={(e) => setNewOpen(e.target.value)} style={control} />
          </div>
          <div>
            <label style={labelS}>{t.closeTime}</label>
            <input type="time" value={newClose} onChange={(e) => setNewClose(e.target.value)} style={control} />
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => addOrUpdateDay(newDate, newOpen, newClose)}
            style={{ height: 36, borderRadius: 7, border: "none", background: "var(--blue)", color: "#fff", fontWeight: 700, fontSize: 12.5, padding: "0 16px" }}
          >
            {t.addHours}
          </button>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#F8FAFB" }}>
            <tr>
              <th style={th}>{t.date}</th>
              <th style={th}>{t.openTime}</th>
              <th style={th}>{t.closeTime}</th>
              <th style={th}>{t.colStatus}</th>
              <th style={{ ...th, textAlign: "right" }}>{t.colActions}</th>
            </tr>
          </thead>
          <tbody>
            {venue.days.length === 0 && (
              <tr><td style={{ ...td, color: "#9AA7B2" }} colSpan={5}>{t.noOperatingDays}</td></tr>
            )}
            {venue.days.map((d) => (
              <tr key={d.dateIso} style={{ opacity: d.active ? 1 : 0.55 }}>
                <td style={{ ...td, fontFamily: "var(--font-mono)" }}>{d.dateDisplay}</td>
                <td style={td}>
                  <input
                    type="time"
                    defaultValue={d.openTime}
                    disabled={pending}
                    onBlur={(e) => {
                      if (e.target.value !== d.openTime) addOrUpdateDay(d.dateIso, e.target.value, d.closeTime);
                    }}
                    style={{ ...control, width: 110, height: 30 }}
                  />
                </td>
                <td style={td}>
                  <input
                    type="time"
                    defaultValue={d.closeTime}
                    disabled={pending}
                    onBlur={(e) => {
                      if (e.target.value !== d.closeTime) addOrUpdateDay(d.dateIso, d.openTime, e.target.value);
                    }}
                    style={{ ...control, width: 110, height: 30 }}
                  />
                </td>
                <td style={td}>
                  {d.active ? (
                    <span style={{ color: "var(--st-confirmed-text)", fontWeight: 600 }}>{t.windowOpen}</span>
                  ) : (
                    <span style={{ color: "#9AA7B2", fontWeight: 600 }}>{t.closedLabel}</span>
                  )}
                </td>
                <td style={{ ...td, textAlign: "right" }}>
                  {d.active ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => closeOperatingDayAction(venue.id, d.dateIso))}
                      style={{ background: "none", border: "none", color: "#B3261E", fontWeight: 600, fontSize: 12 }}
                    >
                      {t.closeDay}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => addOrUpdateDay(d.dateIso, d.openTime, d.closeTime)}
                      style={{ background: "none", border: "none", color: "var(--st-confirmed-text)", fontWeight: 600, fontSize: 12 }}
                    >
                      {t.reopenDay}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Compound & gate maintenance (§8, §15.5) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div style={card}>
          <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{t.compounds}</h2>
          <p style={{ fontSize: 11.5, color: "var(--text-secondary)", marginBottom: 14 }}>{t.compoundsNote}</p>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <div>
              <label style={labelS}>{t.department}</label>
              <select value={newCompoundDept} onChange={(e) => setNewCompoundDept(e.target.value)} style={control}>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={labelS}>{t.labelField}</label>
              <input value={newCompoundLabel} onChange={(e) => setNewCompoundLabel(e.target.value)} placeholder={t.compoundPh} style={{ ...control, width: "100%" }} />
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!newCompoundLabel.trim()) { setError(t.labelRequired); return; }
                run(() => addCompoundAction(venue.id, newCompoundDept, newCompoundLabel));
                setNewCompoundLabel("");
              }}
              style={{ height: 36, borderRadius: 7, border: "none", background: "var(--blue)", color: "#fff", fontWeight: 700, fontSize: 12.5, padding: "0 16px" }}
            >
              {t.add}
            </button>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#F8FAFB" }}>
              <tr>
                <th style={th}>{t.department}</th>
                <th style={th}>{t.labelField}</th>
                <th style={{ ...th, textAlign: "right" }}>{t.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {venue.compounds.length === 0 && (
                <tr><td style={{ ...td, color: "#9AA7B2" }} colSpan={3}>{t.noCompounds}</td></tr>
              )}
              {venue.compounds.map((c) => (
                <tr key={c.id}>
                  <td style={{ ...td, fontFamily: "var(--font-mono)" }}>{c.department}</td>
                  <td style={td}>{c.label}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => removeCompoundAction(venue.id, c.id))}
                      style={{ background: "none", border: "none", color: "#B3261E", fontWeight: 600, fontSize: 12 }}
                    >
                      {t.remove}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={card}>
          <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{t.gates}</h2>
          <p style={{ fontSize: 11.5, color: "var(--text-secondary)", marginBottom: 14 }}>{t.gatesNote}</p>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={labelS}>{t.labelField}</label>
              <input value={newGateLabel} onChange={(e) => setNewGateLabel(e.target.value)} placeholder={t.gatePh} style={{ ...control, width: "100%" }} />
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!newGateLabel.trim()) { setError(t.labelRequired); return; }
                run(() => addGateAction(venue.id, newGateLabel));
                setNewGateLabel("");
              }}
              style={{ height: 36, borderRadius: 7, border: "none", background: "var(--blue)", color: "#fff", fontWeight: 700, fontSize: 12.5, padding: "0 16px" }}
            >
              {t.add}
            </button>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#F8FAFB" }}>
              <tr>
                <th style={th}>{t.labelField}</th>
                <th style={{ ...th, textAlign: "right" }}>{t.colActions}</th>
              </tr>
            </thead>
            <tbody>
              {venue.gates.length === 0 && (
                <tr><td style={{ ...td, color: "#9AA7B2" }} colSpan={2}>{t.noGates}</td></tr>
              )}
              {venue.gates.map((g) => (
                <tr key={g.id}>
                  <td style={td}>{g.label}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => removeGateAction(venue.id, g.id))}
                      style={{ background: "none", border: "none", color: "#B3261E", fontWeight: 600, fontSize: 12 }}
                    >
                      {t.remove}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Routing matrix: which gates each compound may use (§8) */}
      <div style={card}>
        <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{t.routing}</h2>
        <p style={{ fontSize: 11.5, color: "var(--text-secondary)", marginBottom: 14 }}>{t.routingNote}</p>

        {venue.compounds.length === 0 || venue.gates.length === 0 ? (
          <p style={{ color: "#9AA7B2", fontSize: 12.5 }}>{t.routingEmpty}</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse" }}>
              <thead style={{ background: "#F8FAFB" }}>
                <tr>
                  <th style={th}>{t.compound}</th>
                  {venue.gates.map((g) => (
                    <th key={g.id} style={{ ...th, textAlign: "center" }}>{g.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {venue.compounds.map((c) => (
                  <tr key={c.id}>
                    <td style={td}>
                      <span style={{ fontFamily: "var(--font-mono)", color: "#5A6B7C" }}>{c.department}</span> · {c.label}
                    </td>
                    {venue.gates.map((g) => {
                      const on = routeSet.has(`${c.id}|${g.id}`);
                      return (
                        <td key={g.id} style={{ ...td, textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={pending}
                            onChange={(e) => run(() => setRouteAction(venue.id, c.id, g.id, e.target.checked))}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
