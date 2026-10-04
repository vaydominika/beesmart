import { render as rtlRender, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { LanguageStateProvider } from "@/components/i18n/LanguageProvider";
export * from "@testing-library/react";
export function render(ui: ReactElement, options?: RenderOptions) {
  const Parent = options?.wrapper;
  function Wrapper({ children }: { children: ReactNode }) {
    return <LanguageStateProvider initialLocale="en">{Parent ? <Parent>{children}</Parent> : children}</LanguageStateProvider>;
  }
  return rtlRender(ui, { ...options, wrapper: Wrapper });
}
