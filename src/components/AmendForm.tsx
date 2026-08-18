"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dict, Lang } from "@/lib/i18n";
import { translateMasterData } from "@/lib/i18n";
import { minutesToHm } from "@/lib/time";
import { MAX_BOOKING_MINUTES } from "@/lib/constants";
import { PhoneInput } from "./PhoneInput";
import { getRouting, getSlots, type SlotDto } from "@/app/supplier/actions";
import { amendBookingAction } from "@/app/bookings/actions";

interface VenueOpt {
  id: string;
  name: string;
  siteCode: string;
}
interface RoutingCompound {
  id: string;
  department: string;
  label: string;
  gates: { id: string; label: string }[];
}
export interface AmendInitial {
  reference: string;
  type: "delivery" | "collection";
  supplierContact: string;
  transporterName: string;
  transporterContact: string;
  vehicleType: string;
  merchandiseType: string;
  packagingType: string;
  quantity: string;
  weightKg: string;
  volumeM3: string;
  venueId: string;
  dateIso: string;
  compoundId: string;
  gateId: string;
  startMinutes: number;
  endMinutes: number;
  comments: string;
}

const label: React.CSSProperties = { fontWeight: 600, fontSize: 11, color: "#33475B", display: "block", marginBottom: 4 };
const control: React.CSSProperties = { height: 36, borderRadius: 7, border: "1px solid #C7D1DA", padding: "0 10px", fontSize: 12.5, width: "100%", background: "#fff" };
const card: React.CSSProperties = { background: "#fff", border: "1px solid var(--border-card)", borderRadius: 10, padding: "22px 24px" };

/** Red asterisk marking a mandatory field — mirrors BookingForm's RequiredMark. */
function RequiredMark({ t }: { t: Dict }) {
  return (
    <span style={{ color: "var(--st-cancelled-text)" }} title={t.requiredField} aria-label={t.requiredField}>
      *
    </span>
  );
}

