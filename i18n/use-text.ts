"use client";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { createTextTranslator } from "./text";
import english from "@/messages/en.json";
export function useText() {
  const translate = useTranslations("UI");
  const sources = english.UI;
  return useMemo(() => createTextTranslator(translate, sources), [translate, sources]);
}
