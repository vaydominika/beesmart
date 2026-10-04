import { matchErrorMessage } from "./error-messages";
import english from "@/messages/en.json";
export type TextValues = Record<string, string | number | Date | null | undefined>;
export type TextTranslator = (source: string, values?: TextValues) => string;
// Source copy is kept at call sites during the migration of this existing app.
// Only interface copy belongs here; never pass user-authored titles or content.
export function createTextTranslator(translate: (key: string, values?: Record<string, string | number | Date>) => string, sources: Record<string, string> = english.UI): TextTranslator {
  const keys = new Map(Object.entries(sources).map(([key, source]) => [source, key]));
  return (source, values) => {
    const key = keys.get(source);
    if (key) return translate(key, values && Object.fromEntries(Object.entries(values).map(([name, value]) => [name, value === null || value === undefined ? String(value) : value])));
    const error = matchErrorMessage(source);
    const errorKey = error && keys.get(error.template);
    if (errorKey && error) return translate(errorKey, error.values);
    return source.replace(/\{(\w+)\}/g, (match, name: string) => String(values?.[name] ?? match));
  };
}
