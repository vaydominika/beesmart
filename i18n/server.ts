import { getTranslations } from "next-intl/server";
import { createTextTranslator } from "./text";
export async function getText() { return createTextTranslator(await getTranslations("UI")); }
