"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dict } from "@/lib/i18n";
import { changePasswordAction, updateContactAction } from "@/app/settings/actions";

const card: React.CSSProperties = { background: "#fff", border: "1px solid var(--border-card)", borderRadius: 10, padding: "20px 22px" };
const labelS: React.CSSProperties = { fontWeight: 600, fontSize: 11, color: "#33475B", display: "block", marginBottom: 4 };
const control: React.CSSProperties = { height: 36, borderRadius: 7, border: "1px solid #C7D1DA", padding: "0 10px", fontSize: 12.5, width: "100%", background: "#fff" };
const primary: React.CSSProperties = { height: 40, borderRadius: 7, border: "none", background: "var(--blue)", color: "#fff", fontWeight: 700, fontSize: 13, padding: "0 18px" };

export function SettingsForm({
  t,
  phone,
  mustChange,
}: {
  t: Dict;
  phone: string;
  mustChange: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState(false);

  const [phoneVal, setPhoneVal] = useState(phone);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactOk, setContactOk] = useState(false);

  function submitPassword() {
    setPwError(null);
    setPwOk(false);
    if (next !== confirm) {
      setPwError(t.passwordMismatch);
      return;
    }
    startTransition(async () => {
      const res = await changePasswordAction(current, next);
      if (res.ok) {
        setPwOk(true);
        setCurrent("");
        setNext("");
        setConfirm("");
        router.refresh();
      } else {
        setPwError(res.error ?? "Error");
      }
    });
  }

  function submitContact() {
    setContactError(null);
    setContactOk(false);
    startTransition(async () => {
      const res = await updateContactAction(phoneVal);
      if (res.ok) {
        setContactOk(true);
        router.refresh();
      } else {
        setContactError(res.error ?? "Error");
      }
    });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
      {/* Password */}
      <div style={card}>
        <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>{t.changePassword}</h2>
        {mustChange && (
          <p style={{ fontSize: 12, color: "var(--st-pending-text)", background: "var(--st-pending-bg)", borderRadius: 7, padding: "8px 10px", marginBottom: 14 }}>
            {t.mustChangeNote}
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={labelS}>{t.currentPassword}</label>
            <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} style={control} />
          </div>
          <div>
            <label style={labelS}>{t.newPassword}</label>
            <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} style={control} />
          </div>
          <div>
            <label style={labelS}>{t.confirmPassword}</label>
            <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={control} />
          </div>
          {pwError && <p style={{ color: "var(--st-cancelled-text)", fontSize: 12 }}>{pwError}</p>}
          {pwOk && <p style={{ color: "var(--st-confirmed-text)", fontSize: 12 }}>✓ {t.passwordChanged}</p>}
          <button type="button" disabled={pending} onClick={submitPassword} style={primary}>{t.save}</button>
        </div>
      </div>

      {/* Contact details */}
      <div style={card}>
        <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>{t.contactDetails}</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={labelS}>{t.phone} {t.optional}</label>
            <input value={phoneVal} onChange={(e) => setPhoneVal(e.target.value)} style={control} />
          </div>
          {contactError && <p style={{ color: "var(--st-cancelled-text)", fontSize: 12 }}>{contactError}</p>}
          {contactOk && <p style={{ color: "var(--st-confirmed-text)", fontSize: 12 }}>✓ {t.contactSaved}</p>}
          <button type="button" disabled={pending} onClick={submitContact} style={primary}>{t.save}</button>
        </div>
      </div>
    </div>
  );
}
