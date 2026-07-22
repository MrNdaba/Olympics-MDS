"use client";

import { useActionState } from "react";
import { startLogin, type LoginState } from "./actions";
import type { Dict } from "@/lib/i18n";

const inputStyle: React.CSSProperties = {
  height: 40,
  border: "1px solid #C7D1DA",
  borderRadius: 7,
  padding: "0 12px",
  fontSize: 13,
  width: "100%",
};
const labelStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 11.5,
  color: "#33475B",
  display: "block",
  marginBottom: 5,
};

export function LoginForm({ t }: { t: Dict }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(startLogin, {});

  const errorText =
    state.error === "locked"
      ? t.password + " — 🔒"
      : state.error === "rate"
        ? t.rateLimited
        : state.error
          ? t.loginSub
          : null;

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={labelStyle} htmlFor="email">
          {t.email}
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" style={inputStyle} defaultValue="supplier@mds.dev" />
      </div>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <label style={labelStyle} htmlFor="password">
            {t.password}
          </label>
          <a href="#" style={{ fontWeight: 500, fontSize: 11.5, color: "var(--blue)" }}>
            {t.forgot}
          </a>
        </div>
        <input id="password" name="password" type="password" required autoComplete="current-password" style={inputStyle} defaultValue="Password1234!" />
      </div>

      {state.error && (
        <div
          role="alert"
          style={{
            background: "var(--st-cancelled-bg)",
            color: "var(--st-cancelled-text)",
            border: "1px solid #F3C9C9",
            borderRadius: 8,
            padding: "9px 12px",
            fontSize: 12,
          }}
        >
          {state.error === "locked" ? "🔒 " : ""}
          {errorText}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        style={{
          height: 44,
          background: "var(--blue)",
          color: "#fff",
          border: "none",
          borderRadius: 7,
          fontWeight: 700,
          fontSize: 13.5,
          opacity: pending ? 0.7 : 1,
        }}
      >
        {t.continueBtn}
      </button>

      <div
        style={{
          background: "#F4F8FB",
          border: "1px solid #DCEAF5",
          borderRadius: 8,
          padding: "11px 13px",
          display: "flex",
          gap: 10,
          alignItems: "flex-start",
        }}
      >
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "var(--blue)",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
            marginTop: 1,
          }}
        >
          2
        </span>
        <p style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.45 }}>{t.otpNote}</p>
      </div>
    </form>
  );
}
