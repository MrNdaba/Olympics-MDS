"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { destroySession } from "@/lib/auth";
import type { Lang } from "@/lib/i18n";

export async function setLanguage(lang: Lang) {
  const store = await cookies();
  store.set("mds_lang", lang, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
