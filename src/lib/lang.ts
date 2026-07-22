import { cookies } from "next/headers";
import { DEFAULT_LANG, getDict, type Lang } from "./i18n";
import { LANG_COOKIE } from "./constants";

/** Resolve the active UI language from the cookie (French default, spec §18). */
export async function getLang(): Promise<Lang> {
  const store = await cookies();
  const value = store.get(LANG_COOKIE)?.value;
  return value === "en" ? "en" : DEFAULT_LANG;
}

export async function getTranslations() {
  const lang = await getLang();
  return { lang, t: getDict(lang) };
}
