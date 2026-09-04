"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dict } from "@/lib/i18n";
import {
  createVenueAction,
  setVenueStatusAction,
  updateVenueAction,
} from "@/app/admin/actions";

export interface VenueRow {
  id: string;
  name: string;
  siteCode: string;
  city: string;
  status: string;
  slotDuration: number;
  bookings: number;
  /** ISO timestamp — sort key for the Newest/Oldest toggle (item #10). */
  createdAt: string;
}

const card: React.CSSProperties = { background: "#fff", border: "1px solid var(--border-card)", borderRadius: 10, padding: "20px 22px" };
const labelS: React.CSSProperties = { fontWeight: 600, fontSize: 11, color: "#33475B", display: "block", marginBottom: 4 };
const control: React.CSSProperties = { height: 36, borderRadius: 7, border: "1px solid #C7D1DA", padding: "0 10px", fontSize: 12.5, width: "100%", background: "#fff" };
const th: React.CSSProperties = { fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em", color: "#5A6B7C", textAlign: "left", padding: "10px 14px" };
const td: React.CSSProperties = { padding: "10px 14px", fontSize: 12.5, borderTop: "1px solid #F0F3F6" };

/** Red asterisk marking a mandatory field — mirrors BookingForm's RequiredMark. */
function RequiredMark({ t }: { t: Dict }) {
  return (
    <span style={{ color: "var(--st-cancelled-text)" }} title={t.requiredField} aria-label={t.requiredField}>
      *
    </span>
  );
}

export function VenuesAdmin({ t, venues }: { t: Dict; venues: VenueRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Newest ⇄ Oldest sort (item #10).
  const [sortDir, setSortDir] = useState<"newest" | "oldest">("newest");
  const sortedVenues = useMemo(
    () =>
      [...venues].sort((a, b) =>
        sortDir === "newest" ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt),
      ),
    [venues, sortDir],
  );

  const [name, setName] = useState("");
  const [siteCode, setSiteCode] = useState("");
  const [city, setCity] = useState("");
  const [slotDuration, setSlotDuration] = useState<number | "">(30);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // No incomplete venue records (item #12) — block Create until every
  // required field is present, mirroring BookingForm's canSubmit pattern.
  const canSubmit =
    !!name.trim() && !!siteCode.trim() && !!city.trim() && slotDuration !== "" && !pending;

  // Edit-venue modal state.
  const [editing, setEditing] = useState<VenueRow | null>(null);
  const [eName, setEName] = useState("");
  const [eCity, setECity] = useState("");
  const [eSlotDuration, setESlotDuration] = useState(30);
  const [eError, setEError] = useState<string | null>(null);

  function openEdit(v: VenueRow) {
    setEditing(v);
    setEName(v.name);
    setECity(v.city);
    setESlotDuration(v.slotDuration);
    setEError(null);
  }

  function saveEdit() {
    if (!editing) return;
    setEError(null);
    startTransition(async () => {
      const res = await updateVenueAction({
        venueId: editing.id,
        name: eName,
        city: eCity,
        slotDuration: eSlotDuration,
      });
      if (res.ok) {
        setEditing(null);
        router.refresh();
      } else {
        setEError(res.error ?? "Error");
      }
    });
  }

  function submit() {
    if (!canSubmit) return;
    setError(null);
    setOk(null);
    startTransition(async () => {
      const res = await createVenueAction({ name, siteCode, city, slotDuration: Number(slotDuration) });
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

  return (
    <div className="admin-split">
      {/* Create venue */}
      <div style={card}>
        <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>{t.newVenue}</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div><label style={labelS}>{t.name} <RequiredMark t={t} /></label><input value={name} onChange={(e) => setName(e.target.value)} style={control} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={labelS}>{t.siteCode} <RequiredMark t={t} /></label>
              <input value={siteCode} onChange={(e) => setSiteCode(e.target.value.toUpperCase().slice(0, 3))} maxLength={3} className="mono" style={control} />
            </div>
            <div><label style={labelS}>{t.city} <RequiredMark t={t} /></label><input value={city} onChange={(e) => setCity(e.target.value)} style={control} /></div>
          </div>
          <div>
            <label style={labelS}>{t.slotDuration} <RequiredMark t={t} /></label>
            <input
              type="number"
              min={5}
              max={240}
              step={5}
              value={slotDuration}
              onChange={(e) => setSlotDuration(e.target.value === "" ? "" : Number(e.target.value))}
              style={control}
            />
          </div>
          {error && <p style={{ color: "var(--st-cancelled-text)", fontSize: 12 }}>{error}</p>}
          {ok && <p style={{ color: "var(--st-confirmed-text)", fontSize: 12 }}>✓ {ok}</p>}
          <button type="button" disabled={!canSubmit} onClick={submit} style={{ height: 40, borderRadius: 7, border: "none", background: canSubmit ? "var(--blue)" : "#B6C0C9", color: "#fff", fontWeight: 700, fontSize: 13 }}>
            {t.create}
          </button>
        </div>
      </div>

      {/* Venues table */}
      <div style={{ background: "#fff", border: "1px solid var(--border-card)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 14px", borderBottom: "1px solid #F0F3F6" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#5A6B7C" }}>
            {t.sortLabel}
            <select value={sortDir} onChange={(e) => setSortDir(e.target.value as "newest" | "oldest")} style={{ ...control, height: 30, width: "auto" }}>
              <option value="newest">{t.sortNewest}</option>
              <option value="oldest">{t.sortOldest}</option>
            </select>
          </label>
        </div>
        <div className="table-scroll">
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
            {sortedVenues.length === 0 && (
              <tr><td style={{ ...td, color: "#9AA7B2" }} colSpan={6}>{t.noVenues}</td></tr>
            )}
            {sortedVenues.map((v) => (
              <tr key={v.id} style={{ opacity: v.status === "inactive" ? 0.6 : 1 }}>
                <td style={td}>{v.name}</td>
                <td style={{ ...td, fontFamily: "var(--font-mono)", fontWeight: 600 }}>{v.siteCode}</td>
                <td style={td}>{v.city}</td>
                <td style={td}>{v.slotDuration}</td>
                <td style={td}>{v.status === "active" ? t.active : t.inactive}</td>
                <td style={{ ...td, textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                    <button type="button" disabled={pending} onClick={() => openEdit(v)} style={{ background: "none", border: "none", color: "var(--blue)", fontWeight: 600, fontSize: 12 }}>
                      {t.edit}
                    </button>
                    <button type="button" disabled={pending} onClick={() => toggleStatus(v)} style={{ background: "none", border: "none", color: v.status === "active" ? "#B3261E" : "var(--st-confirmed-text)", fontWeight: 600, fontSize: 12 }}>
                      {v.status === "active" ? t.deactivate : t.activate}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Edit venue modal */}
      {editing && (
        <div
          onClick={() => !pending && setEditing(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,32,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: 420, maxWidth: "92vw", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{t.editVenue}</h2>
            <p style={{ fontSize: 11.5, color: "#5A6B7C", fontFamily: "var(--font-mono)", marginBottom: 14 }}>{editing.siteCode}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label style={labelS}>{t.name}</label><input value={eName} onChange={(e) => setEName(e.target.value)} style={control} /></div>
              <div>
                <label style={labelS}>{t.siteCode}</label>
                <input readOnly value={editing.siteCode} className="mono" style={{ ...control, background: "#F4F6F8", border: "1px solid #E3E9EF", color: "#5A6B7C" }} />
                <p style={{ fontSize: 10.5, color: "#9AA7B2", marginTop: 4 }}>{t.siteCodeLocked}</p>
              </div>
              <div><label style={labelS}>{t.city}</label><input value={eCity} onChange={(e) => setECity(e.target.value)} style={control} /></div>
              <div>
                <label style={labelS}>{t.slotDuration}</label>
                <input type="number" min={5} max={240} step={5} value={eSlotDuration} onChange={(e) => setESlotDuration(Number(e.target.value))} style={control} />
              </div>
              {eError && <p style={{ color: "var(--st-cancelled-text)", fontSize: 12 }}>{eError}</p>}
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button type="button" disabled={pending} onClick={() => setEditing(null)} style={{ flex: 1, height: 40, borderRadius: 7, border: "1px solid #C7D1DA", background: "#fff", color: "#33475B", fontWeight: 600, fontSize: 13 }}>
                  {t.cancel}
                </button>
                <button type="button" disabled={pending} onClick={saveEdit} style={{ flex: 1, height: 40, borderRadius: 7, border: "none", background: "var(--blue)", color: "#fff", fontWeight: 700, fontSize: 13 }}>
                  {t.save}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
