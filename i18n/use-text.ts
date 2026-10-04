"use client";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { createTextTranslator } from "./text";
export function useText() {
  const translate = useTranslations("UI");
  return useMemo(() => createTextTranslator(translate), [translate]);
}
