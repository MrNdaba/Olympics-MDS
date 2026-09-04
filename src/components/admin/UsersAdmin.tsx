"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dict } from "@/lib/i18n";
import { PhoneInput } from "@/components/PhoneInput";
import {
  createUserAction,
  updateUserAction,
  setUserStatusAction,
  resetUserPasswordAction,
  type CreateUserInput,
} from "@/app/admin/actions";

interface VenueOpt {
  id: string;
  name: string;
  siteCode: string;
}
export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  phone: string;
  otpChannel: string;
  venues: string[];
  venueIds: string[];
  /** Supplier-only booking-form default (item #2); empty string = none set. */
  preferredMerchandiseType: string;
  /** ISO timestamp — sort key for the Newest/Oldest toggle (item #10). */
  createdAt: string;
}

const card: React.CSSProperties = { background: "#fff", border: "1px solid var(--border-card)", borderRadius: 10, padding: "20px 22px" };
const labelS: React.CSSProperties = { fontWeight: 600, fontSize: 11, color: "#33475B", display: "block", marginBottom: 4 };
const control: React.CSSProperties = { height: 36, borderRadius: 7, border: "1px solid #C7D1DA", padding: "0 10px", fontSize: 12.5, width: "100%", background: "#fff" };
const th: React.CSSProperties = { fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em", color: "#5A6B7C", textAlign: "left", padding: "10px 14px" };
const td: React.CSSProperties = { padding: "10px 14px", fontSize: 12, borderTop: "1px solid #F0F3F6" };

/** Red asterisk marking a mandatory field — mirrors BookingForm's RequiredMark
 *  so required fields read the same way across the app. */
function RequiredMark({ t }: { t: Dict }) {
  return (
    <span style={{ color: "var(--st-cancelled-text)" }} title={t.requiredField} aria-label={t.requiredField}>
      *
    </span>
  );
}

export function UsersAdmin({
  t,
  users,
  venues,
  merchTypes,
  currentAdminId,
}: {
  t: Dict;
  users: UserRow[];
  venues: VenueOpt[];
  /** Active merchandise-type labels, for the supplier default-preselect field (item #2). */
  merchTypes: string[];
  currentAdminId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Newest ⇄ Oldest sort (item #10) — client-side since this table has no
  // server-driven pagination to push a `sort` query param through.
  const [sortDir, setSortDir] = useState<"newest" | "oldest">("newest");
  const sortedUsers = useMemo(
    () =>
      [...users].sort((a, b) =>
        sortDir === "newest" ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt),
      ),
    [users, sortDir],
  );

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<CreateUserInput["role"]>("supplier");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("TempPass1234!");
  const [venueIds, setVenueIds] = useState<string[]>([]);
  const [preferredMerchandiseType, setPreferredMerchandiseType] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // No incomplete user records (item #12) — block Create until every
  // required field is present (phone only required for supplier accounts).
  const canSubmit =
    !!email.trim() &&
    !!name.trim() &&
    !!password.trim() &&
    (role !== "supplier" || !!phone.trim()) &&
    !pending;

  // Edit-user modal state.
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [eName, setEName] = useState("");
  const [eRole, setERole] = useState<CreateUserInput["role"]>("supplier");
  const [ePhone, setEPhone] = useState("");
  const [eVenueIds, setEVenueIds] = useState<string[]>([]);
  const [ePreferredMerchandiseType, setEPreferredMerchandiseType] = useState("");
  const [eError, setEError] = useState<string | null>(null);

  function toggleVenue(id: string) {
    setVenueIds((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  }

  function toggleEVenue(id: string) {
    setEVenueIds((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  }

  function openEdit(u: UserRow) {
    setEditing(u);
    setEName(u.name);
    setERole(u.role as CreateUserInput["role"]);
    setEPhone(u.phone);
    setEVenueIds(u.venueIds);
    setEPreferredMerchandiseType(u.preferredMerchandiseType);
    setEError(null);
  }

  function saveEdit() {
    if (!editing) return;
    setEError(null);
    startTransition(async () => {
      const res = await updateUserAction({
        userId: editing.id,
        name: eName,
        role: eRole,
        otpChannel: "email",
        phone: ePhone,
        venueIds: eVenueIds,
        preferredMerchandiseType: ePreferredMerchandiseType,
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
      const res = await createUserAction({
        email,
        name,
        role,
        otpChannel: "email",
        phone,
        password,
        venueIds,
        preferredMerchandiseType,
      });
      if (res.ok) {
        setOk(email);
        setEmail("");
        setName("");
        setPhone("");
        setVenueIds([]);
        setPreferredMerchandiseType("");
        router.refresh();
      } else {
        setError(res.error ?? "Error");
      }
    });
  }

  function toggleStatus(u: UserRow) {
    const next = u.status === "active" ? "deactivated" : "active";
    startTransition(async () => {
      await setUserStatusAction(u.id, next);
      router.refresh();
    });
  }

  function resetPw(u: UserRow) {
    const min = u.role === "supplier" ? 8 : 12;
    const pw = window.prompt(`${t.tempPassword} (≥ ${min})`, "TempPass1234!");
    if (!pw) return;
    startTransition(async () => {
      const res = await resetUserPasswordAction(u.id, pw);
      if (!res.ok) setError(res.error ?? "Error");
      else router.refresh();
    });
  }

  const roleLabel = (r: string) =>
    r === "admin" ? t.roleAdmin : r === "vlm" ? t.roleVlm : r === "viewer" ? t.roleViewer : t.roleSupplierShort;
  const statusLabel = (s: string) =>
    s === "active" ? t.statusActive : s === "locked" ? t.statusLocked : t.statusDeactivated;

  return (
    <div className="admin-split">
      {/* Create user */}
      <div style={card}>
        <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>{t.newUser}</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div><label style={labelS}>{t.name} <RequiredMark t={t} /></label><input value={name} onChange={(e) => setName(e.target.value)} style={control} /></div>
          <div><label style={labelS}>{t.email} <RequiredMark t={t} /></label><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" style={control} /></div>
          <div>
            <label style={labelS}>
              {t.phone} {role === "supplier" ? <RequiredMark t={t} /> : <span style={{ color: "#9AA7B2" }}>{t.optional}</span>}
            </label>
            <PhoneInput value={phone} onChange={setPhone} />
          </div>
          <div>
            <label style={labelS}>{t.role}</label>
            <select value={role} onChange={(e) => setRole(e.target.value as CreateUserInput["role"])} style={control}>
              <option value="supplier">{t.roleSupplierShort}</option>
              <option value="vlm">{t.roleVlm}</option>
              <option value="viewer">{t.roleViewer}</option>
              <option value="admin">{t.roleAdmin}</option>
            </select>
          </div>
          {role === "supplier" && (
            <div>
              <label style={labelS}>{t.defaultMerchType} <span style={{ color: "#9AA7B2" }}>{t.optional}</span></label>
              <select value={preferredMerchandiseType} onChange={(e) => setPreferredMerchandiseType(e.target.value)} style={control}>
                <option value="">—</option>
                {merchTypes.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              <p style={{ fontSize: 10.5, color: "#5A6B7C", marginTop: 4 }}>{t.defaultMerchTypeNote}</p>
            </div>
          )}
          {(role === "vlm" || role === "viewer") && (
            <div>
              <label style={labelS}>{t.assignedVenues}</label>
              <div style={{ maxHeight: 150, overflowY: "auto", border: "1px solid #E3E9EF", borderRadius: 7, padding: 8 }}>
                {venues.map((v) => (
                  <label key={v.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, padding: "3px 0" }}>
                    <input type="checkbox" checked={venueIds.includes(v.id)} onChange={() => toggleVenue(v.id)} />
                    {v.name} <span className="mono" style={{ color: "#5A6B7C" }}>{v.siteCode}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <label style={labelS}>{t.tempPassword} <RequiredMark t={t} /></label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} style={control} />
          </div>
          {error && <p style={{ color: "var(--st-cancelled-text)", fontSize: 12 }}>{error}</p>}
          {ok && <p style={{ color: "var(--st-confirmed-text)", fontSize: 12 }}>✓ {ok}</p>}
          <button type="button" disabled={!canSubmit} onClick={submit} style={{ height: 40, borderRadius: 7, border: "none", background: canSubmit ? "var(--blue)" : "#B6C0C9", color: "#fff", fontWeight: 700, fontSize: 13 }}>
            {t.create}
          </button>
        </div>
      </div>

      {/* Users table */}
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
              <th style={th}>{t.email}</th>
              <th style={th}>{t.role}</th>
              <th style={th}>{t.assignedVenues}</th>
              <th style={th}>{t.colStatus}</th>
              <th style={th}>{t.colActions}</th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((u) => (
              <tr key={u.id} style={{ opacity: u.status === "deactivated" ? 0.6 : 1 }}>
                <td style={td}>{u.name}</td>
                <td style={{ ...td, fontFamily: "var(--font-mono)", fontSize: 11.5 }}>{u.email}</td>
                <td style={td}>{roleLabel(u.role)}</td>
                <td style={{ ...td, fontFamily: "var(--font-mono)", fontSize: 11 }}>{u.venues.join(", ") || "—"}</td>
                <td style={td}>{statusLabel(u.status)}</td>
                <td style={td}>
                  {u.id === currentAdminId ? (
                    <span style={{ color: "#9AA7B2" }}>—</span>
                  ) : (
                    <div style={{ display: "flex", gap: 12 }}>
                      <button type="button" disabled={pending} onClick={() => openEdit(u)} style={{ background: "none", border: "none", color: "var(--blue)", fontWeight: 600, fontSize: 12 }}>
                        {t.edit}
                      </button>
                      <button type="button" disabled={pending} onClick={() => resetPw(u)} style={{ background: "none", border: "none", color: "var(--blue)", fontWeight: 600, fontSize: 12 }}>
                        {t.resetPassword}
                      </button>
                      <button type="button" disabled={pending} onClick={() => toggleStatus(u)} style={{ background: "none", border: "none", color: u.status === "active" ? "#B3261E" : "var(--st-confirmed-text)", fontWeight: 600, fontSize: 12 }}>
                        {u.status === "active" ? t.deactivate : t.reactivate}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Edit user modal */}
      {editing && (
        <div
          onClick={() => setEditing(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,32,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ ...card, width: 420, maxWidth: "92vw", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{t.editUser}</h2>
            <p style={{ fontSize: 11.5, color: "#5A6B7C", fontFamily: "var(--font-mono)", marginBottom: 14 }}>{editing.email}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label style={labelS}>{t.name}</label><input value={eName} onChange={(e) => setEName(e.target.value)} style={control} /></div>
              <div>
                <label style={labelS}>{t.role}</label>
                <select value={eRole} onChange={(e) => setERole(e.target.value as CreateUserInput["role"])} style={control}>
                  <option value="supplier">{t.roleSupplierShort}</option>
                  <option value="vlm">{t.roleVlm}</option>
                  <option value="viewer">{t.roleViewer}</option>
                  <option value="admin">{t.roleAdmin}</option>
                </select>
              </div>
              {eRole === "supplier" && (
                <div>
                  <label style={labelS}>{t.defaultMerchType} <span style={{ color: "#9AA7B2" }}>{t.optional}</span></label>
                  <select value={ePreferredMerchandiseType} onChange={(e) => setEPreferredMerchandiseType(e.target.value)} style={control}>
                    <option value="">—</option>
                    {merchTypes.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                  <p style={{ fontSize: 10.5, color: "#5A6B7C", marginTop: 4 }}>{t.defaultMerchTypeNote}</p>
                </div>
              )}
              {(eRole === "vlm" || eRole === "viewer") && (
                <div>
                  <label style={labelS}>{t.assignedVenues}</label>
                  <div style={{ maxHeight: 150, overflowY: "auto", border: "1px solid #E3E9EF", borderRadius: 7, padding: 8 }}>
                    {venues.map((v) => (
                      <label key={v.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, padding: "3px 0" }}>
                        <input type="checkbox" checked={eVenueIds.includes(v.id)} onChange={() => toggleEVenue(v.id)} />
                        {v.name} <span className="mono" style={{ color: "#5A6B7C" }}>{v.siteCode}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label style={labelS}>
                  {t.phone} {eRole === "supplier" ? <RequiredMark t={t} /> : <span style={{ color: "#9AA7B2" }}>{t.optional}</span>}
                </label>
                <PhoneInput value={ePhone} onChange={setEPhone} />
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
