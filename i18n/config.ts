export const locales = ["en", "hu"] as const;
export type Locale = (typeof locales)[number];
export const localeCookie = "beesmart-locale";
export function isLocale(value: unknown): value is Locale { return value === "en" || value === "hu"; }
export function resolveLocale(value: unknown): Locale { return isLocale(value) ? value : "en"; }
export function requestLocale(headers: Headers): Locale {
  const cookie = headers.get("cookie")?.split(";").map(value => value.trim()).find(value => value.startsWith(`${localeCookie}=`));
  return resolveLocale(cookie?.slice(localeCookie.length + 1));
}
