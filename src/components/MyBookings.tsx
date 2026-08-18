"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dict } from "@/lib/i18n";
import { StatusChip, TypeChip } from "./Chips";
import { SortControl } from "./SortControl";
import { ModalCloseButton } from "./ModalCloseButton";
import { cancelMyBooking } from "@/app/supplier/actions";

export interface BookingRow {
  id: string;
  reference: string;
  type: string;
  siteCode: string;
  venueName: string;
  dateDisplay: string;
  window: string;
  status: string;
  canCancel: boolean;
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
  padding: "10px 18px",
};
const td: React.CSSProperties = { padding: "10px 18px", fontSize: 12, borderTop: "1px solid #F0F3F6" };
const mono: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 11.5 };

export function MyBookings({ t, rows }: { t: Dict; rows: BookingRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogId, setDialogId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function openCancel(id: string) {
    setDialogId(id);
    setReason("");
    setError(null);
  }

  function confirmCancel() {
    if (!dialogId) return;
    if (!reason.trim()) {
      setError(t.reasonRequired);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await cancelMyBooking(dialogId, reason.trim());
      if (res.ok) {
        setDialogId(null);
        setReason("");
        router.refresh();
      } else {
        setError(res.error ?? "Error");
      }
    });
  }

  return (
    <div style={{ background: "#fff", border: "1px solid var(--border-card)", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 18px" }}>
        <h2 style={{ fontWeight: 700, fontSize: 15 }}>{t.myBookings}</h2>
        <SortControl t={t} basePath="/supplier/bookings" />
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
          <thead style={{ background: "#F8FAFB" }}>
            <tr>
              <th style={th}>{t.colRef}</th>
              <th style={th}>{t.colType}</th>
              <th style={th}>{t.colVenue}</th>
              <th style={th}>{t.colDate}</th>
              <th style={th}>{t.colWindow}</th>
              <th style={th}>{t.colStatus}</th>
              <th style={th}>{t.colActions}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td style={{ ...td, color: "#9AA7B2" }} colSpan={7}>
                  {t.noBookings}
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const terminal = r.status === "Cancelled" || r.status === "Expired";
              return (
                <tr key={r.id} style={{ opacity: terminal ? 0.6 : 1 }}>
                  <td style={{ ...td, ...mono }}>{r.reference}</td>
                  <td style={td}>
                    <TypeChip type={r.type} t={t} />
                  </td>
                  <td style={td}>{r.siteCode}</td>
                  <td style={td}>{r.dateDisplay}</td>
                  <td style={{ ...td, ...mono }}>{r.window}</td>
                  <td style={td}>
                    <StatusChip status={r.status} t={t} reason={r.cancelReason} />
                  </td>
                  <td style={td}>
                    {r.canCancel ? (
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <a href={`/bookings/${r.id}/edit`} style={{ color: "var(--blue)", fontWeight: 600, fontSize: 12 }}>
                          {t.amend}
                        </a>
                        {r.status === "Confirmed" && (
                          <a href={`/bookings/${r.id}/confirmation`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--st-confirmed-text)", fontWeight: 600, fontSize: 12 }}>
                            ⎙ PDF
                          </a>
                        )}
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => openCancel(r.id)}
                          style={{ background: "none", border: "none", color: "#B3261E", fontWeight: 600, fontSize: 12 }}
                        >
                          {t.cancel}
                        </button>
                      </div>
                    ) : r.status === "Confirmed" ? (
                      <a href={`/bookings/${r.id}/confirmation`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--st-confirmed-text)", fontWeight: 600, fontSize: 12 }}>
                        ⎙ PDF
                      </a>
                    ) : (
                      <span style={{ color: "#9AA7B2" }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {dialogId && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(18,32,46,.35)", display: "grid", placeItems: "center", zIndex: 50 }}
          onClick={() => !pending && setDialogId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: "relative", background: "#fff", borderRadius: 12, padding: 22, width: 420, maxWidth: "90vw", boxShadow: "0 20px 50px rgba(0,0,0,.25)" }}
          >
            <ModalCloseButton onClick={() => setDialogId(null)} disabled={pending} label={t.closeModal} />
            <h3 style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, paddingRight: 24 }}>{t.confirmCancel}</h3>
            <p style={{ fontSize: 12.5, color: "#5A6B7C", marginBottom: 12 }}>{t.confirmCancelBooking}</p>
            <label style={{ fontWeight: 600, fontSize: 11.5, color: "#33475B", display: "block", marginBottom: 6 }}>
              {t.reasonRequired}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={t.cancelReasonPh}
              style={{ width: "100%", border: "1px solid #C7D1DA", borderRadius: 7, padding: 10, fontSize: 12.5, resize: "vertical" }}
            />
            {error && <p style={{ color: "var(--st-cancelled-text)", fontSize: 12, marginTop: 8 }}>{error}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <button
                type="button"
                disabled={pending || !reason.trim()}
                onClick={confirmCancel}
                style={{
                  background: pending || !reason.trim() ? "#E7ADA9" : "var(--st-cancelled)",
                  border: "none",
                  borderRadius: 7,
                  padding: "8px 14px",
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "#fff",
                }}
              >
                {t.confirmCancelAction}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