export function AmendForm({
  t,
  lang,
  bookingId,
  initial,
  venues,
  vehicleTypes,
  merchTypes,
  packTypes,
  supplierName,
  backHref,
}: {
  t: Dict;
  lang: Lang;
  bookingId: string;
  initial: AmendInitial;
  venues: VenueOpt[];
  vehicleTypes: string[];
  merchTypes: string[];
  packTypes: string[];
  supplierName: string;
  backHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [type, setType] = useState(initial.type);
  const [transporterName, setTransporterName] = useState(initial.transporterName);
  const [transporterContact, setTransporterContact] = useState(initial.transporterContact);
  const [supplierContact, setSupplierContact] = useState(initial.supplierContact);
  const [vehicleType, setVehicleType] = useState(initial.vehicleType);
  const [merchandiseType, setMerchandiseType] = useState(initial.merchandiseType);
  const [packagingType, setPackagingType] = useState(initial.packagingType);
  const [quantity, setQuantity] = useState(initial.quantity);
  const [weightKg, setWeightKg] = useState(initial.weightKg);
  const [volumeM3, setVolumeM3] = useState(initial.volumeM3);
  const [comments, setComments] = useState(initial.comments);

  const [venueId, setVenueId] = useState(initial.venueId);
  const [dateIso, setDateIso] = useState(initial.dateIso);
  const [routing, setRouting] = useState<RoutingCompound[]>([]);
  const [compoundId, setCompoundId] = useState(initial.compoundId);
  const [gateId, setGateId] = useState(initial.gateId);

  const [slotState, setSlotState] = useState<{ open: boolean; openTime?: string; closeTime?: string; slots: SlotDto[] }>({ open: false, slots: [] });
  // Selected slots, keyed by startMinutes — see BookingForm for the full
  // rationale. Seeded once from the booking's current window below.
  const [sel, setSel] = useState<Set<number>>(new Set());
  const seededInitialSel = useRef(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const effectiveRouting = venueId ? routing : [];
  const gatesForCompound = effectiveRouting.find((c) => c.id === compoundId)?.gates ?? [];
  const singleGate = gatesForCompound.length === 1;
  const effectiveGateId = singleGate ? (gatesForCompound[0]?.id ?? "") : gateId;

  useEffect(() => {
    if (!venueId) return;
    let active = true;
    getRouting(venueId).then((r) => {
      if (!active) return;
      setRouting(r);
    });
    return () => {
      active = false;
    };
  }, [venueId]);

  useEffect(() => {
    if (!venueId || !dateIso) return;
    let active = true;
    getSlots(venueId, dateIso).then((next) => {
      if (!active) return;
      setSlotState(next);
      // Seed the selection from the booking's current window the first time
      // its own venue/date load in — later reloads (user changing venue or
      // date) must not re-seed over their in-progress selection.
      if (!seededInitialSel.current && venueId === initial.venueId && dateIso === initial.dateIso) {
        seededInitialSel.current = true;
        const seed = next.slots
          .filter((s) => s.startMinutes >= initial.startMinutes && s.endMinutes <= initial.endMinutes)
          .map((s) => s.startMinutes);
        setSel(new Set(seed));
      }
    });
    return () => {
      active = false;
    };
  }, [venueId, dateIso, initial.venueId, initial.dateIso, initial.startMinutes, initial.endMinutes]);

  /** Toggle a single slot in/out of the selection — see BookingForm. */
  function clickSlot(s: SlotDto) {
    if (!s.available) return;
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(s.startMinutes)) next.delete(s.startMinutes);
      else next.add(s.startMinutes);
      return next;
    });
  }

  const selectedSlots = slotState.slots
    .filter((s) => sel.has(s.startMinutes))
    .sort((a, b) => a.startMinutes - b.startMinutes);
  const isContiguous = selectedSlots.every(
    (s, i) => i === 0 || s.startMinutes === selectedSlots[i - 1].endMinutes,
  );
  const selWindow =
    selectedSlots.length > 0
      ? { start: selectedSlots[0].startMinutes, end: selectedSlots[selectedSlots.length - 1].endMinutes }
      : null;
  const withinCap = !!selWindow && selWindow.end - selWindow.start <= MAX_BOOKING_MINUTES;
  const selectionValid = selectedSlots.length > 0 && isContiguous && withinCap;

  const totalMinutes = selWindow ? selWindow.end - selWindow.start : 0;
  const canSubmit =
    !!venueId &&
    !!compoundId &&
    !!effectiveGateId &&
    selectionValid &&
    !!supplierContact &&
    !!transporterName &&
    !!transporterContact &&
    !!packagingType &&
    !!quantity.trim() &&
    !pending;

  function submit() {
    if (!selectionValid || !selWindow) return;
    setResult(null);
    startTransition(async () => {
      const res = await amendBookingAction(bookingId, {
        type,
        supplierContact,
        transporterName,
        transporterContact,
        vehicleType,
        merchandiseType,
        packagingType,
        quantity,
        weightKg,
        volumeM3,
        venueId,
        compoundId,
        gateId: effectiveGateId,
        dateIso,
        slotStartMinutes: selWindow.start,
        slotEndMinutes: selWindow.end,
        comments,
      });
      if (res.ok) {
        router.push(backHref);
        router.refresh();
      } else {
        setResult({ ok: false, msg: res.error });
      }
    });
  }

  const typeBtn = (value: "delivery" | "collection", text: string, arrow: string) => {
    const active = type === value;
    return (
      <button type="button" onClick={() => setType(value)} style={{ flex: 1, height: 34, borderRadius: 7, border: "1px solid " + (active ? "var(--blue)" : "#C7D1DA"), background: active ? "var(--blue)" : "#fff", color: active ? "#fff" : "var(--text-secondary)", fontWeight: 600, fontSize: 12.5 }}>
        {arrow} {text}
      </button>
    );
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 384px", gap: 22, alignItems: "start" }}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ fontWeight: 700, fontSize: 16 }}>{t.editBooking}</h2>
            <span className="mono" style={{ fontSize: 11.5, color: "var(--blue)" }}>{initial.reference}</span>
          </div>
          <div style={{ display: "flex", gap: 8, width: 260 }}>
            {typeBtn("delivery", t.delivery, "↓")}
            {typeBtn("collection", t.collection, "↑")}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 18px" }}>
          <div>
            <label style={label}>{t.supplier}</label>
            <input readOnly value={supplierName} style={{ ...control, background: "#F4F6F8", border: "1px solid #E3E9EF", color: "#5A6B7C" }} />
          </div>
          <div>
            <label style={label}>{t.supplierPhone}</label>
            <PhoneInput value={supplierContact} onChange={setSupplierContact} />
          </div>
          <div>
            <label style={label}>{t.transporter}</label>
            <input value={transporterName} onChange={(e) => setTransporterName(e.target.value)} style={control} />
          </div>
          <div>
            <label style={label}>{t.transporterPhone}</label>
            <PhoneInput value={transporterContact} onChange={setTransporterContact} />
          </div>
          <div>
            <label style={label}>{t.vehicleType}</label>
            <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} style={control}>
              {vehicleTypes.map((v) => <option key={v} value={v}>{translateMasterData(v, lang)}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>{t.merchType}</label>
            <select value={merchandiseType} onChange={(e) => setMerchandiseType(e.target.value)} style={control}>
              {merchTypes.map((v) => <option key={v} value={v}>{translateMasterData(v, lang)}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>{t.packType} <RequiredMark t={t} /></label>
            <select value={packagingType} onChange={(e) => setPackagingType(e.target.value)} style={control}>
              <option value="">—</option>
              {packTypes.map((v) => <option key={v} value={v}>{translateMasterData(v, lang)}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div><label style={label}>{t.qty} <RequiredMark t={t} /></label><input value={quantity} onChange={(e) => setQuantity(e.target.value)} style={control} /></div>
            <div><label style={label}>{t.weight}</label><input value={weightKg} onChange={(e) => setWeightKg(e.target.value)} inputMode="decimal" style={control} /></div>
            <div><label style={label}>{t.volume}</label><input value={volumeM3} onChange={(e) => setVolumeM3(e.target.value)} inputMode="decimal" style={control} /></div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #EBF0F4", margin: "18px 0 14px" }} />
        <div style={{ fontWeight: 700, fontSize: 12.5, letterSpacing: ".04em", color: "#33475B", marginBottom: 12 }}>{t.whereWhen}</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 18px" }}>
          <div>
            <label style={label}>{t.venue}</label>
            <select
              value={venueId}
              onChange={(e) => {
                setVenueId(e.target.value);
                setRouting([]);
                setCompoundId("");
                setGateId("");
                setSlotState({ open: false, slots: [] });
                setSel(new Set());
              }}
              style={{ ...control, borderColor: venueId ? "var(--blue)" : "#C7D1DA" }}
            >
              <option value="">—</option>
              {venues.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.siteCode})</option>)}
            </select>
          </div>
          <div>
            <label style={label}>{t.date}</label>
            <input
              type="date"
              value={dateIso}
              onChange={(e) => {
                setDateIso(e.target.value);
                setSlotState({ open: false, slots: [] });
                setSel(new Set());
              }}
              style={{ ...control, borderColor: dateIso ? "var(--blue)" : "#C7D1DA" }}
            />
          </div>
          <div>
            <label style={label}>{t.compound}</label>
            <select
              value={compoundId}
              onChange={(e) => {
                setCompoundId(e.target.value);
                setGateId("");
              }}
              disabled={!venueId}
              style={{ ...control, borderColor: compoundId ? "var(--blue)" : "#C7D1DA" }}
            >
              <option value="">—</option>
              {effectiveRouting.map((c) => <option key={c.id} value={c.id}>{c.label === "OTHER" && c.department === "OTHER" ? "Cleaning & Waste" : `${c.label} · ${c.department}`}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>{t.gate}</label>
            <select
              value={effectiveGateId}
              onChange={(e) => setGateId(e.target.value)}
              disabled={!compoundId || singleGate}
              style={{ ...control, background: singleGate ? "#F4F6F8" : "#fff", borderColor: effectiveGateId ? "var(--blue)" : "#C7D1DA" }}
            >
              <option value="">—</option>
              {gatesForCompound.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
            {singleGate && <span style={{ fontSize: 10.5, color: "#00753A" }}>{t.autoSelected}</span>}
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={label}>{t.comments} <span style={{ color: "#9AA7B2" }}>{t.optional}</span></label>
          <input value={comments} onChange={(e) => setComments(e.target.value)} placeholder={t.commentsPh} style={control} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
            <h3 style={{ fontWeight: 700, fontSize: 14 }}>{t.slotTitle}</h3>
            {slotState.open && <span className="mono" style={{ fontSize: 10.5, color: "#5A6B7C" }}>{slotState.openTime}–{slotState.closeTime}</span>}
          </div>
          <p style={{ fontSize: 11, color: "#5A6B7C", marginBottom: 10 }}>{t.slotHint}</p>
          {!venueId || !dateIso ? (
            <p style={{ fontSize: 12, color: "#9AA7B2" }}>—</p>
          ) : !slotState.open ? (
            <p style={{ fontSize: 12, color: "var(--st-cancelled-text)" }}>{t.closedDay}</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 7 }}>
              {slotState.slots.map((s) => {
                const selected = sel.has(s.startMinutes);
                const base: React.CSSProperties = { height: 32, borderRadius: 6, fontFamily: "var(--font-mono)", fontSize: 11, border: "1px solid #C7D1DA", background: "#fff", color: "var(--ink)" };
                let st = base;
                if (!s.available) st = { ...base, background: "#F4F6F8", border: "1px solid #E3E9EF", color: "#B6C0C9", textDecoration: "line-through", cursor: "not-allowed" };
                else if (selected) st = { ...base, background: "var(--blue)", color: "#fff", border: "1px solid var(--blue)", fontWeight: 600 };
                return <button key={s.startMinutes} type="button" onClick={() => clickSlot(s)} style={st}>{minutesToHm(s.startMinutes)}</button>;
              })}
            </div>
          )}
          {selectedSlots.length > 0 && !isContiguous && (
            <p style={{ fontSize: 11, color: "var(--st-cancelled-text)", marginTop: 8 }}>{t.slotNonContiguous}</p>
          )}
          {selectedSlots.length > 0 && isContiguous && !withinCap && (
            <p style={{ fontSize: 11, color: "var(--st-cancelled-text)", marginTop: 8 }}>{t.slotMaxExceeded}</p>
          )}
        </div>

        <div style={card}>
          <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>{t.summary}</h3>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", fontSize: 12 }}>
            <span style={{ color: "#5A6B7C" }}>{t.window}</span>
            <span className="mono" style={{ fontWeight: 600, fontSize: 13, color: "var(--blue)" }}>
              {selWindow ? (isContiguous ? `${minutesToHm(selWindow.start)} → ${minutesToHm(selWindow.end)}` : t.slotNonContiguous) : "—"}
            </span>
          </div>
          <div style={{ margin: "10px 0" }}>
            <div style={{ fontSize: 11, color: "#5A6B7C", marginBottom: 4 }}>{t.capNote} · {Math.floor(totalMinutes / 60)} h {String(totalMinutes % 60).padStart(2, "0")} / 2 h</div>
            <div style={{ height: 6, background: "#EBF0F4", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, (totalMinutes / MAX_BOOKING_MINUTES) * 100)}%`, height: "100%", background: "var(--blue)" }} />
            </div>
          </div>
          {result && !result.ok && (
            <div role="alert" style={{ borderRadius: 8, padding: "9px 11px", margin: "10px 0", fontSize: 12, background: "var(--st-cancelled-bg)", color: "var(--st-cancelled-text)" }}>{result.msg}</div>
          )}
          <button type="button" disabled={!canSubmit} onClick={submit} style={{ height: 42, width: "100%", borderRadius: 7, border: "none", background: canSubmit ? "var(--blue)" : "#B6C0C9", color: "#fff", fontWeight: 700, fontSize: 13, marginTop: 4 }}>
            {t.saveChanges}
          </button>
          <a href={backHref} style={{ display: "block", textAlign: "center", marginTop: 10, fontSize: 12, fontWeight: 600, color: "#5A6B7C" }}>← {t.back}</a>
        </div>
      </div>
    </div>
  );
}
