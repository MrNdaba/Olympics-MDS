"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Dict, Lang } from "@/lib/i18n";
import { translateMasterData } from "@/lib/i18n";
import { MASTER_DATA_CATEGORIES, type MasterDataCategory } from "@/lib/constants";
import { createMasterDataAction, setMasterDataActiveAction } from "@/app/admin/actions";

export interface MasterDataRow {
  id: string;
  category: string;
  label: string;
  active: boolean;
}

const card: React.CSSProperties = { background: "#fff", border: "1px solid var(--border-card)", borderRadius: 10, overflow: "hidden" };
const th: React.CSSProperties = { fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: ".05em", color: "#5A6B7C", textAlign: "left", padding: "10px 14px" };
const td: React.CSSProperties = { padding: "10px 14px", fontSize: 12.5, borderTop: "1px solid #F0F3F6" };
const control: React.CSSProperties = { height: 36, borderRadius: 7, border: "1px solid #C7D1DA", padding: "0 10px", fontSize: 12.5, background: "#fff" };

const CATEGORY_KEY: Record<MasterDataCategory, keyof Dict> = {
  vehicleType: "vehicleTypes",
  merchandiseType: "merchandiseTypes",
  packagingType: "packagingTypes",
  loadUnit: "loadUnits",
};

export function MasterDataAdmin({ t, lang, rows }: { t: Dict; lang: Lang; rows: MasterDataRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [category, setCategory] = useState<MasterDataCategory>("vehicleType");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add() {
    setError(null);
    const value = label.trim();
    if (!value) return;
    startTransition(async () => {
      const res = await createMasterDataAction(category, value);
      if (res.ok) {
        setLabel("");
        router.refresh();
      } else {
        setError(res.error ?? "Error");
      }
    });
  }

  function toggle(row: MasterDataRow) {
    startTransition(async () => {
      await setMasterDataActiveAction(row.id, !row.active);
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Add entry */}
      <div style={{ ...card, padding: "16px 18px", display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <label style={{ fontWeight: 600, fontSize: 11, color: "#33475B", display: "block", marginBottom: 4 }}>{t.category}</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as MasterDataCategory)} style={{ ...control, minWidth: 200 }}>
            {MASTER_DATA_CATEGORIES.map((c) => (
              <option key={c} value={c}>{t[CATEGORY_KEY[c]]}</option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ fontWeight: 600, fontSize: 11, color: "#33475B", display: "block", marginBottom: 4 }}>{t.labelField}</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} style={{ ...control, width: "100%" }} />
        </div>
        <button type="button" disabled={pending} onClick={add} style={{ height: 36, padding: "0 18px", borderRadius: 7, border: "none", background: "var(--blue)", color: "#fff", fontWeight: 700, fontSize: 13 }}>
          {t.add}
        </button>
        {error && <p style={{ color: "var(--st-cancelled-text)", fontSize: 12, width: "100%", margin: 0 }}>{error}</p>}
      </div>

      {/* Grouped tables */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        {MASTER_DATA_CATEGORIES.map((cat) => {
          const items = rows.filter((r) => r.category === cat);
          return (
            <div key={cat} style={card}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #F0F3F6", background: "#F8FAFB" }}>
                <h2 style={{ fontWeight: 700, fontSize: 13.5 }}>{t[CATEGORY_KEY[cat]]}</h2>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={th}>{t.labelField}</th>
                    <th style={th}>{t.colStatus}</th>
                    <th style={{ ...th, textAlign: "right" }}>{t.colActions}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && (
                    <tr><td style={{ ...td, color: "#9AA7B2" }} colSpan={3}>{t.noEntries}</td></tr>
                  )}
                  {items.map((r) => (
                    <tr key={r.id} style={{ opacity: r.active ? 1 : 0.55 }}>
                      <td style={td}>{translateMasterData(r.label, lang)}</td>
                      <td style={td}>{r.active ? t.active : t.inactive}</td>
                      <td style={{ ...td, textAlign: "right" }}>
                        <button type="button" disabled={pending} onClick={() => toggle(r)} style={{ background: "none", border: "none", color: r.active ? "#B3261E" : "var(--st-confirmed-text)", fontWeight: 600, fontSize: 12 }}>
                          {r.active ? t.deactivate : t.activate}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
