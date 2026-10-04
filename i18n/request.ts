import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { localeCookie, resolveLocale } from "./config";
export default getRequestConfig(async () => {
  const locale = resolveLocale((await cookies()).get(localeCookie)?.value);
  return { locale, timeZone: "Europe/Budapest", messages: (await import(`../messages/${locale}.json`)).default };
});
