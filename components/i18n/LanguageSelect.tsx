"use client";

import { useId } from "react";
import { useLanguage } from "./LanguageProvider";
import { useText } from "@/i18n/use-text";
import { type Locale } from "@/i18n/config";
import { WorkspaceSelect } from "@/components/ui/workspace-select";

const languageOptions = [
  { value: "en", label: "English" },
  { value: "hu", label: "Magyar" },
] as const;

export function LanguageSelect({ onChange }: { onChange?: (locale: Locale) => void }) {
  const id = useId();
  const { locale, setLocale } = useLanguage();
  const t = useText();
  return (
    <div className="flex items-center gap-3 text-sm text-[var(--app-text)]">
      <label htmlFor={id}>{t("Language")}</label>
      <WorkspaceSelect
        id={id}
        value={locale}
        options={languageOptions}
        onValueChange={onChange ?? setLocale}
        ariaLabel={t("Language")}
        align="end"
      />
    </div>
  );
}
