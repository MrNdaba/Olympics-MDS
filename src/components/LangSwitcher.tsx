"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Lang } from "@/lib/i18n";
import { setLanguage } from "@/lib/session-actions";

// Toggling swaps the whole UI dictionary live by setting a cookie and
// refreshing the server components (French default, spec §18).
export function LangSwitcher({ lang }: { lang: Lang }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function set(next: Lang) {
    if (next === lang) return;
    startTransition(async () => {
      await setLanguage(next);
      router.refresh();
    });
  }

  const seg = (value: Lang, label: string) => {
    const active = lang === value;
    return (
      <button
        type="button"
        onClick={() => set(value)}
        disabled={pending}
        style={{
          padding: "5px 11px",
          fontWeight: 600,
          fontSize: 11.5,
          border: "1px solid #DDE4EA",
          background: active ? "var(--blue)" : "#fff",
          color: active ? "#fff" : "var(--text-secondary)",
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div style={{ display: "inline-flex", borderRadius: 6, overflow: "hidden" }}>
      {seg("fr", "FR")}
      {seg("en", "EN")}
    </div>
  );
}
