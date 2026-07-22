"use client";

// Senegal phone input. A fixed "+221" country prefix is shown beside the field;
// the value is always stored with the prefix, e.g. "+221771234567". The local
// part is digit-only (Senegal national numbers are 9 digits).

const SENEGAL_CODE = "+221";

/** Strip the +221 prefix (and stray spaces) to show only the local digits. */
function localPart(value: string): string {
  const digits = (value || "").replace(/[^\d]/g, "");
  const national = digits.startsWith("221") ? digits.slice(3) : digits;
  return national;
}

/** Compose the stored value from local digits. Empty stays empty. */
export function composePhone(local: string): string {
  const digits = (local || "").replace(/[^\d]/g, "");
  return digits ? `${SENEGAL_CODE}${digits}` : "";
}

export function PhoneInput({
  value,
  onChange,
  disabled,
  style,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const local = localPart(value);
  return (
    <div style={{ display: "flex", alignItems: "stretch", ...style }}>
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "0 9px",
          height: 36,
          borderRadius: "7px 0 0 7px",
          border: "1px solid #C7D1DA",
          borderRight: "none",
          background: "#F4F6F8",
          color: "#33475B",
          fontSize: 12.5,
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        <span aria-hidden>🇸🇳</span> {SENEGAL_CODE}
      </span>
      <input
        value={local}
        disabled={disabled}
        inputMode="numeric"
        maxLength={9}
        placeholder="77 123 45 67"
        onChange={(e) => onChange(composePhone(e.target.value))}
        style={{
          height: 36,
          borderRadius: "0 7px 7px 0",
          border: "1px solid #C7D1DA",
          padding: "0 10px",
          fontSize: 12.5,
          width: "100%",
          background: "#fff",
        }}
      />
    </div>
  );
}
