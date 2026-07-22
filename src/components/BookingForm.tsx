"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dict, Lang } from "@/lib/i18n";
import { translateMasterData } from "@/lib/i18n";
import { minutesToHm } from "@/lib/time";
import { MAX_BOOKING_MINUTES } from "@/lib/constants";
import { PhoneInput } from "./PhoneInput";
import {
  createBookingAction,
  getRouting,
  getSlots,
  type SlotDto,
} from "@/app/supplier/actions";

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

const label: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 11,
  color: "#33475B",
  display: "block",
  marginBottom: 4,
};
const control: React.CSSProperties = {
  height: 36,
  borderRadius: 7,
  border: "1px solid #C7D1DA",
  padding: "0 10px",
  fontSize: 12.5,
  width: "100%",
  background: "#fff",
};
const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid var(--border-card)",
  borderRadius: 10,
  padding: "22px 24px",
};

export function BookingForm({
  t,
  lang,
  venues,
  supplierName,
  vehicleTypes,
  merchTypes,
  packTypes,
  defaultDate,
}: {
  t: Dict;
  lang: Lang;
  venues: VenueOpt[];
  supplierName: string;
  vehicleTypes: string[];
  merchTypes: string[];
  packTypes: string[];
  defaultDate: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [type, setType] = useState<"delivery" | "collection">("delivery");
  const [transporterName, setTransporterName] = useState("");
  const [transporterContact, setTransporterContact] = useState("");
  const [supplierContact, setSupplierContact] = useState("");
  const [vehicleType, setVehicleType] = useState(vehicleTypes[0] ?? "");
  const [merchandiseType, setMerchandiseType] = useState(merchTypes[0] ?? "");
  const [packagingType, setPackagingType] = useState("");
  const [quantity, setQuantity] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [volumeM3, setVolumeM3] = useState("");
  const [comments, setComments] = useState("");

  const [venueId, setVenueId] = useState("");
  const [dateIso, setDateIso] = useState(defaultDate);
  const [routing, setRouting] = useState<RoutingCompound[]>([]);
  const [compoundId, setCompoundId] = useState("");
  const [gateId, setGateId] = useState("");

  const [slotState, setSlotState] = useState<{
    open: boolean;
    openTime?: string;
    closeTime?: string;
    slots: SlotDto[];
  }>({ open: false, slots: [] });
  const [sel, setSel] = useState<{ start: number; end: number } | null>(null);

  const [result, setResult] = useState<{ ok: boolean; msg: string; id?: string } | null>(null);

  const effectiveRouting = venueId ? routing : [];
  const gatesForCompound =
    effectiveRouting.find((c) => c.id === compoundId)?.gates ?? [];
  const singleGate = gatesForCompound.length === 1;
  const effectiveGateId = singleGate ? (gatesForCompound[0]?.id ?? "") : gateId;

  // Venue → routing + slots.
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

  // Venue + date → slots.
  useEffect(() => {
    if (!venueId || !dateIso) return;
    let active = true;
    getSlots(venueId, dateIso).then((next) => {
      if (!active) return;
      setSlotState(next);
    });
    return () => {
      active = false;
    };
  }, [venueId, dateIso]);

  function clickSlot(s: SlotDto) {
    if (!s.available) return;
    if (!sel) {
      setSel({ start: s.startMinutes, end: s.endMinutes });
      return;
    }
    // Toggle off if it's the single selected slot.
    if (sel.start === s.startMinutes && sel.end === s.endMinutes) {
      setSel(null);
      return;
    }
    const lo = Math.min(sel.start, s.startMinutes);
    const hi = Math.max(sel.end, s.endMinutes);
    const within = slotState.slots.filter(
      (x) => x.startMinutes >= lo && x.endMinutes <= hi,
    );
    const allAvailable = within.every((x) => x.available);
    if (allAvailable && hi - lo <= MAX_BOOKING_MINUTES) {
      setSel({ start: lo, end: hi });
    } else {
      setSel({ start: s.startMinutes, end: s.endMinutes });
    }
  }

  const totalMinutes = sel ? sel.end - sel.start : 0;
  const canSubmit =
    !!venueId &&
    !!compoundId &&
    !!effectiveGateId &&
    !!sel &&
    !!transporterName &&
    !!transporterContact &&
    !pending;

  function submit() {
    if (!sel) return;
    setResult(null);
    startTransition(async () => {
      const res = await createBookingAction({
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
        slotStartMinutes: sel.start,
        slotEndMinutes: sel.end,
        comments,
      });
      if (res.ok) {
        setResult({ ok: true, msg: res.reference, id: res.id });
        setSel(null);
        setTransporterName("");
        setTransporterContact("");
        getSlots(venueId, dateIso).then(setSlotState);
        router.refresh();
      } else {
        setResult({ ok: false, msg: res.error });
      }
    });
  }

  const typeBtn = (value: "delivery" | "collection", text: string, arrow: string) => {
    const active = type === value;
    return (
      <button
        type="button"
        onClick={() => setType(value)}
        style={{
          flex: 1,
          height: 34,
          borderRadius: 7,
          border: "1px solid " + (active ? "var(--blue)" : "#C7D1DA"),
          background: active ? "var(--blue)" : "#fff",
          color: active ? "#fff" : "var(--text-secondary)",
          fontWeight: 600,
          fontSize: 12.5,
        }}
      >
        {arrow} {text}
      </button>
    );
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 384px", gap: 22, alignItems: "start" }}>
      {/* Form card */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontWeight: 700, fontSize: 16 }}>{t.newBooking}</h2>
          <div style={{ display: "flex", gap: 8, width: 260 }}>
            {typeBtn("delivery", t.delivery, "↓")}
            {typeBtn("collection", t.collection, "↑")}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 18px" }}>
          <div>
            <label style={label}>{t.supplier}</label>
            <input
              readOnly
              value={supplierName}
              style={{ ...control, background: "#F4F6F8", border: "1px solid #E3E9EF", color: "#5A6B7C" }}
            />
          </div>
          <div>
            <label style={label}>
              {t.supplierPhone} <span style={{ color: "#9AA7B2" }}>{t.optional}</span>
            </label>
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
              {vehicleTypes.map((v) => (
                <option key={v} value={v}>{translateMasterData(v, lang)}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={label}>{t.merchType}</label>
            <select value={merchandiseType} onChange={(e) => setMerchandiseType(e.target.value)} style={control}>
              {merchTypes.map((v) => (
                <option key={v} value={v}>{translateMasterData(v, lang)}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={label}>
              {t.packType} <span style={{ color: "#9AA7B2" }}>{t.optional}</span>
            </label>
            <select value={packagingType} onChange={(e) => setPackagingType(e.target.value)} style={control}>
              <option value="">—</option>
              {packTypes.map((v) => (
                <option key={v} value={v}>{translateMasterData(v, lang)}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div>
              <label style={label}>{t.qty}</label>
              <input value={quantity} onChange={(e) => setQuantity(e.target.value)} style={control} />
            </div>
            <div>
              <label style={label}>{t.weight}</label>
              <input value={weightKg} onChange={(e) => setWeightKg(e.target.value)} inputMode="decimal" style={control} />
            </div>
            <div>
              <label style={label}>{t.volume}</label>
              <input value={volumeM3} onChange={(e) => setVolumeM3(e.target.value)} inputMode="decimal" style={control} />
            </div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #EBF0F4", margin: "18px 0 14px" }} />
        <div style={{ fontWeight: 700, fontSize: 12.5, letterSpacing: ".04em", color: "#33475B", marginBottom: 12 }}>
          {t.whereWhen}
        </div>

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
                setSel(null);
              }}
              style={{ ...control, borderColor: venueId ? "var(--blue)" : "#C7D1DA" }}
            >
              <option value="">—</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.siteCode})
                </option>
              ))}
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
                setSel(null);
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
              {effectiveRouting.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label === "OTHER" && c.department === "OTHER"
                    ? "Cleaning & Waste"
                    : `${c.label} · ${c.department}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={label}>{t.gate}</label>
            <select
              value={effectiveGateId}
              onChange={(e) => setGateId(e.target.value)}
              disabled={!compoundId || singleGate}
              style={{
                ...control,
                background: singleGate ? "#F4F6F8" : "#fff",
                borderColor: effectiveGateId ? "var(--blue)" : "#C7D1DA",
              }}
            >
              <option value="">—</option>
              {gatesForCompound.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
            {singleGate && (
              <span style={{ fontSize: 10.5, color: "#00753A" }}>{t.autoSelected}</span>
            )}
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={label}>
            {t.comments} <span style={{ color: "#9AA7B2" }}>{t.optional}</span>
          </label>
          <input
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder={t.commentsPh}
            style={control}
          />
        </div>
      </div>

      {/* Right column: slot picker + summary */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
            <h3 style={{ fontWeight: 700, fontSize: 14 }}>{t.slotTitle}</h3>
            {slotState.open && (
              <span className="mono" style={{ fontSize: 10.5, color: "#5A6B7C" }}>
                {slotState.openTime}–{slotState.closeTime}
              </span>
            )}
          </div>
          <p style={{ fontSize: 11, color: "#5A6B7C", marginBottom: 10 }}>{t.slotHint}</p>

          {!venueId || !dateIso ? (
            <p style={{ fontSize: 12, color: "#9AA7B2" }}>—</p>
          ) : !slotState.open ? (
            <p style={{ fontSize: 12, color: "var(--st-cancelled-text)" }}>{t.closedDay}</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 7 }}>
              {slotState.slots.map((s) => {
                const selected = sel && s.startMinutes >= sel.start && s.endMinutes <= sel.end;
                const base: React.CSSProperties = {
                  height: 32,
                  borderRadius: 6,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  border: "1px solid #C7D1DA",
                  background: "#fff",
                  color: "var(--ink)",
                };
                let st = base;
                if (!s.available)
                  st = {
                    ...base,
                    background: "#F4F6F8",
                    border: "1px solid #E3E9EF",
                    color: "#B6C0C9",
                    textDecoration: "line-through",
                    cursor: "not-allowed",
                  };
                else if (selected)
                  st = { ...base, background: "var(--blue)", color: "#fff", border: "1px solid var(--blue)", fontWeight: 600 };
                return (
                  <button key={s.startMinutes} type="button" onClick={() => clickSlot(s)} style={st}>
                    {minutesToHm(s.startMinutes)}
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ display: "flex", gap: 14, marginTop: 12, fontSize: 10.5, color: "#5A6B7C" }}>
            <Legend color="#fff" border="#C7D1DA" label={t.legFree} />
            <Legend color="var(--blue)" border="var(--blue)" label={t.legSelected} />
            <Legend color="#F4F6F8" border="#E3E9EF" label={t.legHeld} />
          </div>
        </div>

        <div style={card}>
          <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>{t.summary}</h3>
          <Row label={t.window}>
            <span className="mono" style={{ fontWeight: 600, fontSize: 13, color: "var(--blue)" }}>
              {sel ? `${minutesToHm(sel.start)} → ${minutesToHm(sel.end)}` : "—"}
            </span>
          </Row>
          <div style={{ margin: "10px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#5A6B7C", marginBottom: 4 }}>
              <span>
                {t.capNote} · {Math.floor(totalMinutes / 60)} h {String(totalMinutes % 60).padStart(2, "0")} / 2 h
              </span>
            </div>
            <div style={{ height: 6, background: "#EBF0F4", borderRadius: 4, overflow: "hidden" }}>
              <div
                style={{
                  width: `${Math.min(100, (totalMinutes / MAX_BOOKING_MINUTES) * 100)}%`,
                  height: "100%",
                  background: "var(--blue)",
                }}
              />
            </div>
          </div>

          {result && (
            <div
              role="alert"
              style={{
                borderRadius: 8,
                padding: "9px 11px",
                margin: "10px 0",
                fontSize: 12,
                background: result.ok ? "var(--st-confirmed-bg)" : "var(--st-cancelled-bg)",
                color: result.ok ? "var(--st-confirmed-text)" : "var(--st-cancelled-text)",
              }}
            >
              {result.ok ? (
                <>
                  ✓ <span className="mono" style={{ fontWeight: 600 }}>{result.msg}</span>
                  {result.id && (
                    <a
                      href={`/bookings/${result.id}/confirmation`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ marginLeft: 10, color: "var(--st-confirmed-text)", fontWeight: 700, textDecoration: "underline" }}
                    >
                      ⎙ {t.downloadPdf}
                    </a>
                  )}
                </>
              ) : (
                result.msg
              )}
            </div>
          )}

          <button
            type="button"
            disabled={!canSubmit}
            onClick={submit}
            style={{
              height: 42,
              width: "100%",
              borderRadius: 7,
              border: "none",
              background: canSubmit ? "var(--blue)" : "#B6C0C9",
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              marginTop: 4,
            }}
          >
            {t.submit}
          </button>
          <p style={{ fontSize: 10.5, color: "#5A6B7C", marginTop: 8, lineHeight: 1.4 }}>
            {t.autoConfirmNote}
          </p>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, border, label }: { color: string; border: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 10, height: 10, background: color, border: `1px solid ${border}`, borderRadius: 3 }} />
      {label}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", fontSize: 12 }}>
      <span style={{ color: "#5A6B7C" }}>{label}</span>
      {children}
    </div>
  );
}
