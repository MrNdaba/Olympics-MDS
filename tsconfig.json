"use client";

export function PrintButton({ label, filled }: { label: string; filled?: boolean }) {
  return (
    <button
      type="button"
      className="no-print"
      onClick={() => window.print()}
      style={{
        border: filled ? "none" : "1px solid #C7D1DA",
        background: filled ? "var(--blue)" : "#fff",
        color: filled ? "#fff" : "#33475B",
        borderRadius: 7,
        padding: "8px 14px",
        fontSize: 12.5,
        fontWeight: 600,
      }}
    >
      ⎙ {label}
    </button>
  );
}
