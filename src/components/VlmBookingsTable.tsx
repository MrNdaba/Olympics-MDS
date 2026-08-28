"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dict } from "@/lib/i18n";
import { StatusChip, TypeChip } from "./Chips";
import { ModalCloseButton } from "./ModalCloseButton";
import {
  validateBookingAction,
  rejectBookingAction,
  cancelBookingAction,
  reinstateBookingAction,
} from "@/app/vlm/actions";

export interface VlmRow {
  id: string;
  reference: string;
  type: string;
  window: string;
  dateDisplay: string;
  venueName: string;
  supplierName: string;
  transporterName: string;
  compoundLabel: string;
  gateLabel: string;
  status: string;
  canValidate: boolean;
  canCancel: boolean;
  canReinstate: boolean;
  /** Reason stored on the "cancelled" audit entry, if any (item #5). */
  cancelReason?: string | null;
}

const th: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: ".05em",
  color: "#5A6B7C",
  textAlign: "left",
  padding: "10px 14px",
};
const td: React.CSSProperties = { padding: "10px 14px", fontSize: 12, borderTop: "1px solid #F0F3F6", verticalAlign: "middle" };
const mono: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 11.5 };

type Dialog = { id: string; kind: "reject" | "cancel" | "reinstate" } | null;

export function VlmBookingsTable({
  t,
  rows,
  readOnly = false,
}: {
  t: Dict;
  rows: VlmRow[];
  /** View Only accounts (item #3): render the same table, but every
   *  validate/reject/amend/cancel/reinstate control is hidden — the read
   *  path (status, details, PDF link once Confirmed) stays intact. */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Error");
      else {
        setDialog(null);
        setReason("");
        router.refresh();
      }
    });
  }

  function submitDialog() {
    if (!dialog) return;
    // A reason is mandatory for every one of these actions (item #5 covers
    // cancellation; reject/reinstate already required one).
    if (!reason.trim()) {
      setError(t.reasonRequired);
      return;
    }
    if (dialog.kind === "reject") run(() => rejectBookingAction(dialog.id, reason));
    if (dialog.kind === "cancel") run(() => cancelBookingAction(dialog.id, reason));
    if (dialog.kind === "reinstate") run(() => reinstateBookingAction(dialog.id, reason));
  }

  const linkBtn = (color: string, label: string, onClick: () => void) => (
    <button type="button" disabled={pending} onClick={onClick} style={{ background: "none", border: "none", color, fontWeight: 600, fontSize: 12 }}>
      {label}
    </button>
  );
  const solidBtn = (bg: string, label: string, onClick: () => void) => (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      style={{ background: bg, border: "none", color: "#fff", fontWeight: 600, fontSize: 11.5, borderRadius: 6, padding: "5px 9px" }}
    >
      {label}
    </button>
  );
  const outlineBtn = (color: string, label: string, onClick: () => void) => (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      style={{ background: "#fff", border: `1px solid ${color}`, color, fontWeight: 600, fontSize: 11.5, borderRadius: 6, padding: "5px 9px" }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ background: "#fff", border: "1px solid var(--border-card)", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1080 }}>
          <thead style={{ background: "#F8FAFB" }}>
            <tr>
              <th style={th}>{t.colRef}</th>
              <th style={th}>{t.colType}</th>
              <th style={th}>{t.colDate}</th>
              <th style={th}>{t.colWindow}</th>
              <th style={th}>{t.colVenue}</th>
              <th style={th}>{t.colSupplier}</th>
              <th style={th}>{t.colTransporter}</th>
              <th style={th}>{t.colCompound}</th>
              <th style={th}>{t.colGate}</th>
              <th style={th}>{t.colStatus}</th>
              <th style={th}>{t.colActions}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td style={{ ...td, color: "#9AA7B2" }} colSpan={11}>
                  {t.noBookings}
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const pendingRow = r.status === "PendingValidation";
              const terminal = r.status === "Expired";
              return (
                <tr key={r.id} style={{ background: pendingRow ? "#FFFBF2" : undefined, opacity: terminal ? 0.6 : 1 }}>
                  <td style={{ ...td, ...mono }}>{r.reference}</td>
                  <td style={td}><TypeChip type={r.type} t={t} /></td>
                  <td style={{ ...td, ...mono }}>{r.dateDisplay}</td>
                  <td style={{ ...td, ...mono }}>{r.window}</td>
                  <td style={td}>{r.venueName}</td>
                  <td style={td}>{r.supplierName}</td>
                  <td style={td}>{r.transporterName}</td>
                  <td style={td}>{r.compoundLabel}</td>
                  <td style={td}>{r.gateLabel}</td>
                  <td style={td}><StatusChip status={r.status} t={t} reason={r.cancelReason} /></td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {!readOnly && r.canValidate && solidBtn("var(--st-confirmed)", `✓ ${t.validate}`, () => run(() => validateBookingAction(r.id)))}
                      {!readOnly && r.canValidate && outlineBtn("#B3261E", `✕ ${t.reject}`, () => { setDialog({ id: r.id, kind: "reject" }); setReason(""); setError(null); })}
                      {!readOnly && r.canCancel && (
                        <a href={`/bookings/${r.id}/edit`} style={{ color: "var(--blue)", fontWeight: 600, fontSize: 12 }}>
                          {t.amend}
                        </a>
                      )}
                      {!readOnly && r.canCancel && !r.canValidate && linkBtn("#B3261E", t.cancel, () => { setDialog({ id: r.id, kind: "cancel" }); setReason(""); setError(null); })}
                      {r.status === "Confirmed" && (
                        <a href={`/bookings/${r.id}/confirmation`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--st-confirmed-text)", fontWeight: 600, fontSize: 12 }}>
                          ⎙ PDF
                        </a>
                      )}
                      {!readOnly && r.canReinstate && linkBtn("var(--blue)", t.reinstate, () => { setDialog({ id: r.id, kind: "reinstate" }); setReason(""); setError(null); })}
                      {(readOnly || (!r.canValidate && !r.canCancel && !r.canReinstate)) && (
                        <span style={{ color: "#9AA7B2" }}>—</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {dialog && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(18,32,46,.35)", display: "grid", placeItems: "center", zIndex: 50 }}
          onClick={() => !pending && setDialog(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: "relative", background: "#fff", borderRadius: 12, padding: 22, width: 420, maxWidth: "90vw", boxShadow: "0 20px 50px rgba(0,0,0,.25)" }}
          >
            <ModalCloseButton onClick={() => setDialog(null)} disabled={pending} label={t.closeModal} />
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, paddingRight: 24 }}>
              {dialog.kind === "reject" ? t.confirmReject : dialog.kind === "reinstate" ? t.reinstate : t.confirmCancel}
            </h3>
            <label style={{ fontWeight: 600, fontSize: 11.5, color: "#33475B", display: "block", marginBottom: 6 }}>
              {t.reasonRequired}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              style={{ width: "100%", border: "1px solid #C7D1DA", borderRadius: 7, padding: 10, fontSize: 12.5, resize: "vertical" }}
            />
            {error && <p style={{ color: "var(--st-cancelled-text)", fontSize: 12, marginTop: 8 }}>{error}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button
                type="button"
                disabled={pending || !reason.trim()}
                onClick={submitDialog}
                style={{
                  background: !reason.trim() ? "#B6C0C9" : dialog.kind === "reinstate" ? "var(--blue)" : "var(--st-cancelled)",
                  border: "none",
                  borderRadius: 7,
                  padding: "8px 14px",
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "#fff",
                }}
              >
                {dialog.kind === "reject" ? t.reject : dialog.kind === "reinstate" ? t.reinstate : t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && !dialog && (
        <p style={{ color: "var(--st-cancelled-text)", fontSize: 12, padding: "8px 14px" }}>{error}</p>
      )}
    </div>
  );
}
