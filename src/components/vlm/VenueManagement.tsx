"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dict } from "@/lib/i18n";
import {
  setOperatingDayAction,
  closeOperatingDayAction,
  setVenueSlotDurationAction,
  setBookingWindowAction,
  addBreakAction,
  removeBreakAction,
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

export interface BreakRow {
  id: string;
  dateIso: string;
  dateDisplay: string;
  startTime: string;
  endTime: string;
  label: string;
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
  breaks: BreakRow[];
  compounds: { id: string; department: string; label: string }[];
  gates: { id: string; label: string }[];
  routes: { compoundId: string; gateId: string }[];
}

const card: React.CSSProperties = { background: "#fff", border: "1px solid var(--border-card)", borderRadius: 10, padding: "20px 22px" };
const labelS: React.CSSProperties = { fontWeight: 600, fontSize: 11, color: "#33475B", display: "block", marginBottom: 4 };
const control: React.CSSProperties = { height: 36, borderRadius: 7, border: "1px solid #C7D1DA", padding: "0 10px", fontSize: 12.5, background: "#fff" };
const th: React.CSSProperties = { fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em", color: "#5A6B7C", textAlign: "left", padding: "10px 14px" };
const td: React.CSSProperties = { padding: "10px 14px", fontSize: 12.5, borderTop: "1px solid #F0F3F6" };

export function VenueManagement({
  t,
  venues,
  readOnly = false,
}: {
  t: Dict;
  venues: ManagedVenue[];
  /** View Only accounts (item #3): render the same venue-management screens
   *  read-only — no window/slot/hours/compound/gate/routing mutation. */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const disabled = pending || readOnly;
  const [selectedId, setSelectedId] = useState(venues[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  const [newCompoundDept, setNewCompoundDept] = useState<string>(DEPARTMENTS[0]);
  const [newCompoundLabel, setNewCompoundLabel] = useState("");
  const [newGateLabel, setNewGateLabel] = useState("");

  // Day editor (Operating hours rework): pick one date, then configure that
  // day's hours and break periods together in a single focused panel,
  // instead of editing hours inline per-row and breaks in a separate card.
  const [selectedDayIso, setSelectedDayIso] = useState("");
  const [dayOpenTime, setDayOpenTime] = useState("08:00");
  const [dayCloseTime, setDayCloseTime] = useState("18:00");

  // Break periods — a separate, filterable overview (own date filter, own
  // add form) rather than scoped to whichever day the editor above has open,
  // so reviewing/adding breaks doesn't require stepping into hours-editing.
  const [breakFilterDate, setBreakFilterDate] = useState(""); // "" = all days
  const [newBreakDate, setNewBreakDate] = useState("");
  const [newBreakStart, setNewBreakStart] = useState("12:00");
  const [newBreakEnd, setNewBreakEnd] = useState("13:00");
  const [newBreakLabel, setNewBreakLabel] = useState("");

  const venue = useMemo(() => venues.find((v) => v.id === selectedId), [venues, selectedId]);

  const selectedDay = useMemo(
    () => venue?.days.find((d) => d.dateIso === selectedDayIso),
    [venue, selectedDayIso],
  );

  // Select a date in the day editor, seeding the hours inputs from its
  // existing record (or sane defaults for a brand-new date). Driven directly
  // from the triggering event handlers (table "Edit", date picker, venue
  // switch) rather than an effect, so there's no state-from-state cascade.
  function selectDay(dateIso: string) {
    const day = venue?.days.find((d) => d.dateIso === dateIso);
    setSelectedDayIso(dateIso);
    setDayOpenTime(day?.openTime ?? "08:00");
    setDayCloseTime(day?.closeTime ?? "18:00");
  }

  // Newest ⇄ Oldest sort for the operating-days schedule (item #10) — sorts
  // by the scheduled date itself, which is the meaningful order for a
  // venue-scheduling view (rather than row-creation time).
  const [daysSortDir, setDaysSortDir] = useState<"newest" | "oldest">("oldest");
  const sortedDays = useMemo(() => {
    const days = venue?.days ?? [];
    return [...days].sort((a, b) =>
      daysSortDir === "newest" ? b.dateIso.localeCompare(a.dateIso) : a.dateIso.localeCompare(b.dateIso),
    );
  }, [venue, daysSortDir]);

  const routeSet = useMemo(
    () => new Set((venue?.routes ?? []).map((r) => `${r.compoundId}|${r.gateId}`)),
    [venue],
  );

  // Break count per day, for the Operating hours table's "Breaks" column —
  // clicking a count jumps the filter below straight to that day.
  const breaksCountByDate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of venue?.breaks ?? []) counts.set(b.dateIso, (counts.get(b.dateIso) ?? 0) + 1);
    return counts;
  }, [venue]);

  // Only currently-open days can host a break (§10/D4 — a closed day has no
  // slots to begin with) — the source list for both the date filter and the
  // add-break form below.
  const openDays = useMemo(() => (venue?.days ?? []).filter((d) => d.active), [venue]);

  // All breaks, chronological, narrowed to one day when a filter is set —
  // "view all break periods for a specific day" (break-periods date filter).
  const filteredBreaks = useMemo(() => {
    const all = [...(venue?.breaks ?? [])].sort((a, b) =>
      `${a.dateIso}${a.startTime}`.localeCompare(`${b.dateIso}${b.startTime}`),
    );
    return breakFilterDate ? all.filter((b) => b.dateIso === breakFilterDate) : all;
  }, [venue, breakFilterDate]);

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
      setError(t.dateRequired);
      return;
    }
    run(() => setOperatingDayAction(venue!.id, dateIso, open, close));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {venues.length > 1 && (
        <div style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ ...labelS, marginBottom: 0 }}>{t.venue}</label>
          <select
            value={selectedId}
            onChange={(e) => {
              // Switching venue drops any in-progress day selection — it
              // belonged to the previous venue's schedule.
              setSelectedId(e.target.value);
              selectDay("");
            }}
            style={{ ...control, minWidth: 240 }}
          >
            {venues.map((v) => (
              <option key={v.id} value={v.id}>{v.name} · {v.siteCode}</option>
            ))}
          </select>
        </div>
      )}

      {error && <p style={{ color: "var(--st-cancelled-text)", fontSize: 12.5 }}>{error}</p>}

      {/* Booking window + slot duration */}
      <div className="two-col-cards">
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
            {!readOnly && (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => setBookingWindowAction(venue.id, !venue.bookingWindowOpen))}
                style={{ height: 36, borderRadius: 7, border: "1px solid #C7D1DA", background: "#fff", fontWeight: 600, fontSize: 12.5, padding: "0 14px", color: "#33475B" }}
              >
                {venue.bookingWindowOpen ? t.windowClosed : t.windowOpen}
              </button>
            )}
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
            disabled={disabled}
            onBlur={(e) => {
              const minutes = Number(e.target.value);
              if (minutes !== venue.slotDuration) run(() => setVenueSlotDurationAction(venue.id, minutes));
            }}
            style={{ ...control, width: 100 }}
          />
        </div>
      </div>

      {/* Operating hours — overview table; click "Edit" to open the day editor below */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{t.operatingHours}</h2>
            <p style={{ fontSize: 11.5, color: "var(--text-secondary)", marginBottom: 14 }}>{t.operatingHoursNote}</p>
          </div>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#5A6B7C", whiteSpace: "nowrap" }}>
            {t.sortLabel}
            <select value={daysSortDir} onChange={(e) => setDaysSortDir(e.target.value as "newest" | "oldest")} style={{ ...control, height: 30, width: "auto" }}>
              <option value="newest">{t.sortNewest}</option>
              <option value="oldest">{t.sortOldest}</option>
            </select>
          </label>
        </div>

        <div className="table-scroll">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#F8FAFB" }}>
            <tr>
              <th style={th}>{t.date}</th>
              <th style={th}>{t.openTime}</th>
              <th style={th}>{t.closeTime}</th>
              <th style={th}>{t.colStatus}</th>
              <th style={th}>{t.colBreaks}</th>
              <th style={{ ...th, textAlign: "right" }}>{t.colActions}</th>
            </tr>
          </thead>
          <tbody>
            {sortedDays.length === 0 && (
              <tr><td style={{ ...td, color: "#9AA7B2" }} colSpan={6}>{t.noOperatingDays}</td></tr>
            )}
            {sortedDays.map((d) => (
              <tr
                key={d.dateIso}
                style={{
                  opacity: d.active ? 1 : 0.55,
                  background: d.dateIso === selectedDayIso ? "var(--blue-tint-bg)" : undefined,
                }}
              >
                <td style={{ ...td, fontFamily: "var(--font-mono)" }}>{d.dateDisplay}</td>
                <td style={{ ...td, fontFamily: "var(--font-mono)" }}>{d.openTime}</td>
                <td style={{ ...td, fontFamily: "var(--font-mono)" }}>{d.closeTime}</td>
                <td style={td}>
                  {d.active ? (
                    <span style={{ color: "var(--st-confirmed-text)", fontWeight: 600 }}>{t.windowOpen}</span>
                  ) : (
                    <span style={{ color: "#9AA7B2", fontWeight: 600 }}>{t.closedLabel}</span>
                  )}
                </td>
                <td style={{ ...td, fontFamily: "var(--font-mono)" }}>
                  {(breaksCountByDate.get(d.dateIso) ?? 0) > 0 ? (
                    <button
                      type="button"
                      onClick={() => setBreakFilterDate(d.dateIso)}
                      title={t.breakPeriods}
                      style={{ background: "none", border: "none", color: "var(--blue)", fontFamily: "var(--font-mono)", fontSize: 12.5, textDecoration: "underline dashed", textUnderlineOffset: 2, cursor: "pointer" }}
                    >
                      {breaksCountByDate.get(d.dateIso)}
                    </button>
                  ) : (
                    0
                  )}
                </td>
                <td style={{ ...td, textAlign: "right" }}>
                  <button
                    type="button"
                    onClick={() => selectDay(d.dateIso)}
                    style={{ background: "none", border: "none", color: "var(--blue)", fontWeight: 600, fontSize: 12 }}
                  >
                    {t.edit}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Day editor — pick a date (existing or new) to configure its hours
          and break periods together in one place. */}
      <div style={card}>
        <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{t.dayEditorTitle}</h2>
        <p style={{ fontSize: 11.5, color: "var(--text-secondary)", marginBottom: 14 }}>{t.dayEditorNote}</p>

        <div style={{ marginBottom: 16 }}>
          <label style={labelS}>{t.date}</label>
          <input
            type="date"
            value={selectedDayIso}
            onChange={(e) => selectDay(e.target.value)}
            style={{ ...control, borderColor: selectedDayIso ? "var(--blue)" : "#C7D1DA", width: 200 }}
          />
        </div>

        {!selectedDayIso ? (
          <p style={{ fontSize: 12.5, color: "#9AA7B2" }}>{t.selectDayToManage}</p>
        ) : !selectedDay && readOnly ? (
          <p style={{ fontSize: 12.5, color: "#9AA7B2" }}>{t.dayNotConfigured}</p>
        ) : (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
            <div>
              <label style={labelS}>{t.openTime}</label>
              <input
                type="time"
                value={dayOpenTime}
                onChange={(e) => setDayOpenTime(e.target.value)}
                disabled={disabled}
                style={control}
              />
            </div>
            <div>
              <label style={labelS}>{t.closeTime}</label>
              <input
                type="time"
                value={dayCloseTime}
                onChange={(e) => setDayCloseTime(e.target.value)}
                disabled={disabled}
                style={control}
              />
            </div>
            {!readOnly && (
              <button
                type="button"
                disabled={pending}
                onClick={() => addOrUpdateDay(selectedDayIso, dayOpenTime, dayCloseTime)}
                style={{ height: 36, borderRadius: 7, border: "none", background: "var(--blue)", color: "#fff", fontWeight: 700, fontSize: 12.5, padding: "0 16px" }}
              >
                {selectedDay ? t.saveChanges : t.addHours}
              </button>
            )}
            {!readOnly && selectedDay?.active && (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => closeOperatingDayAction(venue.id, selectedDayIso))}
                style={{ height: 36, borderRadius: 7, border: "1px solid #C7D1DA", background: "#fff", color: "#B3261E", fontWeight: 600, fontSize: 12.5, padding: "0 14px" }}
              >
                {t.closeDay}
              </button>
            )}
            {!readOnly && selectedDay && !selectedDay.active && (
              <button
                type="button"
                disabled={pending}
                onClick={() => addOrUpdateDay(selectedDayIso, dayOpenTime, dayCloseTime)}
                style={{ height: 36, borderRadius: 7, border: "1px solid #C7D1DA", background: "#fff", color: "var(--st-confirmed-text)", fontWeight: 600, fontSize: 12.5, padding: "0 14px" }}
              >
                {t.reopenDay}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Break periods — filterable overview across the whole schedule
          (break-periods date filter): pick a day to see only its breaks, or
          leave it on "All" to review every configured break at once. */}
      <div style={card}>
        <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{t.breakPeriods}</h2>
        <p style={{ fontSize: 11.5, color: "var(--text-secondary)", marginBottom: 14 }}>{t.breakPeriodsNote}</p>

        <div style={{ marginBottom: 16 }}>
          <label style={labelS}>{t.filterByDate}</label>
          <select
            value={breakFilterDate}
            onChange={(e) => setBreakFilterDate(e.target.value)}
            style={{ ...control, minWidth: 180 }}
          >
            <option value="">{t.all}</option>
            {openDays.map((d) => (
              <option key={d.dateIso} value={d.dateIso}>{d.dateDisplay}</option>
            ))}
          </select>
        </div>

        {!readOnly && (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <div>
              <label style={labelS}>{t.date}</label>
              <select value={newBreakDate} onChange={(e) => setNewBreakDate(e.target.value)} style={{ ...control, minWidth: 150 }}>
                <option value="">—</option>
                {openDays.map((d) => (
                  <option key={d.dateIso} value={d.dateIso}>{d.dateDisplay}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelS}>{t.breakStart}</label>
              <input type="time" value={newBreakStart} onChange={(e) => setNewBreakStart(e.target.value)} style={control} />
            </div>
            <div>
              <label style={labelS}>{t.breakEnd}</label>
              <input type="time" value={newBreakEnd} onChange={(e) => setNewBreakEnd(e.target.value)} style={control} />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={labelS}>{t.breakLabelField} <span style={{ color: "#9AA7B2" }}>{t.optional}</span></label>
              <input value={newBreakLabel} onChange={(e) => setNewBreakLabel(e.target.value)} placeholder={t.breakLabelPh} style={{ ...control, width: "100%" }} />
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!newBreakDate) { setError(t.dateRequired); return; }
                run(() => addBreakAction(venue.id, newBreakDate, newBreakStart, newBreakEnd, newBreakLabel));
                setNewBreakLabel("");
              }}
              style={{ height: 36, borderRadius: 7, border: "none", background: "var(--blue)", color: "#fff", fontWeight: 700, fontSize: 12.5, padding: "0 16px" }}
            >
              {t.addBreak}
            </button>
          </div>
        )}

        <div className="table-scroll">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: "#F8FAFB" }}>
            <tr>
              <th style={th}>{t.date}</th>
              <th style={th}>{t.breakStart}</th>
              <th style={th}>{t.breakEnd}</th>
              <th style={th}>{t.breakLabelField}</th>
              <th style={{ ...th, textAlign: "right" }}>{t.colActions}</th>
            </tr>
          </thead>
          <tbody>
            {filteredBreaks.length === 0 && (
              <tr><td style={{ ...td, color: "#9AA7B2" }} colSpan={5}>{t.noBreaks}</td></tr>
            )}
            {filteredBreaks.map((b) => (
              <tr key={b.id}>
                <td style={{ ...td, fontFamily: "var(--font-mono)" }}>{b.dateDisplay}</td>
                <td style={{ ...td, fontFamily: "var(--font-mono)" }}>{b.startTime}</td>
                <td style={{ ...td, fontFamily: "var(--font-mono)" }}>{b.endTime}</td>
                <td style={td}>{b.label || "—"}</td>
                <td style={{ ...td, textAlign: "right" }}>
                  {readOnly ? (
                    <span style={{ color: "#9AA7B2" }}>—</span>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => run(() => removeBreakAction(venue.id, b.id))}
                      style={{ background: "none", border: "none", color: "#B3261E", fontWeight: 600, fontSize: 12 }}
                    >
                      {t.remove}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Compound & gate maintenance (§8, §15.5) */}
      <div className="two-col-cards">
        <div style={card}>
          <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{t.compounds}</h2>
          <p style={{ fontSize: 11.5, color: "var(--text-secondary)", marginBottom: 14 }}>{t.compoundsNote}</p>

          {!readOnly && (
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
          )}

          <div className="table-scroll">
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
                    {readOnly ? (
                      <span style={{ color: "#9AA7B2" }}>—</span>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => removeCompoundAction(venue.id, c.id))}
                        style={{ background: "none", border: "none", color: "#B3261E", fontWeight: 600, fontSize: 12 }}
                      >
                        {t.remove}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        <div style={card}>
          <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{t.gates}</h2>
          <p style={{ fontSize: 11.5, color: "var(--text-secondary)", marginBottom: 14 }}>{t.gatesNote}</p>

          {!readOnly && (
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
          )}

          <div className="table-scroll">
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
                    {readOnly ? (
                      <span style={{ color: "#9AA7B2" }}>—</span>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => run(() => removeGateAction(venue.id, g.id))}
                        style={{ background: "none", border: "none", color: "#B3261E", fontWeight: 600, fontSize: 12 }}
                      >
                        {t.remove}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
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
                            disabled={disabled}
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
