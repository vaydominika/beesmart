"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { useRouter } from "next/navigation";
import en from "@/messages/en.json";
import hu from "@/messages/hu.json";
import { localeCookie, type Locale } from "@/i18n/config";

const LanguageContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
} | null>(null);

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}

export function LanguageProvider({ children, initialLocale }: { children: ReactNode; initialLocale: Locale }) {
  const router = useRouter();
  return (
    <LanguageStateProvider initialLocale={initialLocale} refresh={router.refresh}>
      {children}
    </LanguageStateProvider>
  );
}

export function LanguageStateProvider({ children, initialLocale, refresh }: {
  children: ReactNode;
  initialLocale: Locale;
  refresh?: () => void;
}) {
  const [locale, updateLocale] = useState(initialLocale);
  const currentLocale = useRef(initialLocale);
  const setLocale = useCallback((next: Locale) => {
    document.cookie = `${localeCookie}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    const changed = next !== currentLocale.current;
    currentLocale.current = next;
    updateLocale(next);
    if (changed) refresh?.();
  }, [refresh]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return (
    <LanguageContext.Provider value={value}>
      <NextIntlClientProvider locale={locale} messages={locale === "hu" ? hu : en} timeZone="Europe/Budapest">
        {children}
      </NextIntlClientProvider>
    </LanguageContext.Provider>
  );
}
