import { redirect } from "next/navigation";
import Image from "next/image";
import { getSessionUser } from "@/lib/auth";
import { getTranslations } from "@/lib/lang";
import { LangSwitcher } from "@/components/LangSwitcher";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/");
  const { lang, t } = await getTranslations();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-canvas)",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: 1060,
          maxWidth: "100%",
          minHeight: 660,
          background: "#fff",
          borderRadius: 14,
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "460px 1fr",
          boxShadow: "0 24px 60px rgba(18,32,46,.16)",
        }}
      >
        {/* Left brand panel */}
        <aside
          style={{
            background: "var(--blue)",
            padding: 40,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            color: "#fff",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 10,
              padding: "18px 20px",
              width: 196,
            }}
          >
            <Image src="/dakar2026-logo.png" alt="Dakar 2026" width={156} height={64} style={{ width: "100%", height: "auto" }} priority />
          </div>
          <div>
            <h1 style={{ fontWeight: 800, fontSize: 30, lineHeight: 1.15, marginBottom: 14 }}>
              Master Delivery System
            </h1>
            <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "rgba(255,255,255,.85)" }}>
              {t.loginTagline}
            </p>
          </div>
          <div>
            <div style={{ display: "flex", gap: 3, marginBottom: 10 }}>
              {["#FCD116", "#00A651", "#E31B23", "rgba(255,255,255,.4)", "rgba(255,255,255,.18)"].map(
                (c, i) => (
                  <span key={i} style={{ width: 9, height: 9, background: c, display: "inline-block" }} />
                ),
              )}
            </div>
            <p
              className="mono"
              style={{
                fontSize: 10.5,
                fontWeight: 500,
                letterSpacing: ".06em",
                color: "rgba(255,255,255,.65)",
              }}
            >
              DAKAR · DIAMNIADIO · SALY — 28 OCT → 13 NOV 2026
            </p>
          </div>
        </aside>

        {/* Right form column */}
        <section style={{ padding: "40px 48px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <LangSwitcher lang={lang} />
          </div>
          <div style={{ margin: "auto", width: "100%", maxWidth: 360 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{t.loginTitle}</h2>
            <p style={{ fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 22 }}>
              {t.loginSub}
            </p>
            <LoginForm t={t} />
          </div>
          <p style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", marginTop: 20 }}>
            {t.loginFooter}
          </p>
        </section>
      </div>
    </div>
  );
}
